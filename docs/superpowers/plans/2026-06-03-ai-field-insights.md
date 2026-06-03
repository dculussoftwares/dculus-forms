# AI Field Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline AI insight cards to the Field Analytics page — one tip per field card with a "Fix with AI" button that opens the AI Edit Drawer pre-loaded with the suggestion.

**Architecture:** A new `AIFieldInsight` Prisma model stores tips keyed by `(formId, fieldId)` with a `schemaHash` for staleness detection. A backend service generates all tips in one batch AI call, persists them, and returns them on subsequent reads for zero token cost. The frontend injects tip cards into the existing `FieldSelectionGrid` and adds an "Analyze all fields" button to `FieldAnalyticsViewer`.

**Tech Stack:** Prisma (PostgreSQL), Vercel AI SDK (`generateText` + `Output.object`), Apollo GraphQL, React + Apollo Client, Zod structured output, `@dculus/ui` components, react-i18next.

---

## File Map

| Status | File | Responsibility |
|---|---|---|
| NEW | `apps/backend/prisma/schema.prisma` | `AIFieldInsight` model |
| NEW | `apps/backend/src/services/aiFieldInsightService.ts` | `computeSchemaHash`, `getFieldInsights`, `generateFieldInsights` |
| MOD | `apps/backend/src/graphql/schema.ts` | `FieldInsight` + `FieldInsightsResult` types, query + mutation declarations |
| MOD | `apps/backend/src/graphql/resolvers/ai.ts` | `fieldInsights` query resolver + `generateFieldInsights` mutation resolver |
| MOD | `apps/backend/src/graphql/resolvers.ts` | Already imports `aiResolvers` — no change needed (resolvers spread automatically) |
| MOD | `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | Add `initialMessage?: string` prop |
| NEW | `apps/form-app/src/components/Analytics/FieldAnalytics/AIInsightCard.tsx` | Coloured tip card + "Fix with AI" button |
| MOD | `apps/form-app/src/components/Analytics/FieldAnalytics/FieldSelectionGrid.tsx` | Accept + render `AIInsightCard` per field |
| MOD | `apps/form-app/src/components/Analytics/FieldAnalytics/FieldAnalyticsViewer.tsx` | "Analyze" button, insights state, stale banner, open drawer with `initialMessage` |
| MOD | `apps/form-app/src/graphql/queries.ts` | `GET_FIELD_INSIGHTS` query |
| MOD | `apps/form-app/src/graphql/mutations.ts` | `GENERATE_FIELD_INSIGHTS` mutation |
| MOD | `apps/form-app/src/locales/en/fieldAnalyticsViewer.json` | `aiInsights.*` keys |
| MOD | `apps/form-app/src/locales/ta/fieldAnalyticsViewer.json` | `aiInsights.*` keys (Tamil) |

---

## Task 1: Prisma model

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Open `apps/backend/prisma/schema.prisma`. Find the `AIChatMessage` model (near the bottom of the AI section) and add this block directly after it:

```prisma
model AIFieldInsight {
  id           String   @id @default(cuid())
  formId       String
  fieldId      String
  tip          String   @db.Text
  fixPrompt    String   @db.Text
  severity     String
  schemaHash   String
  generatedAt  DateTime @default(now())

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@unique([formId, fieldId])
  @@index([formId])
  @@map("ai_field_insight")
}
```

Also add the back-relation to the `Form` model. Find `model Form` and add this line in its relations block (alongside `aiChatConversations`, etc.):

```prisma
  aiFieldInsights   AIFieldInsight[]
```

- [ ] **Step 2: Push schema and regenerate client**

```bash
cd apps/backend
pnpm db:push
pnpm db:generate
```

Expected: `Your database is now in sync with your Prisma schema.` and `Generated Prisma Client`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/prisma/schema.prisma
git commit -m "feat: add AIFieldInsight prisma model"
```

---

## Task 2: Backend service — `aiFieldInsightService.ts`

**Files:**
- Create: `apps/backend/src/services/aiFieldInsightService.ts`

