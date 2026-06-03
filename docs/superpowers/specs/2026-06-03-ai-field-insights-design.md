# AI Field Insights — Design Spec

**Date:** 2026-06-03  
**Status:** Approved  
**Feature area:** Analytics → Field Analytics

---

## Summary

Add inline AI insight cards to the Field Analytics page. Each field card in the analytics view gains a coloured "AI INSIGHT" callout showing a 1–2 sentence actionable tip, plus a **"Fix with AI ✦"** button that opens the existing `AIEditDrawer` with the suggestion pre-loaded as a message. Tips are generated in a single batch call on demand and persisted in the database — page refreshes and subsequent visits are free.

---

## Context

The app already has:
- Rich field-level analytics: fill rate, average length, option frequency distributions, response counts (`fieldAnalyticsService.ts`)
- A fully-functional AI form editor (`AIEditDrawer`, `formEditAgent`, `aiFormEditTools.ts`) with conversation history
- Per-org token budgets by plan tier (`aiUsageService.ts`)

No AI currently surfaces in the Analytics section. This feature closes the gap between "seeing a problem" and "fixing it."

---

## User Flow

1. User opens **Form Analytics → Field Analytics** tab.
2. No tips yet — a prominent **"✨ Analyze all fields"** button appears in the section header.
3. User clicks it. A single AI batch call runs (~1–3k tokens). Tips render per field.
4. Each field card shows a coloured AI insight card at the bottom.
5. User clicks **"Fix with AI ✦"** on any card → `AIEditDrawer` opens with `fixPrompt` pre-filled.
6. If the form schema changes after analysis, a yellow stale banner appears: "Form changed since last analysis — Re-analyze?"

---

## Data Model

New Prisma model:

```prisma
model AIFieldInsight {
  id           String   @id @default(cuid())
  formId       String
  fieldId      String
  tip          String   @db.Text      // 1-2 sentence human-readable insight
  fixPrompt    String   @db.Text      // exact message to pre-fill in AIEditDrawer
  severity     String                 // "warning" | "error" | "success" | "info"
  schemaHash   String                 // 16-char SHA-256 prefix of field structure
  generatedAt  DateTime @default(now())

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@unique([formId, fieldId])
  @@index([formId])
  @@map("ai_field_insight")
}
```

### Schema hash

Computed from field IDs + types + labels in page order:

```ts
const fingerprint = schema.pages
  .flatMap(p => p.fields)
  .map(f => `${f.id}:${f.type}:${f.label}`)
  .join('|');

return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
```

Structural changes (add/remove/rename/retype field) invalidate the hash. Cosmetic changes (placeholder, hint, options) do not — they don't affect tip relevance.

---

## Backend

### New service: `apps/backend/src/services/aiFieldInsightService.ts`

**`computeSchemaHash(schema)`** — returns 16-char hex string.

**`generateFieldInsights(formId, schema, fieldAnalytics)`**  
- `fieldAnalytics` is sourced from `fieldAnalyticsService.ts` — the same data already rendered in the Field Analytics charts (fill rate, avg response length, option frequency counts for select/radio/checkbox, min/max/mean for number fields, response count per field)
- Builds a compact pipe-delimited prompt table: `fieldId | type | label | fillRate | avgLen | topOptions`
- Includes form-level context: title, overall completion rate, response count
- One AI call using `getPrimaryModel()` with structured output (Zod schema)
- Structured output per field: `{ fieldId, tip, fixPrompt, severity }`
- `tip`: max 180 chars, human-readable
- `fixPrompt`: max 200 chars, written as a direct instruction to the AI editor (e.g. `"Move the 'Cover Letter' field to the last page and improve its placeholder"`)
- `severity`: `"warning" | "error" | "success" | "info"` — drives tip card colour
- Upserts all rows via `@@unique([formId, fieldId])`
- Returns `FieldInsightsResult`

**`getFieldInsights(formId, currentSchemaHash)`**  
- Loads all `AIFieldInsight` rows for the form
- Compares stored `schemaHash` on any row against `currentSchemaHash`
- Returns `{ insights, schemaStale: boolean, generatedAt: string | null }`

### GraphQL additions (`schema.ts`)

```graphql
type FieldInsight {
  fieldId:     ID!
  tip:         String!
  fixPrompt:   String!   # pre-computed message for AIEditDrawer
  severity:    String!   # "warning" | "error" | "success" | "info"
  generatedAt: String!
}

type FieldInsightsResult {
  insights:    [FieldInsight!]!
  schemaStale: Boolean!
  generatedAt: String    # null when no tips exist yet
}

# Query
fieldInsights(formId: ID!, organizationId: ID!): FieldInsightsResult!

# Mutation
generateFieldInsights(formId: ID!, organizationId: ID!): FieldInsightsResult!
```

### Resolvers (`resolvers/ai.ts`)

**`Query.fieldInsights`**
1. `requireAuth` + `requireOrganizationMembership`
2. Load form schema from Y.js (`getFormSchema`)
3. Compute current schema hash
4. Call `getFieldInsights(formId, currentHash)`
5. Return result

