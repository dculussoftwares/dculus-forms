# Part 4: Real-Time Collaboration (YJS/Hocuspocus)

**Document**: MongoDB to PostgreSQL Migration - Collaboration System  
**Last Updated**: November 17, 2025

---

## 🎯 Real-Time Collaboration System Overview

The Dculus Forms application uses **YJS (Yjs)** - a CRDT (Conflict-free Replicated Data Type) library - for real-time collaborative form editing. Multiple users can simultaneously edit the same form without conflicts.

---

## 📋 Table of Contents

1. [YJS Architecture](#yjs-architecture)
2. [Current MongoDB Implementation](#current-mongodb-implementation)
3. [PostgreSQL Migration Strategy](#postgresql-migration-strategy)
4. [Binary Data Handling](#binary-data-handling)
5. [Hocuspocus Server Integration](#hocuspocus-server-integration)
6. [Testing & Validation](#testing--validation)

---

## 🏗️ YJS Architecture

### What is YJS?

**YJS** is a CRDT library that enables real-time collaborative editing with:
- **Conflict-free merges** - Simultaneous edits automatically resolved
- **Offline support** - Changes synced when reconnected
- **Efficient updates** - Only changes transmitted, not full documents
- **Binary state** - Document state encoded as binary for efficiency

### How It Works in Dculus Forms

```
User A (Browser)          Hocuspocus Server          MongoDB/PostgreSQL          User B (Browser)
      │                          │                          │                          │
      ├─ Edit field ───────────>│                          │                          │
      │                          ├─ Broadcast update ──────┼────────────────────────>│
      │                          │                          │                          │
      │                          ├─ Store state ──────────>│                          │
      │                          │                        BYTEA                        │
      │                          │                          │                          │
      │<─────────────────────────┤<─ User B edits field ──┤<────────────────────────┤
      │                          │                          │                          │
```

### YJS Document Structure

Each form has a corresponding YJS document with this structure:

```typescript
YDoc {
  formSchema: Y.Map {
    pages: Y.Array [
      Y.Map {
        id: "page-1",
        title: "Page 1",
        order: 0,
        fields: Y.Array [
          Y.Map {
            id: "field-1",
            type: "text_input_field",
            label: "Name",
            defaultValue: "",
            // ... other field properties
          }
        ]
      }
    ],
    layout: Y.Map {
      theme: "light",
      code: "L1",
      spacing: "normal",
      // ... layout properties
    },
    isShuffleEnabled: false
  }
}
```

### State Encoding

YJS encodes the document state as binary:

```typescript
import * as Y from 'yjs';

const ydoc = new Y.Doc();
const formSchemaMap = ydoc.getMap('formSchema');

// ... populate document

// Encode as binary (Uint8Array)
const state = Y.encodeStateAsUpdate(ydoc);

// State is stored in database as Buffer/BYTEA
await saveToDatabase(formId, Buffer.from(state));
```

---

## 🔄 Current MongoDB Implementation

### CollaborativeDocument Schema

```prisma
model CollaborativeDocument {
  id           String   @id @map("_id")
  documentName String   @unique  // = formId
  state        Bytes             // Binary YJS state
  updatedAt    DateTime @updatedAt
}
```

### Hocuspocus MongoDB Extension

**File**: `apps/backend/src/services/hocuspocus.ts`

```typescript
import { Hocuspocus } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';

export const createHocuspocusServer = () => {
  return new Hocuspocus({
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          const document = await collaborativeDocumentRepository
            .fetchDocumentWithState(documentName);
          
          if (document && document.state) {
            // Return Uint8Array from Buffer
            return new Uint8Array(document.state);
          }
          
          return null;
        },
        
        store: async ({ documentName, state }) => {
          await collaborativeDocumentRepository.saveDocumentState(
            documentName,
            Buffer.from(state),
            (name) => `collab-${name}`
          );
        },
      }),
    ],
    
    onAuthenticate: async ({ documentName, token }) => {
      // Validate user access to form
      const userAccess = await validateUserAccess(token, documentName);
      return { user: userAccess.user };
    },
    
    onChange: async ({ documentName, document }) => {
      // Debounced metadata updates
      scheduleMetadataUpdate(documentName, document);
    },
  });
};
```

### MongoDB Repository

```typescript
export const collaborativeDocumentRepository = {
  fetchDocumentWithState: async (documentName: string) => {
    return prisma.collaborativeDocument.findUnique({
      where: { documentName },
      select: { state: true, id: true, updatedAt: true },
    });
  },
  
  saveDocumentState: async (
    documentName: string,
    state: Buffer,
    idFactory: (name: string) => string
  ) => {
    const existing = await prisma.collaborativeDocument.findUnique({
      where: { documentName },
    });
    
    if (existing) {
      return prisma.collaborativeDocument.update({
        where: { documentName },
        data: { state, updatedAt: new Date() },
      });
    }
    
    return prisma.collaborativeDocument.create({
      data: {
        id: idFactory(documentName),
        documentName,
        state,
      },
    });
  },
};
```

### Reading YJS Documents from Database

```typescript
export const getFormSchemaFromHocuspocus = async (
  formId: string
): Promise<FormSchema | null> => {
  const collabDoc = await collaborativeDocumentRepository
    .fetchDocumentWithState(formId);
  
  if (!collabDoc || !collabDoc.state) {
    return null;
  }
  
  // Reconstruct YJS document from binary state
  const Y = await import('yjs');
  const doc = new Y.Doc();
  
  // Apply stored state
  Y.applyUpdate(doc, new Uint8Array(collabDoc.state));
  
  // Extract formSchema
  const formSchemaMap = doc.getMap('formSchema');
  
  // Convert YJS structures to plain objects
  const formSchema = reconstructFormSchema(formSchemaMap);
  
  doc.destroy();
  
  return formSchema;
};
```

---

## 🎯 PostgreSQL Migration Strategy

### Target Schema

```sql
CREATE TABLE collaborative_document (
  id            TEXT PRIMARY KEY,
  document_name TEXT UNIQUE NOT NULL,
  state         BYTEA NOT NULL,           -- Binary YJS state
  updated_at    TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX idx_collab_doc_name ON collaborative_document(document_name);
CREATE INDEX idx_collab_doc_updated ON collaborative_document(updated_at DESC);
```

### Key Differences: Bytes vs BYTEA

| Aspect | MongoDB (Bytes) | PostgreSQL (BYTEA) |
|--------|-----------------|-------------------|
| Type | Binary data | Binary data |
| Max Size | 16 MB (default) | 1 GB (practical limit) |
| Storage | Raw binary | Hex-encoded or escaped |
| Retrieval | Direct Buffer | Buffer via Node.js driver |
| Indexing | Not applicable | Can't index binary data |
| Performance | Good | Excellent |

### Migration Process

#### Step 1: Data Export from MongoDB

```typescript
async function exportYJSDocuments(): Promise<YJSDocument[]> {
  const documents = await prisma.collaborativeDocument.findMany({
    select: {
      id: true,
      documentName: true,
      state: true,
      updatedAt: true,
    },
  });
  
  return documents.map(doc => ({
    id: doc.id,
    documentName: doc.documentName,
    state: doc.state,  // Already a Buffer
    updatedAt: doc.updatedAt,
  }));
}
```

#### Step 2: Validate Binary Integrity

```typescript
async function validateYJSDocument(
  formId: string,
  state: Buffer
): Promise<boolean> {
  try {
    const Y = await import('yjs');
    const doc = new Y.Doc();
    
    // Try to apply the state
    Y.applyUpdate(doc, new Uint8Array(state));
    
    // Verify document structure
    const formSchemaMap = doc.getMap('formSchema');
    if (!formSchemaMap) {
      console.error(`Invalid YJS document structure for ${formId}`);
      return false;
    }
    
    // Check for required fields
    const pages = formSchemaMap.get('pages');
    const layout = formSchemaMap.get('layout');
    
    if (!pages || !layout) {
      console.error(`Missing required fields in YJS document ${formId}`);
      return false;
    }
    
    doc.destroy();
    return true;
  } catch (error) {
    console.error(`YJS document validation failed for ${formId}:`, error);
    return false;
  }
}
```

#### Step 3: Import to PostgreSQL

```typescript
async function importYJSDocuments(
  documents: YJSDocument[]
): Promise<void> {
  const pgPrisma = new PrismaClient({
    datasources: {
      db: { url: process.env.POSTGRESQL_DATABASE_URL },
    },
  });
  
  for (const doc of documents) {
    // Validate before import
    const isValid = await validateYJSDocument(
      doc.documentName,
      doc.state
    );
    
    if (!isValid) {
      console.error(`Skipping invalid document: ${doc.documentName}`);
      continue;
    }
    
    // Import to PostgreSQL
    await pgPrisma.collaborativeDocument.create({
      data: {
        id: doc.id,
        documentName: doc.documentName,
        state: doc.state,  // Prisma handles Buffer → BYTEA
        updatedAt: doc.updatedAt,
      },
    });
    
    console.log(`✅ Imported YJS document: ${doc.documentName}`);
  }
  
  await pgPrisma.$disconnect();
}
```

#### Step 4: Byte-Level Comparison

```typescript
async function compareYJSDocuments(formId: string): Promise<boolean> {
  const mongoPrisma = new PrismaClient({
    datasources: {
      db: { url: process.env.MONGODB_DATABASE_URL },
    },
  });
  
  const pgPrisma = new PrismaClient({
    datasources: {
      db: { url: process.env.POSTGRESQL_DATABASE_URL },
    },
  });
  
  const mongoDoc = await mongoPrisma.collaborativeDocument.findUnique({
    where: { documentName: formId },
  });
  
  const pgDoc = await pgPrisma.collaborativeDocument.findUnique({
    where: { documentName: formId },
  });
  
  if (!mongoDoc || !pgDoc) {
    console.error(`Document not found in one or both databases: ${formId}`);
    return false;
  }
  
  // Byte-by-byte comparison
  const mongoBuffer = Buffer.from(mongoDoc.state);
  const pgBuffer = Buffer.from(pgDoc.state);
  
  if (mongoBuffer.length !== pgBuffer.length) {
    console.error(`Buffer length mismatch for ${formId}`);
    return false;
  }
  
  const isEqual = mongoBuffer.equals(pgBuffer);
  
  if (!isEqual) {
    console.error(`Binary content mismatch for ${formId}`);
    return false;
  }
  
  console.log(`✅ YJS document ${formId} matches byte-for-byte`);
  
  await mongoPrisma.$disconnect();
  await pgPrisma.$disconnect();
  
  return true;
}
```

---

## 🔧 Binary Data Handling

### Buffer to BYTEA Conversion

PostgreSQL's `BYTEA` type automatically handles Buffer objects:

```typescript
// Writing to PostgreSQL
const state: Buffer = /* YJS state */;

await prisma.collaborativeDocument.create({
  data: {
    id: 'collab-123',
    documentName: 'form-456',
    state: state,  // Prisma automatically converts Buffer to BYTEA
    updatedAt: new Date(),
  },
});

// Reading from PostgreSQL
const doc = await prisma.collaborativeDocument.findUnique({
  where: { documentName: 'form-456' },
});

// doc.state is automatically a Buffer
const yjsState = new Uint8Array(doc.state);
```

### Size Considerations

```typescript
async function checkDocumentSizes(): Promise<void> {
  const documents = await prisma.collaborativeDocument.findMany({
    select: {
      documentName: true,
      state: true,
    },
  });
  
  const stats = {
    total: documents.length,
    sizes: [] as number[],
    totalSize: 0,
  };
  
  for (const doc of documents) {
    const size = Buffer.from(doc.state).length;
    stats.sizes.push(size);
    stats.totalSize += size;
  }
  
  stats.sizes.sort((a, b) => a - b);
  
  console.log('YJS Document Size Statistics:');
  console.log(`Total documents: ${stats.total}`);
  console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Average size: ${(stats.totalSize / stats.total / 1024).toFixed(2)} KB`);
  console.log(`Median size: ${(stats.sizes[Math.floor(stats.total / 2)] / 1024).toFixed(2)} KB`);
  console.log(`Largest: ${(stats.sizes[stats.total - 1] / 1024).toFixed(2)} KB`);
  console.log(`Smallest: ${(stats.sizes[0] / 1024).toFixed(2)} KB`);
}
```

---

## 🌐 Hocuspocus Server Integration

### WebSocket Connection Flow

```
Client                    Hocuspocus                 PostgreSQL
  │                            │                          │
  ├─ Connect (WS) ───────────>│                          │
  │                            ├─ Authenticate ─────────>│
  │                            │  (validate user access)  │
  │                            │                          │
  │                            ├─ Fetch document ───────>│
  │<─ Send initial state ──────┤<─ Return BYTEA state ───┤
  │                            │                          │
  ├─ Send update ─────────────>│                          │
  │                            ├─ Broadcast to others    │
  │                            ├─ Debounced store ──────>│
  │                            │                          │
  │<─ Receive update ──────────┤                          │
```

### No Code Changes Required

The Hocuspocus integration remains **identical** for PostgreSQL:

```typescript
// Same code works for both MongoDB and PostgreSQL
const server = new Hocuspocus({
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        // Repository abstraction handles database differences
        const document = await collaborativeDocumentRepository
          .fetchDocumentWithState(documentName);
        
        return document?.state ? new Uint8Array(document.state) : null;
      },
      
      store: async ({ documentName, state }) => {
        await collaborativeDocumentRepository.saveDocumentState(
          documentName,
          Buffer.from(state),
          (name) => `collab-${name}`
        );
      },
    }),
  ],
});
```

### Authentication Integration

```typescript
onAuthenticate: async ({ documentName, token, requestHeaders }) => {
  // Extract token from various sources
  const authToken = 
    token || 
    requestHeaders?.get?.('authorization')?.replace('Bearer ', '') ||
    null;
  
  if (!authToken) {
    throw new Error('No authentication token provided');
  }
  
  // Validate session with better-auth
  const sessionData = await auth.api.getSession({
    headers: new Headers({ authorization: `Bearer ${authToken}` }),
  });
  
  if (!sessionData?.user) {
    throw new Error('Invalid or expired session');
  }
  
  // Check form access permissions
  const formId = documentName;
  const accessCheck = await checkFormAccess(
    sessionData.user.id,
    formId,
    PermissionLevel.VIEWER
  );
  
  if (!accessCheck.hasAccess) {
    throw new Error('Access denied: Insufficient permissions');
  }
  
  return {
    user: {
      id: sessionData.user.id,
      email: sessionData.user.email,
      permission: accessCheck.permission,
    },
  };
},
```

---

## 🧪 Testing & Validation

### Unit Tests for Binary Data

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

describe('YJS Binary Migration', () => {
  it('should preserve binary state across databases', async () => {
    // Create test YJS document
    const ydoc = new Y.Doc();
    const formSchemaMap = ydoc.getMap('formSchema');
    
    const pagesArray = new Y.Array();
    const pageMap = new Y.Map();
    pageMap.set('id', 'page-1');
    pageMap.set('title', 'Test Page');
    pageMap.set('order', 0);
    pagesArray.push([pageMap]);
    
    formSchemaMap.set('pages', pagesArray);
    
    // Encode to binary
    const originalState = Y.encodeStateAsUpdate(ydoc);
    const buffer = Buffer.from(originalState);
    
    // Simulate MongoDB storage
    await mongoCollaborativeDocRepo.save('test-form', buffer);
    
    // Migrate to PostgreSQL
    const mongoDoc = await mongoCollaborativeDocRepo.fetch('test-form');
    await pgCollaborativeDocRepo.save('test-form', mongoDoc.state);
    
    // Retrieve from PostgreSQL
    const pgDoc = await pgCollaborativeDocRepo.fetch('test-form');
    
    // Compare buffers
    expect(Buffer.from(mongoDoc.state).equals(Buffer.from(pgDoc.state))).toBe(true);
    
    // Verify document can be reconstructed
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, new Uint8Array(pgDoc.state));
    
    const restoredMap = restoredDoc.getMap('formSchema');
    const restoredPages = restoredMap.get('pages');
    
    expect(restoredPages).toBeDefined();
    expect(restoredPages.length).toBe(1);
  });
});
```

