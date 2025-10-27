# Phase 1 Implementation Guide: Foundation Setup

## Overview
This guide provides step-by-step instructions for implementing Phase 1 of the Collaborative Form Builder V2 migration. By the end of this phase, you'll have the core infrastructure ready for building the feature.

**Timeline:** 1 week  
**Priority:** Critical (blocks all other phases)

---

## Prerequisites

Before starting:
- [x] Read the [full migration plan](./COLLABORATIVE_FORM_BUILDER_V2_MIGRATION_PLAN.md)
- [x] Understand YJS/Hocuspocus collaboration architecture
- [x] Familiar with Zustand state management
- [x] Know Shadcn UI component patterns
- [x] Review `form-app` implementation

---

## Step 1: Install Dependencies

### 1.1 Navigate to form-app-v2
```bash
cd apps/form-app-v2
```

### 1.2 Install YJS and Collaboration Dependencies
```bash
pnpm add yjs@^13.6.18
pnpm add @hocuspocus/provider@^2.13.5
```

### 1.3 Install State Management
```bash
pnpm add zustand@^5.0.2
```

### 1.4 Install Drag & Drop
```bash
pnpm add @dnd-kit/core@^6.1.0
pnpm add @dnd-kit/sortable@^8.0.0
pnpm add @dnd-kit/utilities@^3.2.2
```

### 1.5 Verify Existing Dependencies
These should already be installed:
```bash
# Check package.json for:
# - @apollo/client
# - @dculus/types
# - @dculus/ui
# - @dculus/ui-v2
# - @dculus/utils
# - react-hook-form
# - zod
```

### 1.6 Rebuild
```bash
cd ../..
pnpm install
```

---

## Step 2: Create Store Structure

### 2.1 Create Store Directory
```bash
mkdir -p apps/form-app-v2/src/store
```

### 2.2 Create useFormBuilderStore.ts

**File:** `apps/form-app-v2/src/store/useFormBuilderStore.ts`

**Instructions:**
1. Copy from `apps/form-app/src/store/useFormBuilderStore.ts`
2. Update imports to use `import.meta.env` instead of `process.env`
3. Add JSDoc comments for all exported functions
4. Ensure TypeScript strict mode compliance

**Key Sections to Preserve:**
- YJS document initialization
- Hocuspocus provider setup
- Page/field CRUD operations
- Real-time sync observers
- Layout management

**Key Changes:**
```typescript
// OLD (V1)
const wsUrl = process.env.REACT_APP_WS_URL;

// NEW (V2)
const wsUrl = import.meta.env.VITE_WS_URL;
```

**Testing:**
```bash
# From repo root
pnpm --filter form-app-v2 type-check
```

### 2.3 Verify Store Exports

Ensure these functions are exported:
```typescript
export const useFormBuilderStore = create<FormBuilderState>()(...);

// Key methods:
// - initializeCollaboration(formId: string)
// - disconnectCollaboration()
// - addEmptyPage()
// - addField(pageId, fieldType, fieldData)
// - updateField(pageId, fieldId, updates)
// - removeField(pageId, fieldId)
// - reorderFields(pageId, oldIndex, newIndex)
// - updateLayout(layoutUpdates)
// - setSelectedPage(pageId)
// - setSelectedField(fieldId)
// etc.
```

---

## Step 3: Create Contexts

### 3.1 Create Contexts Directory
```bash
mkdir -p apps/form-app-v2/src/contexts
```

### 3.2 Create FormPermissionContext.tsx

**File:** `apps/form-app-v2/src/contexts/FormPermissionContext.tsx`

