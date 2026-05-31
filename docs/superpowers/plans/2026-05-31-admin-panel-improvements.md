# Admin Panel Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all admin panel bugs (Invalid Date, duplicate templates), replace placeholder content with real data, add subscription management per org, and wire real system health checks.

**Architecture:** Backend-first — extend GraphQL schema + resolvers, then update frontend queries + pages. All subscription mutations write to AuditLog. Plan changes are local-DB overrides (Chargebee portal deep-link handles billing side).

**Tech Stack:** Express/Apollo GraphQL (backend), React + Apollo Client (admin-app), Prisma (DB), Chargebee (billing), `@dculus/ui` LoadingSpinner + animate-pulse skeletons (loading states), `toastSuccess`/`toastError` from `@dculus/ui` (mutation feedback).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `apps/backend/src/graphql/schema.ts` | Modify | Add OrgSubscription, OrgNearLimit, SystemHealthItem types; new queries + mutations |
| `apps/backend/src/graphql/resolvers/admin.ts` | Modify | serializeDate utility, extend all resolvers, add 4 new mutations + adminSystemHealth |
| `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts` | Modify | Tests for new resolvers and mutations |
| `apps/backend/prisma/schema.prisma` | Modify | Add `@@unique([name, category])` to FormTemplate |
| `apps/backend/src/scripts/dedupe-templates.ts` | Create | One-shot dedup script to run before adding unique constraint |
| `apps/admin-app/src/main.tsx` | Modify | Mount `<Toaster />` |
| `apps/admin-app/src/graphql/organizations.ts` | Modify | Extend ADMIN_ORGANIZATIONS_QUERY + ADMIN_STATS_QUERY |
| `apps/admin-app/src/graphql/organizationDetail.ts` | Modify | Extend ADMIN_ORGANIZATION_BY_ID_QUERY + add subscription mutations |
| `apps/admin-app/src/graphql/systemHealth.ts` | Create | ADMIN_SYSTEM_HEALTH_QUERY |
| `apps/admin-app/src/pages/DashboardPage.tsx` | Modify | Plan chips, usage alerts strip, real recent orgs, real system health |
| `apps/admin-app/src/pages/OrganizationsPage.tsx` | Modify | Search input, plan badge column, usage mini-bar |
| `apps/admin-app/src/pages/organizations/OrganizationDetailPage.tsx` | Modify | Overview/Subscription tabs + 4 subscription cards |
| `apps/admin-app/src/locales/en/dashboard.json` | Modify | Add plan distribution + usage alert keys |
| `apps/admin-app/src/locales/en/organizations.json` | Modify | Add search + plan badge keys |

---

## Task 1: Fix date serialization in adminOrganizations and adminOrganization

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`

- [ ] **Step 1: Add `serializeDate` utility just above `export const adminResolvers`**

In `apps/backend/src/graphql/resolvers/admin.ts`, add after the `getPostgresStats` function:

```typescript
function serializeDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
```

- [ ] **Step 2: Fix `adminOrganizations` return — wrap createdAt/updatedAt on org and its forms**

Replace the `return` block inside `adminOrganizations` (currently lines ~187–195):

```typescript
return {
  organizations: organizations.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    createdAt: serializeDate(org.createdAt)!,
    updatedAt: serializeDate(org.updatedAt)!,
    memberCount: org._count.members,
    formCount: org._count.forms,
    members: org.members,
    forms: org.forms.map(f => ({
      ...f,
      createdAt: serializeDate(f.createdAt)!,
    })),
  })),
  total,
  hasMore: offset + limit < total,
};
```

- [ ] **Step 3: Fix `adminOrganization` return — same pattern**

Replace the `return` block inside `adminOrganization` (currently ~lines 245–249):

```typescript
return {
  ...organization,
  createdAt: serializeDate(organization.createdAt)!,
  updatedAt: serializeDate(organization.updatedAt)!,
  memberCount: organization._count.members,
  formCount: organization._count.forms,
  forms: organization.forms.map(f => ({
    ...f,
    createdAt: serializeDate(f.createdAt)!,
  })),
};
```

- [ ] **Step 4: Write failing test in admin.test.ts**

Add inside `describe('adminOrganizations')` (or create that describe block):

```typescript
it('should return createdAt as ISO string not locale string', async () => {
  const org = {
    id: 'org-123', name: 'Test Org', slug: 'test', logo: null,
    createdAt: new Date('2026-01-15T10:00:00.000Z'),
    updatedAt: new Date('2026-01-15T10:00:00.000Z'),
    members: [], forms: [],
    _count: { members: 0, forms: 0 },
  };
  vi.mocked(prisma.organization.findMany).mockResolvedValue([org] as any);
  vi.mocked(prisma.organization.count).mockResolvedValue(1);

  const result = await adminResolvers.Query.adminOrganizations({}, { limit: 10, offset: 0 }, mockAdminContext);

  expect(result.organizations[0].createdAt).toBe('2026-01-15T10:00:00.000Z');
  expect(new Date(result.organizations[0].createdAt).toString()).not.toBe('Invalid Date');
});
```

- [ ] **Step 5: Run test**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -A5 "ISO string"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "fix(admin): serialize createdAt/updatedAt as ISO strings in admin resolvers"
```

---

## Task 2: Fix duplicate templates — dedup script + unique constraint

**Files:**
- Create: `apps/backend/src/scripts/dedupe-templates.ts`
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Create dedup script**

Create `apps/backend/src/scripts/dedupe-templates.ts`:

```typescript
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

async function dedupeTemplates() {
  logger.info('Deduplicating FormTemplate records...');

  const all = await prisma.formTemplate.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const seen = new Map<string, string>(); // key -> earliest id
  const toDelete: string[] = [];

  for (const t of all) {
    const key = `${t.name}__${t.category ?? ''}`;
    if (seen.has(key)) {
      toDelete.push(t.id);
    } else {
      seen.set(key, t.id);
    }
  }

  if (toDelete.length === 0) {
    logger.info('No duplicates found.');
  } else {
    await prisma.formTemplate.deleteMany({ where: { id: { in: toDelete } } });
    logger.info(`Deleted ${toDelete.length} duplicate templates.`);
  }

  await prisma.$disconnect();
}

dedupeTemplates().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add script to backend package.json**

In `apps/backend/package.json`, add to `scripts`:

```json
"db:dedupe-templates": "tsx src/scripts/dedupe-templates.ts"
```

- [ ] **Step 3: Run dedup against the dev database**

```bash
pnpm --filter backend db:dedupe-templates
```

Expected output: `Deleted N duplicate templates.`

- [ ] **Step 4: Add unique constraint to FormTemplate in schema.prisma**

In `apps/backend/prisma/schema.prisma`, update the `FormTemplate` model:

```prisma
model FormTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  category    String?
  formSchema  Json
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([name, category])
  @@map("form_template")
}
```

- [ ] **Step 5: Push schema**

```bash
pnpm db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/scripts/dedupe-templates.ts apps/backend/package.json apps/backend/prisma/schema.prisma
git commit -m "fix(seed): dedupe templates and add unique constraint on name+category"
```

---

## Task 3: Backend schema — add new GraphQL types, queries, mutations

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`

- [ ] **Step 1: Extend `AdminOrganization` type with subscription fields**

Find the `type AdminOrganization` block and replace it:

```graphql
type AdminOrganization {
  id: ID!
  name: String!
  slug: String!
  logo: String
  createdAt: String!
  updatedAt: String!
  memberCount: Int!
  formCount: Int!
  members: [Member!]!
  forms: [Form!]!
  planId: String
  subscriptionStatus: String
  submissionsUsed: Int
  submissionsLimit: Int
}
```

- [ ] **Step 2: Extend `AdminStats` type with plan distribution + usage alerts**

Replace the `type AdminStats` block:

```graphql
type AdminStats {
  organizationCount: Int!
  userCount: Int!
  formCount: Int!
  responseCount: Int!
  storageUsed: String!
  fileCount: Int!
  postgresDbSize: String!
  postgresTableCount: Int!
  freePlanCount: Int!
  starterPlanCount: Int!
  advancedPlanCount: Int!
  orgsNearLimit: [OrgNearLimit!]!
}

type OrgNearLimit {
  orgId: String!
  orgName: String!
  submissionsUsed: Int!
  submissionsLimit: Int!
  usagePercent: Int!
}
```

