# AI Token Usage on Subscription Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "AI Assistant Usage" card to `/settings/subscription` showing monthly token consumption with a progress bar, reset date, and an upgrade prompt when the limit is hit.

**Architecture:** The backend `aiTokenUsage(organizationId: ID!)` query already exists and returns `{ used, limit, resetAt }`. The frontend adds a GQL query, a self-contained `AITokenUsageCard` component that owns its own query, and wires it into `SubscriptionDashboard` after the `UsageChart`. No backend changes required.

**Tech Stack:** React, Apollo Client (`useQuery`), Tailwind CSS, `@dculus/ui` (Card, Badge, Button), `lucide-react` (Sparkles, TrendingUp), `useTranslation` hook.

---

## File Map

| Action | Path |
|---|---|
| Modify | `apps/form-app/src/graphql/subscription.ts` |
| Create | `apps/form-app/src/components/subscription/AITokenUsageCard.tsx` |
| Modify | `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx` |
| Modify | `apps/form-app/src/locales/en/subscriptionDashboard.json` |
| Modify | `apps/form-app/src/locales/ta/subscriptionDashboard.json` |

---

## Task 1: Add `GET_AI_TOKEN_USAGE` GraphQL query

**Files:**
- Modify: `apps/form-app/src/graphql/subscription.ts`

- [ ] **Step 1: Append the query to the end of `subscription.ts`**

Open `apps/form-app/src/graphql/subscription.ts` and add at the bottom:

