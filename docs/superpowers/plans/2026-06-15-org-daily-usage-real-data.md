# Org Daily Usage Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synthetic growth-curve chart data in `UsageChart` with real daily aggregated views and submissions for the org's billing period.

**Architecture:** Add a new `orgDailyUsage` GraphQL query on the backend that joins `FormViewAnalytics` and `FormSubmissionAnalytics` through `Form.organizationId`, groups by day within the billing period, and merges into `{ date, views, submissions }[]`. The frontend fires this query inside `UsageChart` using the existing `organizationId` + period dates already available from `GET_SUBSCRIPTION`.

**Tech Stack:** PostgreSQL raw SQL (`prisma.$queryRaw`), GraphQL (code-first), Apollo Client `useQuery`, React, TypeScript, Vitest

---

## File Map

| Action | File |
|--------|------|
| Modify | `apps/backend/src/graphql/schema.ts` |
| Modify | `apps/backend/src/services/analyticsService.ts` |
| Modify | `apps/backend/src/graphql/resolvers/analytics.ts` |
| Modify | `apps/form-app/src/graphql/subscription.ts` |
| Modify | `apps/form-app/src/components/subscription/UsageChart.tsx` |
| Modify | `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx` |
| Modify | `apps/form-app/src/components/settings/BillingSettings.tsx` |
| Modify | `apps/backend/src/services/__tests__/analyticsService.test.ts` |

---

## Task 1: Add GraphQL schema type and query

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`

- [ ] **Step 1: Add `OrgDailyUsageDay` type and `orgDailyUsage` query**

  In `apps/backend/src/graphql/schema.ts`, find the `# Analytics Types` comment block (around line 551). Add the new type immediately after `CompletionTimeRange`, and add the query to the `Query` type.

  Add after the last analytics type definition (search for `completionTimeDistribution` block end):
  ```graphql
  type OrgDailyUsageDay {
    date: String!
    views: Int!
    submissions: Int!
  }
  ```

  Add to the `Query` type (find the block with `formAnalytics` and `formSubmissionAnalytics` around line 1077):
  ```graphql
  orgDailyUsage(organizationId: ID!, periodStart: String!, periodEnd: String!): [OrgDailyUsageDay!]!
  ```