- [ ] **Step 3: Extend `AdminOrganizationDetail` and add `OrgSubscription` type**

After the `type OrganizationStats` block, add:

```graphql
type OrgSubscription {
  planId: String!
  status: String!
  viewsUsed: Int!
  submissionsUsed: Int!
  viewsLimit: Int
  submissionsLimit: Int
  currentPeriodStart: String!
  currentPeriodEnd: String!
  chargebeeCustomerId: String!
  chargebeeSubscriptionId: String
}
```

Then extend `type AdminOrganizationDetail`:

```graphql
type AdminOrganizationDetail {
  id: ID!
  name: String!
  slug: String
  logo: String
  createdAt: String!
  members: [OrganizationMember!]!
  stats: OrganizationStats!
  subscription: OrgSubscription
}
```

- [ ] **Step 4: Add `SystemHealthItem` type and `adminSystemHealth` query**

After the `AdminOrganizationDetail` block, add:

```graphql
type SystemHealthItem {
  label: String!
  status: String!
  latencyMs: Int
  detail: String
}
```

In the `type Query` block, add after the existing admin queries:

```graphql
adminSystemHealth: [SystemHealthItem!]!
```

Also update `adminOrganizations` to accept `search`:

```graphql
adminOrganizations(limit: Int, offset: Int, search: String): AdminOrganizationsResult!
```

- [ ] **Step 5: Add admin mutations to `type Mutation`**

In the `type Mutation` block, add a new `# Admin Mutations` section:

```graphql
# Admin Mutations
adminChangePlan(orgId: ID!, planId: String!): Boolean!
adminResetUsage(orgId: ID!): Boolean!
adminCancelSubscription(orgId: ID!): Boolean!
adminReactivateSubscription(orgId: ID!): Boolean!
```

- [ ] **Step 6: Type-check**

```bash
pnpm type-check 2>&1 | tail -5
```

Expected: no errors (schema.ts is not TypeScript so this checks the resolver types).

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/graphql/schema.ts
git commit -m "feat(schema): add OrgSubscription, OrgNearLimit, SystemHealthItem types and admin mutations"
```

---

## Task 4: Backend — extend adminOrganizations with subscription data + search

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`

- [ ] **Step 1: Update `AdminOrganizationsArgs` interface**

Replace the existing interface at the top of admin.ts:

```typescript
export interface AdminOrganizationsArgs {
  limit?: number;
  offset?: number;
  search?: string;
}
```

- [ ] **Step 2: Update the Prisma query inside `adminOrganizations`**

Replace the `prisma.organization.findMany` call to add subscription include and search where clause:

```typescript
const whereClause = args.search
  ? {
      OR: [
        { name: { contains: args.search, mode: 'insensitive' as const } },
        { slug: { contains: args.search, mode: 'insensitive' as const } },
      ],
    }
  : {};

const organizations = await prisma.organization.findMany({
  skip: offset,
  take: limit,
  where: whereClause,
  include: {
    members: {
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
    forms: {
      select: { id: true, title: true, isPublished: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    },
    subscription: true,
    _count: { select: { members: true, forms: true } },
  },
  orderBy: { createdAt: 'desc' },
});

const total = await prisma.organization.count({ where: whereClause });
```

- [ ] **Step 3: Update the return map to include subscription fields**

Replace the `return` block:

```typescript
return {
  organizations: organizations.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo,
    createdAt: serializeDate(org.createdAt)!,
    updatedAt: serializeDate(org.updatedAt)!,
    memberCount: org._count.members,
    formCount: org._count.forms,
    members: org.members,
    forms: org.forms.map(f => ({ ...f, createdAt: serializeDate(f.createdAt)! })),
    planId: org.subscription?.planId ?? null,
    subscriptionStatus: org.subscription?.status ?? null,
    submissionsUsed: org.subscription?.submissionsUsed ?? null,
    submissionsLimit: org.subscription?.submissionsLimit ?? null,
  })),
  total,
  hasMore: offset + limit < total,
};
```

- [ ] **Step 4: Add `subscription` to the prisma mock in admin.test.ts**

In the `vi.mock('../../../lib/prisma.js', ...)` block, add to the prisma mock:

```typescript
subscription: {
  count: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
},
auditLog: {
  create: vi.fn(),
},
```

- [ ] **Step 5: Write test for search and subscription fields**

```typescript
it('should filter organizations by search term', async () => {
  vi.mocked(prisma.organization.findMany).mockResolvedValue([]);
  vi.mocked(prisma.organization.count).mockResolvedValue(0);

  await adminResolvers.Query.adminOrganizations(
    {}, { limit: 10, offset: 0, search: 'acme' }, mockAdminContext
  );

  expect(vi.mocked(prisma.organization.findMany)).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        OR: [
          { name: { contains: 'acme', mode: 'insensitive' } },
          { slug: { contains: 'acme', mode: 'insensitive' } },
        ],
      },
    })
  );
});

it('should include planId from subscription', async () => {
  const org = {
    id: 'org-1', name: 'Acme', slug: 'acme', logo: null,
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    members: [], forms: [], _count: { members: 0, forms: 0 },
    subscription: { planId: 'starter', status: 'active', submissionsUsed: 100, submissionsLimit: 10000 },
  };
  vi.mocked(prisma.organization.findMany).mockResolvedValue([org] as any);
  vi.mocked(prisma.organization.count).mockResolvedValue(1);

  const result = await adminResolvers.Query.adminOrganizations({}, {}, mockAdminContext);

  expect(result.organizations[0].planId).toBe('starter');
  expect(result.organizations[0].submissionsUsed).toBe(100);
});
```

- [ ] **Step 6: Run tests**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|search|planId"
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "feat(admin): extend adminOrganizations with search and subscription data"
```

---

## Task 5: Backend — extend adminStats with plan counts + orgsNearLimit

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`

- [ ] **Step 1: Extend the `Promise.all` in `adminStats`**

Replace the existing `Promise.all` block inside `adminStats`:

```typescript
const [
  organizationCount,
  userCount,
  formCount,
  responseCount,
  s3Stats,
  pgStats,
  freePlanCount,
  starterPlanCount,
  advancedPlanCount,
  subscriptionsWithLimits,
] = await Promise.all([
  prisma.organization.count(),
  prisma.user.count(),
  prisma.form.count(),
  prisma.response.count(),
  getS3StorageStats(),
  getPostgresStats(),
  prisma.subscription.count({ where: { planId: 'free' } }),
  prisma.subscription.count({ where: { planId: 'starter' } }),
  prisma.subscription.count({ where: { planId: 'advanced' } }),
  prisma.subscription.findMany({
    where: { submissionsLimit: { not: null } },
    include: { organization: { select: { id: true, name: true } } },
  }),
]);
```

- [ ] **Step 2: Compute orgsNearLimit and extend the return object**

Replace the `return` block inside `adminStats`:

```typescript
const orgsNearLimit = (subscriptionsWithLimits as any[])
  .filter(s => s.submissionsLimit && s.submissionsUsed / s.submissionsLimit >= 0.8)
  .map(s => ({
    orgId: s.organization.id,
    orgName: s.organization.name,
    submissionsUsed: s.submissionsUsed,
    submissionsLimit: s.submissionsLimit,
    usagePercent: Math.round((s.submissionsUsed / s.submissionsLimit) * 100),
  }));

return {
  organizationCount,
  userCount,
  formCount,
  responseCount,
  storageUsed: s3Stats.storageUsed,
  fileCount: s3Stats.fileCount,
  postgresDbSize: pgStats.postgresDbSize,
  postgresTableCount: pgStats.postgresTableCount,
  freePlanCount,
  starterPlanCount,
  advancedPlanCount,
  orgsNearLimit,
};
```

- [ ] **Step 3: Write test**

