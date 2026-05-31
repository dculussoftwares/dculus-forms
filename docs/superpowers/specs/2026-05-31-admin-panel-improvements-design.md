# Admin Panel Improvements — Design Spec
**Date:** 2026-05-31  
**Scope:** Option B — Full Admin Subscription Management  
**Status:** Approved

---

## Overview

Comprehensive improvement to the admin dashboard covering: bug fixes, replacing all placeholder/mock content with real data, a subscription management layer per organization, and industrial-grade additions (usage alerts, audit trail, Chargebee deep-links).

---

## Section 1: Bug Fixes

### 1.1 Invalid Date (Organizations list, Templates list)
**Root cause:** Prisma returns JS `Date` objects. Apollo serializes them through `String!` via `.toString()`, producing locale-dependent strings (`"Wed Jan 01 2026 ..."`). These are unreliable across JS engines.

**Fix:** Add a `serializeDate(d: Date | null): string | null` utility in the admin resolver file. Call it on every `createdAt` / `updatedAt` field before returning from any admin resolver. Result is always an ISO 8601 string (`"2026-01-01T00:00:00.000Z"`), which `new Date()` parses correctly in all browsers.

```typescript
function serializeDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
```

Apply to: `adminOrganizations`, `adminOrganization`, `adminOrganizationById`, `adminUsers`, `adminUserById`, and all template resolvers.

### 1.2 Duplicate Templates in Seed
**Root cause:** `db:seed` script uses `prisma.template.create()` without checking for existing records. Running twice doubles all entries.

**Fix:** Replace every `create` with `upsert` keyed on `{ name, category }` compound unique constraint. Add `@@unique([name, category])` to the `FormTemplate` model in `schema.prisma` if not already present, then `pnpm db:push`.

### 1.3 System Health Hardcoded
Covered in Section 2 below.

---

## Section 2: Dashboard Improvements

### 2.1 Dashboard Loading States
Use the existing patterns from `@dculus/ui` and the current codebase — no new libraries:

- **Stat cards** (organizations, users, forms, responses): already use `animate-pulse` skeleton divs while `loading === true`. Extend the same pattern to all new sections added to the dashboard.
- **Plan distribution chips**: render 3 `animate-pulse rounded-full h-6 w-20` skeleton pills while loading.
- **Usage alerts strip**: render an `animate-pulse rounded-xl h-12` skeleton bar while loading.
- **Recent Organizations table**: render 5 `animate-pulse rounded-xl h-10` skeleton rows while loading.
- **System Health**: render 4 `animate-pulse rounded-full h-5 w-24` skeleton badges while `adminSystemHealth` query is in-flight.
- **Page-level / section-level full loading**: use `<LoadingSpinner />` from `@dculus/ui` (already imported in `App.tsx`, `OrganizationsPage`, `TemplatesPage`). Use `<LoadingSpinner className="mr-2 h-4 w-4" />` inline inside action buttons during mutations.

No Apollo Link changes. No new dependencies. Consistent with every other loading state in the admin app.

```typescript
// NProgressLink wires into Apollo Client link chain
// start() on forward, done() on result/error
```

### 2.2 Recent Organizations (Replace Placeholder)
**Data source:** Existing `adminOrganizations` query — no new backend query needed. Fetch with `limit: 5, offset: 0` sorted by `createdAt DESC` (add `orderBy: { createdAt: 'desc' }` to the resolver).

**Display:** Compact table inside the existing "Recent Organizations" card:
- Org name + slug
- Plan badge (Free / Starter / Advanced, color-coded)
- Member count
- Form count
- Created date

Replaces the static "No organizations data available yet" empty state entirely.

### 2.3 System Health (Replace Hardcoded)
**New backend query:** `adminSystemHealth: [SystemHealthItem!]!`

```graphql
type SystemHealthItem {
  label: String!
  status: String!   # "ok" | "degraded" | "error"
  latencyMs: Int
  detail: String
}
```

