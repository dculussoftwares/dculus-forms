---
description: "Add a new GraphQL endpoint (query or mutation) end-to-end"
mode: "agent"
---

# Add New GraphQL Endpoint

Follow these steps to add a new query or mutation end-to-end:

## Step 1: Add Schema Types

In `apps/backend/src/graphql/schema.ts`, add:

```graphql
# New types
type MyResult {
  id: ID!
  name: String!
  data: JSON
}

# New input (for mutations)
input MyInput {
  name: String!
  data: JSON
}

# Add to Query type
type Query {
  myQuery(id: ID!): MyResult
}

# Add to Mutation type  
type Mutation {
  myMutation(input: MyInput!): MyResult!
}
```

## Step 2: Create Service (Business Logic)

Create or extend `apps/backend/src/services/myService.ts`:

```typescript
import { prisma } from '../lib/prisma.js';

export async function myBusinessLogic(userId: string, input: MyInput) {
  // Business logic here
  return await prisma.myModel.create({ data: { ... } });
}
```

## Step 3: Create Resolver

Create `apps/backend/src/graphql/resolvers/myDomain.ts`:

```typescript
import { getUserAndOrgFromContext } from './better-auth.js';
import { myBusinessLogic } from '../../services/myService.js';

export const myResolvers = {
  Query: {
    myQuery: async (_: any, { id }: { id: string }, context: any) => {
      const { userId } = await getUserAndOrgFromContext(context);
      if (!userId) throw new Error('Authentication required');
      return await myBusinessLogic(userId, id);
    },
  },
  Mutation: {
    myMutation: async (_: any, { input }: { input: any }, context: any) => {
      const { userId } = await getUserAndOrgFromContext(context);
      if (!userId) throw new Error('Authentication required');
      return await myBusinessLogic(userId, input);
    },
  },
};
```

## Step 4: Register Resolver

In `apps/backend/src/graphql/resolvers.ts`, import and spread:

```typescript
import { myResolvers } from './resolvers/myDomain.js';

export const resolvers = {
  Query: { ...myResolvers.Query },
  Mutation: { ...myResolvers.Mutation },
};
```

## Step 5: Add Frontend Query/Mutation

In `apps/form-app/src/graphql/queries.ts` or a new file:

```typescript
export const MY_QUERY = gql`
  query MyQuery($id: ID!) {
    myQuery(id: $id) { id name data }
  }
`;

export const MY_MUTATION = gql`
  mutation MyMutation($input: MyInput!) {
    myMutation(input: $input) { id name data }
  }
`;
```

## Step 6: Use in Component

```typescript
const { data } = useQuery(MY_QUERY, { variables: { id } });
const [doMutation] = useMutation(MY_MUTATION);
```

## Step 7: Add Integration Test

Create `test/integration/features/my-feature.feature` with Gherkin scenarios.