### Integration Tests for Collaboration

```typescript
describe('Real-time Collaboration', () => {
  it('should sync updates across multiple clients', async () => {
    const formId = 'test-form-123';
    
    // Create two WebSocket connections
    const client1 = await connectToHocuspocus(formId, user1Token);
    const client2 = await connectToHocuspocus(formId, user2Token);
    
    // Client 1 makes an edit
    const update = createYJSUpdate({
      pageId: 'page-1',
      fieldId: 'field-1',
      label: 'Updated by Client 1',
    });
    
    client1.sendUpdate(update);
    
    // Wait for propagation
    await sleep(100);
    
    // Client 2 should receive the update
    const client2State = client2.getDocumentState();
    expect(client2State.pages[0].fields[0].label).toBe('Updated by Client 1');
    
    // Verify database persistence
    const dbDoc = await pgPrisma.collaborativeDocument.findUnique({
      where: { documentName: formId },
    });
    
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, new Uint8Array(dbDoc.state));
    
    const formSchemaMap = ydoc.getMap('formSchema');
    const pages = formSchemaMap.get('pages');
    const firstPage = pages.get(0);
    const fields = firstPage.get('fields');
    const firstField = fields.get(0);
    
    expect(firstField.get('label')).toBe('Updated by Client 1');
  });
});
```

