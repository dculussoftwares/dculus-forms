# Admin App

The Admin Dashboard provides system-wide administration capabilities for the Dculus Forms platform.

## Overview

The Admin App is a React-based dashboard that allows administrators to manage organizations, users, and system-wide settings across the entire Dculus Forms platform. It provides cross-organizational access and system monitoring capabilities.

## Features

- **Dashboard**: System-wide statistics and health monitoring
- **Organizations Management**: View and manage all organizations
- **Cross-Organization Access**: Admin users can access data across all organizations
- **Role-Based Access Control**: Requires admin or superAdmin role for access
- **Real-time Data**: GraphQL-powered data fetching with Apollo Client

## Architecture

### Authentication & Authorization
- Uses **better-auth** with session cookies (not bearer tokens)
- Requires `admin` or `superAdmin` role for access
- Apollo Client configured with `credentials: 'include'` for cookie-based auth
- GraphQL context automatically validates admin permissions

### GraphQL Integration
- **Apollo Client** for GraphQL queries and mutations
- Endpoint: `http://localhost:4000/graphql`
- Admin-specific queries: `adminOrganizations`, `adminStats`, `adminOrganization`
- Cookie-based authentication with backend

### UI Components
- Imports all components from `@dculus/ui` package
- Uses shadcn/ui components (Card, Button, etc.)
- Shared utilities from `@dculus/utils`
- Consistent styling with other apps

## Development

### Starting the Admin App
```bash
# From root directory
pnpm admin-app:dev

# Or start all services
pnpm dev
```

### Access
- **URL**: http://localhost:3002
- **Port**: 3002 (configurable in package.json)

### Default Admin Credentials
```
Email: admin@dculus.com
Password: admin123!@#
Role: superAdmin
```

## File Structure

```
apps/admin-app/
├── src/
│   ├── components/          # Admin-specific React components
│   │   ├── AdminLayout.tsx  # Main layout wrapper
│   │   └── ...
│   ├── pages/               # Page components
│   │   ├── DashboardPage.tsx
│   │   ├── OrganizationsPage.tsx
│   │   └── ...
│   ├── services/            # API services
│   │   ├── apolloClient.ts  # Apollo Client configuration
│   │   └── auth.ts          # Authentication service
│   ├── graphql/             # GraphQL queries/mutations
│   │   └── organizations.ts
│   ├── hooks/               # Custom React hooks
│   │   └── useAuth.ts       # Authentication hook
│   ├── lib/                 # Utility functions
│   │   └── config.ts        # Configuration helpers
│   └── App.tsx              # Main App component
├── package.json
└── README.md
```

## Key GraphQL Queries

### Admin Organizations
```typescript
const ADMIN_ORGANIZATIONS_QUERY = gql`
  query AdminOrganizations($limit: Int, $offset: Int) {
    adminOrganizations(limit: $limit, offset: $offset) {
      organizations {
        id
        name
        slug
        logo
        createdAt
        updatedAt
        memberCount
        formCount
      }
      total
      hasMore
    }
  }
`;
```

### Admin Statistics
```typescript
const ADMIN_STATS_QUERY = gql`
  query AdminStats {
    adminStats {
      organizationCount
      userCount
      formCount
      responseCount
    }
  }
`;
```

## Authentication Flow

1. **Login**: User signs in via better-auth at `/api/auth/sign-in/email`
2. **Session**: Better-auth creates session cookie
3. **GraphQL**: Apollo Client includes cookies in requests
4. **Authorization**: Backend validates admin role in GraphQL context
5. **Access**: Admin queries return data for authorized users

## Configuration

### Environment Variables
- `VITE_BACKEND_URL`: Backend API URL (default: http://localhost:4000)
- `VITE_AUTH_URL`: Authentication URL (default: http://localhost:4000/api/auth)

### Apollo Client Configuration
```typescript
const httpLink = createHttpLink({
  uri: graphqlUrl,
  credentials: 'include', // Essential for cookie-based auth
});

export const client = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { errorPolicy: 'all' },
    query: { errorPolicy: 'all' },
  },
});
```

## Admin Setup

### Creating Super Admin User
```bash
# Set environment variables
export SUPER_ADMIN_EMAIL="admin@dculus.com"
export SUPER_ADMIN_PASSWORD="admin123!@#"

# Run setup script
pnpm admin:setup
```

### Manual Admin Role Assignment
```typescript
// In backend, update user role
await prisma.user.update({
  where: { email: 'user@example.com' },
  data: { role: 'admin' }
});
```

## Troubleshooting

### Authentication Issues
- Ensure backend is running on port 4000
- Check that better-auth is properly configured
- Verify CORS settings allow localhost:3002
- Use browser dev tools to check for session cookies

### GraphQL Errors
- Check backend logs for authentication context
- Verify admin role is assigned to user
- Ensure GraphQL endpoint is accessible
- Test queries in GraphQL playground at http://localhost:4000/graphql

### Common Error Messages
- `"Authentication required"`: User not logged in or session expired
- `"Admin access required"`: User lacks admin/superAdmin role
- `"Unable to load organizations"`: Check GraphQL endpoint and authentication

## Development Guidelines

### Adding New Admin Features
1. Create GraphQL resolvers in `apps/backend/src/graphql/resolvers/admin.ts`
2. Add admin permission checks using `requireAdmin()` helper
3. Create GraphQL queries in `apps/admin-app/src/graphql/`
4. Build React components using `@dculus/ui` components
5. Add routes to `App.tsx`

### Role-Based Access
- Use `requireAdmin()` in GraphQL resolvers
- Check user roles with `authService.isAdmin()` and `authService.isSuperAdmin()`
- Implement UI conditionals based on user permissions

### Testing Admin Features
1. Login with admin credentials at http://localhost:3002
2. Verify GraphQL queries work in browser network tab
3. Check backend logs for authentication context
4. Test cross-organizational data access

## Related Documentation

- **Main Project**: `/Users/natheeshkumarrangasamy/Desktop/DculusIndustries/dculus-forms/CLAUDE.md`
- **Backend API**: `apps/backend/README.md`
- **UI Components**: `packages/ui/README.md`
- **Better-auth Config**: `apps/backend/src/lib/better-auth.ts`