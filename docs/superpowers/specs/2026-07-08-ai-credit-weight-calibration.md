# AI Credit Weight Calibration

**Date:** 2026-07-08
**Status:** Decided
**Related:** GitHub issue #80

## Question

`DEFAULT_CREDIT_WEIGHTS` in `apps/backend/src/lib/ai.ts` assumed `mini` costs ~5x
`nano` per token. That number was a placeholder, never checked against real Azure
pricing for the models actually deployed. Is 5x correct?

## Models actually in production

Per `infrastructure/multi-cloud/terraform/azure/ai.tf` and the `ai.ts` fallback
defaults (confirmed live as of commit `a116067a`, which replaced an earlier
DeepSeek-V3-0324 + gpt-4.1-nano combo — see
`2026-06-07-ai-model-swap-deepseek-gpt41nano-design.md` — with the current
GPT-5.4 family):

- **mini** (primary, `AI_PRIMARY_MODEL`) → `gpt-5.4-mini`
- **nano** (fast, `AI_FAST_MODEL`) → `gpt-5.4-nano`

## Real Azure OpenAI pricing (Global Standard / PAYG, short context)

| Model | Input / 1M tokens | Output / 1M tokens |
|---|---|---|
| `gpt-5.4-nano` | $0.20 | $1.25 |
| `gpt-5.4-mini` | $0.75 | $4.50 |

Source: OpenAI API pricing docs (mirrored by Azure OpenAI Global Standard pricing
for the same model family).

## Ratio analysis

| Basis | mini : nano ratio |
|---|---|
| Input only | 0.75 / 0.20 = **3.75x** |
| Output only | 4.50 / 1.25 = **3.6x** |
| Blended (any input/output mix) | **3.6x – 3.75x** (stable — both tiers scale similarly regardless of mix) |

`tokensToMilliCredits()` weights *total* tokens (input + output combined, see
`recordAITokenUsage` callers in `aiChat.ts` / `resolvers/ai.ts` which pass
`usage.totalTokens`), so a single blended weight is the correct model. Since the
ratio barely moves across plausible input/output splits, the exact split doesn't
matter much — any reasonable choice lands in the 3.6–3.75 range.

**Where the 5x came from:** it matches the *previous-generation* pricing almost
exactly — `gpt-5-mini` ($0.25 / $2.00) vs. `gpt-5-nano` ($0.05 / $0.40) is exactly
5x on both axes. The weight was set (or copied) against that generation and never
re-validated after the project moved to `gpt-5.4-mini` / `gpt-5.4-nano`.

## Decision

**5x is meaningfully wrong for the live models** (>20% threshold from the issue:
5 / 3.75 ≈ 1.33, i.e. 33% too high) and is corrected to **3.75x**, using the
input-price ratio as the concrete constant (matches the upper end of the blended
range, i.e. the safer/more conservative choice for margin protection).

`DEFAULT_CREDIT_WEIGHTS` updated in `apps/backend/src/lib/ai.ts`:

```ts
const DEFAULT_CREDIT_WEIGHTS: Record<AIModelTier, number> = {
  nano: 1,
  mini: 3.75, // was 5
};
```

Still overridable via `AI_CREDIT_WEIGHT_MINI` / `AI_CREDIT_WEIGHT_NANO` env vars
if Azure pricing changes again — no env vars currently set these in any
deployment config, so this code default is what's live in prod.

## `AI_CREDIT_LIMITS_FALLBACK` — left unchanged

Lowering the mini weight increases the *token* allowance a fixed credit budget
buys on the mini tier (free plan: 200 credits → 40,000 mini tokens/month under
the old 5x weight vs. ~53,333 tokens/month under 3.75x). At current usage volumes
(low thousands of tokens per org per month, per `aiUsageService.ts` telemetry)
that's a difference of a few cents of Azure spend per free-tier org per month —
not material enough to justify changing user-facing plan numbers (200 / 2,000 /
20,000), which are also product/marketing decisions, not purely cost-derived.
Revisit if per-org usage volume grows by an order of magnitude.

## Reconciliation check

Out of scope per the issue (no automated pipeline required). A simple manual
spot-check: compare `SUM(creditsUsedMilli)/1000` from `AIUsage` for a period
against the actual Azure invoice for the same period, converted to nano-token-
equivalents via the same weight. Revisit this doc if a new model tier is added
or Azure repriced GPT-5.4.
