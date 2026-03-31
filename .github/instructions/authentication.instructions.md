---
applyTo: "**/lib/better-auth**,**/auth**,**/contexts/Auth**"
---

# Authentication (better-auth) Quick Reference

## Overview

This project uses **better-auth** for authentication with the following plugins:
- Email/password sign-in
- Organization management (multi-tenant)
- Bearer token support
- Admin plugin
- Email OTP

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/src/lib/better-auth.ts` | Server-side auth configuration |
| `apps/form-app/src/lib/auth-client.ts` | Form app auth client |
| `apps/form-viewer/src/lib/auth-client.ts` | Viewer auth client (minimal) |
| `apps/admin-app/src/lib/auth-client.ts` | Admin auth client (cookie-only) |
| `apps/form-app/src/contexts/AuthContext.tsx` | React auth context provider |

## Server Configuration

```typescript
// apps/backend/src/lib/better-auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer, organization, admin } from 'better-auth/plugins';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
  session: { expiresIn: 7 * 24 * 60 * 60 }, // 7 days
  plugins: [
    bearer(),
    organization({ ... }),
    admin({ ... }),
  ],
});
```

## Getting Auth in GraphQL Resolvers

```typescript
// ALWAYS use this pattern in resolvers
import { getUserAndOrgFromContext } from './better-auth.js';

const myResolver = async (_: any, args: any, context: any) => {
  const { userId, organizationId } = await getUserAndOrgFromContext(context);
  if (!userId) throw new Error('Authentication required');
  
  // Now use userId and organizationId
};
```

## Client Configuration

### Form App (Cookie + Bearer)
```typescript
import { createAuthClient } from 'better-auth/react';
import { bearerClient, organizationClient, adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [bearerClient(), organizationClient(), adminClient()],
});
```

### Admin App (Cookie Only)
```typescript
// admin-app uses cookies, NOT bearer tokens
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  // credentials: 'include' set in Apollo Client
  plugins: [organizationClient(), adminClient()],
});
```

## Role Hierarchy

| Level | Roles | Scope |
|-------|-------|-------|
| System | `user`, `admin`, `superAdmin` | `User.role` |
| Organization | `member`, `owner` | `Member.role` |
| Form | `VIEWER`, `EDITOR`, `OWNER`, `NO_ACCESS` | `FormPermission.permission` |

## Auth Hooks (Frontend)

```typescript
// Using the auth client
const { data: session } = authClient.useSession();

// Custom AuthContext
const { currentUser, organization, isAuthenticated } = useAuth();
```

## Session Management

- Sessions stored in `session` table (Prisma)
- `activeOrganizationId` tracks current org context
- 7-day expiry
- Bearer tokens for API access
- Cookies for web browser access

## Full better-auth Documentation

For comprehensive better-auth documentation including all plugins, social providers, email OTP,
and advanced configuration, see `.github/better_auth_llm.instructions.md` (24K lines of official docs).
