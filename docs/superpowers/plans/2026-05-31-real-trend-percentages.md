# Real Trend Percentages — Performance Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three hardcoded percentage badges (+12%, +8%, +15%) in the form dashboard Performance Overview with real period-over-period comparisons computed in the backend.

**Architecture:** The backend `dashboardStats` resolver gains four new parallel Prisma queries and computes three nullable trend floats; `null` means "insufficient data — hide badge." The frontend passes values straight through without any math.

**Tech Stack:** Prisma (PostgreSQL), Apollo GraphQL (code-first), React + Apollo Client, TypeScript, Vitest

---

## File Map

| File | Change |
|---|---|
| `apps/backend/src/graphql/schema.ts` | Add 3 nullable Float fields to `FormDashboardStats` |
| `apps/backend/src/graphql/resolvers/forms.ts` | 4 new Prisma queries + trend math in `dashboardStats` |
| `apps/backend/src/graphql/resolvers/__tests__/forms.test.ts` | Update existing tests + add 3 new trend tests |
| `apps/form-app/src/graphql/queries.ts` | Add 3 fields to `GET_FORM_BY_ID` dashboardStats selection |
| `apps/form-app/src/hooks/useFormDashboard.ts` | Extend `DashboardStats` interface + pass-through |
| `apps/form-app/src/components/FormDashboard/StatsGrid.tsx` | Replace `positiveTrend(N)` with real props |

---

## Task 1: Extend the GraphQL schema

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts:149-155`

- [ ] **Step 1: Add the three new nullable Float fields**

Open `apps/backend/src/graphql/schema.ts`. Replace lines 149–155:

```graphql
  type FormDashboardStats {
    averageCompletionTime: Float # Average completion time in seconds
    responseRate: Float # Response rate as percentage (0-100)
    responsesToday: Int!
    responsesThisWeek: Int!
    responsesThisMonth: Int!
  }
