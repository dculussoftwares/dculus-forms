# AI Chat Token Re-Architecture

**Date:** 2026-06-01
**Status:** Draft — pending review
**Supersedes/extends:** `2026-06-01-ai-token-reduction-design.md` (that spec's two changes are already shipped; this spec attacks the larger, structural levers it left untouched)

---

## Problem

The AI form-builder chat consumes far more tokens per conversation than expected. A code-level audit (`apps/backend/src/routes/aiChat.ts`, `lib/formEditAgent.ts`, `lib/aiFormEditTools.ts`, `lib/ai.ts`) confirmed the cost model:

```
input_per_step = STATIC_INSTRUCTIONS (~1k tok)
               + 16_TOOL_DEFS         (~3.2k tok)
               + HISTORY (≤20 msgs, pruned)
               + GROWING_TOOL_RESULTS
turn_cost      = input_per_step × steps_per_turn × (0% cached today)
```

A single user message runs a `ToolLoopAgent` loop of up to **15 steps** (`formEditAgent.ts:12`). On **every step** the full payload is re-sent to Azure. Three compounding root causes:

| # | Root cause | Evidence | Effect |
|---|---|---|---|
| 1 | **Cache prefix is busted** | `aiChat.ts:84` injects `currentPageId` near the *start* of the system prompt; `:88–94` appends the `Form structure:` summary at the *end*. Both are dynamic, so Azure's automatic prefix cache matches only the first ~50 chars and gives up. | Full price on every step, every turn. |
| 2 | **Read-before-act round-trips** | System prompt forces `listFields` → `getField` before edits (`aiChat.ts:98`). 16 tool defs (~3.2k tok) re-sent each step. | Each read is an extra full-priced model call before any change. |
| 3 | **Loop multiplies an uncached base** | `stepCountIs(15)`; tools encourage sequential reads. | `base × steps`, never cached = the explosion. |

### Verified facts (Azure)

- Azure OpenAI **supports automatic prefix caching**: prefixes ≥1024 tokens, ~50% discount on cached input, cache persists 5–10 min (longer off-peak). It only triggers when the request **prefix is byte-stable**, and can be pinned with `promptCacheKey`.
- AI SDK exposes the cache hit count via `providerMetadata.openai.cachedPromptTokens` (the Azure provider extends the OpenAI provider). The exact namespace (`providerOptions.azure` vs `.openai`) is to be confirmed during Phase 0 with a live probe — see Open Questions.
- **Dev and prod run different models.** Dev: `gpt-5.4-mini` / `gpt-5.4-nano`. Prod: `gpt-4o` / `gpt-4o-mini`. Terraform `infrastructure/multi-cloud/terraform/azure/ai.tf` already defines `gpt-5.4-mini`/`gpt-5.4-nano` deployments; prod simply hasn't applied them. Standardizing on `gpt-5.4-mini` is a Terraform variable/apply on the operator's side (no code change, no resource creation by Claude).
- AI SDK version: `ai@6.0.191`, `@ai-sdk/azure@3.0.66`, `@ai-sdk/openai@3.0.65`.

---

## Goals

1. **65–75% token reduction** per conversation (measured, not estimated).
2. **Lower latency** — fewer model round-trips per user message.
3. **Preserve every documented behavior** in `docs/ai-builder-chat-capabilities.md` (the manual test checklist G1–S10).
4. **No regressions** in the behavior stabilized by the recent 7-bug-fix + coverage work.

### Non-goals

- Switching LLM providers (staying on Azure — decided).
- Changing the frontend request contract (it already sends only the latest message + IDs; that stays).
- Touching the Y.js / Hocuspocus collaboration layer or the `applyAIOp` → Zustand → Y.js mutation flow.

---

## Solution Overview

Two structural ideas, each independently valuable:

### Idea A — Stable cacheable prefix + ephemeral tail

Restructure each request so the expensive, repeated content forms a **byte-stable prefix** that Azure caches, and all dynamic content lives in an **ephemeral tail** that is never persisted to history.

```
┌─ CACHEABLE PREFIX (byte-stable → hits Azure prefix cache) ─────┐
│  [system]   STATIC instructions  (no page id, no form data)     │
│  [tools]    consolidated tool definitions                       │
│  [history]  prior conversation messages (grow-only prefix)      │
├─ EPHEMERAL TAIL (uncached, NOT saved to history) ──────────────┤
│  [user]     "<the user's message>"                              │
│  [context]  current page id + compact form snapshot             │
└─────────────────────────────────────────────────────────────────┘
providerOptions: { <azure|openai>: { promptCacheKey: conversationId } }
```

Key properties:
- The system prompt becomes **100% static** — no `currentPageId`, no `Form structure:` line. (This directly undoes the cache-busting introduced by the prior token-reduction spec.)
- Dynamic context moves to a trailing message placed **after** history. Because the prefix (system + tools + history) is unchanged, steps 2–15 within a turn — and every turn within the 5–10 min cache window — hit the cache (~50% off the base).
- The ephemeral context message is **stripped before `saveConversationMessages`**, so stale form snapshots never accumulate in history (history stays a stable, growing prefix — no snapshot churn).
- `promptCacheKey = conversationId` pins cache routing so a conversation's requests land on the same cached prefix.

### Idea B — Compact form snapshot kills read round-trips

Inject the form's current structure (the same compact format `listFields` already produces) into the ephemeral tail every turn. The model sees the form immediately and acts in ~1–2 steps instead of 4–10.

- **Small forms (≤ ~40 fields):** include the full compact snapshot (~200–600 tok, uncached but saves entire round-trips). Build the agent **without** `listFields`/`getField` — the model already has the data.
- **Large forms (> ~40 fields):** include only a page-level summary in the tail, and **keep** `listFields`/`getField` so the model can drill in on demand. (Threshold tunable; default 40, configurable constant.)
- Tools are already created per-request (`createFormEditTools(schema)` in `formEditAgent.ts:9`), so conditional inclusion is natural.

### Idea C — Tool consolidation (16 → ~8)

Shrinks the (now-cached, but still first-turn-billed) tool block and removes whole classes of "which tool?" bugs. Behavior-preserving mergers:

| New tool | Replaces | Behavior contract preserved |
|---|---|---|
| `updateFields(fieldIds[], updates)` | `updateField`, `bulkUpdateFields` | Single edit = 1-element array. Covers U1–U9, B1–B4. |
| `removeFields(fieldIds[])` | `removeField`, `bulkRemoveFields` | Single delete = 1-element array. Covers R1, R2. |
| `relocateField(fieldId, targetPageId, insertAfterFieldId, mode)` | `moveField`, `copyField` | `mode: 'move' \| 'copy'`. Covers M1–M4. |
| `reorder(scope, ids[], pageId?)` | `reorderFields`, `reorderPages` | `scope: 'fields' \| 'pages'`. Covers O1, O2, P5. |
| `addField` | (unchanged) | F1–F8. |
| `addPage` | (unchanged) | **Must keep** pre-generated `pageId` return (`aiFormEditTools.ts:164`) for F8/S9 next-page logic. |
| `removePage` | (unchanged) | Keeps "refuse last page" guard. P4, P6. |
| `renamePage` | (unchanged) | P3. |
| `navigateToPage` | (unchanged) | N1, N2. |
| `updateLayout` | (unchanged) | L1–L4. |
| `proposeValidation` | (unchanged — **never merge**) | The suggest-vs-apply distinction (V1–V3, S7) is a hard product contract. |
| `listFields`, `getField` | conditional (large forms only) | A1–A4 still work; on small forms the snapshot covers them. |

That's **11 always-present + 2 conditional** (`listFields`/`getField`). Net: small-form requests carry ~9 tools; large-form requests carry ~11. The frontend mutation router (`MUTATION_TOOL_NAMES` in `aiAgentTypes.ts`) and `applyAIOp.ts` must learn the new op shapes — see Frontend Impact.

### Idea D — Model standardization

Standardize both envs on `gpt-5.4-mini` (primary) + `gpt-5.4-nano` (fast). Prod applies the existing Terraform deployments. Code already reads `AZURE_OPENAI_PRIMARY_DEPLOYMENT` / `AZURE_OPENAI_FAST_DEPLOYMENT` (`ai.ts:25,31`), so the only change is env/Terraform, plus removing any prod env override that pins `gpt-4o-mini`.

### Idea E — Telemetry + regression guard (Phase 0, first)

We cannot claim savings without measurement, nor protect behavior without a guard.
- Per-turn telemetry: `{ conversationId, formId, formFieldCount, steps, inputTokens, outputTokens, cachedPromptTokens, cacheHitRatio, model }`, logged via existing `logger` and recorded alongside `recordAITokenUsage`.
- Token-cost regression test: a harness that runs representative prompts (drawn from the capability doc) through the agent with a mocked/stubbed model, asserting step count and assembled-prompt token estimates stay within a budget. Plus the existing behavioral tests, adapted to the consolidated tools.

---

## Architecture / Component Changes

### `apps/backend/src/lib/ai.ts`
- Add a helper to attach `providerOptions` with `promptCacheKey` (namespace confirmed in Phase 0).
- No model-selection logic change (already env-driven). Document the standardized deployment names.

### `apps/backend/src/routes/aiChat.ts`
- `buildSystemPrompt()` → `STATIC_SYSTEM_PROMPT` constant (no args, no dynamic content). Hoisted to module scope so it is literally the same string every request.
- New `buildEphemeralContext(currentPageId, schema, formFieldCount)` → returns a single trailing message (role chosen per Phase 0 probe; likely a `user`-role context block or system-role appended message) containing current page + compact snapshot (small forms) or page summary (large forms).
- Assemble messages as `[...history, userMessage, ephemeralContext]`; pass `promptCacheKey: conversationId` via providerOptions.
- In `onFinish`, compute `newMessages` by slicing off both the persisted history **and** the ephemeral context (ensure the ephemeral message is never saved). Record telemetry here.

### `apps/backend/src/lib/formEditAgent.ts`
- Accept a flag (or derive from `schema`) whether to include read tools; build the consolidated tool set accordingly.
- Thread `providerOptions` through to the model call.
- Keep `stepCountIs(15)` as a safety cap (consolidation should make hitting it rare); keep the `prepareStep` compaction.

### `apps/backend/src/lib/aiFormEditTools.ts`
- Implement the consolidated tool set (Idea C). Update the exported `FormOperation` union to the new op shapes. Preserve all guards (last-page, pre-generated pageId, etc.).

### `apps/backend/src/services/aiTelemetry.ts` (new)
- Small module: `recordTurnTelemetry(stats)` — structured log + optional persistence. Keep it dependency-light.

### Frontend Impact — `apps/form-app/src`
- `lib/aiAgentTypes.ts`: update `MUTATION_TOOL_NAMES` to the consolidated names (`updateFields`, `removeFields`, `relocateField`, `reorder`, …).
- `lib/applyAIOp.ts`: handle the new op `type`s, mapping them onto existing store actions (`moveFieldBetweenPages`, `copyFieldToPage`, `reorderFields`, `reorderPages`, batched `updateField`/`removeField`). No new store actions expected — the store already supports all underlying operations.
- Tool-part display components (`tool-parts/`): the `MutationToolPart` is generic, but verify rendering for renamed tools; `ListFieldsToolPart`/`GetFieldToolPart` only render on large forms now.
- **Backward compatibility:** existing persisted conversations contain old tool-call part types (`tool-updateField`, etc.). `applyAIOp` and the display components must continue to render historical messages without erroring (keep old type handling as no-op-on-replay / display-only). New mutations use new types.

### Docs
- Update `docs/ai-builder-chat-capabilities.md`: tool count, tool names, and the stale token table (header says 16, table says 14). Re-map each scenario to its consolidated tool.

---

## Data Flow (after)

```
User msg ──► POST /api/ai/chat
   │  load history (≤20, already capped)
   │  read Y.js schema (already 10s-cached)
   ▼
assemble: [STATIC_SYSTEM][TOOLS][history] + [userMsg] + [ephemeral: page+snapshot]
   │  providerOptions.promptCacheKey = conversationId
   ▼
ToolLoopAgent.stream  ── steps 2..N reuse cached prefix (~50% off base)
   │  small form: no listFields/getField needed → ~1–2 steps
   ▼
SSE stream ──► frontend  ── tool outputs ──► applyAIOp ──► Zustand ──► Y.js
   │
onFinish: strip ephemeral ctx → save newMessages; record telemetry + usage
```

---

## Phasing

| Phase | Scope | Risk | Test gate |
|---|---|---|---|
| **0. Telemetry & probe** | Add telemetry; live-probe Azure cache namespace + `cachedPromptTokens`; capture baseline numbers from real dev conversations. | None (additive) | Telemetry visible in logs; baseline recorded. |
| **1. Cacheable prefix + snapshot** | Static system prompt; ephemeral tail; snapshot injection; `promptCacheKey`; conditional read tools. **Behavior-preserving — keeps all 16 tools.** | Low–med | Cache-hit ratio > 0 on step 2+; behavioral tests pass; token regression test shows reduction. |
| **2. Tool consolidation** | 16 → ~8 tools; update `FormOperation`, frontend `applyAIOp` + `MUTATION_TOOL_NAMES`; back-compat for old persisted messages. | Med (touches recently stabilized tools) | Adapted behavioral tests (all G/F/U/R/O/M/B/P/L/V/A/N/X scenarios) pass; old conversations still render. |
| **3. Model standardization** | Deploy `gpt-5.4-mini` to prod via Terraform (operator); remove prod model override; verify. | Low (ops) | Both envs on `gpt-5.4-mini`; smoke test in dev. |

Each phase is independently shippable. Measure after each (telemetry from Phase 0 proves the delta).

---

## Testing Strategy

- **Token-cost regression test** (new): run a fixed set of capability-doc prompts through the agent with a stubbed model that echoes deterministic tool calls; assert (a) steps ≤ budget per scenario, (b) estimated assembled-prompt tokens ≤ budget, (c) ephemeral context is **not** present in saved messages.
- **Behavioral tests** (adapt existing): every scenario in `ai-builder-chat-capabilities.md` §2–§9 maps to a consolidated tool — assert the right op shape is produced. Special focus on the recently-fixed cases (move/copy, bulk-remove, next-page auto-create).
- **Cache verification**: an integration-style test (or manual dev probe) asserting `cachedPromptTokens > 0` on the second step of a multi-step turn.
- **Back-compat test**: load a conversation containing old tool-call part types; assert it renders and replays without error.
- **`aiChatService` test**: assert the ephemeral context message is stripped before persistence.

---

## Estimated Impact

| Scenario | Today | After (Phase 1+2) | Reduction |
|---|---|---|---|
| Short (5 msgs), 3-page form | ~3k tok/turn × full steps | cached base + fewer steps | ~55–65% |
| Medium (10 msgs), 5-page form | ~8k tok/turn equivalent | snapshot avoids reads + cache | ~65–75% |
| "Make all required" (bulk) | listFields + N updates × uncached | snapshot + 1 `updateFields` | ~70–80% |

Plus: fewer round-trips → lower latency; fewer tools → fewer mis-selection bugs.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Azure cache namespace / behavior differs from OpenAI docs | Phase 0 live probe before relying on it; telemetry surfaces actual `cachedPromptTokens`. |
| Snapshot in tail bloats large forms | Size threshold (default 40 fields) falls back to page-summary + read tools. |
| Tool consolidation breaks stabilized behavior | Phase 2 gated on the full adapted behavioral suite; consolidation is mechanical (same underlying ops). |
| Old persisted conversations use old tool types | Explicit back-compat handling + test. |
| Ephemeral context accidentally persisted → history churn kills cache | Dedicated strip step + assertion test. |
| Prod model swap changes output quality | `gpt-5.4-mini` already validated in dev; Phase 3 smoke test; env-flag rollback. |

---

## Open Questions (resolve in Phase 0)

1. **Cache namespace:** `providerOptions.azure.promptCacheKey` vs `providerOptions.openai.promptCacheKey` for `@ai-sdk/azure@3.0.66` — confirm via live probe + reading `providerMetadata`.
2. **Ephemeral context role:** trailing `user`-role context block vs second `system` message vs `instructions`-merged — pick whichever keeps the cacheable prefix intact and reads cleanly to the model.
3. **Snapshot threshold:** confirm 40 fields is the right small/large cutoff against real form-size distribution (check `FormMetadata.fieldCount` stats).

---

## Files Touched (summary)

| File | Phase | Change |
|---|---|---|
| `apps/backend/src/services/aiTelemetry.ts` | 0 | New — per-turn telemetry |
| `apps/backend/src/routes/aiChat.ts` | 0,1 | Telemetry hook; static system prompt; ephemeral tail; promptCacheKey; strip-before-save |
| `apps/backend/src/lib/ai.ts` | 0,1,3 | providerOptions helper; documented deployment names |
| `apps/backend/src/lib/formEditAgent.ts` | 1,2 | Conditional read tools; providerOptions threading; consolidated tool set |
| `apps/backend/src/lib/aiFormEditTools.ts` | 2 | Consolidated tools + `FormOperation` union |
| `apps/form-app/src/lib/aiAgentTypes.ts` | 2 | Updated `MUTATION_TOOL_NAMES` |
| `apps/form-app/src/lib/applyAIOp.ts` | 2 | New op shapes + back-compat |
| `apps/form-app/src/components/form-builder/tool-parts/*` | 2 | Verify rendering for renamed/conditional tools |
| `infrastructure/multi-cloud/terraform/azure/*` | 3 | (Operator) apply `gpt-5.4-mini` to prod |
| `docs/ai-builder-chat-capabilities.md` | 2 | Update tool list/count/token table |
| backend `__tests__/*` | 0,1,2 | Token regression test, adapted behavioral tests, back-compat, strip test |