**Four checks run in parallel:**
| Check | Method | ok condition |
|-------|--------|-------------|
| Database | `prisma.$queryRaw\`SELECT 1\`` with timer | Query completes < 1000ms |
| Chargebee | Check `CHARGEBEE_API_KEY` + `CHARGEBEE_SITE` env vars set | Both present |
| S3 Storage | Check `PUBLIC_S3_ACCESS_KEY` + `PUBLIC_S3_ENDPOINT` set | Both present |
| Email | Check `EMAIL_HOST` + `EMAIL_USER` set | Both present |

**Frontend:** Badge colors become `green (ok)` / `amber (degraded)` / `red (error)`. Database shows latency in ms beside the badge.

### 2.4 Plan Distribution Summary
Extend `adminStats` with three new fields:
```graphql
freePlanCount: Int!
starterPlanCount: Int!
advancedPlanCount: Int!
```

**Backend:** Three additional `prisma.subscription.count()` calls added to the existing `Promise.all` in `adminStats` resolver.

**Display:** A row of 3 stat chips below the main 4-stat row:
`Free · 3` | `Starter · 4` | `Advanced · 2`

### 2.5 Usage Alerts Strip
Extend `adminStats` with:
```graphql
orgsNearLimit: [OrgNearLimit!]!

type OrgNearLimit {
  orgId: String!
  orgName: String!
  submissionsUsed: Int!
  submissionsLimit: Int!
  usagePercent: Int!
}
```

**Backend:** `prisma.subscription.findMany({ where: { submissionsLimit: { not: null } } })` then filter in-process for `submissionsUsed / submissionsLimit >= 0.8`. Joined with org name.

**Display:** Collapsible amber banner below plan distribution: "3 organizations are at ≥80% of their submission limit." Expands to list org names as links to their detail pages. Hidden entirely when `orgsNearLimit.length === 0`.

---

## Section 3: Organization List Improvements

### 3.1 Fix Invalid Date
Covered by Section 1.1 — resolver serialization fix.

### 3.2 Plan Badge Column
New `PLAN` column between `FORMS` and `CREATED`.

**Backend change:** Add `include: { subscription: true }` to the `adminOrganizations` Prisma query. Extend `AdminOrganization` GraphQL type:
```graphql
planId: String
subscriptionStatus: String
submissionsUsed: Int
submissionsLimit: Int
```

**Display:** Colored pill badge:
- `free` → gray
- `starter` → blue  
- `advanced` → purple
- Any plan with `status === 'past_due'` → red with ⚠ icon

### 3.3 Usage Mini-Bar
Beneath the plan badge in the `PLAN` column: a thin horizontal bar `submissionsUsed / submissionsLimit`. Hidden for plans with `submissionsLimit === null` (unlimited).

Color thresholds:
- `< 80%` → green
- `80–99%` → amber
- `≥ 100%` → red

### 3.4 Search
Search input above the table, identical pattern to `UsersPage`.

**Backend:** Add optional `search?: string` to `adminOrganizations` args:
```prisma
where: search ? {
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { slug: { contains: search, mode: 'insensitive' } }
  ]
} : {}
```

**Frontend:** Debounced 300ms. Passes `search` variable to the Apollo query via `refetch`.

---

## Section 4: Organization Detail — Subscription Tab

### 4.1 Tab Layout
The org detail page gains a tab bar: **Overview** (all existing content unchanged) and **Subscription** (new). Both tabs share the same Apollo query result — no separate fetch.

**Backend:** Extend `adminOrganizationById` to include:
```graphql
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
```

One `include: { subscription: true }` addition to the existing Prisma query.

### 4.2 Card 1 — Plan & Status
- Plan name badge + status badge (Active / Past Due / Cancelled)
- Chargebee Customer ID in monospace copy-to-clipboard
- **"Open in Chargebee →"** external link: `https://{CHARGEBEE_SITE}.chargebee.com/customers/{chargebeeCustomerId}`
- Billing period: `Jun 1, 2026 → Jun 30, 2026 · 13 days remaining`

### 4.3 Card 2 — Usage Bars
Two bars side by side:

**Form Views:**
- Bar: `viewsUsed / viewsLimit` (shows "Unlimited" text, no bar for null limit)
- Raw numbers: `7,241 / 10,000`

**Submissions:**
- Bar: `submissionsUsed / submissionsLimit`
- Raw numbers: `841 / 1,000`

Color thresholds: green → amber (≥80%) → red (≥100%).