```typescript
import React, { createContext, useContext } from 'react';

export type PermissionLevel = 'VIEWER' | 'EDITOR' | 'OWNER';

interface FormPermissionContextValue {
  userPermission: PermissionLevel;
  canEdit: () => boolean;
  canEditLayout: () => boolean;
  canDelete: () => boolean;
  canShare: () => boolean;
}

const FormPermissionContext = createContext<FormPermissionContextValue | null>(null);

export const useFormPermissions = () => {
  const context = useContext(FormPermissionContext);
  if (!context) {
    throw new Error('useFormPermissions must be used within FormPermissionProvider');
  }
  return context;
};

interface FormPermissionProviderProps {
  userPermission: PermissionLevel;
  children: React.ReactNode;
}

export const FormPermissionProvider: React.FC<FormPermissionProviderProps> = ({
  userPermission,
  children,
}) => {
  const canEdit = () => userPermission === 'EDITOR' || userPermission === 'OWNER';
  const canEditLayout = () => userPermission === 'OWNER';
  const canDelete = () => userPermission === 'OWNER';
  const canShare = () => userPermission === 'OWNER';

  const value: FormPermissionContextValue = {
    userPermission,
    canEdit,
    canEditLayout,
    canDelete,
    canShare,
  };

  return (
    <FormPermissionContext.Provider value={value}>
      {children}
    </FormPermissionContext.Provider>
  );
};
```

**Testing:**
```bash
pnpm --filter form-app-v2 type-check
```

---

## Step 4: Create GraphQL Queries

### 4.1 Create GraphQL Directory
```bash
mkdir -p apps/form-app-v2/src/graphql
```

### 4.2 Create formBuilder.ts

**File:** `apps/form-app-v2/src/graphql/formBuilder.ts`

```typescript
import { gql } from '@apollo/client';

/**
 * Query to fetch form data for the builder
 */
export const GET_FORM_BY_ID = gql`
  query GetFormById($id: ID!) {
    form(id: $id) {
      id
      title
      shortUrl
      userPermission
      organization {
        id
        name
      }
      createdAt
      updatedAt
    }
  }
`;

/**
 * Mutation to update form title
 */
export const UPDATE_FORM_TITLE = gql`
  mutation UpdateFormTitle($id: ID!, $title: String!) {
    updateForm(id: $id, input: { title: $title }) {
      id
      title
    }
  }
`;
```

**Note:** Most updates will go through YJS, but we need basic queries for metadata.

---

## Step 5: Create Hooks

### 5.1 Create Hooks Directory
```bash
mkdir -p apps/form-app-v2/src/hooks
```

### 5.2 Create useDragAndDrop.ts

**File:** `apps/form-app-v2/src/hooks/useDragAndDrop.ts`

**Instructions:**
1. Copy from `apps/form-app/src/hooks/useDragAndDrop.ts`
2. Adapt type imports from `@dculus/types`
3. Update to use new store structure

**Key Functions:**
```typescript
export const useDragAndDrop = ({
  pages,
  onAddField,
  onReorderFields,
  onReorderPages,
  onMoveFieldBetweenPages,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<any>(null);

  const handleDragStart = (event: DragStartEvent) => { /* ... */ };
  const handleDragOver = (event: DragOverEvent) => { /* ... */ };
  const handleDragEnd = (event: DragEndEvent) => { /* ... */ };

  return {
    activeId,
    draggedItem,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
```

### 5.3 Create useCollisionDetection.ts

**File:** `apps/form-app-v2/src/hooks/useCollisionDetection.ts`

Copy from `form-app` and adapt as needed.

### 5.4 Create useFieldCreation.ts

**File:** `apps/form-app-v2/src/hooks/useFieldCreation.ts`

Factory function for creating field instances:

```typescript
import { generateId } from '@dculus/utils';
import {
  FieldType,
  TextInputField,
  EmailField,
  NumberField,
  // ... other field types
} from '@dculus/types';

export const useFieldCreation = () => {
  const createFieldData = (fieldType: FieldTypeConfig) => {
    const baseId = generateId();
    
    switch (fieldType.type) {
      case FieldType.TEXT_INPUT_FIELD:
        return new TextInputField({
          id: baseId,
          label: fieldType.label || 'Text Input',
        });
      // ... other cases
      default:
        throw new Error(`Unknown field type: ${fieldType.type}`);
    }
  };

  return { createFieldData };
};
```

---

## Step 6: Create Routing Structure

### 6.1 Create CollaborativeFormBuilder Page

**File:** `apps/form-app-v2/src/pages/CollaborativeFormBuilder.tsx`

