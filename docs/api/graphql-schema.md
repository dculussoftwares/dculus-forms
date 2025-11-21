# GraphQL API Reference

## Overview

Dculus Forms uses a **GraphQL API** built with Apollo Server. The API follows a code-first approach where the schema is generated from TypeScript types and resolvers.

## Endpoints

- **GraphQL Endpoint**: `http://localhost:4000/graphql` (development)
- **GraphQL Playground**: `http://localhost:4000/graphql` (interactive documentation)
- **Production**: `https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql`

## Authentication

All authenticated requests require a session cookie or Authorization header:

```http
Authorization: Bearer <session-token>
```

## Core Types

### User

```graphql
type User {
  id: ID!
  email: String!
  name: String
  emailVerified: Boolean!
  image: String
  createdAt: DateTime!
  updatedAt: DateTime!
  organizations: [OrganizationMember!]!
  forms: [Form!]!
}
```

### Organization

```graphql
type Organization {
  id: ID!
  name: String!
  slug: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  members: [OrganizationMember!]!
  forms: [Form!]!
  subscription: Subscription
}
```

### Form

```graphql
type Form {
  id: ID!
  title: String!
  description: String
  fields: JSON!
  settings: JSON
  layout: JSON
  status: FormStatus!
  organizationId: String!
  organization: Organization!
  createdBy: String!
  creator: User!
  responses: [FormResponse!]!
  responseCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum FormStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}
```

### FormResponse

```graphql
type FormResponse {
  id: ID!
  formId: String!
  form: Form!
  data: JSON!
  metadata: JSON
  status: ResponseStatus!
  score: Float
  submittedAt: DateTime!
  updatedAt: DateTime!
}

enum ResponseStatus {
  DRAFT
  SUBMITTED
  REVIEWED
}
```

### Template

```graphql
type Template {
  id: ID!
  name: String!
  description: String
  category: String!
  fields: JSON!
  layout: JSON
  settings: JSON
  isPublic: Boolean!
  organizationId: String
  createdBy: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

## Queries

### Authentication

```graphql
# Get current user
query Me {
  me {
    id
    email
    name
    organizations {
      id
      role
      organization {
        id
        name
      }
    }
  }
}
```

### Forms

```graphql
# Get single form
query GetForm($id: ID!) {
  form(id: $id) {
    id
    title
    description
    fields
    settings
    layout
    status
    responseCount
    createdAt
  }
}

# List forms
query ListForms($organizationId: String!) {
  forms(organizationId: $organizationId) {
    id
    title
    description
    status
    responseCount
    createdAt
  }
}

# Get form with responses
query GetFormWithResponses($id: ID!) {
  form(id: $id) {
    id
    title
    responses {
      id
      data
      submittedAt
      score
    }
  }
}
```

### Responses

```graphql
# Get single response
query GetResponse($id: ID!) {
  formResponse(id: $id) {
    id
    data
    metadata
    status
    score
    submittedAt
  }
}

# List responses for a form
query ListResponses($formId: String!) {
  formResponses(formId: $formId) {
    id
    data
    status
    score
    submittedAt
  }
}
```

### Templates

```graphql
# List public templates
query ListPublicTemplates {
  publicTemplates {
    id
    name
    description
    category
    fields
  }
}

# Get template
query GetTemplate($id: ID!) {
  template(id: $id) {
    id
    name
    description
    category
    fields
    layout
    settings
  }
}
```

### Organizations

```graphql
# Get organization
query GetOrganization($id: ID!) {
  organization(id: $id) {
    id
    name
    slug
    members {
      id
      role
      user {
        id
        email
        name
      }
    }
    subscription {
      id
      planId
      status
    }
  }
}
```

## Mutations

### Forms

```graphql
# Create form
mutation CreateForm($input: CreateFormInput!) {
  createForm(input: $input) {
    id
    title
    description
    status
  }
}

input CreateFormInput {
  title: String!
  description: String
  fields: JSON!
  settings: JSON
  layout: JSON
  organizationId: String!
}

# Update form
mutation UpdateForm($id: ID!, $input: UpdateFormInput!) {
  updateForm(id: $id, input: $input) {
    id
    title
    description
    fields
    updatedAt
  }
}

input UpdateFormInput {
  title: String
  description: String
  fields: JSON
  settings: JSON
  layout: JSON
  status: FormStatus
}

# Delete form
mutation DeleteForm($id: ID!) {
  deleteForm(id: $id)
}

