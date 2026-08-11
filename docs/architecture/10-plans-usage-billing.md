# Plans, Usage & Billing

Chargebee is the source of truth for what an organization has paid for. Postgres
holds a cached copy so a form view doesn't cost an API call. Everything
interesting here is about keeping those two in step — and about the three
different clocks that reset the three different usage counters.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/routes/chargebee-webhooks.ts` — `POST /api/chargebee-webhooks` |
| **Trigger** | Chargebee lifecycle events; plus in-process usage events on view and submit |
| **Execution** | Webhooks synchronously; usage tracking asynchronously in-process |
| **Outcome** | A `Subscription` row that mirrors Chargebee, plus live usage counters |
| **Fails loudly?** | Enforcement does — over-limit submissions are rejected outright |

## The flow

```
   CHECKOUT                            USAGE
   ────────                            ─────
   Chargebee hosted page          form viewed / submitted
            │                              │
            ▼                              ▼
   ┌──────────────────┐          ┌─────────────────────┐
   │ webhook event    │          │ subscription events │
   │  created         │          │  FORM_VIEWED        │
   │  changed         │          │  FORM_SUBMITTED     │
   │  renewed         │          └──────────┬──────────┘
   │  cancelled       │                     │
   │  paused          │                     ▼
   │  payment_failed  │          ┌─────────────────────┐
   └────────┬─────────┘          │ usageService        │
            │                    │  · increment        │
            ▼                    │  · 80% → REACHED    │
   ┌──────────────────┐          │  · 100% → EXCEEDED  │
   │ syncSubscription │          └──────────┬──────────┘
   │ FromWebhook      │                     │
   └────────┬─────────┘                     │
            │  on renewal also:             │
            │  resetUsageCounters           │
            ▼                               ▼
        ┌───────────────────────────────────────┐
        │  Subscription                         │
        │   planId, status, period              │
        │   viewsUsed / viewsLimit              │
        │   submissionsUsed / submissionsLimit  │
        │   aiCreditsLimit                      │
        └───────────────┬───────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  checkUsageExceeded            checkAITokenBudget
  (blocks submission)           (blocks AI, 402)
                                      │
                                      ▼
                                  AIUsage
                          (own row per billing period)