- [ ] **Step 2: Verify the schema compiles**

  ```bash
  pnpm --filter backend exec tsc --noEmit 2>&1 | grep -E "error TS|schema" | head -20
  ```

  Expected: no errors related to schema.ts.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/backend/src/graphql/schema.ts
  git commit -m "feat: add orgDailyUsage GraphQL type and query to schema"
  ```

---

## Task 2: Implement `getOrgDailyUsage` in analyticsService

**Files:**
- Modify: `apps/backend/src/services/analyticsService.ts`

- [ ] **Step 1: Write the failing test**

  Open `apps/backend/src/services/__tests__/analyticsService.test.ts`. The file already mocks `prisma.$queryRaw`. Add this describe block at the end (before the closing of the file):

  ```typescript
  describe('getOrgDailyUsage', () => {
    const orgId = 'org-abc';
    const periodStart = new Date('2026-06-01T00:00:00Z');
    const periodEnd = new Date('2026-06-30T23:59:59Z');

    it('returns merged daily views and submissions sorted by date', async () => {
      (prisma.$queryRaw as any)
        .mockResolvedValueOnce([
          { date: new Date('2026-06-01T00:00:00Z'), views: BigInt(5) },
          { date: new Date('2026-06-03T00:00:00Z'), views: BigInt(2) },
        ])
        .mockResolvedValueOnce([
          { date: new Date('2026-06-01T00:00:00Z'), submissions: BigInt(3) },
          { date: new Date('2026-06-04T00:00:00Z'), submissions: BigInt(1) },
        ]);

      const result = await analyticsService.getOrgDailyUsage(orgId, periodStart, periodEnd);

      expect(result).toEqual([
        { date: '2026-06-01', views: 5, submissions: 3 },
        { date: '2026-06-03', views: 2, submissions: 0 },
        { date: '2026-06-04', views: 0, submissions: 1 },
      ]);
    });

    it('returns empty array when no data exists', async () => {
      (prisma.$queryRaw as any)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await analyticsService.getOrgDailyUsage(orgId, periodStart, periodEnd);

      expect(result).toEqual([]);
    });

    it('throws when prisma.$queryRaw fails', async () => {
      (prisma.$queryRaw as any).mockRejectedValueOnce(new Error('DB error'));

      await expect(
        analyticsService.getOrgDailyUsage(orgId, periodStart, periodEnd)
      ).rejects.toThrow('Failed to fetch org daily usage data');
    });
  });
  ```

- [ ] **Step 2: Run the test to confirm it fails**

  ```bash
  pnpm --filter backend test:unit -- --reporter=verbose --testNamePattern="getOrgDailyUsage" 2>&1 | tail -20
  ```

  Expected: FAIL with `analyticsService.getOrgDailyUsage is not a function`.

- [ ] **Step 3: Implement `getOrgDailyUsage` in analyticsService**

  In `apps/backend/src/services/analyticsService.ts`, add this function before the `analyticsService` object definition (before line that reads `const analyticsService = {`):

  ```typescript
  type OrgDailyViewRow = { date: Date; views: bigint };
  type OrgDailySubmissionRow = { date: Date; submissions: bigint };

  const getOrgDailyUsage = async (
    organizationId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<Array<{ date: string; views: number; submissions: number }>> => {
    try {
      const [viewRows, submissionRows] = await Promise.all([
        prisma.$queryRaw<OrgDailyViewRow[]>`
          SELECT
            DATE_TRUNC('day', fva."viewedAt") AS date,
            COUNT(*) AS views
          FROM "form_view_analytics" fva
          JOIN "form" f ON f.id = fva."formId"
          WHERE f."organizationId" = ${organizationId}
            AND fva."viewedAt" >= ${periodStart}
            AND fva."viewedAt" <= ${periodEnd}
          GROUP BY DATE_TRUNC('day', fva."viewedAt")
          ORDER BY date ASC
        `,
        prisma.$queryRaw<OrgDailySubmissionRow[]>`
          SELECT
            DATE_TRUNC('day', fsa."submittedAt") AS date,
            COUNT(*) AS submissions
          FROM "form_submission_analytics" fsa
          JOIN "form" f ON f.id = fsa."formId"
          WHERE f."organizationId" = ${organizationId}
            AND fsa."submittedAt" >= ${periodStart}
            AND fsa."submittedAt" <= ${periodEnd}
          GROUP BY DATE_TRUNC('day', fsa."submittedAt")
          ORDER BY date ASC
        `,
      ]);

      const merged = new Map<string, { views: number; submissions: number }>();

      for (const row of viewRows) {
        const date = new Date(row.date).toISOString().split('T')[0];
        merged.set(date, { views: Number(row.views), submissions: 0 });
      }
      for (const row of submissionRows) {
        const date = new Date(row.date).toISOString().split('T')[0];
        const existing = merged.get(date);
        if (existing) {
          existing.submissions = Number(row.submissions);
        } else {
          merged.set(date, { views: 0, submissions: Number(row.submissions) });
        }
      }

      return Array.from(merged.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date, ...counts }));
    } catch (error) {
      logger.error('Error getting org daily usage:', error);
      throw new Error('Failed to fetch org daily usage data');
    }
  };
  ```

  Then add `getOrgDailyUsage` to the service object:
  ```typescript
  const analyticsService = {
    trackFormView,
    updateFormStartTime,
    trackFormSubmission,
    getFormAnalytics,
    getFormSubmissionAnalytics,
    getOrgDailyUsage,       // ← add this line
    initialize: initializeService
  };
  ```

- [ ] **Step 4: Run the tests to confirm they pass**

  ```bash
  pnpm --filter backend test:unit -- --reporter=verbose --testNamePattern="getOrgDailyUsage" 2>&1 | tail -20
  ```

  Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/services/analyticsService.ts apps/backend/src/services/__tests__/analyticsService.test.ts
  git commit -m "feat: add getOrgDailyUsage to analyticsService with unit tests"
  ```

---

