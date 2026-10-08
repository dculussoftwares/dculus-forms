import { Router, type Router as ExpressRouter } from 'express';
import {
  convertToModelMessages,
  createIdGenerator,
  pipeUIMessageStreamToResponse,
  pruneMessages,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type LanguageModelUsage,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet,
  type UIMessage,
} from 'ai';
import * as Y from 'yjs';
import { isLayoutField } from '@dculus/types';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
import { checkFormAccess, PermissionLevel } from '../graphql/resolvers/formSharing.js';
import {
  findOwnedConversation,
  loadConversationMessages,
  saveConversationMessages,
  autoGenerateTitle,
  truncateToolResults,
  pruneToolCallsFromHistory,
  summarizeHistoryIfNeeded,
} from '../services/aiChatService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../services/aiUsageService.js';
import { createFormEditAgent } from '../lib/formEditAgent.js';
import { getModelForIntent, getModelIdForIntent } from '../lib/ai.js';
import { classifyIntent, intentToModelTier, intentToToolTier } from '../lib/intentClassifier.js';
import { extractUsageStats, recordTurnTelemetry } from '../services/aiTelemetry.js';
import { getCachedSchema, setCachedSchema, invalidateCachedSchema } from '../lib/formSchemaCache.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const aiChatRouter: ExpressRouter = Router();

async function getFormSchemaFromYjs(formId: string): Promise<{ pages: any[] } | null> {
  const docName = formId.replace(/[^a-zA-Z0-9_-]/g, '');
  const collabDoc = await prisma.collaborativeDocument.findFirst({
    where: { documentName: docName },
    select: { state: true },
  });

  if (collabDoc?.state) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, collabDoc.state as Uint8Array);
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>> | undefined;
      if (!pagesArray) return { pages: [] };
      const pages = pagesArray.toArray().map((pageMap) => {
        const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>> | undefined;
        const fields = fieldsArray ? fieldsArray.toArray().filter((fieldMap) => !isLayoutField({ type: fieldMap.get('type') })).map((fieldMap) => {
          const optionsRaw = fieldMap.get('options');
          const options = optionsRaw instanceof Y.Array ? optionsRaw.toArray() : (optionsRaw ?? null);
          return {
            id: fieldMap.get('id'),
            type: fieldMap.get('type'),
            label: fieldMap.get('label'),
            required: fieldMap.get('validation')?.get?.('required') ?? fieldMap.get('required') ?? false,
            placeholder: fieldMap.get('placeholder') ?? null,
            hint: fieldMap.get('hint') ?? null,
            options,
          };
        }) : [];
        return { id: pageMap.get('id'), title: pageMap.get('title'), fields };
      });
      return { pages };
    } catch {
      // fall through to Prisma fallback
    }
  }

  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { formSchema: true },
  });
  return form ? withoutLayoutFields(form.formSchema as any) : null;
}

// The stored JSON snapshot can hold layout fields; the AI context must never list them as targets.
function withoutLayoutFields(schema: { pages?: any[] } | null): { pages: any[] } | null {
  if (!schema || !Array.isArray(schema.pages)) return schema as { pages: any[] } | null;
  return {
    ...schema,
    pages: schema.pages.map((page: any) =>
      Array.isArray(page?.fields)
        ? { ...page, fields: page.fields.filter((field: unknown) => !isLayoutField(field)) }
        : page
    ),
  };
}

// ── Schema cache ──────────────────────────────────────────────────────────────
// Phase 2.2: cache logic extracted to lib/formSchemaCache.ts.
// schemaCache, SCHEMA_CACHE_TTL_MS removed — use getCachedSchema / setCachedSchema.

export async function getFormSchema(formId: string): Promise<{ pages: any[] }> {
  const cached = getCachedSchema(formId);
  if (cached) return cached;
  const schema = (await getFormSchemaFromYjs(formId)) ?? { pages: [] };
  setCachedSchema(formId, schema);
  return schema;
}

// Forms with more fields than this skip the inline snapshot and rely on read tools instead,
// keeping the (uncached) ephemeral tail small.
export const SNAPSHOT_FIELD_THRESHOLD = 40;

const TYPE_MAP: Record<string, string> = {
  text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
  text_area_field: 'ta',     TEXT_AREA_FIELD: 'ta',
  email_field: 'email',      EMAIL_FIELD: 'email',
  number_field: 'num',       NUMBER_FIELD: 'num',
  date_field: 'date',        DATE_FIELD: 'date',
  select_field: 'select',    SELECT_FIELD: 'select',
  radio_field: 'radio',      RADIO_FIELD: 'radio',
  checkbox_field: 'check',   CHECKBOX_FIELD: 'check',
  file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
};