- [ ] **Step 1: Create the file**

```typescript
import { createHash } from 'crypto';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getPrimaryModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FieldInsight {
  fieldId: string;
  tip: string;
  fixPrompt: string;
  severity: 'warning' | 'error' | 'success' | 'info';
  generatedAt: string;
}

export interface FieldInsightsResult {
  insights: FieldInsight[];
  schemaStale: boolean;
  generatedAt: string | null;
  tokensUsed?: number;
}

// ── Schema hash ───────────────────────────────────────────────────────────

export function computeSchemaHash(schema: { pages: any[] }): string {
  const fingerprint = (schema.pages ?? [])
    .flatMap((p: any) => p.fields ?? [])
    .map((f: any) => `${f.id}:${f.type}:${f.label}`)
    .join('|');
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
}

// ── Read ─────────────────────────────────────────────────────────────────

export async function getFieldInsights(
  formId: string,
  currentSchemaHash: string
): Promise<FieldInsightsResult> {
  const rows = await prisma.aIFieldInsight.findMany({
    where: { formId },
    orderBy: { generatedAt: 'asc' },
  });

  if (rows.length === 0) {
    return { insights: [], schemaStale: false, generatedAt: null };
  }

  const schemaStale = rows.some((r) => r.schemaHash !== currentSchemaHash);
  const earliest = rows[0].generatedAt.toISOString();

  return {
    insights: rows.map((r) => ({
      fieldId: r.fieldId,
      tip: r.tip,
      fixPrompt: r.fixPrompt,
      severity: r.severity as FieldInsight['severity'],
      generatedAt: r.generatedAt.toISOString(),
    })),
    schemaStale,
    generatedAt: earliest,
  };
}

// ── Generate ──────────────────────────────────────────────────────────────

const InsightRowSchema = z.object({
  fieldId: z.string(),
  tip: z.string().max(200),
  fixPrompt: z.string().max(250),
  severity: z.enum(['warning', 'error', 'success', 'info']),
});

const InsightsOutputSchema = z.object({
  insights: z.array(InsightRowSchema),
});

export async function generateFieldInsights(
  formId: string,
  formTitle: string,
  schema: { pages: any[] },
  totalResponses: number
): Promise<FieldInsightsResult & { tokensUsed: number }> {
  const allFields = (schema.pages ?? []).flatMap((p: any) => p.fields ?? []);

  if (allFields.length === 0) {
    return { insights: [], schemaStale: false, generatedAt: null, tokensUsed: 0 };
  }

  // Load responses to compute per-field stats
  const responses = await prisma.response.findMany({
    where: { formId, deletedAt: null },
    select: { data: true },
  });

  const total = responses.length;

  // Build compact stats per field
  const fieldRows = allFields.map((field: any) => {
    const values = responses
      .map((r) => (r.data as Record<string, any>)[field.id])
      .filter((v) => v !== null && v !== undefined && v !== '');

    const fillRate = total > 0 ? Math.round((values.length / total) * 100) : 0;

    // Average word count for text-like fields
    let avgLen = '-';
    if (['text_input_field', 'text_area_field', 'email_field', 'TEXT_INPUT_FIELD', 'TEXT_AREA_FIELD', 'EMAIL_FIELD'].includes(field.type)) {
      if (values.length > 0) {
        const avg = values.reduce((sum: number, v: any) => sum + String(v).split(/\s+/).filter(Boolean).length, 0) / values.length;
        avgLen = `${avg.toFixed(1)} words`;
      }
    }

    // Top options for choice fields
    let topOptions = '-';
    if (['select_field', 'radio_field', 'checkbox_field', 'SELECT_FIELD', 'RADIO_FIELD', 'CHECKBOX_FIELD'].includes(field.type)) {
      const counts: Record<string, number> = {};
      values.forEach((v: any) => {
        const opts = Array.isArray(v) ? v : [v];
        opts.forEach((o: string) => { counts[o] = (counts[o] ?? 0) + 1; });
      });
      topOptions = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([opt, cnt]) => `${opt}:${Math.round((cnt / (values.length || 1)) * 100)}%`)
        .join(', ') || '-';
    }

    const shortType = field.type
      .toLowerCase()
      .replace('_field', '')
      .replace('_input', '')
      .replace('_area', 'area')
      .replace('_upload', 'upload');

    return `${field.id} | ${shortType} | "${field.label}" | ${fillRate}% fill | ${avgLen} | ${topOptions}`;
  });

  const prompt = [
    `Form: "${formTitle}" — ${total} total responses`,
    '',
    'fieldId | type | label | fillRate | avgLen | topOptions',
    ...fieldRows,
    '',
    'For EACH field: write a 1-2 sentence actionable insight (tip, max 180 chars) and a direct instruction message (fixPrompt, max 220 chars) the form editor AI can act on.',
    'severity: "error" if fillRate <30%, "warning" if fillRate 30-60% or "Other" option >25%, "success" if field is healthy with an improvement opportunity, "info" otherwise.',
  ].join('\n');

  const { output, usage } = await generateText({
    model: getPrimaryModel(),
    output: Output.object({ schema: InsightsOutputSchema }),
    system:
      'You are a form analytics expert. Analyse the field stats and generate concise, actionable insights to improve form completion and data quality. Return ONLY valid JSON matching the schema.',
    prompt,
  });

  const tokensUsed = usage?.totalTokens ?? 0;
  const schemaHash = computeSchemaHash(schema);
  const now = new Date();

  // Upsert all rows
  await Promise.all(
    output.insights.map((ins) =>
      prisma.aIFieldInsight.upsert({
        where: { formId_fieldId: { formId, fieldId: ins.fieldId } },
        update: {
          tip: ins.tip,
          fixPrompt: ins.fixPrompt,
          severity: ins.severity,
          schemaHash,
          generatedAt: now,
        },
        create: {
          formId,
          fieldId: ins.fieldId,
          tip: ins.tip,
          fixPrompt: ins.fixPrompt,
          severity: ins.severity,
          schemaHash,
          generatedAt: now,
        },
      })
    )
  );

  logger.info({ formId, fieldCount: allFields.length, tokensUsed }, 'AI field insights generated');

  return {
    insights: output.insights.map((ins) => ({
      ...ins,
      generatedAt: now.toISOString(),
    })),
    schemaStale: false,
    generatedAt: now.toISOString(),
    tokensUsed,
  };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/backend
pnpm type-check 2>&1 | grep -i "aiFieldInsight\|aifield" | head -20
```