```typescript
it('should return plan distribution counts', async () => {
  vi.mocked(prisma.organization.count).mockResolvedValue(3);
  vi.mocked(prisma.user.count).mockResolvedValue(5);
  vi.mocked(prisma.form.count).mockResolvedValue(10);
  vi.mocked(prisma.response.count).mockResolvedValue(20);
  mockS3Send.mockRejectedValue(new Error('S3 error'));
  vi.mocked(prisma.subscription.count)
    .mockResolvedValueOnce(2)   // free
    .mockResolvedValueOnce(1)   // starter
    .mockResolvedValueOnce(0);  // advanced
  vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);

  const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

  expect(result.freePlanCount).toBe(2);
  expect(result.starterPlanCount).toBe(1);
  expect(result.advancedPlanCount).toBe(0);
  expect(result.orgsNearLimit).toEqual([]);
});

it('should include orgs at >=80% usage in orgsNearLimit', async () => {
  vi.mocked(prisma.organization.count).mockResolvedValue(1);
  vi.mocked(prisma.user.count).mockResolvedValue(1);
  vi.mocked(prisma.form.count).mockResolvedValue(1);
  vi.mocked(prisma.response.count).mockResolvedValue(1);
  mockS3Send.mockRejectedValue(new Error('S3 error'));
  vi.mocked(prisma.subscription.count).mockResolvedValue(0);
  vi.mocked(prisma.subscription.findMany).mockResolvedValue([
    {
      submissionsUsed: 850, submissionsLimit: 1000,
      organization: { id: 'org-1', name: 'Acme' },
    } as any,
  ]);

  const result = await adminResolvers.Query.adminStats({}, {}, mockAdminContext);

  expect(result.orgsNearLimit).toHaveLength(1);
  expect(result.orgsNearLimit[0].usagePercent).toBe(85);
  expect(result.orgsNearLimit[0].orgName).toBe('Acme');
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -E "plan distribution|orgsNearLimit|PASS|FAIL"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "feat(admin): add plan distribution counts and usage alerts to adminStats"
```

---

## Task 6: Backend — add adminSystemHealth resolver

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`

- [ ] **Step 1: Add `adminSystemHealth` to the Query resolvers object**

Inside `export const adminResolvers = { Query: { ... } }`, add after `adminOrganizationById`:

```typescript
adminSystemHealth: async (_: any, __: any, context: { auth: BetterAuthContext }) => {
  requireAdminRole(context);

  const checks = await Promise.allSettled([
    // Database
    (async () => {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      return { label: 'Database', status: 'ok', latencyMs: Date.now() - start, detail: null };
    })(),
    // Chargebee
    (async () => {
      const ok = !!(process.env.CHARGEBEE_API_KEY && process.env.CHARGEBEE_SITE);
      return { label: 'Chargebee', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'API key or site not configured' };
    })(),
    // S3 Storage
    (async () => {
      const ok = !!(process.env.PUBLIC_S3_ACCESS_KEY && process.env.PUBLIC_S3_ENDPOINT);
      return { label: 'S3 Storage', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'S3 credentials not configured' };
    })(),
    // Email
    (async () => {
      const ok = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
      return { label: 'Email', status: ok ? 'ok' : 'degraded', latencyMs: null, detail: ok ? null : 'SMTP not configured' };
    })(),
  ]);

  return checks.map((result, i) => {
    const labels = ['Database', 'Chargebee', 'S3 Storage', 'Email'];
    if (result.status === 'fulfilled') return result.value;
    return { label: labels[i], status: 'error', latencyMs: null, detail: String(result.reason) };
  });
},
```

- [ ] **Step 2: Write tests**

```typescript
describe('adminSystemHealth', () => {
  it('should return error status when database is down', async () => {
    vi.mocked(prisma.$queryRaw as any) = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const result = await adminResolvers.Query.adminSystemHealth({}, {}, mockAdminContext);
    const dbCheck = result.find((r: any) => r.label === 'Database');

    expect(dbCheck?.status).toBe('error');
  });

  it('should require admin role', async () => {
    await expect(
      adminResolvers.Query.adminSystemHealth({}, {}, mockUserContext)
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Add `$queryRaw` to the prisma mock**

In the `vi.mock('../../../lib/prisma.js', ...)` block, add:

```typescript
$queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -E "adminSystemHealth|PASS|FAIL"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "feat(admin): add adminSystemHealth query with real DB/Chargebee/S3/Email checks"
```

---

## Task 7: Backend — extend adminOrganizationById with subscription

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`

- [ ] **Step 1: Add `subscription: true` to the Prisma include in `adminOrganizationById`**

Inside the `adminOrganizationById` resolver, update the `prisma.organization.findUnique` call to add `subscription: true` in the `include` block:

```typescript
const organization = await prisma.organization.findUnique({
  where: { id: args.id },
  include: {
    members: {
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    },
    forms: {
      select: {
        id: true, title: true, isPublished: true,
        createdAt: true, updatedAt: true, sharingScope: true,
      },
    },
    subscription: true,
  },
});
```

- [ ] **Step 2: Extend the return object with subscription**

Replace the `return` block inside `adminOrganizationById`:

```typescript
return {
  id: organization.id,
  name: organization.name,
  slug: organization.slug,
  logo: organization.logo,
  createdAt: serializeDate(organization.createdAt)!,
  members: organization.members.map(m => ({
    userId: m.user.id,
    userName: m.user.name,
    userEmail: m.user.email,
    userImage: m.user.image,
    role: m.role,
    createdAt: serializeDate(m.createdAt)!,
  })),
  stats: {
    totalForms: organization.forms.length,
    totalResponses,
  },
  subscription: organization.subscription
    ? {
        planId: organization.subscription.planId,
        status: organization.subscription.status,
        viewsUsed: organization.subscription.viewsUsed,
        submissionsUsed: organization.subscription.submissionsUsed,
        viewsLimit: organization.subscription.viewsLimit,
        submissionsLimit: organization.subscription.submissionsLimit,
        currentPeriodStart: serializeDate(organization.subscription.currentPeriodStart)!,
        currentPeriodEnd: serializeDate(organization.subscription.currentPeriodEnd)!,
        chargebeeCustomerId: organization.subscription.chargebeeCustomerId,
        chargebeeSubscriptionId: organization.subscription.chargebeeSubscriptionId,
      }
    : null,
};
```

- [ ] **Step 3: Write test**

```typescript
it('should include subscription data in adminOrganizationById', async () => {
  const org = {
    id: 'org-1', name: 'Acme', slug: 'acme', logo: null,
    createdAt: new Date('2026-01-01'), members: [], forms: [],
    subscription: {
      planId: 'starter', status: 'active',
      viewsUsed: 0, submissionsUsed: 500,
      viewsLimit: null, submissionsLimit: 10000,
      currentPeriodStart: new Date('2026-05-01'),
      currentPeriodEnd: new Date('2026-05-31'),
      chargebeeCustomerId: 'org_org-1',
      chargebeeSubscriptionId: 'sub_abc123',
    },
  };
  vi.mocked(prisma.organization.findUnique).mockResolvedValue(org as any);
  vi.mocked(prisma.response.count).mockResolvedValue(5);

  const result = await adminResolvers.Query.adminOrganizationById({}, { id: 'org-1' }, mockAdminContext);

  expect(result.subscription?.planId).toBe('starter');
  expect(result.subscription?.currentPeriodStart).toBe('2026-05-01T00:00:00.000Z');
  expect(result.subscription?.chargebeeCustomerId).toBe('org_org-1');
});
```

- [ ] **Step 4: Run tests**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -E "subscription data|PASS|FAIL"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "feat(admin): extend adminOrganizationById with subscription data"
```

---

## Task 8: Backend — add admin subscription mutations

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/admin.ts`
- Modify: `apps/backend/src/graphql/resolvers/__tests__/admin.test.ts`
- Modify: `apps/backend/src/graphql/resolvers.ts`

- [ ] **Step 1: Add imports for chargebeeService and usageService at the top of admin.ts**

Add after the existing imports:

```typescript
import { cancelChargebeeSubscription, reactivateChargebeeSubscription } from '../../services/chargebeeService.js';
import { resetUsageCounters } from '../../subscriptions/usageService.js';
```

- [ ] **Step 2: Add `PLAN_LIMITS` constant to admin.ts**

After the imports, add:

```typescript
const PLAN_LIMITS: Record<string, { views: number | null; submissions: number | null }> = {
  free: { views: 10000, submissions: 1000 },
  starter: { views: null, submissions: 10000 },
  advanced: { views: null, submissions: 100000 },
};
```

- [ ] **Step 3: Add `Mutation` object to `adminResolvers`**

After the closing brace of `Query`, add a `Mutation` block inside `adminResolvers`:

```typescript
Mutation: {
  adminChangePlan: async (_: any, args: { orgId: string; planId: string }, context: { auth: BetterAuthContext }) => {
    const admin = requireAdminRole(context);
    const { orgId, planId } = args;

    if (!['free', 'starter', 'advanced'].includes(planId)) {
      throw createGraphQLError('Invalid plan ID', GRAPHQL_ERROR_CODES.INVALID_INPUT);
    }

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!subscription) {
      throw createGraphQLError('Subscription not found for this organization', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }

    const limits = PLAN_LIMITS[planId];
    const previousPlan = subscription.planId;

    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        planId,
        viewsLimit: limits.views,
        submissionsLimit: limits.submissions,
        status: 'active',
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'plan_changed',
        actorId: admin.id,
        resourceType: 'Organization',
        resourceId: orgId,
        metadata: { from: previousPlan, to: planId, changedBy: admin.email },
      },
    });

    logger.info(`[Admin] Plan changed for org ${orgId}: ${previousPlan} -> ${planId} by ${admin.email}`);
    return true;
  },

  adminResetUsage: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
    const admin = requireAdminRole(context);
    const { orgId } = args;

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!subscription) {
      throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }

    await resetUsageCounters(orgId, subscription.currentPeriodStart, subscription.currentPeriodEnd);

    await prisma.auditLog.create({
      data: {
        action: 'usage_reset',
        actorId: admin.id,
        resourceType: 'Organization',
        resourceId: orgId,
        metadata: {
          resetBy: admin.email,
          previousSubmissionsUsed: subscription.submissionsUsed,
          previousViewsUsed: subscription.viewsUsed,
        },
      },
    });

    logger.info(`[Admin] Usage reset for org ${orgId} by ${admin.email}`);
    return true;
  },

  adminCancelSubscription: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
    requireAdminRole(context);
    const { orgId } = args;

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!subscription) {
      throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }
    if (!subscription.chargebeeSubscriptionId) {
      throw createGraphQLError('No Chargebee subscription to cancel (free plan)', GRAPHQL_ERROR_CODES.INVALID_INPUT);
    }

    await cancelChargebeeSubscription(subscription.chargebeeSubscriptionId, true);
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { status: 'cancelled' },
    });

    return true;
  },

  adminReactivateSubscription: async (_: any, args: { orgId: string }, context: { auth: BetterAuthContext }) => {
    requireAdminRole(context);
    const { orgId } = args;

    const subscription = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    if (!subscription) {
      throw createGraphQLError('Subscription not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
    }
    if (!subscription.chargebeeSubscriptionId) {
      throw createGraphQLError('No Chargebee subscription to reactivate', GRAPHQL_ERROR_CODES.INVALID_INPUT);
    }

    await reactivateChargebeeSubscription(subscription.chargebeeSubscriptionId);
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { status: 'active' },
    });

    return true;
  },
},
```

- [ ] **Step 4: Register mutations in resolvers.ts**

In `apps/backend/src/graphql/resolvers.ts`, add to the `Mutation` spread:

```typescript
Mutation: {
  // ... existing mutations ...
  ...adminResolvers.Mutation,
},
```

- [ ] **Step 5: Write tests for adminChangePlan**

```typescript
describe('adminChangePlan', () => {
  it('should update planId and limits for a valid plan', async () => {
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      organizationId: 'org-1', planId: 'free', status: 'active',
      chargebeeSubscriptionId: null, viewsUsed: 0, submissionsUsed: 0,
      currentPeriodStart: new Date(), currentPeriodEnd: new Date(),
    } as any);
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const result = await adminResolvers.Mutation.adminChangePlan(
      {}, { orgId: 'org-1', planId: 'starter' }, mockAdminContext
    );

    expect(result).toBe(true);
    expect(vi.mocked(prisma.subscription.update)).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      data: { planId: 'starter', viewsLimit: null, submissionsLimit: 10000, status: 'active' },
    });
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'plan_changed' }) })
    );
  });

  it('should reject invalid plan IDs', async () => {
    await expect(
      adminResolvers.Mutation.adminChangePlan({}, { orgId: 'org-1', planId: 'enterprise' }, mockAdminContext)
    ).rejects.toThrow();
  });

  it('should require admin role', async () => {
    await expect(
      adminResolvers.Mutation.adminChangePlan({}, { orgId: 'org-1', planId: 'starter' }, mockUserContext)
    ).rejects.toThrow();
  });
});

