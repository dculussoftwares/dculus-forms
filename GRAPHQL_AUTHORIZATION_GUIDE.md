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
| `me` | Query | Authenticated | Any authenticated user | Returns current user with organizations array |
| `myOrganizations` | Query | Authenticated | Any authenticated user | Returns user's organization memberships |
| `activeOrganization` | Query | Authenticated | Organization member | **🔒 SECURED**: Verifies membership before returning org data |
| `createOrganization` | Mutation | Authenticated | Any authenticated user | Creates org, user becomes companyOwner |
| `setActiveOrganization` | Mutation | Authenticated | **🔒 Organization member** | **SECURED**: Verifies membership before switching |
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

## Organization Security Middleware

The system implements comprehensive organization-level security through centralized middleware functions that ensure proper membership verification and access control.

### Core Security Functions

#### Organization Membership Verification

```typescript
// apps/backend/src/middleware/better-auth-middleware.ts
export async function requireOrganizationMembership(
  context: BetterAuthContext,
  organizationId: string
): Promise<any> {
  requireAuth(context);

  const membership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: context.user!.id
    },
    include: {
      organization: true,
      user: true
    }
  });

  if (!membership) {
    throw new GraphQLError('Access denied: You are not a member of this organization');
  }

  return membership;
}
```

### Enhanced Authentication & Organization Operations

#### 🔒 Secured `activeOrganization` Query

The `activeOrganization` query now implements robust security:

```typescript
// apps/backend/src/graphql/resolvers/better-auth.ts
activeOrganization: async (_, __, context: { auth: BetterAuthContext }) => {
  requireAuth(context.auth);

  if (!context.auth.session?.activeOrganizationId) {
    return null;
  }

  try {
    // 🔒 SECURITY: Verify user membership before returning data
    await requireOrganizationMembership(
      context.auth,
      context.auth.session.activeOrganizationId
    );

    // Return complete organization data with members
    return await prisma.organization.findUnique({
      where: { id: context.auth.session.activeOrganizationId },
      include: {
        members: { include: { user: true } }
      }
    });
  } catch (error: any) {
    // Graceful handling: return null for access/membership errors
    if (error.message.includes('Access denied') || error.message.includes('not a member')) {
      return null;
    }
    throw error; // Re-throw authentication errors
  }
}
```

**Security Enhancements:**
- ✅ **Membership Verification**: Validates user is actually a member before returning organization data
- ✅ **Session Integrity**: Prevents compromised sessions from accessing unauthorized organizations
- ✅ **Graceful Error Handling**: Returns `null` instead of throwing for membership violations
- ✅ **Complete Data**: Returns organization with properly populated members array
- ✅ **GraphQL Schema Compliance**: Ensures non-nullable fields are always properly populated

#### 🔒 Secured `setActiveOrganization` Mutation

The organization switching functionality is now fully secured:

```typescript
setActiveOrganization: async (
  _: any,
  { organizationId }: { organizationId: string },
  context: { auth: BetterAuthContext; req: any }
) => {
  // 🔒 SECURITY: Verify membership before allowing switch
  await requireOrganizationMembership(context.auth, organizationId);

  // User is verified member - return full organization with members
  return await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: { include: { user: true } }
    }
  });
}
```

**Security Features:**
- ✅ **Membership Validation**: Only allows switching to organizations where user is a member
- ✅ **Access Control**: Prevents unauthorized organization access
- ✅ **Data Integrity**: Returns complete organization data after successful verification

### Frontend Integration & Error Handling

#### Enhanced AuthContext

The frontend `AuthContext` now provides comprehensive error handling:

```typescript
// apps/form-app/src/contexts/AuthContext.tsx
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activeOrganization: Organization | null;
  organizationError: string | null;  // 🆕 Error state tracking
  setActiveOrganization: (organizationId: string) => Promise<boolean>; // 🆕 Secure switching
}
```

**Error Handling Features:**
- ✅ **Authorization Error Detection**: Distinguishes between authentication and authorization failures
- ✅ **User-Friendly Messages**: Provides specific error messages for different failure scenarios
- ✅ **Toast Notifications**: Immediate feedback for organization switching operations
- ✅ **Graceful Degradation**: UI handles access denial appropriately

#### Organization Switcher Component

```typescript
// apps/form-app/src/components/OrganizationSwitcher.tsx
export const OrganizationSwitcher: React.FC = () => {
  const { activeOrganization, setActiveOrganization, organizationError } = useAuth();

  const handleOrganizationSwitch = async (organizationId: string) => {
    const success = await setActiveOrganization(organizationId);
    if (!success) {
      toastError('Failed to switch organization', 'Please try again');
    }
  };

  // Error state UI
  if (organizationError) {
    return `<ErrorDisplay message="Organization Access Error" />`;
  }

  // Organization selection UI with role display
  return `<OrganizationDropdown ... />`;
};
```

### Role-Based Access Control

#### Organization Roles

The system supports granular organization-level roles:

| Role | Description | Permissions | Default |
|------|-------------|-------------|---------|
| `companyOwner` | Organization owner/admin | Full organization management, invite members, manage forms | Creator only |
| `companyMember` | Regular member | View organization forms, create responses, basic access | Default for invites |