# Publish form
mutation PublishForm($id: ID!) {
  publishForm(id: $id) {
    id
    status
  }
}
```

### Responses

```graphql
# Submit response
mutation SubmitResponse($input: SubmitResponseInput!) {
  submitFormResponse(input: $input) {
    id
    data
    score
    submittedAt
  }
}

input SubmitResponseInput {
  formId: String!
  data: JSON!
  metadata: JSON
}

# Update response
mutation UpdateResponse($id: ID!, $input: UpdateResponseInput!) {
  updateFormResponse(id: $id, input: $input) {
    id
    data
    updatedAt
  }
}

input UpdateResponseInput {
  data: JSON
  status: ResponseStatus
}
```

### Templates

```graphql
# Create template from form
mutation CreateTemplate($input: CreateTemplateInput!) {
  createTemplate(input: $input) {
    id
    name
    category
  }
}

input CreateTemplateInput {
  name: String!
  description: String
  category: String!
  fields: JSON!
  layout: JSON
  settings: JSON
  isPublic: Boolean
  organizationId: String
}
```

### Organizations

```graphql
# Create organization
mutation CreateOrganization($input: CreateOrganizationInput!) {
  createOrganization(input: $input) {
    id
    name
    slug
  }
}

input CreateOrganizationInput {
  name: String!
  slug: String!
}

# Invite member
mutation InviteMember($input: InviteMemberInput!) {
  inviteOrganizationMember(input: $input) {
    id
    role
  }
}

input InviteMemberInput {
  organizationId: String!
  email: String!
  role: OrganizationRole!
}

enum OrganizationRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

## Subscriptions

```graphql
# Subscribe to form updates
subscription FormUpdated($formId: ID!) {
  formUpdated(formId: $formId) {
    id
    title
    fields
    updatedAt
  }
}

# Subscribe to new responses
subscription ResponseSubmitted($formId: ID!) {
  responseSubmitted(formId: $formId) {
    id
    data
    submittedAt
  }
}
```

## Error Handling

GraphQL errors follow this format:

```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

Common error codes:
- `UNAUTHENTICATED` - User not authenticated
- `FORBIDDEN` - User lacks permission
- `BAD_USER_INPUT` - Invalid input data
- `NOT_FOUND` - Resource not found
- `INTERNAL_SERVER_ERROR` - Server error

## Pagination

For large result sets, use cursor-based pagination:

```graphql
query ListForms($first: Int!, $after: String) {
  forms(first: $first, after: $after) {
    edges {
      node {
        id
        title
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

## Best Practices

### 1. Request Only Needed Fields

```graphql
# ✅ Good: Request only what you need
query GetForm($id: ID!) {
  form(id: $id) {
    id
    title
    status
  }
}

# ❌ Bad: Requesting everything
query GetForm($id: ID!) {
  form(id: $id) {
    id
    title
    description
    fields
    settings
    layout
    status
    responses {
      id
      data
      metadata
    }
  }
}
```

### 2. Use Fragments for Reusability

```graphql
fragment FormFields on Form {
  id
  title
  description
  status
  createdAt
}

query GetForm($id: ID!) {
  form(id: $id) {
    ...FormFields
  }
}
```

### 3. Handle Errors Properly

```typescript
const { data, loading, error } = useQuery(GET_FORM_QUERY);

if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return null;
```

### 4. Use Variables

```graphql
# ✅ Good: Use variables
query GetForm($id: ID!) {
  form(id: $id) {
    id
    title
  }
}

# ❌ Bad: Hardcoded values
query GetForm {
  form(id: "123") {
    id
    title
  }
}
```

## Testing GraphQL API

### Using curl

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { me { id email } }"
  }'
```

### Using GraphQL Playground

1. Open `http://localhost:4000/graphql`
2. Write your query in the left panel
3. Click the play button
4. View results in the right panel

### Using Apollo Client

```typescript
import { gql, useQuery } from '@apollo/client';

const GET_FORM = gql`
  query GetForm($id: ID!) {
    form(id: $id) {
      id
      title
    }
  }
`;

function FormComponent({ formId }) {
  const { data, loading, error } = useQuery(GET_FORM, {
    variables: { id: formId },
  });
  
  // Handle loading, error, data...
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:
- **Authenticated users**: 1000 requests per hour
- **Unauthenticated**: 100 requests per hour

## Further Reading

- [GraphQL Authorization Guide](../architecture/GRAPHQL_AUTHORIZATION_GUIDE.md)
- [Apollo Client Documentation](https://www.apollographql.com/docs/react/)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