Expected: no errors mentioning `aiFieldInsightService`.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/src/services/aiFieldInsightService.ts
git commit -m "feat: add aiFieldInsightService with computeSchemaHash, getFieldInsights, generateFieldInsights"
```

---

## Task 3: GraphQL schema additions

**Files:**
- Modify: `apps/backend/src/graphql/schema.ts`

- [ ] **Step 1: Add new GraphQL types**

Open `apps/backend/src/graphql/schema.ts`. Find the `# AI Types` section (search for `AITokenUsage`). Add these types right after the existing AI types:

```graphql
  type FieldInsight {
    fieldId: ID!
    tip: String!
    fixPrompt: String!
    severity: String!
    generatedAt: String!
  }

  type FieldInsightsResult {
    insights: [FieldInsight!]!
    schemaStale: Boolean!
    generatedAt: String
  }
```

- [ ] **Step 2: Add query and mutation declarations**

In the same file, find the `type Query {` block. Add after `aiTokenUsage`:

```graphql
    fieldInsights(formId: ID!, organizationId: ID!): FieldInsightsResult!
```

Find the `type Mutation {` block. Add after `generateFormWithAI`:

```graphql
    generateFieldInsights(formId: ID!, organizationId: ID!): FieldInsightsResult!
```

- [ ] **Step 3: Verify type-check**