```typescript
export const GET_AI_TOKEN_USAGE = gql`
  query GetAITokenUsage($organizationId: ID!) {
    aiTokenUsage(organizationId: $organizationId) {
      used
      limit
      resetAt
    }
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/graphql/subscription.ts
git commit -m "feat(subscription): add GET_AI_TOKEN_USAGE GraphQL query"
```

---

## Task 2: Add locale strings (English + Tamil)

**Files:**
- Modify: `apps/form-app/src/locales/en/subscriptionDashboard.json`
- Modify: `apps/form-app/src/locales/ta/subscriptionDashboard.json`

- [ ] **Step 1: Add `aiTokens` key to the English locale**

In `apps/form-app/src/locales/en/subscriptionDashboard.json`, add the following as a new top-level key (e.g. after `"planComparison"`):

```json
"aiTokens": {
  "title": "AI Assistant Usage",
  "resetsOn": "Resets {{date}}",
  "used": "{{used}} / {{limit}} tokens",
  "percentageUsed": "{{percentage}}% of monthly tokens used",
  "limitReached": "Monthly AI token limit reached. Upgrade to continue using AI features.",
  "upgradePlan": "Upgrade Plan",
  "loading": "Loading AI usage..."
}
```

- [ ] **Step 2: Add `aiTokens` key to the Tamil locale**

In `apps/form-app/src/locales/ta/subscriptionDashboard.json`, add:

```json
"aiTokens": {
  "title": "AI உதவியாளர் பயன்பாடு",
  "resetsOn": "{{date}} அன்று மீட்டமைக்கப்படும்",
  "used": "{{used}} / {{limit}} டோக்கன்கள்",
  "percentageUsed": "மாதாந்திர டோக்கன்களில் {{percentage}}% பயன்படுத்தப்பட்டது",
  "limitReached": "மாதாந்திர AI டோக்கன் வரம்பை எட்டிவிட்டது. AI அம்சங்களைத் தொடர மேம்படுத்தவும்.",
  "upgradePlan": "மேம்படுத்தல் திட்டம்",
  "loading": "AI பயன்பாட்டை ஏற்றுகிறது..."
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/locales/en/subscriptionDashboard.json \
        apps/form-app/src/locales/ta/subscriptionDashboard.json
git commit -m "feat(subscription): add AI token usage locale strings (en + ta)"
```

---

## Task 3: Create `AITokenUsageCard` component

**Files:**
- Create: `apps/form-app/src/components/subscription/AITokenUsageCard.tsx`

- [ ] **Step 1: Create the component file**

Create `apps/form-app/src/components/subscription/AITokenUsageCard.tsx` with this content:

```tsx
import { useQuery } from '@apollo/client';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Card, Button } from '@dculus/ui';
import { useState } from 'react';
import { GET_AI_TOKEN_USAGE } from '../../graphql/subscription';
import { UpgradeModal } from './UpgradeModal';
import { useTranslation } from '../../hooks/useTranslation';

interface AITokenUsageCardProps {
  organizationId: string;
  currentPlan: string;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-red-500';
  if (percentage >= 80) return 'bg-orange-500';
  return 'bg-amber-500';
}

export function AITokenUsageCard({ organizationId, currentPlan }: AITokenUsageCardProps) {
  const { t } = useTranslation('subscriptionDashboard');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { data, loading } = useQuery(GET_AI_TOKEN_USAGE, {
    variables: { organizationId },
    skip: !organizationId,
  });

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-muted" />
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-2 w-full rounded bg-muted" />
        </div>
      </Card>
    );
  }

  if (!data?.aiTokenUsage) return null;

  const { used, limit, resetAt } = data.aiTokenUsage;
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const limitReached = used >= limit;
  const resetDate = new Date(resetAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-semibold">{t('aiTokens.title')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {t('aiTokens.resetsOn', { values: { date: resetDate } })}
          </span>
        </div>

        {/* Limit-reached warning */}
        {limitReached && (
          <div className="flex items-start justify-between gap-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('aiTokens.limitReached')}
            </p>
            <Button
              size="sm"
              onClick={() => setShowUpgradeModal(true)}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {t('aiTokens.upgradePlan')}
            </Button>
          </div>
        )}

        {/* Token count */}
        <div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-2xl font-bold">{used.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">
              {t('aiTokens.used', {
                values: {
                  used: used.toLocaleString(),
                  limit: limit.toLocaleString(),
                },
              })}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all ${getProgressColor(percentage)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            {t('aiTokens.percentageUsed', { values: { percentage: percentage.toFixed(1) } })}
          </p>
        </div>
      </div>

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          currentPlan={currentPlan}
        />
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/form-app/src/components/subscription/AITokenUsageCard.tsx
git commit -m "feat(subscription): add AITokenUsageCard component"
```

---

## Task 4: Wire `AITokenUsageCard` into `SubscriptionDashboard`

**Files:**
- Modify: `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx`

- [ ] **Step 1: Add the import**

At the top of `SubscriptionDashboard.tsx`, add after the existing imports:

```tsx
import { AITokenUsageCard } from './AITokenUsageCard';
```

- [ ] **Step 2: Extract `organizationId` and `planId` from query data**

The existing code already has:
```tsx
const subscription = data?.activeOrganization?.subscription;
```

Add directly below it:
```tsx
const organizationId = data?.activeOrganization?.id ?? '';
```

- [ ] **Step 3: Render `AITokenUsageCard` after `UsageChart`**

Find the `<UsageChart ... />` JSX block (near the bottom of the return statement, before the `UpgradeModal`). Add `AITokenUsageCard` immediately after it:

```tsx
      {/* AI Token Usage */}
      {organizationId && (
        <AITokenUsageCard
          organizationId={organizationId}
          currentPlan={planId}
        />
      )}
```

The final order in the return should be:
1. Alert banners
2. Main subscription card
3. `<UsageChart />`
4. `<AITokenUsageCard />` ← new
5. `<UpgradeModal />` (conditionally rendered, no visual output)

- [ ] **Step 4: Confirm TypeScript compiles**

```bash
pnpm type-check
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/subscription/SubscriptionDashboard.tsx
git commit -m "feat(subscription): show AI token usage card on subscription page"
```

---

## Task 5: Verify in browser

- [ ] **Step 1: Ensure the dev server is running**

```bash
pnpm dev
```

- [ ] **Step 2: Open `/settings/subscription`**

Navigate to `http://localhost:3000/settings/subscription`.

Expected: Below the existing usage chart, an "AI Assistant Usage" card appears showing:
- Sparkles icon with amber background
- "Resets on {date}" in top-right
- Token count (e.g. `12,400 / 50,000 tokens`)
- Amber progress bar
- Percentage label below the bar

- [ ] **Step 3: Verify loading state**

With DevTools open, throttle the network to "Slow 3G". Reload the page.

Expected: A skeleton placeholder (3 grey bars) appears where the card will be, then transitions to the real data.

- [ ] **Step 4: Verify the limit-reached state (dev only)**

In `apps/backend/src/lib/ai.ts`, temporarily change the free plan limit:

```typescript
export const AI_TOKEN_LIMITS: Record<string, number> = {
  free: 1,        // ← temporarily set very low
  starter: 500_000,
  advanced: 5_000_000,
};
```

Reload. Expected: red "Monthly AI token limit reached" banner with "Upgrade Plan" button appears. Clicking opens the upgrade modal.

Revert the limit change after verifying:

```typescript
export const AI_TOKEN_LIMITS: Record<string, number> = {
  free: 50_000,
  starter: 500_000,
  advanced: 5_000_000,
};
```

- [ ] **Step 5: Final commit if any fixes were made during verification**

```bash
git add -p  # stage only intentional changes
git commit -m "fix(subscription): address issues found during AI token usage verification"
```