## Task 3: Add `orgDailyUsage` resolver

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/analytics.ts`

- [ ] **Step 1: Add the resolver**

  In `apps/backend/src/graphql/resolvers/analytics.ts`, find the closing of the `Query` object (just before `}` that closes `analyticsResolvers = { Query: {`). Add after the `formSubmissionAnalytics` resolver:

  ```typescript
  orgDailyUsage: async (
    _: any,
    { organizationId, periodStart, periodEnd }: { organizationId: string; periodStart: string; periodEnd: string },
    context: { auth: BetterAuthContext }
  ) => {
    try {
      requireAuth(context.auth);
      // 🔒 SECURITY: user must be a member of the organization they're querying
      const { requireOrganizationMembership } = await import('../../middleware/better-auth-middleware.js');
      await requireOrganizationMembership(context.auth, organizationId);

      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw createGraphQLError('Invalid period dates', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
      }

      return await analyticsService.getOrgDailyUsage(organizationId, start, end);
    } catch (error) {
      logger.error('Error in orgDailyUsage query:', error);
      if (error instanceof GraphQLError) throw error;
      throw createGraphQLError('Failed to fetch org daily usage', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  },
  ```

  Note: `requireOrganizationMembership` is already imported at the top of `analytics.ts` via `better-auth-middleware`. Check the top of the file — if it's not imported, add it to the existing import:
  ```typescript
  import { requireAuth, requireOrganizationMembership, type BetterAuthContext } from '../../middleware/better-auth-middleware.js';
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter backend exec tsc --noEmit 2>&1 | grep "error TS" | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/backend/src/graphql/resolvers/analytics.ts
  git commit -m "feat: add orgDailyUsage GraphQL resolver with org membership auth"
  ```

---

## Task 4: Add `GET_ORG_DAILY_USAGE` query to frontend

**Files:**
- Modify: `apps/form-app/src/graphql/subscription.ts`

- [ ] **Step 1: Add the query**

  In `apps/form-app/src/graphql/subscription.ts`, add after the `GET_SUBSCRIPTION` query (after line 64):

  ```typescript
  export const GET_ORG_DAILY_USAGE: TypedDocumentNode<any, any> = gql`
    query GetOrgDailyUsage($organizationId: ID!, $periodStart: String!, $periodEnd: String!) {
      orgDailyUsage(organizationId: $organizationId, periodStart: $periodStart, periodEnd: $periodEnd) {
        date
        views
        submissions
      }
    }
  `;
  ```

- [ ] **Step 2: Type-check form-app**

  ```bash
  pnpm --filter form-app exec tsc --noEmit 2>&1 | grep "error TS" | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/form-app/src/graphql/subscription.ts
  git commit -m "feat: add GET_ORG_DAILY_USAGE GraphQL query"
  ```

---

## Task 5: Wire real data into `UsageChart`

**Files:**
- Modify: `apps/form-app/src/components/subscription/UsageChart.tsx`

- [ ] **Step 1: Replace the component**

  Replace the entire content of `apps/form-app/src/components/subscription/UsageChart.tsx` with:

  ```typescript
  import { useQuery } from '@apollo/client/react';
  import { Card, LoadingSpinner } from '@dculus/ui';
  import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
  import { Eye, FileText } from 'lucide-react';
  import { useTranslation } from '../../hooks/useTranslation';
  import { GET_ORG_DAILY_USAGE } from '../../graphql/subscription';

  interface UsageChartProps {
    organizationId: string;
    viewsUsed: number;
    submissionsUsed: number;
    viewsLimit: number | null;
    submissionsLimit: number | null;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  }

  export const UsageChart = ({
    organizationId,
    viewsUsed,
    submissionsUsed,
    viewsLimit,
    submissionsLimit,
    currentPeriodStart,
    currentPeriodEnd,
  }: UsageChartProps) => {
    const { t } = useTranslation('usageChart');

    const { data, loading } = useQuery(GET_ORG_DAILY_USAGE, {
      variables: {
        organizationId,
        periodStart: new Date(Number(currentPeriodStart)).toISOString(),
        periodEnd: new Date(Number(currentPeriodEnd)).toISOString(),
      },
      skip: !organizationId,
    });

    const chartData: Array<{ date: string; views: number; submissions: number }> =
      data?.orgDailyUsage ?? [];

    const CustomTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white dark:bg-gray-800 border border-[var(--tf-border-medium)] dark:border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="font-medium text-sm mb-2">{payload[0].payload.date}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Eye className="h-3 w-3 text-blue-500" />
                <span className="text-foreground dark:text-gray-400">{t('tooltip.views')}</span>
                <span className="font-medium">{payload[0].value.toLocaleString()}</span>
                {viewsLimit && (
                  <span className="text-xs text-muted-foreground">
                    / {viewsLimit.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-3 w-3 text-purple-500" />
                <span className="text-foreground dark:text-gray-400">{t('tooltip.submissions')}</span>
                <span className="font-medium">{payload[1].value.toLocaleString()}</span>
                {submissionsLimit && (
                  <span className="text-xs text-muted-foreground">
                    / {submissionsLimit.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-1">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('subtitle', {
              values: {
                startDate: new Date(Number(currentPeriodStart)).toLocaleDateString(),
                endDate: new Date(Number(currentPeriodEnd)).toLocaleDateString()
              }
            })}
          </p>
        </div>

        {loading ? (
          <div className="h-[300px] flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 12 }} tickLine={false} />
              <YAxis
                stroke="#6b7280"
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => <span className="text-sm font-medium">{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViews)"
                name={t('legend.formViews')}
              />
              <Area
                type="monotone"
                dataKey="submissions"
                stroke="#a855f7"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSubmissions)"
                name={t('legend.formSubmissions')}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        <div className="mt-4 pt-4 border-t border-[var(--tf-border-medium)] dark:border-gray-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span className="font-medium">{t('totals.views')}</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{viewsUsed.toLocaleString()}</p>
              {viewsLimit && (
                <p className="text-xs text-muted-foreground">
                  {t('totals.ofLimit', { values: { limit: viewsLimit.toLocaleString() } })}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                <span className="font-medium">{t('totals.submissions')}</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{submissionsUsed.toLocaleString()}</p>
              {submissionsLimit && (
                <p className="text-xs text-muted-foreground">
                  {t('totals.ofLimit', { values: { limit: submissionsLimit.toLocaleString() } })}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };
  ```

- [ ] **Step 2: Type-check**

  ```bash
  pnpm --filter form-app exec tsc --noEmit 2>&1 | grep "error TS" | head -20
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/form-app/src/components/subscription/UsageChart.tsx
  git commit -m "feat: wire UsageChart to real orgDailyUsage API, remove synthetic data"
  ```

---

## Task 6: Pass `organizationId` to `UsageChart` from callers

**Files:**
- Modify: `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx`
- Modify: `apps/form-app/src/components/settings/BillingSettings.tsx`

- [ ] **Step 1: Update SubscriptionDashboard**

  In `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx`, find the `<UsageChart` block (around line 376). Add `organizationId`:

  ```tsx
  <UsageChart
    organizationId={organizationId}
    viewsUsed={usage.views.used}
    submissionsUsed={usage.submissions.used}
    viewsLimit={usage.views.limit}
    submissionsLimit={usage.submissions.limit}
    currentPeriodStart={currentPeriodStart}
    currentPeriodEnd={currentPeriodEnd}
  />
  ```

- [ ] **Step 2: Update BillingSettings**

  In `apps/form-app/src/components/settings/BillingSettings.tsx`, find the `<UsageChart` block (around line 251). Add `organizationId`:

  ```tsx
  <UsageChart
    organizationId={organizationId}
    viewsUsed={usage.views.used}
    submissionsUsed={usage.submissions.used}
    viewsLimit={usage.views.limit}
    submissionsLimit={usage.submissions.limit}
    currentPeriodStart={currentPeriodStart}
    currentPeriodEnd={currentPeriodEnd}
  />
  ```

- [ ] **Step 3: Type-check**

  ```bash
  pnpm --filter form-app exec tsc --noEmit 2>&1 | grep "error TS" | head -20
  ```

  Expected: no errors.

- [ ] **Step 4: Run all unit tests**

  ```bash
  pnpm test:unit 2>&1 | tail -15
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/form-app/src/components/subscription/SubscriptionDashboard.tsx apps/form-app/src/components/settings/BillingSettings.tsx
  git commit -m "fix: pass organizationId to UsageChart in SubscriptionDashboard and BillingSettings"
  ```

---

## Self-Review Checklist

- **Spec coverage:** All requirements covered — backend SQL aggregation (Task 2), GraphQL schema + resolver (Tasks 1 & 3), frontend query (Task 4), component wiring (Tasks 5 & 6).
- **Placeholder scan:** No TBDs. All code blocks are complete.
- **Type consistency:** `organizationId: string` used throughout. `currentPeriodStart`/`currentPeriodEnd` are epoch millisecond strings (same as existing callers). `OrgDailyUsageDay` matches between schema, service return type, and frontend query shape.
- **Auth:** `requireOrganizationMembership` guard on the resolver ensures users can only query usage for orgs they belong to.
- **Edge case:** `skip: !organizationId` on the frontend query prevents firing before the subscription data loads.