**Initial Structure:**
```typescript
import React, { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { FormPermissionProvider } from '@/contexts/FormPermissionContext';
import { GET_FORM_BY_ID } from '@/graphql/formBuilder';

type BuilderTab = 'layout' | 'page-builder' | 'preview' | 'settings';

const CollaborativeFormBuilder: React.FC = () => {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  const {
    isConnected,
    isLoading,
    initializeCollaboration,
    disconnectCollaboration,
  } = useFormBuilderStore();

  // Validate and default tab
  const activeTab: BuilderTab = ['layout', 'page-builder', 'preview', 'settings'].includes(tab as any)
    ? (tab as BuilderTab)
    : 'page-builder';

  // Initialize collaboration
  useEffect(() => {
    if (!formId) return;

    initializeCollaboration(formId).catch(console.error);

    return () => {
      disconnectCollaboration();
    };
  }, [formId, initializeCollaboration, disconnectCollaboration]);

  // DnD setup
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  if (loading || isLoading) {
    return <div>Loading...</div>; // TODO: Use Skeleton from ui-v2
  }

  if (error) {
    return <div>Error: {error.message}</div>; // TODO: Use ErrorState component
  }

  const userPermission = data?.form?.userPermission || 'VIEWER';

  return (
    <FormPermissionProvider userPermission={userPermission}>
      <DndContext sensors={sensors}>
        <div className="min-h-screen bg-background">
          {/* Header - TODO: Phase 6 */}
          <div className="border-b p-4">
            <h1 className="text-2xl font-bold">{data?.form?.title}</h1>
          </div>

          {/* Tab Content - TODO: Phases 2-5 */}
          <div className="p-6">
            <p>Active Tab: {activeTab}</p>
            <p>Form ID: {formId}</p>
            <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
          </div>

          {/* Tab Navigation - TODO: Phase 6 */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
            <p className="text-sm text-muted-foreground">Tab Navigation Coming Soon</p>
          </div>
        </div>
      </DndContext>
    </FormPermissionProvider>
  );
};

export default CollaborativeFormBuilder;
```

### 6.2 Update App.tsx Routing

**File:** `apps/form-app-v2/src/App.tsx`

Add route:
```typescript
import CollaborativeFormBuilder from './pages/CollaborativeFormBuilder';

// In your Routes:
<Route
  path="/dashboard/form/:formId/collaborate/:tab"
  element={
    <ProtectedRoute>
      <CollaborativeFormBuilder />
    </ProtectedRoute>
  }
/>
```

---

## Step 7: Environment Configuration

### 7.1 Update .env File

**File:** `apps/form-app-v2/.env.local`

```bash
VITE_API_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/collaboration
VITE_CDN_ENDPOINT=http://localhost:4000/static-files
```

### 7.2 Verify Config in Store

Ensure `useFormBuilderStore` uses these variables:
```typescript
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/collaboration';
```

---

## Step 8: Testing Phase 1

### 8.1 Type Check
```bash
pnpm --filter form-app-v2 type-check
```

### 8.2 Start Development Server
```bash
# Terminal 1: Start backend
pnpm backend:dev

# Terminal 2: Start form-app-v2
pnpm form-app-v2:dev
```

### 8.3 Manual Testing Checklist

1. **Navigate to Builder:**
   - Go to `http://localhost:3001/dashboard`
   - Create or select a form
   - Click "Edit" button
   - URL should be: `/dashboard/form/{formId}/collaborate/page-builder`

2. **Verify Store Initialization:**
   - Open browser console
   - Check for YJS connection messages
   - Verify no errors

3. **Test Tab Navigation:**
   - Manually change URL tab parameter:
     - `/collaborate/layout`
     - `/collaborate/page-builder`
     - `/collaborate/preview`
     - `/collaborate/settings`
   - Verify tab changes in UI

4. **Test Multi-User Collaboration:**
   - Open form in two browser tabs
   - Watch for connection status
   - Both should show "Connected: Yes"

### 8.4 Unit Test Store

**File:** `apps/form-app-v2/src/store/__tests__/useFormBuilderStore.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useFormBuilderStore } from '../useFormBuilderStore';

describe('useFormBuilderStore', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useFormBuilderStore());
    
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.pages).toEqual([]);
  });

  it('should add a page', () => {
    const { result } = renderHook(() => useFormBuilderStore());
    
    act(() => {
      result.current.addEmptyPage();
    });
    
    expect(result.current.pages).toHaveLength(1);
  });

  // TODO: Add more tests
});
```