export function countFields(schema: { pages: any[] }): number {
  // The Prisma fallback can still hold layout fields, so filter here too
  return (schema.pages ?? []).reduce(
    (n, p) => n + (p.fields?.filter((f: unknown) => !isLayoutField(f)).length ?? 0),
    0
  );
}

/**
 * STATIC system prompt. Contains NO per-turn data (no current page, no form structure) so it is
 * byte-identical on every request — this is what lets Azure/OpenAI prefix caching hit. All
 * dynamic context is delivered separately via buildEphemeralContext (the trailing tail).
 *
 * COMPRESSED: Behavioral rules that are tool-specific are embedded in each tool's description
 * (aiFormEditTools.ts) — the model always sees them in context but only for the tools included
 * in the current turn. This reduces the static prompt from ~525 tokens to ~210 tokens.
 */
export const STATIC_SYSTEM_PROMPT = `You are an AI form editor. A <current_context> block at the end of each message shows the form's pages, fields, and current page. Read it before acting — it is authoritative.

Rules:
1. Identify fields by label+id from <current_context>. Large forms omit the snapshot — call listFields then getField.
2. "page N" = Nth page by position. If N = total+1, auto-create (addPage then act). If N > total+1, ask which page.
3. "add/create/insert a field" = always addField (never updateFields). updateFields = only explicit edits ("rename", "change", "make required").
4. Batch: prefer one updateFields/removeFields call with multiple IDs over many single calls.
5. After addPage, use its returned pageId for subsequent addField calls. Never invent IDs.
6. Cross-page edits: call navigateToPage first, then make changes.
7. Proposals (removeFields, removePage, proposeFieldTypeChange, proposeValidation, upsertConditionRule) do NOT apply immediately — tell the user to confirm in the card. Never say "deleted/converted"; say "will be once confirmed".
8. Merge pages: relocateField (move) ALL fields first, THEN removePage on empty source pages.
9. Remix/transform: read structure, removeFields unneeded, addField new ones, updateFields to relabel keepers, updateLayout for title+CTA. Add before removing.
10. Make only requested changes. Confirm what you did in final text.
11. Quiz questions: when the user asks to add graded/quiz questions, use addField with a "radio" field (one correct answer) or "checkbox" field (2+ correct answers) and pass correctAnswers = the exact option label(s). The answer key is set and options reshuffled automatically — never hand-order the correct option first.
12. Reply format: 1-3 short sentences of plain Markdown for a narrow chat panel. **Bold** field labels; use a bullet list only for 3+ items. No headings, tables, code blocks, or field/page IDs.`;

/**
 * The per-turn dynamic context, delivered as a trailing user message placed AFTER conversation
 * history so the cacheable prefix (system + tools + history) stays byte-stable. This message is
 * EPHEMERAL — it must never be persisted to conversation history (see the onEnd persistence logic).
 *
 * Small forms get a full compact snapshot (so the model can act without read round-trips); large
 * forms get only a page-level summary and rely on listFields/getField.
 */
export function buildEphemeralContext(
  currentPageId: string | undefined,
  schema: { pages: any[] }
): string {
  const pages = schema.pages ?? [];
  const totalPages = pages.length;
  const fieldCount = countFields(schema);

  const pageLine = currentPageId
    ? `Current page id: ${currentPageId} (this is "this page" / "the current page").`
    : 'The user is on the first page.';

  const totalsLine = `Form has ${totalPages} page${totalPages !== 1 ? 's' : ''} and ${fieldCount} field${fieldCount !== 1 ? 's' : ''}.`;

  let structure: string;
  if (totalPages === 0) {
    structure = 'The form is empty (no pages).';
  } else if (fieldCount <= SNAPSHOT_FIELD_THRESHOLD) {
    // Full compact snapshot: page header + each field as id|type|"label"|req/opt
    structure = pages
      .map((p: any, i: number) => {
        const fields = (p.fields ?? [])
          .map((f: any) => `${f.id}|${TYPE_MAP[f.type] ?? f.type}|"${f.label}"|${(f.required ?? false) ? 'req' : 'opt'}`)
          .join(', ');
        return `p${i + 1} "${p.title ?? `Page ${i + 1}`}" [id:${p.id}]: ${fields || '(empty)'}`;
      })
      .join('\n');
  } else {
    // Large form: page summary only; the model uses listFields/getField for detail.
    structure =
      pages
        .map((p: any, i: number) => `p${i + 1}:"${p.title ?? `Page ${i + 1}`}"(${(p.fields ?? []).length}f,id:${p.id})`)
        .join(' | ') + '\n(Large form — call listFields/getField for field details.)';
  }

  return `<current_context>\n${pageLine}\n${totalsLine}\n${structure}\n</current_context>`;
}