describe('adminResetUsage', () => {
  it('should reset usage counters and write audit log', async () => {
    const periodStart = new Date('2026-05-01');
    const periodEnd = new Date('2026-05-31');
    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      organizationId: 'org-1', viewsUsed: 500, submissionsUsed: 200,
      currentPeriodStart: periodStart, currentPeriodEnd: periodEnd,
    } as any);
    vi.mocked(prisma.subscription.update).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const result = await adminResolvers.Mutation.adminResetUsage({}, { orgId: 'org-1' }, mockAdminContext);

    expect(result).toBe(true);
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'usage_reset' }) })
    );
  });
});
```

- [ ] **Step 6: Mock chargebeeService and usageService in test file**

Add at the top of admin.test.ts:

```typescript
vi.mock('../../../services/chargebeeService.js', () => ({
  cancelChargebeeSubscription: vi.fn().mockResolvedValue(undefined),
  reactivateChargebeeSubscription: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../subscriptions/usageService.js', () => ({
  resetUsageCounters: vi.fn().mockResolvedValue(undefined),
}));
```

- [ ] **Step 7: Run tests**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -E "adminChangePlan|adminResetUsage|PASS|FAIL"
```

Expected: PASS

- [ ] **Step 8: Type-check**

```bash
pnpm type-check 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/graphql/resolvers/admin.ts apps/backend/src/graphql/resolvers/resolvers.ts apps/backend/src/graphql/resolvers/__tests__/admin.test.ts
git commit -m "feat(admin): add adminChangePlan, adminResetUsage, adminCancelSubscription, adminReactivateSubscription mutations"
```

---

## Task 9: Frontend — mount Toaster, add new GraphQL queries and mutations

**Files:**
- Modify: `apps/admin-app/src/main.tsx`
- Modify: `apps/admin-app/src/graphql/organizations.ts`
- Modify: `apps/admin-app/src/graphql/organizationDetail.ts`
- Create: `apps/admin-app/src/graphql/systemHealth.ts`

- [ ] **Step 1: Mount Toaster in main.tsx**

Replace the contents of `apps/admin-app/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './hooks/useAuth';
import { LocaleProvider } from './contexts/LocaleContext';
import { client } from './services/apolloClient';
import { Toaster } from '@dculus/ui';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <ApolloProvider client={client}>
        <AuthProvider>
          <BrowserRouter>
            <App />
            <Toaster />
          </BrowserRouter>
        </AuthProvider>
      </ApolloProvider>
    </LocaleProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Update ADMIN_ORGANIZATIONS_QUERY in organizations.ts**

Replace `ADMIN_ORGANIZATIONS_QUERY`:

```typescript
export const ADMIN_ORGANIZATIONS_QUERY = gql`
  query AdminOrganizations($limit: Int, $offset: Int, $search: String) {
    adminOrganizations(limit: $limit, offset: $offset, search: $search) {
      organizations {
        id
        name
        slug
        logo
        createdAt
        updatedAt
        memberCount
        formCount
        planId
        subscriptionStatus
        submissionsUsed
        submissionsLimit
      }
      total
      hasMore
    }
  }
`;
```

- [ ] **Step 3: Update ADMIN_STATS_QUERY in organizations.ts**

Replace `ADMIN_STATS_QUERY`:

```typescript
export const ADMIN_STATS_QUERY = gql`
  query AdminStats {
    adminStats {
      organizationCount
      userCount
      formCount
      responseCount
      storageUsed
      fileCount
      postgresDbSize
      postgresTableCount
      freePlanCount
      starterPlanCount
      advancedPlanCount
      orgsNearLimit {
        orgId
        orgName
        submissionsUsed
        submissionsLimit
        usagePercent
      }
    }
  }
`;
```

- [ ] **Step 4: Create systemHealth.ts**

Create `apps/admin-app/src/graphql/systemHealth.ts`:

```typescript
import { gql } from '@apollo/client';

export const ADMIN_SYSTEM_HEALTH_QUERY = gql`
  query AdminSystemHealth {
    adminSystemHealth {
      label
      status
      latencyMs
      detail
    }
  }
`;