#### System-Level Roles

| Role | Description | Permissions | Admin Dashboard |
|------|-------------|-------------|-----------------|
| `user` | Standard user | Create organizations, join organizations, manage own forms | ❌ |
| `admin` | System administrator | Access admin dashboard, view all organizations, system statistics | ✅ |
| `superAdmin` | Super administrator | All admin permissions + system management + template creation | ✅ |

### Security Middleware Architecture

The authorization system uses a layered approach:

1. **Authentication Layer**: `requireAuth()` - Verifies user session
2. **Organization Layer**: `requireOrganizationMembership()` - Verifies organization access
3. **Role Layer**: `requireOrganizationRole()` - Verifies specific role requirements
4. **Permission Layer**: Form-specific permission checking

### Error Handling Patterns

#### Backend Error Responses

```typescript
// Membership violation
throw new GraphQLError('Access denied: You are not a member of this organization');

// Authentication failure
throw new GraphQLError('Authentication required');

// Role insufficient
throw new GraphQLError('Permission denied: Requires companyOwner role');
```

#### Frontend Error Handling

```typescript
// apps/form-app/src/components/AuthorizationErrorBoundary.tsx
export const AuthorizationErrorBoundary: React.FC = ({ error, children }) => {
  if (error?.message?.includes('Access denied')) {
    return `<AccessDeniedUI onRetry={handleRetry} />`;
  }

  if (error?.message?.includes('Authentication required')) {
    return `<SignInPromptUI />`;
  }

  return `<>{children}</>`;
};
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

### Core Authorization
1. **Dynamic Permission Checking**: Form operations check specific permission levels based on action type
2. **Organization Isolation**: Users can only access data within their organization memberships
3. **Categorized Form Access**: Users only see forms in appropriate categories (owned vs shared)
4. **Public Form Access**: Published forms are accessible via short URLs without authentication
5. **Admin Role Separation**: Clear distinction between system-level and organization-level permissions

### 🔒 Enhanced Organization Security (New)
6. **Centralized Membership Verification**: All organization operations use `requireOrganizationMembership()` middleware
7. **Secured Organization Switching**: `setActiveOrganization` validates membership before allowing switch
8. **Protected Organization Data**: `activeOrganization` query verifies membership before returning data
9. **Graceful Error Handling**: Authorization failures return `null` instead of throwing GraphQL errors
10. **Session Integrity Validation**: Prevents compromised sessions from accessing unauthorized organizations

### Advanced Features
11. **Form Sharing Scopes**: PRIVATE, SPECIFIC_MEMBERS, ALL_ORG_MEMBERS with configurable default permissions
12. **Analytics Privacy**: Public analytics tracking for published forms only, authenticated analytics viewing
13. **Submission Limits**: Forms can enforce maximum responses and time window restrictions
14. **Invitation System**: Secure organization invitation flow with expiration and status tracking

### 🆕 Frontend Security Integration
15. **Authorization Error Boundaries**: Comprehensive error handling for different authorization failure types
16. **Organization Switcher Component**: Secure UI component with role display and error states
17. **Enhanced AuthContext**: Tracks organization errors and provides secure switching functions
18. **Toast Notifications**: Immediate user feedback for organization access and switching operations
19. **Role-Based UI**: Components adapt based on user's organization role (companyOwner vs companyMember)

## Best Practices

### Backend Security
1. **Always check form access** before performing form operations
2. **Use categorized form queries** - Use `formsWithCategory` with appropriate category (MY_FORMS/SHARED_WITH_ME)
3. **Use appropriate permission levels** for different operation types
4. **Validate organization membership** for org-scoped operations using `requireOrganizationMembership()`
5. **Handle public operations carefully** with proper form state validation
6. **Implement proper error handling** for authorization failures
7. **Log admin operations** for audit trails
8. **Respect sharing scopes** when implementing new form features

### 🆕 Enhanced Security Practices
9. **Use centralized middleware** - Always use `requireOrganizationMembership()` for organization operations
10. **Return complete data structures** - Ensure GraphQL responses include all required non-nullable fields
11. **Implement graceful error handling** - Return `null` for access violations, throw only for authentication failures
12. **Verify session integrity** - Check organization membership even when user has activeOrganizationId

### Frontend Integration
13. **Use AuthorizationErrorBoundary** - Wrap organization-related components with error boundaries
14. **Implement proper loading states** - Show loading indicators during organization operations
15. **Provide user feedback** - Use toast notifications for organization switching and access errors
16. **Handle edge cases** - Account for null organization states and membership changes
17. **Display user roles** - Show organization roles in UI components for clarity
18. **Cache organization data** - Use Apollo Client caching for efficient organization switching

## Error Handling

Common authorization errors:

- `Authentication required` - User not logged in
- `Admin privileges required` - System admin role required
- `Access denied: You do not have permission to view this form` - Insufficient form permissions
- `Form not found` - Form doesn't exist or user has no access
- `Form is not published` - Attempting public access to unpublished form

This authorization model provides comprehensive security while enabling flexible collaboration and sharing workflows.