### 4.4 Card 3 — Change Plan
3-option radio selector: Free / Starter / Advanced. Current plan pre-selected and highlighted.

**"Change Plan" button** → confirmation modal:
> "Change [OrgName] from Starter to Advanced? This will update their Chargebee subscription immediately and take effect now."

On confirm → `adminChangePlan(orgId, planId)` mutation. On success: refetch org data + toast "Plan updated successfully".

Every plan change writes to `AuditLog`:
```typescript
{
  action: 'plan_changed',
  actorId: adminUserId,
  resourceType: 'Organization',
  resourceId: orgId,
  metadata: JSON.stringify({ from: currentPlan, to: newPlan, changedBy: adminEmail })
}
```

### 4.5 Card 4 — Danger Zone
Visually separated with a red border.

| Action | Trigger | Confirmation | Mutation |
|--------|---------|-------------|---------|
| Reset Usage Counters | Button | Type org name | `adminResetUsage(orgId)` |
| Cancel Subscription | Button (active only) | Confirm dialog | `adminCancelSubscription(orgId)` |
| Reactivate Subscription | Button (cancelled only) | Confirm dialog | `adminReactivateSubscription(orgId)` |

Reset usage also writes to `AuditLog` with action `usage_reset`.

---

## Section 5: Backend Changes

### 5.1 New Utility
```typescript
// In admin.ts
function serializeDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}
```

### 5.2 Schema Additions (schema.ts)

```graphql
# Extend AdminOrganization
type AdminOrganization {
  # existing fields...
  planId: String
  subscriptionStatus: String
  submissionsUsed: Int
  submissionsLimit: Int
}

# Extend AdminStats
type AdminStats {
  # existing fields...
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

# Extend AdminOrganizationDetail
type AdminOrganizationDetail {
  # existing fields...
  subscription: OrgSubscription
}

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

# New query
type SystemHealthItem {
  label: String!
  status: String!
  latencyMs: Int
  detail: String
}

# New adminOrganizations args
adminOrganizations(limit: Int, offset: Int, search: String): AdminOrganizationsResult!

# New mutations
adminChangePlan(orgId: ID!, planId: String!): Boolean!
adminResetUsage(orgId: ID!): Boolean!
adminCancelSubscription(orgId: ID!): Boolean!
adminReactivateSubscription(orgId: ID!): Boolean!
```

And add to Query type: `adminSystemHealth: [SystemHealthItem!]!`

### 5.3 Resolver Changes Summary

| Resolver | Change |
|----------|--------|
| `adminOrganizations` | Add `include: { subscription: true }`, add `search` filter, add `orderBy`, serialize dates |
| `adminOrganizationById` | Add `include: { subscription: true }`, serialize dates |
| `adminStats` | Add 3 plan count queries + orgsNearLimit query to Promise.all |
| `adminUsers` / `adminUserById` | Serialize dates |
| All template resolvers | Serialize dates |
| `adminSystemHealth` (new) | 4 parallel health checks |
| `adminChangePlan` (new) | Chargebee plan change + AuditLog write |
| `adminResetUsage` (new) | Calls existing `resetUsageCounters()` + AuditLog write |
| `adminCancelSubscription` (new) | Wraps `cancelChargebeeSubscription()` |
| `adminReactivateSubscription` (new) | Wraps `reactivateChargebeeSubscription()` |

### 5.4 Seed Fix
`apps/backend/prisma/seed.ts` — replace `create` with `upsert` for all template records. Match key: `name + category`.

---

## Industrial Additions (included in Option B)

1. **Usage alert strip** — proactive visibility into orgs approaching limits (Section 2.5)
2. **Plan change audit trail** — every admin plan change logged to `AuditLog` (Section 4.4)
3. **Billing period display** — "X days remaining" countdown on org detail (Section 4.2)
4. **`past_due` warning badge** — failed-payment orgs flagged red on org list (Section 3.2)
5. **Chargebee portal deep-link** — one-click to customer in Chargebee dashboard (Section 4.2)

---

## Out of Scope (follow-up sprint)
- Dedicated Subscriptions page with cross-org plan/status filters
- User ban/unban actions
- Audit Log browser page
- Form-level admin views
