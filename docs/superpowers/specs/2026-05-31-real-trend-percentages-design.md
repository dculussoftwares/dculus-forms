# Real Trend Percentages — Performance Overview

**Date:** 2026-05-31
**Status:** Approved

## Problem

The three green percentage badges in the form dashboard "Performance Overview" section
(`StatsGrid`) show hardcoded dummy values: +12%, +8%, +15%. They never change and are
not derived from any real data.

## Goal

Replace all three hardcoded values with real period-over-period comparisons. A badge is
hidden (no component rendered) when there is insufficient data to produce a meaningful
number.

---

## Approach: Backend computes trend percentages, frontend renders them

Business logic (thresholds, zero-safe division, minimum sample size) lives entirely in
the backend resolver. The frontend receives either a float or `null` and renders
accordingly — no math in the frontend.

---

## Backend Changes

### File: `apps/backend/src/graphql/schema.ts`

Add three nullable fields to `FormDashboardStats`:

```graphql
type FormDashboardStats {
  averageCompletionTime: Float
  responseRate: Float
  responsesToday: Int!
  responsesThisWeek: Int!
  responsesThisMonth: Int!
  trendResponsesToday: Float   # null = hide badge
  trendThisWeek: Float         # null = hide badge
  trendResponseRate: Float     # null = hide badge (insufficient views)
}
```

### File: `apps/backend/src/graphql/resolvers/forms.ts`

Inside the existing `dashboardStats` resolver, add 4 additional parallel Prisma queries
alongside the current 6. `responsesThisWeek` is already queried and reused for the
response rate numerator — no extra query needed.

| New query | Description |
|---|---|
| `responsesYesterday` | `Response.count` where `submittedAt` is in yesterday's date window |
| `responsesLastWeek` | `Response.count` where `submittedAt` is between 14 and 7 days ago |
| `viewsThisWeek` | `FormViewAnalytics.count` where `viewedAt >= weekAgo` |
| `viewsLastWeek` | `FormViewAnalytics.count` where `viewedAt` is between 14 and 7 days ago |

**Date window helpers** (derived from existing `today` and `weekAgo`):

```ts
const yesterday    = new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000);
const twoWeeksAgo  = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
```

**Trend calculations:**

```ts
// Today vs yesterday
const trendResponsesToday =
  responsesYesterday === 0
    ? null
    : ((responsesToday - responsesYesterday) / responsesYesterday) * 100;

// This week vs last week (response count)
const trendThisWeek =
  responsesLastWeek === 0
    ? null
    : ((responsesThisWeek - responsesLastWeek) / responsesLastWeek) * 100;

// Response rate: week-over-week PERCENTAGE POINTS delta (not relative % change).
// e.g. rate goes from 20% → 25% → trendResponseRate = +5 (displayed as "+5%")
// Hidden when either window has fewer than 10 views (noisy with small samples)
const rateThisWeek  = viewsThisWeek  > 0 ? (responsesThisWeek  / viewsThisWeek)  * 100 : 0;
const rateLastWeek  = viewsLastWeek  > 0 ? (responsesLastWeek  / viewsLastWeek)  * 100 : 0;
const trendResponseRate =
  viewsThisWeek < 10 || viewsLastWeek < 10
    ? null
    : rateThisWeek - rateLastWeek;
```

Return all three alongside existing fields.

---

## Frontend Changes

### File: `apps/form-app/src/graphql/queries.ts`

Add the three new fields to the `dashboardStats` selection in `GET_FORM_BY_ID`:

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

### File: `apps/form-app/src/hooks/useFormDashboard.ts`

Extend `DashboardStats` interface:

```ts
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

Pass through from `formDashboardStats` with `?? null` fallback (no math in the hook).

### File: `apps/form-app/src/components/FormDashboard/StatsGrid.tsx`

Update `DashboardStats` interface to include the three trend fields, then replace:

| Card | Old | New |
|---|---|---|
| Total Responses | `positiveTrend(12)` | real `trendResponsesToday`, hidden when `null` |
| Response Rate | `positiveTrend(8)` | real `trendResponseRate`, hidden when `null` |
| This Week | `positiveTrend(15)` | real `trendThisWeek`, hidden when `null` |

`isPositive` is derived from `value >= 0` (≥0 = green, <0 = red).

No locale changes required — the existing `statsTrend.positive` translation key already
handles the `{value}%` format. The `trend.label` field in the existing `positiveTrend`
helper will be dropped; the component falls back to `${Math.abs(trend.value)}%` which
is already the correct behavior.

---

## Error Handling / Edge Cases

| Case | Behaviour |
|---|---|
| No responses yesterday | `trendResponsesToday = null` → no badge |
| No responses last week | `trendThisWeek = null` → no badge |
| < 10 views in either window | `trendResponseRate = null` → no badge |
| Trend is 0% exactly | Badge shows "0%" in green (no change is not a problem) |
| Trend is negative | Badge renders in red with a down arrow (existing component already supports this) |

---

## Files Changed

| File | Change |
|---|---|
| `apps/backend/src/graphql/schema.ts` | Add 3 nullable Float fields to `FormDashboardStats` |
| `apps/backend/src/graphql/resolvers/forms.ts` | Add 4 new Prisma queries + trend math |
| `apps/form-app/src/graphql/queries.ts` | Add 3 fields to `GET_FORM_BY_ID` selection |
| `apps/form-app/src/hooks/useFormDashboard.ts` | Extend interface + pass-through |
| `apps/form-app/src/components/FormDashboard/StatsGrid.tsx` | Use real trend props |

No database migrations required — all new data is derived from existing tables.
