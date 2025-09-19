# GraphQL Authorization Guide

This document provides a comprehensive overview of authorization patterns for all GraphQL queries and mutations in the dculus-forms application.

## Authorization Categories

The system implements several levels of authorization:

1. **Public** - No authentication required
2. **Authenticated** - Any authenticated user
3. **Organization Member** - Must be member of specific organization
4. **Form Permissions** - Uses form sharing system (OWNER/EDITOR/VIEWER)
5. **System Admin** - Requires admin/superAdmin role
6. **Super Admin** - Requires superAdmin role specifically

## Comprehensive Authorization Table

| Operation | Type | Access Level | Specific Requirements | Notes |
|-----------|------|--------------|----------------------|-------|
| **Authentication & Organization** |
| `me` | Query | Authenticated | Any authenticated user | Returns current user info |
| `myOrganizations` | Query | Authenticated | Any authenticated user | Returns user's organizations |
| `activeOrganization` | Query | Authenticated | Any authenticated user | Returns active organization |
| `createOrganization` | Mutation | Authenticated | Any authenticated user | Creates org, user becomes owner |
| `setActiveOrganization` | Mutation | Authenticated | Must be org member | Sets user's active organization |
| **Public Operations** |
| `getInvitationPublic` | Query | Public | None | Validates invitation tokens |
| `formByShortUrl` | Query | Public | Form must be published | Public form access via short URL |
| `trackFormView` | Mutation | Public | Form must be published | Analytics tracking |
| `updateFormStartTime` | Mutation | Public | Form must be published | Analytics timing |
| `trackFormSubmission` | Mutation | Public | Form must be published | Analytics submission tracking |
| `submitResponse` | Mutation | Public | Form must be published | Submit form responses |
| **Form Operations** |
| `form` | Query | Form Permissions | VIEWER or higher | Individual form access |
| `createForm` | Mutation | Organization Member | Member of target org | Creates new form |
| `updateForm` | Mutation | Form Permissions | EDITOR for content, OWNER for publishing | Dynamic permission based on update type |
| `deleteForm` | Mutation | Form Permissions | OWNER only | Permanent form deletion |
| `regenerateShortUrl` | Mutation | Form Permissions | EDITOR or higher | Regenerates public URL |
| **Form Sharing & Lists** |
| `formPermissions` | Query | Form Permissions | VIEWER or higher | View form permissions |
| `formsWithCategory` | Query | Organization Member | Member of specified org | Secure categorized form lists (MY_FORMS/SHARED_WITH_ME) |
| `organizationMembers` | Query | Organization Member | Member of specified org | List org members for sharing |
| `shareForm` | Mutation | Form Permissions | OWNER only | Configure form sharing |
| `updateFormPermission` | Mutation | Form Permissions | OWNER only | Update user permissions |
| `removeFormAccess` | Mutation | Form Permissions | OWNER only | Remove user access |
| **Response Management** |
| `responses` | Query | Organization Member | Member of specified org | All org responses |
| `response` | Query | Organization Member | Member of form's org | Individual response |
| `responsesByForm` | Query | Organization Member | Member of form's org | Form-specific responses |
| `deleteResponse` | Mutation | Organization Member | Member of form's org | Delete response |
| **Template Operations** |
| `templates` | Query | Authenticated | Any authenticated user | Browse templates |
| `template` | Query | Authenticated | Any authenticated user | Individual template |
| `templatesByCategory` | Query | Authenticated | Any authenticated user | Templates by category |
| `templateCategories` | Query | Authenticated | Any authenticated user | Available categories |
| `createTemplate` | Mutation | System Admin | admin/superAdmin role | Create new template |
| `updateTemplate` | Mutation | System Admin | admin/superAdmin role | Update template |
| `deleteTemplate` | Mutation | System Admin | admin/superAdmin role | Delete template |
| `createFormFromTemplate` | Mutation | Organization Member | Member of target org | Create form from template |
| **File Management** |
| `getFormFiles` | Query | Form Permissions | VIEWER or higher | List form files |
| `uploadFile` | Mutation | Authenticated | Context-dependent | Upload files |
| `deleteFile` | Mutation | Authenticated | File owner or admin | Delete files |
| **Analytics** |
| `formAnalytics` | Query | Form Permissions | VIEWER or higher | Form view analytics |
| `formSubmissionAnalytics` | Query | Form Permissions | VIEWER or higher | Form submission analytics |
| `fieldAnalytics` | Query | Form Permissions | VIEWER or higher | Individual field analytics |
| `allFieldsAnalytics` | Query | Form Permissions | VIEWER or higher | All fields analytics |
| `fieldAnalyticsCacheStats` | Query | System Admin | admin/superAdmin role | Cache statistics |
| `invalidateFieldAnalyticsCache` | Mutation | Form Permissions | EDITOR or higher | Clear field analytics cache |
| **Export Operations** |
| `generateFormResponseReport` | Mutation | Form Permissions | VIEWER or higher | Export responses to Excel/CSV |
| **Admin Operations** |
| `adminOrganizations` | Query | System Admin | admin/superAdmin role | List all organizations |
| `adminOrganization` | Query | System Admin | admin/superAdmin role | Individual org details |
| `adminStats` | Query | System Admin | admin/superAdmin role | System-wide statistics |