/**
 * Variant of the system prompt for question turns, which run without tools. Without this note
 * the model reads the tool-centric rules above and may claim it changed the form when it cannot.
 */
export const QUESTION_SYSTEM_PROMPT = `${STATIC_SYSTEM_PROMPT}

This turn has NO editing tools. Answer the question from <current_context>. Never claim you changed the form; if the user wants a change, tell them in one sentence what to ask for (e.g. "Ask me to add a phone field").`;

// Server-side ids keep persisted messages stable across reloads (AI SDK message-persistence guide).
const generateMessageId = createIdGenerator({ prefix: 'msg', size: 16 });

// The slice of a streamText / agent.stream result the route needs.
interface ChatTurnStream<TOOLS extends ToolSet> {
  stream: ReadableStream<TextStreamPart<TOOLS>>;
  /** Usage totalled across every step of the turn. */
  usage: PromiseLike<LanguageModelUsage>;
  consumeStream(): PromiseLike<void>;
}

// Bounds a turn so a stalled provider call can't hold the HTTP stream open indefinitely.
const CHAT_TURN_TIMEOUT = { totalMs: 120_000, stepMs: 60_000 } as const;

// Shared by both turn paths so the history-trimming policy stays identical.
async function toPrunedModelMessages(messages: UIMessage[]): Promise<ModelMessage[]> {
  return pruneMessages({
    messages: await convertToModelMessages(messages),
    reasoning: 'all',
    toolCalls: 'before-last-5-messages',
    emptyMessages: 'remove',
  });
}

