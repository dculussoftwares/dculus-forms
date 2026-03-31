---
applyTo: "**/graphql/**"
---

# GraphQL Development Instructions

## Schema Definition

The GraphQL schema is defined in `apps/backend/src/graphql/schema.ts` using `gql` tagged template literals (SDL approach with code-first registration).

### Adding New Types

Add to `schema.ts`:
```typescript
export const typeDefs = gql`
  # Add new types here
  type MyNewType {
    id: ID!
    name: String!
    data: JSON    # Use JSON scalar for flexible data
  }

  # Extend Query
  extend type Query {
    myNewQuery(id: ID!): MyNewType
  }

  # Extend Mutation
  extend type Mutation {
    createMyNew(input: CreateMyNewInput!): MyNewType!
  }

  input CreateMyNewInput {
    name: String!
  }
`;
```

## Existing Query/Mutation Reference

### Queries
| Query | Args | Returns | Auth |
|-------|------|---------|------|
| `me` | — | `User` | ✅ |
| `activeOrganization` | — | `Organization` | ✅ |
| `form(id)` | `ID!` | `Form` | ✅ |
| `formByShortUrl(shortUrl)` | `String!` | `Form` | ❌ (public) |
| `forms(orgId, category, page, limit, filters)` | Multiple | `PaginatedForms` | ✅ |
| `responsesByForm(formId, page, limit, sortBy, sortOrder, filters)` | Multiple | `PaginatedResponses` | ✅ |
| `formAnalytics(formId, timeRange)` | `ID!, TimeRangeInput` | `FormAnalytics` | ✅ |
| `formSubmissionAnalytics(formId, timeRange)` | `ID!, TimeRangeInput` | `FormSubmissionAnalytics` | ✅ |
| `fieldAnalytics(formId, fieldId)` | `ID!, ID!` | `FieldAnalytics` | ✅ |
| `allFieldsAnalytics(formId)` | `ID!` | `AllFieldsAnalytics` | ✅ |
| `formPlugins(formId)` | `ID!` | `[FormPlugin]` | ✅ |
| `templates(category)` | `String?` | `[FormTemplate]` | ✅ |
| `templatesByCategory` | — | `[TemplatesByCategory]` | ✅ |
| `adminOrganizations(limit, offset)` | `Int?, Int?` | `AdminOrganizationsResult` | ✅ superAdmin |
| `adminStats` | — | `AdminStats` | ✅ superAdmin |
| `adminUsers(page, limit, search)` | Multiple | `AdminUsersResponse` | ✅ superAdmin |

### Mutations
| Mutation | Input | Returns |
|----------|-------|---------|
| `createForm(input)` | `CreateFormInput` | `Form` |
| `updateForm(id, input)` | `ID, UpdateFormInput` | `Form` |
| `deleteForm(id)` | `ID` | `Boolean` |
| `duplicateForm(id)` | `ID` | `Form` |
| `submitResponse(input)` | `SubmitResponseInput` | `FormResponse` |
| `updateResponse(input)` | `UpdateResponseInput` | `FormResponse` |
| `shareForm(input)` | `ShareFormInput` | `FormSharingSettings` |
| `trackFormView(input)` | `TrackFormViewInput` | `TrackFormViewResponse` |
| `trackFormSubmission(input)` | `TrackFormSubmissionInput` | `TrackFormViewResponse` |
| `createFormPlugin(input)` | `CreateFormPluginInput` | `FormPlugin` |
| `uploadFile(input)` | `UploadFileInput` | `FileUploadResponse` |
| `generateFormResponseReport(formId, format, filters)` | Multiple | `ExportResult` |
| `createTemplate(input)` | `CreateTemplateInput` | `FormTemplate` |

## Custom Scalars

```graphql
scalar JSON     # Flexible JSON data (graphql-type-json)
scalar Upload   # File upload (graphql-upload)
```

## Enums

```graphql
enum SharingScope { PRIVATE, SPECIFIC_MEMBERS, ALL_ORG_MEMBERS }
enum PermissionLevel { OWNER, EDITOR, VIEWER, NO_ACCESS }
enum FormCategory { OWNER, SHARED, ALL }
enum ExportFormat { EXCEL, CSV }
enum FilterOperator { EQUALS, NOT_EQUALS, CONTAINS, ... }
enum FilterLogic { AND, OR }
enum EditType { MANUAL, SYSTEM, BULK }
enum ChangeType { ADD, UPDATE, DELETE }
enum SubscriptionStatus { active, cancelled, expired, past_due }
```

## Frontend GraphQL Files

- `apps/form-app/src/graphql/queries.ts` — Form queries
- `apps/form-app/src/graphql/mutations.ts` — Form mutations
- `apps/form-app/src/graphql/plugins.ts` — Plugin queries/mutations
- `apps/form-app/src/graphql/formSharing.ts` — Sharing queries
- `apps/form-app/src/graphql/subscription.ts` — Subscription queries
- `apps/form-app/src/graphql/templates.ts` — Template queries

## Resolver Registration

After creating a resolver, register it in `apps/backend/src/graphql/resolvers.ts`:

```typescript
import { myResolvers } from './resolvers/myDomain.js';

export const resolvers = {
  Query: {
    ...existingQuery,
    ...myResolvers.Query,     // Add here
  },
  Mutation: {
    ...existingMutation,
    ...myResolvers.Mutation,  // Add here
  },
  // If you have type resolvers
  MyType: {
    ...myResolvers.MyType,
  },
};
```