```

with:

```graphql
  type FormDashboardStats {
    averageCompletionTime: Float # Average completion time in seconds
    responseRate: Float # Response rate as percentage (0-100)
    responsesToday: Int!
    responsesThisWeek: Int!
    responsesThisMonth: Int!
    trendResponsesToday: Float # % change today vs yesterday; null = no data
    trendThisWeek: Float # % change this week vs last week; null = no data
    trendResponseRate: Float # percentage-point delta this week vs last week; null = <10 views
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/backend/src/graphql/schema.ts
git commit -m "feat(graphql): add trend fields to FormDashboardStats schema"
```

---

## Task 2: Implement trend calculations in the resolver (TDD)

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/__tests__/forms.test.ts:331-378`
- Modify: `apps/backend/src/graphql/resolvers/forms.ts:132-178`

- [ ] **Step 1: Update existing test — "should return dashboard statistics"**

Open `apps/backend/src/graphql/resolvers/__tests__/forms.test.ts`.

The test at line 332 currently mocks `prisma.response.count` 4 times and `prisma.formViewAnalytics.count` once (with `mockResolvedValue`). The resolver will now call `response.count` 6 times and `formViewAnalytics.count` 3 times. Update the test:

```typescript
it('should return dashboard statistics', async () => {
  vi.mocked(prisma.response.count)
    .mockResolvedValueOnce(5)   // today
    .mockResolvedValueOnce(20)  // this week
    .mockResolvedValueOnce(50)  // this month
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(4)   // yesterday  → trendResponsesToday = (5-4)/4*100 = 25
    .mockResolvedValueOnce(16); // last week  → trendThisWeek = (20-16)/16*100 = 25

  // mockResolvedValue (no Once) returns 200 for all three formViewAnalytics.count calls:
  // totalViews=200, viewsThisWeek=200, viewsLastWeek=200
  // rateThisWeek=(20/200)*100=10, rateLastWeek=(16/200)*100=8 → trendResponseRate=2
  vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);

  vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([
    { completionTimeSeconds: 120 },
    { completionTimeSeconds: 180 },
    { completionTimeSeconds: 150 },
  ] as any);

  const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

  expect(result).toEqual({
    averageCompletionTime: 150,
    responseRate: 50,
    responsesToday: 5,
    responsesThisWeek: 20,
    responsesThisMonth: 50,
    trendResponsesToday: 25,
    trendThisWeek: 25,
    trendResponseRate: 2,
  });
});
```

- [ ] **Step 2: Update existing test — "should handle null completion times"**

The test at line 363 also needs the extra mocks (it will fail because response.count is only mocked 4 times but now called 6):

```typescript
it('should handle null completion times', async () => {
  vi.mocked(prisma.response.count)
    .mockResolvedValueOnce(5)   // today
    .mockResolvedValueOnce(20)  // this week
    .mockResolvedValueOnce(50)  // this month
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(4)   // yesterday
    .mockResolvedValueOnce(16); // last week

  vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);
  vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([]);

  const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

  expect(result.averageCompletionTime).toBeNull();
});
```

- [ ] **Step 3: Add three new tests for trend edge cases**

Append these inside the `describe('Form: dashboardStats', ...)` block, after the existing two tests:

```typescript
it('should return null trendResponsesToday when no responses yesterday', async () => {
  vi.mocked(prisma.response.count)
    .mockResolvedValueOnce(5)   // today
    .mockResolvedValueOnce(20)  // this week
    .mockResolvedValueOnce(50)  // this month
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(0)   // yesterday → trendResponsesToday = null
    .mockResolvedValueOnce(16); // last week

  vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);
  vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([]);

  const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

  expect(result.trendResponsesToday).toBeNull();
  expect(result.trendThisWeek).toBe(25);
});

it('should return null trendThisWeek when no responses last week', async () => {
  vi.mocked(prisma.response.count)
    .mockResolvedValueOnce(5)   // today
    .mockResolvedValueOnce(20)  // this week
    .mockResolvedValueOnce(50)  // this month
    .mockResolvedValueOnce(100) // total
    .mockResolvedValueOnce(4)   // yesterday
    .mockResolvedValueOnce(0);  // last week → trendThisWeek = null

  vi.mocked(prisma.formViewAnalytics.count).mockResolvedValue(200);
  vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([]);

  const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

  expect(result.trendThisWeek).toBeNull();
  expect(result.trendResponsesToday).toBe(25);
});

it('should return null trendResponseRate when either week has fewer than 10 views', async () => {
  vi.mocked(prisma.response.count)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(20)
    .mockResolvedValueOnce(50)
    .mockResolvedValueOnce(100)
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce(16);

  vi.mocked(prisma.formViewAnalytics.count)
    .mockResolvedValueOnce(200) // totalViews
    .mockResolvedValueOnce(5)   // viewsThisWeek — below threshold
    .mockResolvedValueOnce(200); // viewsLastWeek

  vi.mocked(prisma.formSubmissionAnalytics.findMany).mockResolvedValue([]);

  const result = await formsResolvers.Form.dashboardStats({ id: 'form-123' });

  expect(result.trendResponseRate).toBeNull();
});
```

- [ ] **Step 4: Run tests to confirm they fail (resolver not updated yet)**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -A 3 "dashboardStats"
```

Expected: failures on the 5 `dashboardStats` tests.

- [ ] **Step 5: Implement the new queries and trend math in the resolver**

Open `apps/backend/src/graphql/resolvers/forms.ts`. Replace the entire `dashboardStats` resolver body (lines 132–178) with:

```typescript
dashboardStats: async (parent: any) => {
  const formId = parent.id;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    responsesToday,
    responsesThisWeek,
    responsesThisMonth,
    totalResponses,
    totalViews,
    submissionAnalytics,
    responsesYesterday,
    responsesLastWeek,
    viewsThisWeek,
    viewsLastWeek,
  ] = await Promise.all([
    prisma.response.count({ where: { formId, submittedAt: { gte: today } } }),
    prisma.response.count({ where: { formId, submittedAt: { gte: weekAgo } } }),
    prisma.response.count({ where: { formId, submittedAt: { gte: monthAgo } } }),
    prisma.response.count({ where: { formId } }),
    prisma.formViewAnalytics.count({ where: { formId } }),
    prisma.formSubmissionAnalytics.findMany({
      where: { formId },
      select: { completionTimeSeconds: true },
    }),
    prisma.response.count({ where: { formId, submittedAt: { gte: yesterday, lt: today } } }),
    prisma.response.count({ where: { formId, submittedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    prisma.formViewAnalytics.count({ where: { formId, viewedAt: { gte: weekAgo } } }),
    prisma.formViewAnalytics.count({ where: { formId, viewedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ]);

  const validCompletionTimes = submissionAnalytics
    .map(s => s.completionTimeSeconds)
    .filter((t): t is number => t !== null && t > 0);

  const averageCompletionTime =
    validCompletionTimes.length > 0
      ? validCompletionTimes.reduce((sum, t) => sum + t, 0) / validCompletionTimes.length
      : null;

  const responseRate = totalViews > 0 ? (totalResponses / totalViews) * 100 : 0;

  const trendResponsesToday =
    responsesYesterday === 0
      ? null
      : ((responsesToday - responsesYesterday) / responsesYesterday) * 100;

  const trendThisWeek =
    responsesLastWeek === 0
      ? null
      : ((responsesThisWeek - responsesLastWeek) / responsesLastWeek) * 100;

  const rateThisWeek = viewsThisWeek > 0 ? (responsesThisWeek / viewsThisWeek) * 100 : 0;
  const rateLastWeek = viewsLastWeek > 0 ? (responsesLastWeek / viewsLastWeek) * 100 : 0;
  const trendResponseRate =
    viewsThisWeek < 10 || viewsLastWeek < 10
      ? null
      : rateThisWeek - rateLastWeek;

  return {
    averageCompletionTime,
    responseRate,
    responsesToday,
    responsesThisWeek,
    responsesThisMonth,
    trendResponsesToday,
    trendThisWeek,
    trendResponseRate,
  };
},
```

- [ ] **Step 6: Run tests to confirm all pass**

```bash
pnpm test:unit -- --reporter=verbose 2>&1 | grep -A 3 "dashboardStats"
```

Expected output: 5 passing tests under `Form: dashboardStats`.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/graphql/resolvers/forms.ts \
        apps/backend/src/graphql/resolvers/__tests__/forms.test.ts
git commit -m "feat(resolver): compute real trend percentages in dashboardStats"
```

---

## Task 3: Add trend fields to the frontend GraphQL query

**Files:**
- Modify: `apps/form-app/src/graphql/queries.ts:125-131`

- [ ] **Step 1: Add the three new fields to the dashboardStats selection**

Open `apps/form-app/src/graphql/queries.ts`. Replace lines 125–131:

```graphql
      dashboardStats {
        averageCompletionTime
        responseRate
        responsesToday
        responsesThisWeek
        responsesThisMonth
      }
```

with:

```graphql
      dashboardStats {
        averageCompletionTime
        responseRate
        responsesToday
        responsesThisWeek
        responsesThisMonth
        trendResponsesToday
        trendThisWeek
        trendResponseRate
      }
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/graphql/queries.ts
git commit -m "feat(graphql): select trend fields in GET_FORM_BY_ID"
```

---

## Task 4: Extend the useFormDashboard hook

**Files:**
- Modify: `apps/form-app/src/hooks/useFormDashboard.ts:9-16` (interface) and `:93-100` (return object)

- [ ] **Step 1: Extend the DashboardStats interface**

Open `apps/form-app/src/hooks/useFormDashboard.ts`. Replace the `DashboardStats` interface (lines 9–16):

```typescript
interface DashboardStats {
  totalResponses: number;
  totalFields: number;
  averageCompletionTime: string;
  responseRate: string;
  responsesToday: number;
  responsesThisWeek: number;
}
```

with:

```typescript
interface DashboardStats {
  totalResponses: number;
  totalFields: number;
  averageCompletionTime: string;
  responseRate: string;
  responsesToday: number;
  responsesThisWeek: number;
  trendResponsesToday: number | null;
  trendThisWeek: number | null;
  trendResponseRate: number | null;
}
```

- [ ] **Step 2: Pass the trend values through in the useMemo return**

In the same file, find the `return` object inside `useMemo` (around line 93). Replace:

```typescript
    return {
      totalResponses: formData.form.responseCount || 0,
      totalFields,
      averageCompletionTime: formatCompletionTime(formDashboardStats?.averageCompletionTime),
      responseRate: formatResponseRate(formDashboardStats?.responseRate),
      responsesToday: formDashboardStats?.responsesToday || 0,
      responsesThisWeek: formDashboardStats?.responsesThisWeek || 0,
    };
```

with:

```typescript
    return {
      totalResponses: formData.form.responseCount || 0,
      totalFields,
      averageCompletionTime: formatCompletionTime(formDashboardStats?.averageCompletionTime),
      responseRate: formatResponseRate(formDashboardStats?.responseRate),
      responsesToday: formDashboardStats?.responsesToday || 0,
      responsesThisWeek: formDashboardStats?.responsesThisWeek || 0,
      trendResponsesToday: formDashboardStats?.trendResponsesToday ?? null,
      trendThisWeek: formDashboardStats?.trendThisWeek ?? null,
      trendResponseRate: formDashboardStats?.trendResponseRate ?? null,
    };
```

Also update the empty-state return (around line 64) to include the new fields so TypeScript is satisfied:

```typescript
    if (!formData?.form) {
      return {
        totalResponses: 0,
        totalFields: 0,
        averageCompletionTime: '0 min',
        responseRate: '0%',
        responsesToday: 0,
        responsesThisWeek: 0,
        trendResponsesToday: null,
        trendThisWeek: null,
        trendResponseRate: null,
      };
    }
```

- [ ] **Step 3: Run type-check to confirm no errors**

```bash
pnpm type-check 2>&1 | grep -i "useFormDashboard\|error" | head -20
```

Expected: no errors mentioning `useFormDashboard`.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/hooks/useFormDashboard.ts
git commit -m "feat(hook): pass real trend values through useFormDashboard"
```

---

## Task 5: Update StatsGrid to render real trend badges

**Files:**
- Modify: `apps/form-app/src/components/FormDashboard/StatsGrid.tsx`

- [ ] **Step 1: Extend DashboardStats interface in StatsGrid**

Open `apps/form-app/src/components/FormDashboard/StatsGrid.tsx`. The `DashboardStats` interface at the top of the file currently has:

```typescript
interface DashboardStats {
  totalResponses: number;
  responseRate: string;
  averageCompletionTime: string;
  responsesToday: number;
  responsesThisWeek: number;
}
```

Replace it with:

```typescript
interface DashboardStats {
  totalResponses: number;
  responseRate: string;
  averageCompletionTime: string;
  responsesToday: number;
  responsesThisWeek: number;
  trendResponsesToday: number | null;
  trendThisWeek: number | null;
  trendResponseRate: number | null;
}
```

- [ ] **Step 2: Replace the positiveTrend helper with makeTrend**

Find and delete the `positiveTrend` helper function:

```typescript
  const positiveTrend = (value: number) => ({
    value,
    isPositive: true,
    label: t('statsTrend.positive', { values: { value: Math.abs(value) } }),
  });
```

Replace it with:

```typescript
  const makeTrend = (value: number | null) =>
    value == null ? undefined : { value, isPositive: value >= 0 };
```

- [ ] **Step 3: Update the trend display in StatCard to round values**

In the `StatCard` component, find the trend badge label line:

```tsx
            {trend.label ?? `${Math.abs(trend.value)}%`}
```

Replace with:

```tsx
            {`${Math.round(Math.abs(trend.value))}%`}
```

This removes the unused `label` fallback and ensures floats like `25.333...` display as `25%`.

- [ ] **Step 4: Replace all three hardcoded positiveTrend calls**

In the `StatsGrid` return JSX, make these three replacements:

**Total Responses card** — replace:
```tsx
        trend={stats.responsesToday > 0 ? positiveTrend(12) : undefined}
```
with:
```tsx
        trend={makeTrend(stats.trendResponsesToday)}
```

**Response Rate card** — replace:
```tsx
        trend={positiveTrend(8)}
```
with:
```tsx
        trend={makeTrend(stats.trendResponseRate)}
```

**This Week card** — replace:
```tsx
        trend={positiveTrend(15)}
```
with:
```tsx
        trend={makeTrend(stats.trendThisWeek)}
```

- [ ] **Step 5: Run type-check to confirm no errors**

```bash
pnpm type-check 2>&1 | grep -i "StatsGrid\|error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/components/FormDashboard/StatsGrid.tsx
git commit -m "feat(ui): replace hardcoded trend badges with real period-over-period data"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full unit test suite**

```bash
pnpm test:unit
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Run type-check across all packages**

```bash
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 3: Start the dev server and verify visually**

```bash
pnpm dev
```

Open the form dashboard in the browser. Verify:
- Forms with responses today AND yesterday → Total Responses badge shows a real % (green or red)
- Forms with no responses yesterday → Total Responses badge is **absent**
- Forms with this week AND last week responses → This Week badge shows real %
- Response Rate badge only appears when both weeks have ≥10 views
- Negative trends render in red with a down arrow (create a scenario where last week > this week)

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -p
git commit -m "fix: address review feedback on trend percentage display"
```
