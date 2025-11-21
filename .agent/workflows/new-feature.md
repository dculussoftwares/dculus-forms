---
description: Adding new features to the codebase
---

# New Feature Development Workflow

This workflow guides you through adding new features to Dculus Forms.

## Planning Phase

### 1. Define Requirements

Document the feature requirements:
- **What**: What is the feature?
- **Why**: Why is it needed?
- **Who**: Who will use it?
- **How**: How will it work?

### 2. Design Decisions

Consider:
- **Database changes**: New tables, fields, or relations?
- **API changes**: New queries, mutations, or subscriptions?
- **UI changes**: New components or pages?
- **Breaking changes**: Will this affect existing functionality?

### 3. Create Feature Branch

```bash
git checkout -b feature/feature-name
```

## Implementation Phase

### Backend Changes

#### 1. Update Database Schema (if needed)

```prisma
// apps/backend/prisma/schema.prisma
model NewFeature {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // Relations
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
}
```

Generate and apply:
```bash
pnpm db:generate
pnpm db:push  # Development
# OR
cd apps/backend
npx prisma migrate dev --name add_new_feature  # Production
```

#### 2. Create Repository

```typescript
// apps/backend/src/repositories/NewFeatureRepository.ts
import { prisma } from '@/lib/prisma';
import type { Prisma, NewFeature } from '@prisma/client';

export class NewFeatureRepository {
  async create(data: Prisma.NewFeatureCreateInput): Promise<NewFeature> {
    return prisma.newFeature.create({ data });
  }

  async findById(id: string): Promise<NewFeature | null> {
    return prisma.newFeature.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<NewFeature[]> {
    return prisma.newFeature.findMany({ where: { userId } });
  }

  async update(
    id: string,
    data: Prisma.NewFeatureUpdateInput
  ): Promise<NewFeature> {
    return prisma.newFeature.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await prisma.newFeature.delete({ where: { id } });
  }
}
```

#### 3. Create Service

```typescript
// apps/backend/src/services/NewFeatureService.ts
import { NewFeatureRepository } from '@/repositories/NewFeatureRepository';
import type { NewFeature } from '@prisma/client';

export class NewFeatureService {
  private repository: NewFeatureRepository;

  constructor() {
    this.repository = new NewFeatureRepository();
  }

  async createFeature(
    name: string,
    userId: string
  ): Promise<NewFeature> {
    // Validation
    if (!name?.trim()) {
      throw new Error('Name is required');
    }

    // Business logic
    return this.repository.create({
      name,
      user: { connect: { id: userId } },
    });
  }

  async getFeature(id: string, userId: string): Promise<NewFeature> {
    const feature = await this.repository.findById(id);
    
    if (!feature) {
      throw new Error('Feature not found');
    }

    // Authorization check
    if (feature.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return feature;
  }

  async getUserFeatures(userId: string): Promise<NewFeature[]> {
    return this.repository.findByUserId(userId);
  }
}
```

#### 4. Create GraphQL Types

```typescript
// apps/backend/src/graphql/types/NewFeature.ts
export const NewFeatureTypeDef = `
  type NewFeature {
    id: ID!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
    user: User!
  }

  input CreateNewFeatureInput {
    name: String!
  }

  input UpdateNewFeatureInput {
    name: String
  }

  extend type Query {
    newFeature(id: ID!): NewFeature
    myNewFeatures: [NewFeature!]!
  }

  extend type Mutation {
    createNewFeature(input: CreateNewFeatureInput!): NewFeature!
    updateNewFeature(id: ID!, input: UpdateNewFeatureInput!): NewFeature!
    deleteNewFeature(id: ID!): Boolean!
  }
`;
```

#### 5. Create GraphQL Resolvers

```typescript
// apps/backend/src/graphql/resolvers/newFeature.ts
import { NewFeatureService } from '@/services/NewFeatureService';

const service = new NewFeatureService();

export const newFeatureResolvers = {
  Query: {
    newFeature: async (_parent, { id }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return service.getFeature(id, user.id);
    },
    myNewFeatures: async (_parent, _args, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return service.getUserFeatures(user.id);
    },
  },
  Mutation: {
    createNewFeature: async (_parent, { input }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return service.createFeature(input.name, user.id);
    },
    updateNewFeature: async (_parent, { id, input }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      // Implementation...
    },
    deleteNewFeature: async (_parent, { id }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      // Implementation...
      return true;
    },
  },
};
```

#### 6. Register Resolvers

```typescript
// apps/backend/src/graphql/schema.ts
import { newFeatureResolvers } from './resolvers/newFeature';
import { NewFeatureTypeDef } from './types/NewFeature';

// Add to typeDefs array
const typeDefs = [
  // ... existing types
  NewFeatureTypeDef,
];

// Merge resolvers
const resolvers = mergeResolvers([
  // ... existing resolvers
  newFeatureResolvers,
]);
```

### Frontend Changes

#### 1. Create GraphQL Operations

