# AI Token Usage on Subscription Page

**Date:** 2026-05-30  
**Status:** Approved  
**Scope:** Frontend only — backend is complete

---

## Problem

Users have no visibility into their AI token consumption. When the limit is hit, they see an error toast but have no proactive way to monitor usage. The subscription page (`/settings/subscription`) already surfaces form views and submissions usage — AI tokens should live there too.

---

## What Already Exists

### Backend (no changes needed)
- `aiTokenUsage(organizationId: ID!): AITokenUsage!` GraphQL query
- Returns `{ used: Int!, limit: Int!, resetAt: String! }`
- Plan limits: `free` 50,000 / `starter` 500,000 / `advanced` 5,000,000 (monthly, resets on 1st)
- Tracked in `AIUsage` Prisma model, upserted per org per billing period

### Frontend (gap)
- `SubscriptionDashboard.tsx` queries views + submissions but does not call `aiTokenUsage`
- No `GET_AI_TOKEN_USAGE` GQL query exists in the frontend
- No locale strings for AI token usage

---

## Design

### Data flow

1. `GET_SUBSCRIPTION` (already runs) resolves `activeOrganization.id`
2. A second `useQuery(GET_AI_TOKEN_USAGE, { variables: { organizationId }, skip: !organizationId })` fetches AI token data
3. The result is rendered in a new card placed directly below the main subscription card

Using two separate queries (rather than extending `GET_SUBSCRIPTION`) avoids a backend schema change and keeps concerns separate.

### New component placement

```
SubscriptionDashboard
  ├── Alert banners (existing)
  ├── Main subscription card — views, submissions, billing period (existing)
  ├── UsageChart (existing)
  └── AITokenUsageCard (new)        ← added here
```

`AITokenUsageCard` is a small self-contained component extracted into `components/subscription/AITokenUsageCard.tsx`. It receives `organizationId` as a prop, owns its own query, and renders nothing while loading (skeleton).

### AITokenUsageCard UI

- **Header row:** sparkle icon + "AI Assistant Usage" title (left) + "Resets {date}" label (right)
- **Stat row:** large `used` number + "/ {limit}" limit label
- **Progress bar:** amber (`bg-amber-500`) → orange (`bg-orange-500`) at ≥80% → red (`bg-red-500`) at ≥100%
- **Sub-label:** `{percentage}% of monthly tokens used`
- **Exceeded state:** inline warning banner (amber background, matches existing exceeded alert pattern) with "Upgrade Plan" button
- **Loading state:** skeleton placeholder (same height as the card)

Visual hierarchy mirrors the existing views/submissions progress bars — same `Card`, `p-6`, `space-y-4` pattern.

### Files changed

| File | Change |
|---|---|
| `apps/form-app/src/graphql/subscription.ts` | Add `GET_AI_TOKEN_USAGE` query |
| `apps/form-app/src/components/subscription/AITokenUsageCard.tsx` | New component |
| `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx` | Import + render `AITokenUsageCard` after `UsageChart` |
| `apps/form-app/src/locales/en/subscriptionDashboard.json` | Add `aiTokens.*` keys |
| `apps/form-app/src/locales/ta/subscriptionDashboard.json` | Add Tamil translations |

### Locale keys (English)

```json
"aiTokens": {
  "title": "AI Assistant Usage",
  "resetsOn": "Resets {{date}}",
  "used": "{{used}} / {{limit}} tokens",
  "percentageUsed": "{{percentage}}% of monthly tokens used",
  "limitReached": "Monthly AI token limit reached. Upgrade to continue using AI features.",
  "upgradePlan": "Upgrade Plan"
}
```

---

## Error handling

- If `aiTokenUsage` query fails: card renders nothing (silent failure — non-critical usage info)
- If `organizationId` is not yet available: query is skipped via `skip: !organizationId`
- If `limit` is 0 (shouldn't happen but defensive): show "—" rather than divide-by-zero

---

## Out of scope

- Backend changes
- Historical token usage chart
- Per-conversation token breakdown
- Admin-side token reporting