export interface SystemHealthItem {
  label: string;
  status: 'ok' | 'degraded' | 'error';
  latencyMs: number | null;
  detail: string | null;
}
```

- [ ] **Step 5: Update ADMIN_ORGANIZATION_BY_ID_QUERY in organizationDetail.ts**

Replace the query and add mutations + types:

```typescript
import { gql } from '@apollo/client';

export const ADMIN_ORGANIZATION_BY_ID_QUERY = gql`
  query AdminOrganizationById($id: String!) {
    adminOrganizationById(id: $id) {
      id
      name
      slug
      logo
      createdAt
      members {
        userId
        userName
        userEmail
        userImage
        role
        createdAt
      }
      stats {
        totalForms
        totalResponses
      }
      subscription {
        planId
        status
        viewsUsed
        submissionsUsed
        viewsLimit
        submissionsLimit
        currentPeriodStart
        currentPeriodEnd
        chargebeeCustomerId
        chargebeeSubscriptionId
      }
    }
  }
`;

export const ADMIN_CHANGE_PLAN_MUTATION = gql`
  mutation AdminChangePlan($orgId: ID!, $planId: String!) {
    adminChangePlan(orgId: $orgId, planId: $planId)
  }
`;

export const ADMIN_RESET_USAGE_MUTATION = gql`
  mutation AdminResetUsage($orgId: ID!) {
    adminResetUsage(orgId: $orgId)
  }
`;

export const ADMIN_CANCEL_SUBSCRIPTION_MUTATION = gql`
  mutation AdminCancelSubscription($orgId: ID!) {
    adminCancelSubscription(orgId: $orgId)
  }
`;

export const ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION = gql`
  mutation AdminReactivateSubscription($orgId: ID!) {
    adminReactivateSubscription(orgId: $orgId)
  }
`;

export interface OrgSubscription {
  planId: string;
  status: string;
  viewsUsed: number;
  submissionsUsed: number;
  viewsLimit: number | null;
  submissionsLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  chargebeeCustomerId: string;
  chargebeeSubscriptionId: string | null;
}

export interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  role: string;
  createdAt: string;
}

export interface OrganizationStats {
  totalForms: number;
  totalResponses: number;
}

export interface AdminOrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: string;
  members: OrganizationMember[];
  stats: OrganizationStats;
  subscription: OrgSubscription | null;
}

export interface AdminOrganizationByIdQueryData {
  adminOrganizationById: AdminOrganizationDetail;
}
```

- [ ] **Step 6: Type-check**

```bash
pnpm type-check 2>&1 | grep -E "admin-app.*error|Error" | head -10
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/admin-app/src/main.tsx apps/admin-app/src/graphql/organizations.ts apps/admin-app/src/graphql/organizationDetail.ts apps/admin-app/src/graphql/systemHealth.ts
git commit -m "feat(admin-app): mount Toaster, update GraphQL queries with subscription and system health"
```

---

## Task 10: Frontend — update DashboardPage

**Files:**
- Modify: `apps/admin-app/src/pages/DashboardPage.tsx`
- Modify: `apps/admin-app/src/locales/en/dashboard.json`

- [ ] **Step 1: Update dashboard.json with new locale keys**

Replace `apps/admin-app/src/locales/en/dashboard.json`:

```json
{
  "title": "Dashboard",
  "welcome": "Welcome to the Dculus Forms admin dashboard",
  "stats": {
    "totalOrganizations": "Total Organizations",
    "totalUsers": "Total Users",
    "totalForms": "Total Forms",
    "formResponses": "Form Responses"
  },
  "storage": {
    "title": "Storage Overview",
    "s3Storage": "S3 Storage",
    "postgresDB": "PostgreSQL",
    "files": "files",
    "tables": "tables"
  },
  "plans": {
    "title": "Plan Distribution",
    "free": "Free",
    "starter": "Starter",
    "advanced": "Advanced",
    "orgs": "orgs"
  },
  "usageAlerts": {
    "title": "{{count}} organization(s) are at ≥80% of their submission limit",
    "viewAll": "View"
  },
  "recentActivity": {
    "recentOrganizations": "Recent Organizations",
    "noOrganizations": "No organizations yet",
    "plan": "Plan",
    "members": "Members",
    "forms": "Forms"
  },
  "systemHealth": {
    "title": "System Health",
    "ok": "OK",
    "degraded": "Degraded",
    "error": "Error"
  },
  "error": {
    "unableToLoad": "Unable to load dashboard",
    "checkConnection": "Please check your connection and try again.",
    "backendRunning": "Make sure the backend server is running and GraphQL endpoint is accessible."
  }
}
```

- [ ] **Step 2: Replace DashboardPage.tsx entirely**

```typescript
import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@dculus/ui';
import {
  AlertCircle, Building2, Users, FileText, BarChart3,
  HardDrive, Database, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { ADMIN_STATS_QUERY, ADMIN_ORGANIZATIONS_QUERY } from '../graphql/organizations';
import { ADMIN_SYSTEM_HEALTH_QUERY, SystemHealthItem } from '../graphql/systemHealth';
import { useTranslation } from '../hooks/useTranslation';

const STAT_COLORS = [
  { iconBg: 'var(--tf-icon-salmon)', iconColor: 'var(--tf-dark)' },
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },
  { iconBg: '#fbe19d', iconColor: '#8b6a18' },
  { iconBg: 'var(--tf-icon-lavender)', iconColor: '#5c2e6b' },
];

const STORAGE_COLORS = [
  { iconBg: 'var(--tf-icon-gray)', iconColor: 'var(--tf-text)' },
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },
];