---

## Step 9: Documentation

### 9.1 Update README

Add section to `apps/form-app-v2/README.md`:

```markdown
## Collaborative Form Builder

Real-time collaborative form builder with drag-and-drop interface.

### Features
- Multi-user collaboration via YJS/Hocuspocus
- Drag-and-drop field creation
- Visual layout designer
- Live preview
- Form settings

### Routes
- `/dashboard/form/:formId/collaborate/layout` - Layout designer
- `/dashboard/form/:formId/collaborate/page-builder` - Form builder
- `/dashboard/form/:formId/collaborate/preview` - Live preview
- `/dashboard/form/:formId/collaborate/settings` - Form settings
```

### 9.2 Add JSDoc Comments

Ensure all exported functions have JSDoc:

```typescript
/**
 * Initializes collaboration for a form
 * @param formId - The ID of the form to edit
 * @returns Promise that resolves when connection is established
 */
initializeCollaboration: (formId: string) => Promise<void>;
```

---

## Step 10: Commit Changes

### 10.1 Git Commit Structure

```bash
git checkout -b feat/collaborative-builder-v2-phase1

git add apps/form-app-v2/package.json
git commit -m "feat: add YJS and DnD dependencies for collaborative builder"

git add apps/form-app-v2/src/store/
git commit -m "feat: create useFormBuilderStore with YJS integration"

git add apps/form-app-v2/src/contexts/
git commit -m "feat: add FormPermissionContext for access control"

git add apps/form-app-v2/src/graphql/
git commit -m "feat: add GraphQL queries for form builder"

git add apps/form-app-v2/src/hooks/
git commit -m "feat: add DnD and field creation hooks"

git add apps/form-app-v2/src/pages/CollaborativeFormBuilder.tsx
git add apps/form-app-v2/src/App.tsx
git commit -m "feat: create CollaborativeFormBuilder page with routing"

git add apps/form-app-v2/.env.local
git commit -m "chore: add environment variables for collaboration"

git add apps/form-app-v2/README.md
git commit -m "docs: update README with builder documentation"
```

### 10.2 Push and Create PR

```bash
git push origin feat/collaborative-builder-v2-phase1

# Create PR on GitHub:
# Title: "feat: Collaborative Form Builder V2 - Phase 1 Foundation"
# Description: See Phase 1 checklist in migration plan
```

---

## Validation Checklist ✅

Before moving to Phase 2, verify:

- [ ] All dependencies installed
- [ ] `useFormBuilderStore` created with YJS integration
- [ ] `FormPermissionContext` created
- [ ] GraphQL queries added
- [ ] DnD hooks created
- [ ] `CollaborativeFormBuilder` page created
- [ ] Routing configured in `App.tsx`
- [ ] Environment variables set
- [ ] Type checking passes
- [ ] Store unit test passes
- [ ] Manual testing completed (2 browser tabs)
- [ ] Documentation updated
- [ ] Git commits pushed
- [ ] PR created and reviewed

---

## Troubleshooting

### Issue: YJS Connection Fails
**Solution:**
- Verify backend is running on port 4000
- Check `VITE_WS_URL` environment variable
- Look for CORS errors in console
- Ensure WebSocket endpoint is correct

### Issue: TypeScript Errors
**Solution:**
- Run `pnpm install` from repo root
- Check `tsconfig.json` paths are correct
- Verify all imports use correct aliases (`@/` for local, `@dculus/` for packages)

### Issue: Store Not Updating
**Solution:**
- Check YJS observer setup
- Verify `updateFromYJS()` is called
- Use React DevTools to inspect Zustand state
- Add console logs to track updates

---

## Next Steps

After completing Phase 1:
1. Review and get PR merged
2. Start [Phase 2: Layout Tab Migration](./COLLABORATIVE_FORM_BUILDER_V2_MIGRATION_PLAN.md#phase-2-layout-tab-migration-🎨)
3. Continue iterative development

---

**Document Version:** 1.0  
**Created:** 2025-01-26  
**Estimated Time:** 1 week (40 hours)