### Performance Testing

```typescript
async function testCollaborationPerformance() {
  const formId = 'perf-test-form';
  const numClients = 10;
  const numUpdates = 100;
  
  // Connect multiple clients
  const clients = await Promise.all(
    Array.from({ length: numClients }, (_, i) =>
      connectToHocuspocus(formId, `user-${i}-token`)
    )
  );
  
  const startTime = performance.now();
  
  // Each client sends updates
  await Promise.all(
    clients.map((client, i) =>
      sendMultipleUpdates(client, numUpdates, `client-${i}`)
    )
  );
  
  // Wait for all updates to propagate
  await waitForSynchronization(clients);
  
  const duration = performance.now() - startTime;
  const totalUpdates = numClients * numUpdates;
  const avgLatency = duration / totalUpdates;
  
  console.log(`Performance Test Results:`);
  console.log(`Total updates: ${totalUpdates}`);
  console.log(`Total time: ${duration.toFixed(2)}ms`);
  console.log(`Average latency: ${avgLatency.toFixed(2)}ms per update`);
  console.log(`Throughput: ${(totalUpdates / (duration / 1000)).toFixed(2)} updates/sec`);
  
  // Cleanup
  await Promise.all(clients.map(c => c.disconnect()));
}
```

---

## ⚠️ Migration Risks & Mitigation