```bash
cd apps/backend
pnpm type-check 2>&1 | grep -i "schema\|fieldInsight" | head -10
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/graphql/schema.ts
git commit -m "feat: add FieldInsight types and fieldInsights query/mutation to GraphQL schema"
```

---

## Task 4: GraphQL resolvers

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/ai.ts`

- [ ] **Step 1: Add imports at the top of `ai.ts`**

Open `apps/backend/src/graphql/resolvers/ai.ts`. Add these imports alongside the existing ones:

```typescript
import { getFieldInsights, generateFieldInsights, computeSchemaHash } from '../../services/aiFieldInsightService.js';
import { getFormSchema } from '../../routes/aiChat.js';
import { prisma } from '../../lib/prisma.js';
```

- [ ] **Step 2: Add `fieldInsights` query resolver**

Inside `aiResolvers.Query`, add after `aiTokenUsage`:

```typescript
    fieldInsights: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      const schema = await getFormSchema(formId);
      const currentHash = computeSchemaHash(schema);
      return getFieldInsights(formId, currentHash);
    },
```

- [ ] **Step 3: Add `generateFieldInsights` mutation resolver**

Inside `aiResolvers.Mutation`, add after `generateFormWithAI`:

```typescript
    generateFieldInsights: async (
      _: any,
      { formId, organizationId }: { formId: string; organizationId: string },
      context: { auth: BetterAuthContext }
    ) => {
      requireAuth(context.auth);
      await requireOrganizationMembership(context.auth, organizationId);

      const budget = await checkAITokenBudget(organizationId);
      if (!budget.allowed) {
        throw createGraphQLError(
          `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} tokens used this month). Upgrade your plan to continue.`,
          GRAPHQL_ERROR_CODES.AI_TOKEN_LIMIT_EXCEEDED
        );
      }

      const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { title: true },
      });
      if (!form) {
        throw createGraphQLError('Form not found', GRAPHQL_ERROR_CODES.NOT_FOUND);
      }

      const schema = await getFormSchema(formId);
      const totalResponses = await prisma.response.count({
        where: { formId, deletedAt: null },
      });

      try {
        const result = await generateFieldInsights(formId, form.title, schema, totalResponses);
        await recordAITokenUsage(organizationId, result.tokensUsed);
        return result;
      } catch (error) {
        logger.error({ err: error, formId, organizationId }, 'AI field insights generation failed');
        throw createGraphQLError(
          'AI field insights generation failed. Please try again.',
          GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR
        );
      }
    },
```

- [ ] **Step 4: Type-check**

```bash
cd apps/backend
pnpm type-check 2>&1 | grep -i "ai\.ts\|aiField" | head -10
```

Expected: no errors in `resolvers/ai.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql/resolvers/ai.ts
git commit -m "feat: add fieldInsights query and generateFieldInsights mutation resolvers"
```

---

## Task 5: Add `initialMessage` prop to `AIEditDrawer`

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Extend the props interface**

Find `interface AIEditDrawerProps` (line 26) and add `initialMessage`:

```typescript
interface AIEditDrawerProps {
  formId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
}
```

- [ ] **Step 2: Destructure the new prop**

Find the component definition (`const AIEditDrawer: React.FC<AIEditDrawerProps> = ({`) and add `initialMessage` to the destructured props:

```typescript
const AIEditDrawer: React.FC<AIEditDrawerProps> = ({
  formId,
  organizationId,
  isOpen,
  onClose,
  initialMessage,
}) => {
```

- [ ] **Step 3: Add auto-send effect**

Add a `useRef` guard and a new `useEffect` after the existing effects (after the `handleKeyDown` callback, before `if (!isOpen) return null`):

```typescript
  const initialMessageSentRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      initialMessageSentRef.current = false;
      return;
    }
    if (!initialMessage || initialMessageSentRef.current) return;
    if (!activeConversationId || isStreaming) return;
    initialMessageSentRef.current = true;
    sendMessage(initialMessage);
  }, [isOpen, initialMessage, activeConversationId, isStreaming, sendMessage]);