**`Mutation.generateFieldInsights`**
1. `requireAuth` + `requireOrganizationMembership`
2. Check token budget (`checkAITokenBudget`) — throw `AI_TOKEN_LIMIT_EXCEEDED` if over
3. Load form schema + field analytics data
4. Call `generateFieldInsights(...)` → get tips + token count
5. `recordAITokenUsage(organizationId, tokensUsed)`
6. Return fresh `FieldInsightsResult`

---

## Frontend

### New component: `AIInsightCard.tsx`

```
apps/form-app/src/components/Analytics/FieldAnalytics/AIInsightCard.tsx
```

Props: `{ tip, fixPrompt, severity, onFixWithAI: (prompt: string) => void }`

Renders:
- Coloured card based on `severity`:
  - `warning` → yellow (`bg-yellow-50`, `border-yellow-300`)
  - `error` → red (`bg-red-50`, `border-red-200`)
  - `success` → green (`bg-green-50`, `border-green-200`)
  - `info` → blue (`bg-blue-50`, `border-blue-200`)
- "✨ AI INSIGHT" label
- Tip text
- "Fix with AI ✦" button — calls `onFixWithAI(fixPrompt)`

### Modified: `FieldAnalytics/index.tsx`

1. **On mount** — fire `GET_FIELD_INSIGHTS` query. If tips exist, render them. If `schemaStale`, show stale banner.
2. **Section header** — add "Analyze all fields" button (shown when no tips yet) or "Re-analyze" text link (shown when tips exist).
3. **Loading state** — skeleton cards per field while mutation is in-flight.
4. **Stale banner** — yellow bar: "Form changed since last analysis" + Re-analyze button.
5. **Per-field** — render `<AIInsightCard>` at the bottom of each field card when a matching insight exists.
6. **`onFixWithAI`** — opens `AIEditDrawer` (via existing `isOpen`/`onClose` pattern) and passes `fixPrompt` as the initial message.

### GraphQL operations

**`GET_FIELD_INSIGHTS`** (query) — `fieldInsights(formId, organizationId)`  
**`GENERATE_FIELD_INSIGHTS`** (mutation) — `generateFieldInsights(formId, organizationId)`

### i18n keys (en + ta)

```json
{
  "aiInsights": {
    "analyzeButton": "Analyze all fields",
    "reanalyzeLink": "Re-analyze",
    "insightLabel": "AI INSIGHT",
    "fixButton": "Fix with AI",
    "staleBanner": "Form changed since last analysis",
    "reanalyzeButton": "Re-analyze",
    "loading": "Analyzing fields...",
    "generatedAgo": "Analyzed {{time}} ago"
  }
}
```

---

## Caching & Invalidation Lifecycle

| State | DB rows | `schemaStale` | UI |
|---|---|---|---|
| No tips yet | 0 | — | "Analyze all fields" button prominent |
| Tips fresh | N fields | `false` | Tips shown, "Re-analyze" link |
| Schema changed | N fields | `true` | Yellow stale banner + Re-analyze button |
| Re-analyzed | N fields | `false` | Tips updated, stale banner gone |

---

## Token Budget

| Action | Token cost |
|---|---|
| Generate / Re-analyze (10 fields) | ~1,000–2,000 |
| Generate / Re-analyze (20 fields) | ~2,000–3,000 |
| Page visit (cached) | 0 |
| "Fix with AI" click | 0 |

Free plan (200k tokens/month) supports ~100 full-form analyses per month. All token usage is recorded via `recordAITokenUsage` and surfaced in the existing `AITokenMeter`.

---

## Files Changed

| Status | Path |
|---|---|
| NEW | `apps/backend/prisma/schema.prisma` — `AIFieldInsight` model |
| NEW | `apps/backend/src/services/aiFieldInsightService.ts` |
| MOD | `apps/backend/src/graphql/schema.ts` — `FieldInsight`, `FieldInsightsResult` types + query + mutation |
| MOD | `apps/backend/src/graphql/resolvers/ai.ts` — `fieldInsights` query + `generateFieldInsights` mutation |
| MOD | `apps/backend/src/graphql/resolvers.ts` — register updated `aiResolvers` |
| NEW | `apps/form-app/src/components/Analytics/FieldAnalytics/AIInsightCard.tsx` |
| MOD | `apps/form-app/src/components/Analytics/FieldAnalytics/index.tsx` |
| MOD | `apps/form-app/src/graphql/queries.ts` — `GET_FIELD_INSIGHTS` |
| MOD | `apps/form-app/src/graphql/mutations.ts` — `GENERATE_FIELD_INSIGHTS` |
| MOD | `apps/form-app/src/locales/en/fieldAnalytics.json` |
| MOD | `apps/form-app/src/locales/ta/fieldAnalytics.json` |

---

## Out of Scope

- Streaming tips field-by-field (can be added later for large forms)
- Tips for form-level analytics (views/completion chart) — separate feature
- Automatic re-analysis on schema change — user always triggers manually