```typescript
// apps/form-app/src/graphql/newFeature.ts
import { gql } from '@apollo/client';

export const GET_NEW_FEATURES = gql`
  query GetNewFeatures {
    myNewFeatures {
      id
      name
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_NEW_FEATURE = gql`
  mutation CreateNewFeature($input: CreateNewFeatureInput!) {
    createNewFeature(input: $input) {
      id
      name
      createdAt
    }
  }
`;

export const UPDATE_NEW_FEATURE = gql`
  mutation UpdateNewFeature($id: ID!, $input: UpdateNewFeatureInput!) {
    updateNewFeature(id: $id, input: $input) {
      id
      name
      updatedAt
    }
  }
`;
```

#### 2. Create Component

```typescript
// apps/form-app/src/components/NewFeatureList.tsx
import { useQuery, useMutation } from '@apollo/client';
import { Button, Card, CardContent } from '@dculus/ui';
import { GET_NEW_FEATURES, CREATE_NEW_FEATURE } from '@/graphql/newFeature';

export function NewFeatureList() {
  const { data, loading, error, refetch } = useQuery(GET_NEW_FEATURES);
  const [createFeature, { loading: creating }] = useMutation(
    CREATE_NEW_FEATURE,
    {
      onCompleted: () => refetch(),
    }
  );

  const handleCreate = async () => {
    try {
      await createFeature({
        variables: {
          input: { name: 'New Feature' },
        },
      });
    } catch (err) {
      console.error('Failed to create feature:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <Button onClick={handleCreate} disabled={creating}>
        Create Feature
      </Button>
      
      <div className="grid gap-4 mt-4">
        {data?.myNewFeatures.map((feature) => (
          <Card key={feature.id}>
            <CardContent>
              <h3>{feature.name}</h3>
              <p>Created: {new Date(feature.createdAt).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

#### 3. Add Route (if needed)

```typescript
// apps/form-app/src/App.tsx
import { NewFeatureList } from '@/components/NewFeatureList';

// Add route
<Route path="/features" element={<NewFeatureList />} />
```

## Testing Phase

### 1. Write Unit Tests

```typescript
// apps/backend/src/services/NewFeatureService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { NewFeatureService } from './NewFeatureService';

describe('NewFeatureService', () => {
  let service: NewFeatureService;

  beforeEach(() => {
    service = new NewFeatureService();
  });

  it('should create a new feature', async () => {
    const result = await service.createFeature('Test Feature', 'user-123');
    expect(result.name).toBe('Test Feature');
  });

  it('should throw error for empty name', async () => {
    await expect(
      service.createFeature('', 'user-123')
    ).rejects.toThrow('Name is required');
  });
});
```

### 2. Write Integration Tests

```gherkin
# test/integration/features/new-feature.feature
Feature: New Feature Management
  @newfeature @create
  Scenario: Create a new feature
    Given I am authenticated as "user@example.com"
    When I create a new feature with name "My Feature"
    Then the response status should be 200
    And the feature should be created successfully
```

### 3. Run Tests

```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration:by-tags "@newfeature"
```

## Documentation Phase

### 1. Update README (if needed)

Add feature to README if it's a major addition.

### 2. Add Code Comments

Use JSDoc for public APIs:

```typescript
/**
 * Creates a new feature for the authenticated user.
 * 
 * @param name - The name of the feature
 * @param userId - ID of the user creating the feature
 * @returns The created feature
 * @throws {Error} If name is empty or invalid
 */
async createFeature(name: string, userId: string): Promise<NewFeature>
```

## Review and Merge

### 1. Self-Review Checklist

- [ ] Code follows conventions (see `.agent/conventions.md`)
- [ ] All tests passing
- [ ] No console.log or debug code
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] TypeScript types defined
- [ ] GraphQL schema updated
- [ ] Database migrations created (if needed)

### 2. Create Pull Request

```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/feature-name
```

Create PR on GitHub with:
- Description of changes
- Screenshots (for UI changes)
- Testing instructions
- Breaking changes (if any)

### 3. Code Review

Address review comments and update PR.

### 4. Merge

Once approved, merge to main branch.

## Common Patterns

### Adding a New Form Field Type

1. Update `FormField` type in schema
2. Add field renderer in form viewer
3. Add field editor in form builder
4. Update validation logic
5. Add tests

### Adding a New Plugin

1. Create plugin in `packages/plugins/`
2. Implement plugin interface
3. Register plugin in backend
4. Add plugin UI in form builder
5. Test plugin functionality

### Adding a New API Endpoint

1. Create service method
2. Add GraphQL resolver
3. Update GraphQL schema
4. Add authorization checks
5. Write tests

## Quick Reference

```bash
# Create feature branch
git checkout -b feature/feature-name

# Update database
pnpm db:generate
pnpm db:push

# Run tests
pnpm test:unit
pnpm test:integration

# Commit and push
git add .
git commit -m "feat: description"
git push origin feature/feature-name
```