```

## Walkthrough

### The plans

| Plan | Views | Submissions | AI credits |
|---|---|---|---|
| `free` | 10,000 | 1,000 | 200 |
| `starter` | unlimited | 10,000 | 2,000 |
| `advanced` | unlimited | 100,000 | 20,000 |
| `enterprise` | negotiated | negotiated | negotiated |

`null` means unlimited. These are **fallbacks** — the live values come from
Chargebee entitlements once `getAvailablePlans()` has populated its cache. The
fallback map also serves as the floor a cancelled or expired org drops to, so it
can't keep the last-synced paid tier indefinitely.

Enterprise is different in kind: its limits are **admin-set directly on the
`Subscription` row** and never re-derived from Chargebee. Anything that
recalculates limits from a plan id has to leave enterprise alone.

### Even the free plan has a Chargebee subscription

`createFreeSubscription` creates a real $0 subscription (`free-usd-monthly`)
rather than treating free as an absence. That gives every organization a billing
period, which everything downstream depends on for its reset clock.

### Webhooks

`/api/chargebee-webhooks` handles eight event types. All of them call
`syncSubscriptionFromWebhook`; `subscription_renewed` additionally calls
`handleSubscriptionRenewal`.

| Event | Effect |
|---|---|
| `subscription_created` / `_started` | Sync |
| `subscription_changed` / `_activated` | Sync |
| `subscription_renewed` | Sync **and** reset usage counters |
| `subscription_cancelled` / `_cancelled_scheduled` | Sync |
| `subscription_paused` / `_reactivated` | Sync |
| `payment_succeeded` | Sync |
| `payment_failed` | Mark `past_due`, email the org owner |

The organization id is recovered from the Chargebee customer id by stripping an
`org_` prefix — that naming convention is load-bearing.

### The three reset clocks

This is the part that surprises people, and it's worth stating plainly:

| Counter | Where it lives | Resets |
|---|---|---|
| `viewsUsed` | `Subscription` column | On `subscription_renewed`, via `resetUsageCounters` |
| `submissionsUsed` | `Subscription` column | Same |
| AI credits | `AIUsage` rows, keyed by period start | **Never reset** — a new period simply gets a new row |

AI credits don't reset because there's nothing to reset. `currentPeriod()` derives
the period from `Subscription.currentPeriodStart`, and usage is looked up for
*that* period. Roll into a new period and the lookup finds no row, so usage reads
as zero.

The practical consequence: **if a renewal webhook is missed, views and
submissions stay stale but AI credits roll over correctly anyway.** Diverging
behaviour from one missed event.

Historical `AIUsage` rows created before periods were aligned to the billing cycle
are keyed to calendar-month boundaries. They're deliberately not backfilled —
they simply stop matching and remain as an audit trail.

### Usage tracking

Views and submissions are tracked through an in-process `EventEmitter`, separate
from the plugin one. `usageService` listens, increments the cached counter, and
emits:

- `USAGE_LIMIT_REACHED` at 80%
- `USAGE_LIMIT_EXCEEDED` at 100%

Enforcement is elsewhere and hard: `checkUsageExceeded` runs in `submitResponse`
and rejects an over-limit submission outright.

### AI credits

Tokens convert to **milli-credits** (1 credit = 1,000 milli-credits) at a per-tier
weight:

| Tier | Weight |
|---|---|
| `nano` | 1 |
| `mini` | 3.75 |

That ratio is calibrated against actual Azure OpenAI pricing for the deployed
models, and overridable via `AI_CREDIT_WEIGHT_NANO` / `AI_CREDIT_WEIGHT_MINI`.
It was previously assumed to be 5×, which matched a prior model generation's
pricing rather than the models actually deployed.

`checkAITokenBudget` caches per organization, but deliberately **skips the cache
near the limit** and invalidates on a concurrent write. It's still a soft
pre-check — see Gotchas.

### Enterprise activation

Enterprise has a state ordinary plans don't. When an admin sets a paid enterprise
deal, `enterprisePendingActivation` becomes `true` and the status flips to
`past_due` until the customer completes checkout.

That flag exists to distinguish two `past_due` organizations that need opposite
things:

| State | What the org needs |
|---|---|
| `past_due` + `enterprisePendingActivation` | The **checkout page** — they've never paid |
| `past_due` alone | The **billing portal** — normal dunning after a failed payment |

The negotiated terms (currency, period, price) are stored so a fresh hosted page
can be regenerated on demand — hosted pages expire, so the URL itself is never
persisted.

## Invariants & design decisions

- **Chargebee is the source of truth; Postgres is a cache.** Never write a limit
  locally and expect it to survive the next sync — except for enterprise, which
  is exactly the documented exception.
- **Enterprise limits are never re-derived from a plan id.** Anything that
  recalculates from `planId` must skip enterprise.
- **The free plan is a real $0 subscription.** Every org has a billing period.
- **Cancelled and expired orgs fall back to free-tier limits.** They must not
  retain the last paid tier.
- **`past_due` blocks AI credits**, matching how views and submissions behave.
- **The AI budget check races, deliberately.** An atomic reservation would
  serialise every AI request in an organization.
- **Usage enforcement is separate from usage warning.** The 80% event is
  informational; only `checkUsageExceeded` blocks anything.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `checkUsageExceeded` | `submitResponse` | `{ submissionsExceeded, … }` | It starts throwing rather than returning flags |
| `checkAITokenBudget` | AI chat route, subscription UI | `{ allowed, used, limit }` in **credits** | Units change to raw tokens |
| `recordAITokenUsage` | AI chat route | Takes tokens plus a model tier | The tier union changes |
| `PLAN_LIMITS_FALLBACK` | `chargebeeService`, `usageService` | Keyed by plan id, `null` = unlimited | A plan id is added to Chargebee but not here |
| Subscription event types | `usageService` | The `SubscriptionEventType` enum | A value is renamed |
| `Subscription` row | Pricing page, admin app, usage UI | Column names and `status` union | A new status appears without UI handling |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| Chargebee API + webhooks | External | Source of truth |
| `org_` customer-id convention | `chargebeeService` | Webhooks recover the org id from it |
| `subscriptionRepository` | Repositories | All persistence |
| `emailService` | Services | The payment-failed notification |

## Data touched

| Model | Access |
|---|---|
| `Subscription` | RW |
| `AIUsage` | RW |
| `Organization` | R |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Webhook handler throws | Error propagates; Chargebee retries per its own policy |
| Unknown event type | Logged and ignored |
| Payment fails | Status `past_due`, owner emailed; AI and submissions blocked |
| Renewal webhook missed | Views/submissions stay stale at last period's totals; AI credits roll over correctly regardless |
| No `Subscription` row for an org | Usage tracking logs a warning and returns |
| Chargebee entitlements unreachable | `PLAN_LIMITS_FALLBACK` is used |

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `CHARGEBEE_SITE` / `CHARGEBEE_API_KEY` | Environment | API access |
| `WARNING_THRESHOLD = 80` | `usageService.ts` | When `USAGE_LIMIT_REACHED` fires |
| `AI_CREDIT_WEIGHT_NANO` / `_MINI` | Environment | Token-to-credit weights |
| `PLAN_LIMITS_FALLBACK` | `lib/planLimits.ts` | Fallback and cancelled-org floor |
| `AI_CREDIT_LIMITS_FALLBACK` | `lib/ai.ts` | Fallback credit ceilings |

## Related pages

- [The Life of a Submission](./01-submission-lifecycle.md) — where
  `checkUsageExceeded` rejects, and where the usage event is emitted.
- [The AI Form Editor](./08-ai-form-editor.md) — the consumer of AI credits and
  the 402 path.

## Gotchas

- **Views/submissions and AI credits reset on different clocks.** If one looks
  reset and the other doesn't, that's expected, not a bug — check whether the
  renewal webhook actually arrived.
- **`aiCreditsLimit: null` means "not yet synced", not "unlimited".** It falls
  back to plan defaults. Unlike `viewsLimit`, where `null` *does* mean unlimited.
  Same column type, opposite meaning.
- **Enterprise ignores the plan catalog.** Editing `PLAN_LIMITS_FALLBACK` or
  Chargebee entitlements has no effect on an enterprise org.
- **`past_due` means two different things.** Check
  `enterprisePendingActivation` before deciding whether to send someone to
  checkout or to the billing portal.
- **The budget check can be beaten by concurrency.** Two simultaneous AI requests
  from one org can both pass and together exceed the limit. Accepted trade.
- **The `org_` prefix convention is load-bearing.** Webhooks strip it to recover
  the organization id.