## Form Permission Levels

The form sharing system uses these permission levels:

| Permission | Create | Read | Update | Delete | Share | Publish |
|------------|--------|------|--------|--------|-------|---------|
| **OWNER** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **EDITOR** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **VIEWER** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **NO_ACCESS** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Organization Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **companyOwner** | Organization owner | Full org management, create forms, manage members |
| **companyMember** | Regular member | View org forms, create responses |

## System Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| **user** | Standard user | Default role, create orgs, join orgs |
| **admin** | System admin | Access admin dashboard, view all orgs, system stats |
| **superAdmin** | Super admin | All admin permissions + create templates, system management |

## Authorization Implementation Details

### Authentication Context

The system uses better-auth for authentication with the following context structure:

```typescript
interface BetterAuthContext {
  user: any | null;
  session: any | null;
  isAuthenticated: boolean;
}
```

### Form Access Control

Form access is determined by the `checkFormAccess` function which evaluates:

1. **Form Owner**: Creator has OWNER permissions
2. **Organization Membership**: Must be member of form's organization
3. **Explicit Permissions**: Direct permissions granted to user
4. **Sharing Scope**:
   - `PRIVATE`: Only explicit permissions
   - `SPECIFIC_MEMBERS`: Only users with explicit permissions
   - `ALL_ORG_MEMBERS`: All org members get default permission

### Dynamic Permission Checking

The `updateForm` mutation uses dynamic permission checking:

- **Content Changes** (title, description, settings): Requires EDITOR
- **Publishing Changes** (isPublished, shortUrl): Requires OWNER
- **Critical Changes** (organizationId, ownership): Requires OWNER or blocked

### Admin Role Verification

Admin operations use the `requireAdminRole` function:

```typescript
function requireAdminRole(context: any) {
  if (!context.user) {
    throw new GraphQLError('Authentication required');
  }

  const userRole = context.user.role;
  if (!userRole || (userRole !== 'admin' && userRole !== 'superAdmin')) {
    throw new GraphQLError('Admin privileges required');
  }

  return context.user;
}
```

## Form Categorization System

The `formsWithCategory` query implements secure form access through categorization:

### Categories

| Category | Description | Access Rules |
|----------|-------------|--------------|
| **MY_FORMS** | Forms owned by the current user | Returns only forms where `createdById = userId` |
| **SHARED_WITH_ME** | Forms shared with the current user | Returns forms with explicit permissions or org-wide sharing (excludes owned forms) |

### Security Implementation

```typescript
// MY_FORMS category - only user's own forms
whereCondition = {
  organizationId,
  createdById: userId
};

// SHARED_WITH_ME category - shared forms only
whereCondition = {
  organizationId,
  createdById: { not: userId },
  OR: [
    // Forms with explicit permissions
    { permissions: { some: { userId, permission: { not: 'NO_ACCESS' } } } },
    // Forms shared with all org members
    { sharingScope: 'ALL_ORG_MEMBERS', defaultPermission: { not: 'NO_ACCESS' } }
  ]
};
```


## Key Security Features

1. **Dynamic Permission Checking**: Form operations check specific permission levels based on action type
2. **Organization Isolation**: Users can only access data within their organization memberships
3. **Categorized Form Access**: Users only see forms in appropriate categories (owned vs shared)
4. **Public Form Access**: Published forms are accessible via short URLs without authentication
5. **Admin Role Separation**: Clear distinction between system-level and organization-level permissions
6. **Form Sharing Scopes**: PRIVATE, SPECIFIC_MEMBERS, ALL_ORG_MEMBERS with configurable default permissions
7. **Analytics Privacy**: Public analytics tracking for published forms only, authenticated analytics viewing
8. **Submission Limits**: Forms can enforce maximum responses and time window restrictions
9. **Invitation System**: Secure organization invitation flow with expiration and status tracking

## Best Practices

1. **Always check form access** before performing form operations
2. **Use categorized form queries** - Use `formsWithCategory` with appropriate category (MY_FORMS/SHARED_WITH_ME)
3. **Use appropriate permission levels** for different operation types
4. **Validate organization membership** for org-scoped operations
5. **Handle public operations carefully** with proper form state validation
6. **Implement proper error handling** for authorization failures
7. **Log admin operations** for audit trails
8. **Respect sharing scopes** when implementing new form features
9. **Avoid legacy form list patterns** - Do not implement bulk form access without categorization

## Error Handling

Common authorization errors:

- `Authentication required` - User not logged in
- `Admin privileges required` - System admin role required
- `Access denied: You do not have permission to view this form` - Insufficient form permissions
- `Form not found` - Form doesn't exist or user has no access
- `Form is not published` - Attempting public access to unpublished form

This authorization model provides comprehensive security while enabling flexible collaboration and sharing workflows.