### Risk 1: Binary Corruption

**Risk**: YJS documents corrupted during migration  
**Impact**: Forms become uneditable  
**Probability**: Low  
**Severity**: Critical

**Mitigation**:
- ✅ Byte-level validation before and after migration
- ✅ Test document reconstruction
- ✅ Keep MongoDB backup for 2 weeks post-migration
- ✅ Rollback procedure ready

### Risk 2: Performance Degradation

**Risk**: PostgreSQL BYTEA slower than MongoDB Bytes  
**Impact**: Collaboration sync delays  
**Probability**: Very Low  
**Severity**: Medium

**Mitigation**:
- ✅ Benchmark both databases
- ✅ Monitor WebSocket latency
- ✅ Optimize connection pooling
- ✅ Use read replicas if needed

### Risk 3: Size Limit Exceeded

**Risk**: Document exceeds PostgreSQL BYTEA limits  
**Impact**: Save operations fail  
**Probability**: Very Low  
**Severity**: High

**Mitigation**:
- ✅ Analyze current document sizes
- ✅ Set alerts for large documents (> 10MB)
- ✅ Implement document compression if needed
- ✅ Archive old versions

---

## ✅ Migration Checklist

- [ ] Export all YJS documents from MongoDB
- [ ] Validate each document structure
- [ ] Check document sizes (none > 100MB)
- [ ] Import to PostgreSQL test environment
- [ ] Byte-level comparison for all documents
- [ ] Test document reconstruction
- [ ] Test real-time sync with PostgreSQL
- [ ] Performance benchmarks
- [ ] Load testing with multiple clients
- [ ] Rollback procedure tested
- [ ] Monitoring alerts configured
- [ ] Documentation updated

---

**Next Document**: [MIGRATION_PART_5_PHASE_PLAN.md](./MIGRATION_PART_5_PHASE_PLAN.md)