```

- [ ] **Step 4: Type-check**

```bash
cd apps/form-app
pnpm type-check 2>&1 | grep "AIEditDrawer" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat: add initialMessage prop to AIEditDrawer for pre-filling from field insights"
```

---

## Task 6: Frontend GraphQL operations

**Files:**
- Modify: `apps/form-app/src/graphql/queries.ts`
- Modify: `apps/form-app/src/graphql/mutations.ts`

- [ ] **Step 1: Add `GET_FIELD_INSIGHTS` query**

Open `apps/form-app/src/graphql/queries.ts`. Add at the end of the file:

```typescript
export const GET_FIELD_INSIGHTS = gql`
  query GetFieldInsights($formId: ID!, $organizationId: ID!) {
    fieldInsights(formId: $formId, organizationId: $organizationId) {
      insights {
        fieldId
        tip
        fixPrompt
        severity
        generatedAt
      }
      schemaStale
      generatedAt
    }
  }
`;
```

- [ ] **Step 2: Add `GENERATE_FIELD_INSIGHTS` mutation**

Open `apps/form-app/src/graphql/mutations.ts`. Add at the end of the file:

```typescript
export const GENERATE_FIELD_INSIGHTS = gql`
  mutation GenerateFieldInsights($formId: ID!, $organizationId: ID!) {
    generateFieldInsights(formId: $formId, organizationId: $organizationId) {
      insights {
        fieldId
        tip
        fixPrompt
        severity
        generatedAt
      }
      schemaStale
      generatedAt
    }
  }
`;
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/graphql/queries.ts apps/form-app/src/graphql/mutations.ts
git commit -m "feat: add GET_FIELD_INSIGHTS and GENERATE_FIELD_INSIGHTS GraphQL operations"
```

---

## Task 7: i18n keys

**Files:**
- Modify: `apps/form-app/src/locales/en/fieldAnalyticsViewer.json`
- Modify: `apps/form-app/src/locales/ta/fieldAnalyticsViewer.json`

- [ ] **Step 1: Add English keys**

Open `apps/form-app/src/locales/en/fieldAnalyticsViewer.json`. Add an `"aiInsights"` block inside the root object (alongside existing keys):

```json
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
```

- [ ] **Step 2: Add Tamil keys**

Open `apps/form-app/src/locales/ta/fieldAnalyticsViewer.json`. Add the same block with Tamil translations:

```json
  "aiInsights": {
    "analyzeButton": "அனைத்து புலங்களையும் பகுப்பாய்வு செய்",
    "reanalyzeLink": "மீண்டும் பகுப்பாய்வு",
    "insightLabel": "AI நுண்ணறிவு",
    "fixButton": "AI மூலம் சரிசெய்",
    "staleBanner": "கடைசி பகுப்பாய்வுக்குப் பிறகு படிவம் மாறியது",
    "reanalyzeButton": "மீண்டும் பகுப்பாய்வு",
    "loading": "புலங்களை பகுப்பாய்வு செய்கிறது...",
    "generatedAgo": "{{time}} முன்பு பகுப்பாய்வு செய்யப்பட்டது"
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/locales/en/fieldAnalyticsViewer.json apps/form-app/src/locales/ta/fieldAnalyticsViewer.json
git commit -m "feat: add aiInsights i18n keys to fieldAnalyticsViewer locale (en + ta)"
```

---

## Task 8: `AIInsightCard` component

**Files:**
- Create: `apps/form-app/src/components/Analytics/FieldAnalytics/AIInsightCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@dculus/ui';
import { cn } from '@dculus/utils';

type Severity = 'warning' | 'error' | 'success' | 'info';

interface AIInsightCardProps {
  tip: string;
  fixPrompt: string;
  severity: Severity;
  insightLabel: string;
  fixButtonLabel: string;
  onFixWithAI: (prompt: string) => void;
}

const SEVERITY_STYLES: Record<Severity, { card: string; label: string; button: string }> = {
  warning: {
    card: 'bg-yellow-50 border-yellow-300',
    label: 'text-yellow-800',
    button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  error: {
    card: 'bg-red-50 border-red-200',
    label: 'text-red-800',
    button: 'bg-red-500 hover:bg-red-600 text-white',
  },
  success: {
    card: 'bg-green-50 border-green-200',
    label: 'text-green-800',
    button: 'bg-green-500 hover:bg-green-600 text-white',
  },
  info: {
    card: 'bg-blue-50 border-blue-200',
    label: 'text-blue-800',
    button: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
};

export const AIInsightCard: React.FC<AIInsightCardProps> = ({
  tip,
  fixPrompt,
  severity,
  insightLabel,
  fixButtonLabel,
  onFixWithAI,
}) => {
  const styles = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.info;

  return (
    <div className={cn('border rounded-lg px-3 py-2.5 mt-3', styles.card)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-1 text-xs font-bold uppercase tracking-wide mb-1', styles.label)}>
            <Sparkles className="h-3 w-3" />
            {insightLabel}
          </div>
          <p className={cn('text-xs leading-relaxed', styles.label)}>{tip}</p>
        </div>
        <Button
          size="sm"
          className={cn('shrink-0 text-xs h-7 px-2.5 border-0', styles.button)}
          onClick={(e) => {
            e.stopPropagation();
            onFixWithAI(fixPrompt);
          }}
        >
          {fixButtonLabel} ✦
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Type-check**

```bash
cd apps/form-app
pnpm type-check 2>&1 | grep "AIInsightCard" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/components/Analytics/FieldAnalytics/AIInsightCard.tsx
git commit -m "feat: add AIInsightCard component with severity-based colour coding"
```

---

## Task 9: Wire insights into `FieldSelectionGrid`

**Files:**
- Modify: `apps/form-app/src/components/Analytics/FieldAnalytics/FieldSelectionGrid.tsx`

- [ ] **Step 1: Add imports and extend props**

At the top of `FieldSelectionGrid.tsx`, add the import:

```typescript
import { AIInsightCard } from './AIInsightCard';
```

Extend `FieldSelectionGridProps` to accept insights:

```typescript
interface FieldInsight {
  fieldId: string;
  tip: string;
  fixPrompt: string;
  severity: string;
}

interface FieldSelectionGridProps {
  fields: FieldAnalyticsData[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  totalFormResponses: number;
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
  insights?: Record<string, FieldInsight>;
  onFixWithAI?: (prompt: string) => void;
}
```

- [ ] **Step 2: Destructure new props**

Find the component signature and add the new props:

```typescript
export const FieldSelectionGrid: React.FC<FieldSelectionGridProps> = ({
  fields,
  selectedFieldId,
  onFieldSelect,
  totalFormResponses: _totalFormResponses,
  t,
  insights = {},
  onFixWithAI,
}) => {
```

- [ ] **Step 3: Render `AIInsightCard` inside each field card**

Find the closing of `<CardContent>` for each field card (it wraps the field header, mini chart, and stats). Inside that `CardContent`, just before its closing `</CardContent>`, add:

```tsx
              {insights[field.fieldId] && onFixWithAI && (
                <div className="px-5 pb-4">
                  <AIInsightCard
                    tip={insights[field.fieldId].tip}
                    fixPrompt={insights[field.fieldId].fixPrompt}
                    severity={insights[field.fieldId].severity as any}
                    insightLabel={t('aiInsights.insightLabel')}
                    fixButtonLabel={t('aiInsights.fixButton')}
                    onFixWithAI={onFixWithAI}
                  />
                </div>
              )}
```

- [ ] **Step 4: Type-check**

```bash
cd apps/form-app
pnpm type-check 2>&1 | grep "FieldSelectionGrid" | head -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/components/Analytics/FieldAnalytics/FieldSelectionGrid.tsx
git commit -m "feat: inject AIInsightCard into FieldSelectionGrid field cards"
```

---

## Task 10: Wire `FieldAnalyticsViewer` — button, state, stale banner, drawer

**Files:**
- Modify: `apps/form-app/src/components/Analytics/FieldAnalytics/FieldAnalyticsViewer.tsx`

- [ ] **Step 1: Add imports**

At the top of `FieldAnalyticsViewer.tsx`, add:

```typescript
import { useQuery, useMutation } from '@apollo/client';
import { Sparkles } from 'lucide-react';
import AIEditDrawer from '../../form-builder/AIEditDrawer';
import { GET_FIELD_INSIGHTS } from '../../../graphql/queries';
import { GENERATE_FIELD_INSIGHTS } from '../../../graphql/mutations';
```

The file already imports `useQuery`/`useMutation` and `Button` from `@dculus/ui` — add only what's missing.

- [ ] **Step 2: Add `organizationId` prop**

Extend `FieldAnalyticsViewerProps`:

```typescript
interface FieldAnalyticsViewerProps {
  formId: string;
  organizationId: string;
  initialSelectedFieldId?: string | null;
}
```

Update the component signature to destructure it:

```typescript
export const FieldAnalyticsViewer: React.FC<FieldAnalyticsViewerProps> = ({
  formId,
  organizationId,
  initialSelectedFieldId,
}) => {
```

> **Note:** Verify all call sites of `FieldAnalyticsViewer` pass `organizationId`. Search for `<FieldAnalyticsViewer` in the codebase and add the prop where missing.

- [ ] **Step 3: Add insights state and GraphQL hooks**

Inside the component, after the existing hooks, add:

```typescript
  const [aiDrawerOpen, setAIDrawerOpen] = React.useState(false);
  const [aiInitialMessage, setAIInitialMessage] = React.useState<string | undefined>();

  const { data: insightsData, refetch: refetchInsights } = useQuery(GET_FIELD_INSIGHTS, {
    variables: { formId, organizationId },
    skip: !formId || !organizationId,
  });

  const [generateInsights, { loading: generatingInsights }] = useMutation(GENERATE_FIELD_INSIGHTS, {
    variables: { formId, organizationId },
    onCompleted: () => refetchInsights(),
  });

  const insightsMap: Record<string, { fieldId: string; tip: string; fixPrompt: string; severity: string }> =
    React.useMemo(() => {
      const list = insightsData?.fieldInsights?.insights ?? [];
      return Object.fromEntries(list.map((ins: any) => [ins.fieldId, ins]));
    }, [insightsData]);

  const schemaStale = insightsData?.fieldInsights?.schemaStale ?? false;
  const hasInsights = (insightsData?.fieldInsights?.insights?.length ?? 0) > 0;
  const generatedAt = insightsData?.fieldInsights?.generatedAt ?? null;

  const handleFixWithAI = React.useCallback((prompt: string) => {
    setAIInitialMessage(prompt);
    setAIDrawerOpen(true);
  }, []);
```

- [ ] **Step 4: Add the "Analyze" button and stale banner to the section header**

Find where the component renders the section header (the area with the refresh button or `Field Analytics` title). Add the Analyze button and stale banner. Look for `<RefreshCw` or `{t('title')}` in the JSX and add alongside:

```tsx
          {/* AI Analyze button */}
          {!hasInsights && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateInsights()}
              disabled={generatingInsights}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generatingInsights
                ? t('aiInsights.loading')
                : t('aiInsights.analyzeButton')}
            </Button>
          )}
          {hasInsights && (
            <button
              onClick={() => generateInsights()}
              disabled={generatingInsights}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
            >
              {generatingInsights ? t('aiInsights.loading') : t('aiInsights.reanalyzeLink')}
            </button>
          )}
```

Add the stale banner just below the header row, before the field grid:

```tsx
          {schemaStale && (
            <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              <span>{t('aiInsights.staleBanner')}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                onClick={() => generateInsights()}
                disabled={generatingInsights}
              >
                {t('aiInsights.reanalyzeButton')}
              </Button>
            </div>
          )}
```

- [ ] **Step 5: Pass insights to `FieldSelectionGrid`**

Find the `<FieldSelectionGrid` render and add the new props:

```tsx
          <FieldSelectionGrid
            fields={allFields}
            selectedFieldId={selectedFieldId}
            onFieldSelect={handleFieldSelect}
            totalFormResponses={totalResponses}
            t={t}
            insights={insightsMap}
            onFixWithAI={handleFixWithAI}
          />
```

- [ ] **Step 6: Add `AIEditDrawer` at the bottom of the component's return**

Just before the final closing `</div>` of the component's return, add:

```tsx
        <AIEditDrawer
          formId={formId}
          organizationId={organizationId}
          isOpen={aiDrawerOpen}
          onClose={() => {
            setAIDrawerOpen(false);
            setAIInitialMessage(undefined);
          }}
          initialMessage={aiInitialMessage}
        />
```

- [ ] **Step 7: Find and update all call sites**

```bash
grep -rn "FieldAnalyticsViewer" /Users/natheeshkumarrangasamy/Desktop/DculusApps/dculus-forms/apps/form-app/src --include="*.tsx" | grep -v "FieldAnalyticsViewer.tsx"
```

For each call site found, add the `organizationId` prop. You'll need to trace where `organizationId` is available (typically from `useAuth` context or passed from the parent analytics page).

- [ ] **Step 8: Type-check the whole form-app**

```bash
cd apps/form-app
pnpm type-check 2>&1 | head -30
```

Expected: no errors (fix any prop mismatches found).

- [ ] **Step 9: Commit**

```bash
git add apps/form-app/src/components/Analytics/FieldAnalytics/FieldAnalyticsViewer.tsx
git commit -m "feat: wire AI field insights into FieldAnalyticsViewer — analyze button, stale banner, drawer integration"
```

---

## Task 11: End-to-end smoke test

- [ ] **Step 1: Start backend and form-app**

```bash
# Terminal 1
pnpm backend:dev

# Terminal 2
pnpm form-app:dev
```

- [ ] **Step 2: Verify the full flow**

1. Open a form with responses → navigate to **Analytics → Field Analytics**
2. Confirm "Analyze all fields" button is visible in the section header
3. Click it — confirm loading state appears, then tips render on each field card
4. Confirm tip cards are colour-coded (yellow/red/green/blue by severity)
5. Click **"Fix with AI ✦"** on any card — confirm `AIEditDrawer` opens with the suggestion pre-filled and auto-sent
6. Edit a field label in the form builder → return to Field Analytics → confirm yellow stale banner appears
7. Click Re-analyze → confirm banner disappears and tips refresh

- [ ] **Step 3: Verify zero-response edge case**

Test with a form that has no responses. Confirm "Analyze all fields" still works and the AI returns tips based on field structure (fillRate = 0%).

- [ ] **Step 4: Final commit**

```bash
git add -p  # stage any leftover changes
git commit -m "feat: AI field insights — inline tips with Fix-with-AI integration (complete)"
```

---

## Self-Review Checklist

- [x] `AIFieldInsight` model covers all fields used in service: `tip`, `fixPrompt`, `severity`, `schemaHash`, `generatedAt` ✓
- [x] `computeSchemaHash` used in both query resolver (staleness check) and generate service (upsert) with same logic ✓
- [x] `tokensUsed` returned from `generateFieldInsights` and passed to `recordAITokenUsage` in resolver ✓
- [x] `initialMessage` effect guards against double-send with `useRef` ✓
- [x] `e.stopPropagation()` on "Fix with AI" button prevents card click from navigating to field detail ✓
- [x] `@@unique([formId, fieldId])` enables clean upsert — old tips replaced on re-analyze ✓
- [x] `onDelete: Cascade` on `AIFieldInsight` means tips are deleted when form is deleted ✓
- [x] Both `en` and `ta` locale files updated ✓
- [x] `resolvers.ts` already spreads `aiResolvers.Query` and `aiResolvers.Mutation` — no change needed there ✓