const StatCard: React.FC<{
  name: string; value: string; subtitle?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; large?: boolean;
}> = ({ name, value, subtitle, icon: Icon, iconBg, iconColor, large = false }) => (
  <div className="rounded-xl bg-white p-5 flex items-center gap-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
    <div className={`${large ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0`} style={{ backgroundColor: iconBg }}>
      <Icon className={large ? 'h-6 w-6' : 'h-5 w-5'} style={{ color: iconColor }} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium truncate text-muted-foreground">{name}</p>
      <p className={`font-light truncate text-primary ${large ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {subtitle && <p className="text-xs mt-0.5 text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const planBadgeStyle = (planId: string) => {
  switch (planId) {
    case 'starter': return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default: return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const healthBadgeStyle = (status: string) => {
  switch (status) {
    case 'ok': return { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' };
    case 'degraded': return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
    default: return { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' };
  }
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  const { data: statsData, loading: statsLoading, error: statsError } = useQuery(ADMIN_STATS_QUERY);
  const { data: orgsData, loading: orgsLoading } = useQuery(ADMIN_ORGANIZATIONS_QUERY, {
    variables: { limit: 5, offset: 0 },
  });
  const { data: healthData, loading: healthLoading } = useQuery(ADMIN_SYSTEM_HEALTH_QUERY);

  const stats = [
    { name: t('stats.totalOrganizations'), value: statsData?.adminStats?.organizationCount?.toString() || '0', icon: Building2, ...STAT_COLORS[0] },
    { name: t('stats.totalUsers'),         value: statsData?.adminStats?.userCount?.toString() || '0',         icon: Users,      ...STAT_COLORS[1] },
    { name: t('stats.totalForms'),         value: statsData?.adminStats?.formCount?.toString() || '0',         icon: FileText,   ...STAT_COLORS[2] },
    { name: t('stats.formResponses'),      value: statsData?.adminStats?.responseCount?.toString() || '0',     icon: BarChart3,  ...STAT_COLORS[3] },
  ];

  const storageStats = [
    { name: t('storage.s3Storage'),  value: statsData?.adminStats?.storageUsed || '0 B',    subtitle: `${statsData?.adminStats?.fileCount || 0} ${t('storage.files')}`,           icon: HardDrive, ...STORAGE_COLORS[0] },
    { name: t('storage.postgresDB'), value: statsData?.adminStats?.postgresDbSize || '0 B', subtitle: `${statsData?.adminStats?.postgresTableCount || 0} ${t('storage.tables')}`, icon: Database,  ...STORAGE_COLORS[1] },
  ];

  const planChips = [
    { key: 'free',     count: statsData?.adminStats?.freePlanCount     ?? 0 },
    { key: 'starter',  count: statsData?.adminStats?.starterPlanCount  ?? 0 },
    { key: 'advanced', count: statsData?.adminStats?.advancedPlanCount ?? 0 },
  ];

  const orgsNearLimit = statsData?.adminStats?.orgsNearLimit ?? [];
  const recentOrgs = orgsData?.adminOrganizations?.organizations ?? [];
  const healthItems: SystemHealthItem[] = healthData?.adminSystemHealth ?? [];

  if (statsError) {
    return (
      <EmptyState
        variant="error"
        className="min-h-64"
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title={t('error.unableToLoad')}
        description={statsError.message || t('error.checkConnection')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{t('welcome')}</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          statsLoading
            ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-20" style={{ border: '1px solid var(--tf-border-medium)' }} />
            : <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Storage */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-primary">{t('storage.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {storageStats.map((stat) => (
            statsLoading
              ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-24" style={{ border: '1px solid var(--tf-border-medium)' }} />
              : <StatCard key={stat.name} {...stat} large />
          ))}
        </div>
      </div>

      {/* Plan distribution */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-primary">{t('plans.title')}</h2>
        <div className="flex gap-3 flex-wrap">
          {statsLoading
            ? [0,1,2].map(i => <div key={i} className="animate-pulse rounded-full h-6 w-24" style={{ backgroundColor: 'var(--tf-faint)' }} />)
            : planChips.map(({ key, count }) => (
                <span key={key} className="px-3 py-1 rounded-full text-xs font-medium" style={planBadgeStyle(key)}>
                  {t(`plans.${key}`)} · {count} {t('plans.orgs')}
                </span>
              ))
          }
        </div>
      </div>

      {/* Usage alerts */}
      {!statsLoading && orgsNearLimit.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setAlertsExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#92400e' }} />
              <span className="text-xs font-medium" style={{ color: '#92400e' }}>
                {t('usageAlerts.title', { count: orgsNearLimit.length } as any)}
              </span>
            </div>
            {alertsExpanded ? <ChevronUp className="h-4 w-4" style={{ color: '#92400e' }} /> : <ChevronDown className="h-4 w-4" style={{ color: '#92400e' }} />}
          </div>
          {alertsExpanded && (
            <div className="mt-3 space-y-1.5">
              {orgsNearLimit.map((org: any) => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/organizations/${org.orgId}`)}
                >
                  <span className="text-xs font-medium" style={{ color: '#92400e' }}>{org.orgName}</span>
                  <span className="text-xs" style={{ color: '#92400e' }}>{org.submissionsUsed.toLocaleString()} / {org.submissionsLimit.toLocaleString()} ({org.usagePercent}%)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {statsLoading && <div className="animate-pulse rounded-xl h-12" style={{ backgroundColor: 'var(--tf-faint)' }} />}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent organizations */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('recentActivity.recentOrganizations')}</h3>
          {orgsLoading ? (
            <div className="space-y-2">
              {[0,1,2,3,4].map(i => <div key={i} className="animate-pulse rounded-xl h-10" style={{ backgroundColor: 'var(--tf-faint)' }} />)}
            </div>
          ) : recentOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Building2 className="h-8 w-8 mb-2 text-[var(--tf-icon-gray)]" />
              <p className="text-xs font-medium text-muted-foreground">{t('recentActivity.noOrganizations')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrgs.map((org: any) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--tf-tab-bg-faint)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/organizations/${org.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
                      <Building2 className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{org.name}</p>
                      <p className="text-[10px] text-muted-foreground">/{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {org.planId && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize" style={planBadgeStyle(org.planId)}>
                        {org.planId}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{org.memberCount}m · {org.formCount}f</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System health */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('systemHealth.title')}</h3>
          <div className="space-y-3">
            {healthLoading
              ? [0,1,2,3].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="animate-pulse rounded h-3 w-24" style={{ backgroundColor: 'var(--tf-faint)' }} />
                    <div className="animate-pulse rounded-full h-5 w-16" style={{ backgroundColor: 'var(--tf-faint)' }} />
                  </div>
                ))
              : healthItems.map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      {item.latencyMs != null && (
                        <span className="text-[10px] text-muted-foreground ml-1">({item.latencyMs}ms)</span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={healthBadgeStyle(item.status)}>
                      {t(`systemHealth.${item.status}` as any)}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check 2>&1 | grep "admin-app" | head -10
```

Expected: no errors

- [ ] **Step 4: Verify in browser at http://localhost:3002/dashboard**

Check: stat cards load, plan chips show real counts, recent orgs table shows 5 orgs with plan badges, system health shows real colored badges with DB latency.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-app/src/pages/DashboardPage.tsx apps/admin-app/src/locales/en/dashboard.json
git commit -m "feat(dashboard): wire plan distribution, usage alerts, real recent orgs, real system health"
```

---

## Task 11: Frontend — update OrganizationsPage with search, plan badge, usage mini-bar

**Files:**
- Modify: `apps/admin-app/src/pages/OrganizationsPage.tsx`
- Modify: `apps/admin-app/src/locales/en/organizations.json`

- [ ] **Step 1: Add search key to organizations.json**

Add to `apps/admin-app/src/locales/en/organizations.json`:

```json
{
  "title": "Organizations",
  "subtitle": "Manage all organizations in the system",
  "members": "members",
  "forms": "forms",
  "created": "Created",
  "viewDetails": "View Details",
  "search": {
    "placeholder": "Search organizations by name or slug..."
  },
  "plan": {
    "columnHeader": "Plan",
    "free": "Free",
    "starter": "Starter",
    "advanced": "Advanced"
  },
  "error": {
    "unableToLoad": "Unable to load organizations",
    "checkConnection": "Please check your connection and try again."
  }
}
```

- [ ] **Step 2: Replace OrganizationsPage.tsx**

```typescript
import React, { useState, useCallback } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner } from '@dculus/ui';
import { Building2, Search, AlertTriangle } from 'lucide-react';
import { ADMIN_ORGANIZATIONS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  formCount: number;
  planId?: string | null;
  subscriptionStatus?: string | null;
  submissionsUsed?: number | null;
  submissionsLimit?: number | null;
}

const planBadgeStyle = (planId: string, status?: string | null) => {
  if (status === 'past_due') return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
  switch (planId) {
    case 'starter':  return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default:         return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const UsageMiniBar: React.FC<{ used: number; limit: number }> = ({ used, limit }) => {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
  return (
    <div className="mt-1">
      <div className="h-1 rounded-full w-20" style={{ backgroundColor: 'var(--tf-faint)' }}>
        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--tf-muted)' }}>{used.toLocaleString()} / {limit.toLocaleString()}</p>
    </div>
  );
};

const ActionLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <Button {...(props as any)} variant="ghost" size="sm" className="text-xs h-7 px-2 text-muted-foreground hover:text-primary">
    {children}
  </Button>
);

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('organizations');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const { data, loading, error, refetch } = useQuery(ADMIN_ORGANIZATIONS_QUERY, {
    variables: { limit: 50, offset: 0, search: debouncedSearch || undefined },
  });

  const organizations: AdminOrganization[] = data?.adminOrganizations?.organizations || [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1 text-primary">{t('error.unableToLoad')}</h2>
        <p className="text-xs mb-3 text-muted-foreground">{error.message || t('error.checkConnection')}</p>
        <ActionLink onClick={() => refetch()}>Try again</ActionLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          style={{ border: '1px solid var(--tf-border-medium)' }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div className="rounded-xl bg-white overflow-hidden" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          {organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-faint)' }}>
                <Building2 className="h-6 w-6 text-[var(--tf-icon-gray)]" />
              </div>
              <p className="text-sm font-medium text-primary">No Organizations</p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                {debouncedSearch ? 'No organizations match your search.' : 'No organizations have been created yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
                    {['Organization', 'Members', 'Forms', t('plan.columnHeader'), 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-faint)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {organizations.map((org, i) => (
                    <tr
                      key={org.id}
                      className="hover:bg-[var(--tf-tab-bg-faint)] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
                            {org.logo
                              ? <img src={org.logo} alt={org.name} className="w-8 h-8 rounded-lg object-cover" />
                              : <Building2 className="h-4 w-4 text-primary" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary">{org.name}</p>
                            <p className="text-xs text-muted-foreground">/{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{org.memberCount}</td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{org.formCount}</td>
                      <td className="px-5 py-3.5">
                        {org.planId ? (
                          <div>
                            <div className="flex items-center gap-1">
                              {org.subscriptionStatus === 'past_due' && (
                                <AlertTriangle className="h-3 w-3" style={{ color: '#991b1b' }} />
                              )}
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize" style={planBadgeStyle(org.planId, org.subscriptionStatus)}>
                                {org.planId}
                              </span>
                            </div>
                            {org.submissionsUsed != null && org.submissionsLimit != null && (
                              <UsageMiniBar used={org.submissionsUsed} limit={org.submissionsLimit} />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionLink onClick={() => navigate(`/organizations/${org.id}`)}>View</ActionLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check 2>&1 | grep "admin-app" | head -10
```

Expected: no errors

- [ ] **Step 4: Verify in browser at http://localhost:3002/organizations**

Check: dates render correctly (not "Invalid Date"), Plan column shows colored badges, usage mini-bars appear for orgs with limits, search filters the table in real time.

- [ ] **Step 5: Commit**

```bash
git add apps/admin-app/src/pages/OrganizationsPage.tsx apps/admin-app/src/locales/en/organizations.json
git commit -m "feat(orgs): add search, plan badge column, usage mini-bar, fix Invalid Date"
```

---

## Task 12: Frontend — add Subscription tab to OrganizationDetailPage

**Files:**
- Modify: `apps/admin-app/src/pages/organizations/OrganizationDetailPage.tsx`

- [ ] **Step 1: Replace OrganizationDetailPage.tsx entirely**

```typescript
import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, LoadingSpinner, toastSuccess, toastError } from '@dculus/ui';
import {
  ArrowLeft, Building2, Users, FileText, BarChart3,
  Calendar, Mail, ExternalLink, AlertTriangle, CreditCard, RefreshCw,
} from 'lucide-react';
import {
  ADMIN_ORGANIZATION_BY_ID_QUERY,
  ADMIN_CHANGE_PLAN_MUTATION,
  ADMIN_RESET_USAGE_MUTATION,
  ADMIN_CANCEL_SUBSCRIPTION_MUTATION,
  ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION,
  AdminOrganizationByIdQueryData,
  OrgSubscription,
} from '../../graphql/organizationDetail';

const CHARGEBEE_SITE = import.meta.env.VITE_CHARGEBEE_SITE ?? '';

const planBadgeStyle = (planId: string) => {
  switch (planId) {
    case 'starter':  return { backgroundColor: '#dbeafe', color: '#1d4ed8' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9' };
    default:         return { backgroundColor: '#f3f4f6', color: '#374151' };
  }
};

const statusBadgeStyle = (status: string) => {
  switch (status) {
    case 'active':    return { backgroundColor: '#d1fae5', color: '#065f46' };
    case 'past_due':  return { backgroundColor: '#fee2e2', color: '#991b1b' };
    case 'cancelled': return { backgroundColor: '#f3f4f6', color: '#6b7280' };
    default:          return { backgroundColor: '#f3f4f6', color: '#6b7280' };
  }
};

const UsageBar: React.FC<{ label: string; used: number; limit: number | null }> = ({ label, used, limit }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
  return (
    <div className="flex-1">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {limit == null ? 'Unlimited' : `${used.toLocaleString()} / ${limit.toLocaleString()}`}
        </span>
      </div>
      {limit != null && (
        <>
          <div className="h-2 rounded-full w-full" style={{ backgroundColor: 'var(--tf-faint)' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <p className="text-[10px] mt-0.5 text-muted-foreground">{pct}% used</p>
        </>
      )}
    </div>
  );
};

const formatDate = (s: string) => new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const daysRemaining = (endDate: string) => {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const PLANS = ['free', 'starter', 'advanced'] as const;

export const OrganizationDetailPage = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'subscription'>('overview');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<null | 'changePlan' | 'resetUsage' | 'cancel' | 'reactivate'>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const { data, loading, error, refetch } = useQuery<AdminOrganizationByIdQueryData>(
    ADMIN_ORGANIZATION_BY_ID_QUERY,
    { variables: { id: orgId }, skip: !orgId }
  );

  const [changePlan, { loading: changingPlan }] = useMutation(ADMIN_CHANGE_PLAN_MUTATION, {
    onCompleted: () => { toastSuccess('Plan updated', 'The plan has been changed successfully.'); setConfirmModal(null); refetch(); },
    onError: (e) => toastError('Failed to change plan', e.message),
  });

  const [resetUsage, { loading: resettingUsage }] = useMutation(ADMIN_RESET_USAGE_MUTATION, {
    onCompleted: () => { toastSuccess('Usage reset', 'Usage counters have been reset to zero.'); setConfirmModal(null); setResetConfirmText(''); refetch(); },
    onError: (e) => toastError('Failed to reset usage', e.message),
  });

  const [cancelSub, { loading: cancelling }] = useMutation(ADMIN_CANCEL_SUBSCRIPTION_MUTATION, {
    onCompleted: () => { toastSuccess('Subscription cancelled', 'The subscription has been cancelled.'); setConfirmModal(null); refetch(); },
    onError: (e) => toastError('Failed to cancel', e.message),
  });

  const [reactivateSub, { loading: reactivating }] = useMutation(ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION, {
    onCompleted: () => { toastSuccess('Subscription reactivated', 'The subscription is now active again.'); setConfirmModal(null); refetch(); },
    onError: (e) => toastError('Failed to reactivate', e.message),
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const getRoleBadgeColor = (role: string) => {
    if (role.toLowerCase() === 'owner') return 'bg-purple-100 text-purple-700';
    if (role.toLowerCase() === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-muted text-foreground';
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-64"><LoadingSpinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h3 className="text-sm font-semibold text-primary mb-1">Error loading organization</h3>
        <p className="text-xs text-muted-foreground mb-4">{error?.message || 'Organization not found'}</p>
        <Button onClick={() => navigate('/organizations')} variant="outline" size="sm">Back to Organizations</Button>
      </div>
    );
  }

  const org = data.adminOrganizationById;
  const sub: OrgSubscription | null = org.subscription;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Button onClick={() => navigate('/organizations')} variant="outline" className="flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Organizations
      </Button>

      {/* Header card */}
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {org.logo
                ? <img src={org.logo} alt={org.name} className="w-20 h-20 rounded-lg object-cover" />
                : <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"><Building2 className="w-10 h-10 text-white" /></div>
              }
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-primary mb-2">{org.name}</h1>
              {org.slug && <p className="text-muted-foreground mb-4">@{org.slug}</p>}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Created {formatDate(org.createdAt)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Members', value: org.members.length, icon: Users, bg: 'bg-blue-100', iconClass: 'text-blue-600' },
          { label: 'Forms', value: org.stats.totalForms, icon: FileText, bg: 'bg-purple-100', iconClass: 'text-purple-600' },
          { label: 'Responses', value: org.stats.totalResponses, icon: BarChart3, bg: 'bg-primary/10', iconClass: 'text-primary' },
        ].map(({ label, value, icon: Icon, bg, iconClass }) => (
          <Card key={label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${bg}`}><Icon className={`w-6 h-6 ${iconClass}`} /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold text-primary">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid var(--tf-border-medium)' }}>
        <nav className="flex gap-6">
          {(['overview', 'subscription'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="pb-3 text-sm font-medium capitalize transition-colors"
              style={{
                borderBottom: activeTab === tab ? '2px solid var(--tf-dark)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--tf-dark)' : 'var(--tf-muted)',
              }}
            >
              {tab === 'subscription' && <CreditCard className="inline h-4 w-4 mr-1" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">Organization Information</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Organization ID</p>
                  <p className="font-mono text-sm text-primary bg-muted p-2 rounded">{org.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Created Date</p>
                  <p className="text-sm text-primary">{formatDate(org.createdAt)}</p>
                </div>
                {org.slug && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Slug</p>
                    <p className="text-sm text-primary">{org.slug}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-primary mb-4">Members ({org.members.length})</h2>
              {org.members.length > 0 ? (
                <div className="space-y-3">
                  {org.members.map(member => (
                    <Card key={member.userId} className="border border-[var(--tf-border-medium)]">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {member.userImage
                              ? <img src={member.userImage} alt={member.userName} className="w-12 h-12 rounded-full object-cover" />
                              : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">{getInitials(member.userName)}</div>
                            }
                            <div className="flex-1">
                              <h3 className="font-semibold text-primary">{member.userName}</h3>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="w-3 h-3" /><span>{member.userEmail}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>{member.role}</span>
                                <span className="text-xs text-muted-foreground">Joined {formatDate(member.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <Button onClick={() => navigate(`/users/${member.userId}`)} variant="outline" size="sm">View User →</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No members in this organization</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subscription tab */}
      {activeTab === 'subscription' && (
        <div className="space-y-4">
          {!sub ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-primary">No subscription found</p>
                <p className="text-xs text-muted-foreground mt-1">This organization has no subscription record.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Card 1: Plan & Status */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Plan & Status</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-sm font-semibold capitalize" style={planBadgeStyle(sub.planId)}>{sub.planId}</span>
                    <span className="px-3 py-1 rounded-full text-sm font-medium capitalize" style={statusBadgeStyle(sub.status)}>{sub.status.replace('_', ' ')}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Chargebee Customer ID</p>
                    <p className="font-mono text-xs text-primary bg-muted px-2 py-1 rounded inline-block">{sub.chargebeeCustomerId}</p>
                  </div>
                  {CHARGEBEE_SITE && (
                    <a
                      href={`https://${CHARGEBEE_SITE}.chargebee.com/customers/${sub.chargebeeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium"
                      style={{ color: 'var(--tf-green)' }}
                    >
                      Open in Chargebee <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <span>Billing period: {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}</span>
                    <span className="ml-2 font-medium text-primary">· {daysRemaining(sub.currentPeriodEnd)} days remaining</span>
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Usage */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Usage</h2>
                  <div className="flex gap-8">
                    <UsageBar label="Form Views" used={sub.viewsUsed} limit={sub.viewsLimit} />
                    <UsageBar label="Submissions" used={sub.submissionsUsed} limit={sub.submissionsLimit} />
                  </div>
                </CardContent>
              </Card>

              {/* Card 3: Change Plan */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold text-primary">Change Plan</h2>
                  <p className="text-xs text-muted-foreground">This updates the local subscription record immediately. Use the Chargebee portal link above to adjust billing.</p>
                  <div className="flex gap-3">
                    {PLANS.map(plan => (
                      <button
                        key={plan}
                        onClick={() => setSelectedPlan(plan)}
                        className="flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all border-2"
                        style={{
                          borderColor: selectedPlan === plan ? 'var(--tf-dark)' : (sub.planId === plan ? 'var(--tf-green)' : 'var(--tf-border-medium)'),
                          backgroundColor: selectedPlan === plan ? 'var(--tf-dark)' : (sub.planId === plan ? 'var(--tf-green-bg)' : 'white'),
                          color: selectedPlan === plan ? 'white' : (sub.planId === plan ? 'var(--tf-green)' : 'var(--tf-text)'),
                        }}
                      >
                        {plan}
                        {sub.planId === plan && <span className="ml-1 text-[10px]">(current)</span>}
                      </button>
                    ))}
                  </div>
                  <Button
                    disabled={!selectedPlan || selectedPlan === sub.planId || changingPlan}
                    onClick={() => setConfirmModal('changePlan')}
                    size="sm"
                  >
                    {changingPlan ? <><LoadingSpinner className="mr-2 h-4 w-4" />Changing...</> : 'Change Plan'}
                  </Button>
                </CardContent>
              </Card>

              {/* Card 4: Danger Zone */}
              <Card style={{ border: '1px solid #fecaca' }}>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-base font-semibold" style={{ color: '#dc2626' }}>
                    <AlertTriangle className="inline h-4 w-4 mr-1" />
                    Danger Zone
                  </h2>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-primary">Reset Usage Counters</p>
                        <p className="text-xs text-muted-foreground">Resets views and submissions to zero immediately.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setConfirmModal('resetUsage')} disabled={resettingUsage}>
                        {resettingUsage ? <><LoadingSpinner className="mr-2 h-4 w-4" />Resetting...</> : <><RefreshCw className="h-3.5 w-3.5 mr-1" />Reset</>}
                      </Button>
                    </div>

                    {sub.status === 'active' && sub.chargebeeSubscriptionId && (
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #fecaca' }}>
                        <div>
                          <p className="text-sm font-medium text-primary">Cancel Subscription</p>
                          <p className="text-xs text-muted-foreground">Cancels at end of billing period.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setConfirmModal('cancel')} disabled={cancelling}
                          className="border-red-300 text-red-600 hover:bg-red-50">
                          {cancelling ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </div>
                    )}

                    {sub.status === 'cancelled' && sub.chargebeeSubscriptionId && (
                      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid #fecaca' }}>
                        <div>
                          <p className="text-sm font-medium text-primary">Reactivate Subscription</p>
                          <p className="text-xs text-muted-foreground">Restores the subscription to active.</p>
                        </div>
                        <Button size="sm" onClick={() => setConfirmModal('reactivate')} disabled={reactivating}>
                          {reactivating ? 'Reactivating...' : 'Reactivate'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Confirmation modals */}
      {confirmModal === 'changePlan' && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Change Plan</h3>
            <p className="text-sm text-muted-foreground">
              Change <strong>{org.name}</strong> from <strong>{sub?.planId}</strong> to <strong>{selectedPlan}</strong>? This updates the local subscription record immediately.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button size="sm" onClick={() => changePlan({ variables: { orgId, planId: selectedPlan } })}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'resetUsage' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Reset Usage Counters</h3>
            <p className="text-sm text-muted-foreground">
              Type <strong>{org.name}</strong> to confirm resetting all usage counters to zero.
            </p>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder={org.name}
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setConfirmModal(null); setResetConfirmText(''); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={resetConfirmText !== org.name}
                onClick={() => resetUsage({ variables: { orgId } })}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Cancel Subscription</h3>
            <p className="text-sm text-muted-foreground">This will cancel the Chargebee subscription at the end of the billing period.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Back</Button>
              <Button size="sm" onClick={() => cancelSub({ variables: { orgId } })} className="bg-red-600 hover:bg-red-700 text-white">Cancel Subscription</Button>
            </div>
          </div>
        </div>
      )}

      {confirmModal === 'reactivate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm w-full mx-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)' }}>
            <h3 className="text-base font-semibold text-primary">Reactivate Subscription</h3>
            <p className="text-sm text-muted-foreground">This will reactivate the Chargebee subscription immediately.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
              <Button size="sm" onClick={() => reactivateSub({ variables: { orgId } })}>Reactivate</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Add VITE_CHARGEBEE_SITE to admin-app .env**

In `apps/admin-app/.env`, add:

```
VITE_CHARGEBEE_SITE=dculus-global
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check 2>&1 | grep "admin-app" | head -10
```

Expected: no errors

- [ ] **Step 4: Verify in browser — navigate to an org detail page**

Check: Overview tab shows existing content unchanged. Subscription tab shows:
- Plan badge + status badge
- Chargebee customer ID + "Open in Chargebee →" link
- Billing period with days remaining
- Views and submissions usage bars
- Change Plan selector (current plan highlighted, disabled until different plan selected)
- Danger zone with Reset, Cancel/Reactivate buttons

- [ ] **Step 5: Commit**

```bash
git add apps/admin-app/src/pages/organizations/OrganizationDetailPage.tsx apps/admin-app/.env
git commit -m "feat(org-detail): add Subscription tab with plan management, usage bars, and danger zone"
```

---

## Task 13: Final type-check, test run, and verification

- [ ] **Step 1: Full type-check**

```bash
pnpm type-check 2>&1 | tail -15
```

Expected: all packages pass, zero errors.

- [ ] **Step 2: Run unit tests**

```bash
pnpm test:unit 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Full browser walkthrough**

Visit each page and verify:

| Page | What to check |
|------|--------------|
| `/dashboard` | Stat cards load, plan chips show 3 real counts, usage alerts strip appears (amber if any orgs ≥80%), recent orgs table replaces placeholder, system health shows real colored badges with DB latency |
| `/organizations` | No "Invalid Date", Plan column visible with colored badges + usage mini-bars, search filters live |
| `/organizations/:id` (Overview tab) | Members list, stats all present |
| `/organizations/:id` (Subscription tab) | Plan & status, usage bars, Change Plan selector, Danger zone |
| `/templates` | No "Invalid Date" duplicates |

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: admin panel improvements — all tasks complete"
```