aiChatRouter.post('/chat', async (req, res) => {
  const auth = await createBetterAuthContext(req);

  try {
    requireAuth(auth);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { message, conversationId, organizationId, currentPageId } = req.body as {
    message: UIMessage;
    conversationId: string;
    organizationId: string;
    currentPageId?: string;
  };

  const messageText = (message as any)?.content ?? (message?.parts as any[])?.find((p: any) => p.type === 'text')?.text ?? '';
  if (!conversationId || !organizationId || !messageText.trim()) {
    res.status(400).json({ error: 'conversationId, organizationId, and message are required' });
    return;
  }

  try {
    await requireOrganizationMembership(auth, organizationId);
  } catch {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Verify conversation ownership, and that it belongs to the org being billed for this turn.
  const conv = await findOwnedConversation(conversationId, auth.user!.id);
  if (!conv || conv.organizationId !== organizationId) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  // Re-check form access every turn: edit rights can be revoked after the conversation was created.
  let permission: string;
  try {
    const access = await checkFormAccess(auth.user!.id, conv.formId, PermissionLevel.EDITOR);
    if (!access.hasAccess) throw new Error('insufficient form permission');
    permission = access.permission;
  } catch {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Check token budget
  const budget = await checkAITokenBudget(organizationId);
  if (!budget.allowed) {
    res.status(402).json({
      error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.`,
    });
    return;
  }

  // Load history from DB
  const previous = await loadConversationMessages(conversationId);

  // Auto-title on first message (fire-and-forget)
  if (previous.length === 0) {
    autoGenerateTitle(conversationId, messageText);
  }

  // Build full message list with new user message.
  // Phase 1.3: Prune old tool call payloads to compact annotations, then
  // summarise if the conversation is long enough — reduces context by ~55%.
  const previousPruned = pruneToolCallsFromHistory(
    truncateToolResults(previous)
  );
  const previousSmartened = await summarizeHistoryIfNeeded(previousPruned);
  const allMessages = [...previousSmartened, message];

  // Read Y.js schema once (cached for 10 s)
  const schema = await getFormSchema(conv.formId);
  const fieldCount = countFields(schema);
  // Small forms get the full snapshot inline (no read tools needed); large forms keep read tools.
  const includeReadTools = fieldCount > SNAPSHOT_FIELD_THRESHOLD;

  // Validate messages (handles tool call/result shapes in history). Use the full tool set
  // (read + mutation + plugin tools) so historical tool calls validate regardless of the
  // current caller's tier or permission — validation never executes tools.
  let validated: UIMessage[];
  try {
    const tools = createFormEditAgent(schema, { canManagePlugins: true }).tools as Record<string, any>;
    validated = await validateUIMessages({ messages: allMessages, tools }) as UIMessage[];
  } catch {
    logger.warn({ conversationId }, 'validateUIMessages failed — falling back to unvalidated messages');
    validated = allMessages;
  }

  // ── Intent classification + model routing ──────────────────────────────────
  // Zero-latency heuristic: no API call, pure regex. Determines which model and
  // tool tier to use for this specific turn.
  const intent = classifyIntent(messageText);
  const modelTier = intentToModelTier(intent);
  const toolTier = intentToToolTier(intent);

  logger.debug({ conversationId, intent, modelTier, toolTier }, 'AI chat intent classified');

  // EPHEMERAL tail: dynamic per-turn context appended AFTER history as a trailing user message.
  // It is NOT part of `validated`/UIMessages, so it is never persisted and never disturbs the
  // cacheable prefix. Appended after pruning so pruning can't drop it.
  const ephemeralContext: ModelMessage = {
    role: 'user',
    content: buildEphemeralContext(currentPageId, schema),
  };

  // Streams a turn to the client in the UI message stream protocol that useChat's
  // DefaultChatTransport parses (a plain text stream would be silently dropped), and persists
  // the turn when the stream ends. Generic so streamText and agent results (different tool
  // sets) both fit.
  const respond = async <TOOLS extends ToolSet>(result: ChatTurnStream<TOOLS>): Promise<void> => {
    // Ensure onEnd fires (and the turn is persisted) even if the client disconnects.
    void result.consumeStream();

    const uiStream = toUIMessageStream({
      stream: result.stream,
      originalMessages: validated,
      generateMessageId,
      onEnd: async ({ responseMessage }) => {
        // Persist exactly this turn: the user message plus the assistant reply. The ephemeral
        // context is not a UI message, so no snapshot leaks into persisted history.
        const usage = await result.usage;
        const tokensUsed = usage?.totalTokens ?? 0;
        try {
          await saveConversationMessages(conversationId, truncateToolResults([message, responseMessage]), tokensUsed);
        } finally {
          // The tokens were spent even if persistence failed.
          await recordAITokenUsage(organizationId, tokensUsed, modelTier);
        }
        recordTurnTelemetry({
          conversationId,
          formId: conv.formId,
          formFieldCount: fieldCount,
          model: getModelIdForIntent(intent),
          intentTier: intent,
          modelTier,
          ...extractUsageStats(usage),
        });
      },
    });
    await pipeUIMessageStreamToResponse({ response: res, stream: uiStream });
  };

  try {
    const messages = [...(await toPrunedModelMessages(validated)), ephemeralContext];

    if (intent === 'question') {
      // Questions ("what field types do you support?", "how do I...") don't need tools: skip the
      // ToolLoopAgent and use direct streamText, saving the tool-schema tokens.
      await respond(
        streamText({
          model: getModelForIntent(intent),
          instructions: QUESTION_SYSTEM_PROMPT,
          messages,
          timeout: CHAT_TURN_TIMEOUT,
        })
      );
    } else {
      // Static system prompt keeps the prefix byte-stable so provider prefix caching hits on
      // every step and across turns. Plugin (integration) tools are full-tier only and OWNER-gated.
      const agent = createFormEditAgent(schema, {
        instructions: STATIC_SYSTEM_PROMPT,
        cacheKey: conversationId,
        includeReadTools,
        formId: conv.formId,
        modelTier,
        toolTier,
        canManagePlugins: toolTier === 'full' && permission === PermissionLevel.OWNER,
      });
      await respond(await agent.stream({ messages, timeout: CHAT_TURN_TIMEOUT }));
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ errMsg, conversationId }, 'AI chat stream failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI processing failed. Please try again.' });
    }
    res.end();
  }
});

aiChatRouter.post('/invalidate-schema', async (req, res) => {
  const auth = await createBetterAuthContext(req);
  try { requireAuth(auth); } catch { res.status(401).json({ error: 'Authentication required' }); return; }
  const { formId } = req.body as { formId?: string };
  // Phase 2.2: use centralized invalidation utility
  if (formId) invalidateCachedSchema(formId);
  res.status(204).end();
});
