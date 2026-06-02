import { Router, type Router as ExpressRouter } from 'express';
import { validateUIMessages, convertToModelMessages, pruneMessages } from 'ai';
import type { UIMessage, ModelMessage } from 'ai';
import * as Y from 'yjs';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
import {
  getConversation,
  loadConversationMessages,
  saveConversationMessages,
  autoGenerateTitle,
} from '../services/aiChatService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../services/aiUsageService.js';
import { createFormEditAgent } from '../lib/formEditAgent.js';
import { getPrimaryModelId } from '../lib/ai.js';
import { extractUsageStats, recordTurnTelemetry } from '../services/aiTelemetry.js';
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
        const fields = fieldsArray ? fieldsArray.toArray().map((fieldMap) => {
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
  return form ? (form.formSchema as any) : null;
}

// ── Schema cache ──────────────────────────────────────────────────────────────
const schemaCache = new Map<string, { schema: { pages: any[] }; cachedAt: number }>();
const SCHEMA_CACHE_TTL_MS = 10_000;

export async function getFormSchema(formId: string): Promise<{ pages: any[] }> {
  const hit = schemaCache.get(formId);
  if (hit && Date.now() - hit.cachedAt < SCHEMA_CACHE_TTL_MS) return hit.schema;
  const schema = (await getFormSchemaFromYjs(formId)) ?? { pages: [] };
  schemaCache.set(formId, { schema, cachedAt: Date.now() });
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
  return (schema.pages ?? []).reduce((n, p) => n + (p.fields?.length ?? 0), 0);
}

/**
 * STATIC system prompt. Contains NO per-turn data (no current page, no form structure) so it is
 * byte-identical on every request — this is what lets Azure/OpenAI prefix caching hit. All
 * dynamic context is delivered separately via buildEphemeralContext (the trailing tail).
 */
export const STATIC_SYSTEM_PROMPT = `You are an AI assistant that helps users edit their multi-page form.

The current form structure (pages, fields, and the current page) is provided in a <current_context> block at the end of each message. Read it before acting — it is authoritative.

- Identify fields by their label and id from <current_context>. If the snapshot is omitted (large forms), call listFields (no pageId) to search across all pages, then getField for full details before updating.
- When the user mentions "page 1", "page 2", match by position using the page numbers in <current_context>.
- If the user references a page that does not exist:
  • If the number is exactly one more than the current total — it is the next sequential page. Auto-create it: call addPage, then immediately addField (or whatever was requested). Do NOT ask, do NOT write text first.
  • If the number is two or more beyond the total — reply with plain text asking which page they meant. Do NOT call any tools.
- Make only the changes the user requests. Confirm what you did in your final text response.
- When you call addPage, the result contains a pageId. Use that exact pageId for subsequent addField calls on that new page. Never invent a page ID.
- Never call removePage when there is only one page.
- When editing fields on a page that is NOT the current page, call navigateToPage first, then make your changes.
- When suggesting or reviewing validation, call proposeValidation with all affected fields at once. Never apply validation via updateFields without explicit user confirmation.
- updateFields and removeFields take an array of field IDs — pass one ID for a single field, or many for a batch. Always prefer one batched call over many single calls.
- Use reorder with scope "fields" (and a pageId) to change field order within a page; use reorder with scope "pages" to reorder pages.
- Use relocateField with mode "move" to move a field to a different page, or mode "copy" to duplicate it onto another page (the copy gets a new ID; all other properties are preserved). Not for same-page reordering.
- When asked to "remix", "transform", or "convert" the form: read the current structure, remove fields that don't fit (removeFields), add fields that belong (addField), keep fields that work for both and relabel via updateFields, then updateLayout for the title and CTA. Add new fields before removing the last field on a page.`;

/**
 * The per-turn dynamic context, delivered as a trailing user message placed AFTER conversation
 * history so the cacheable prefix (system + tools + history) stays byte-stable. This message is
 * EPHEMERAL — it must never be persisted to conversation history (see onFinish slice logic).
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

  // Check token budget
  const budget = await checkAITokenBudget(organizationId);
  if (!budget.allowed) {
    res.status(402).json({
      error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.`,
    });
    return;
  }

  // Verify conversation ownership
  const conv = await getConversation(conversationId, auth.user!.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  // Load history from DB
  const previous = await loadConversationMessages(conversationId);

  // Auto-title on first message (fire-and-forget)
  if (previous.length === 0) {
    autoGenerateTitle(conversationId, messageText);
  }

  // Build full message list with new user message
  const allMessages = [...previous, message];

  // Read Y.js schema once (cached for 10 s)
  const schema = await getFormSchema(conv.formId);
  const fieldCount = countFields(schema);
  // Small forms get the full snapshot inline (no read tools needed); large forms keep read tools.
  const includeReadTools = fieldCount > SNAPSHOT_FIELD_THRESHOLD;

  // Validate messages (handles tool call/result shapes in history). Use the full tool set
  // (read + mutation) so historical tool calls validate regardless of form size.
  let validated: UIMessage[];
  try {
    const tools = createFormEditAgent(schema).tools as Record<string, any>;
    validated = await validateUIMessages({ messages: allMessages, tools }) as UIMessage[];
  } catch {
    logger.warn({ conversationId }, 'validateUIMessages failed — falling back to unvalidated messages');
    validated = allMessages;
  }

  // Static system prompt + stable per-conversation cache key keep the prefix byte-stable so
  // Azure/OpenAI prefix caching hits on every step and across turns.
  const agent = createFormEditAgent(schema, {
    instructions: STATIC_SYSTEM_PROMPT,
    cacheKey: conversationId,
    includeReadTools,
  });

  try {
    const modelMessages = await convertToModelMessages(validated);
    const prunedModelMessages = pruneMessages({
      messages: modelMessages,
      reasoning: 'all',
      toolCalls: 'before-last-5-messages',
      emptyMessages: 'remove',
    });

    // EPHEMERAL tail: dynamic per-turn context appended AFTER history as a trailing user
    // message. It is NOT part of `validated`/UIMessages, so it is never persisted and never
    // disturbs the cacheable prefix. Added after pruning so pruning can't drop it.
    const ephemeralContext: ModelMessage = {
      role: 'user',
      content: buildEphemeralContext(currentPageId, schema),
    };
    const result = await agent.stream({
      messages: [...prunedModelMessages, ephemeralContext],
    });

    // Ensure onFinish fires even if client disconnects
    result.consumeStream();

    const webResponse = result.toUIMessageStreamResponse({
      originalMessages: validated as any,
      onFinish: async ({ messages: finalMessages }: { messages: UIMessage[] }) => {
        // The ephemeral context is not in originalMessages, so the new messages are exactly
        // the user turn + assistant response — no snapshot leaks into persisted history.
        const newMessages = finalMessages.slice(previous.length);
        const usage = await result.totalUsage;
        const tokensUsed = usage?.totalTokens ?? 0;
        await saveConversationMessages(conversationId, newMessages, tokensUsed);
        await recordAITokenUsage(organizationId, tokensUsed);

        const stats = extractUsageStats(usage);
        recordTurnTelemetry({
          conversationId,
          formId: conv.formId,
          formFieldCount: fieldCount,
          model: getPrimaryModelId(),
          ...stats,
        });
      },
    });

    // Bridge Web API Response → Express response
    res.status(webResponse.status);
    for (const [k, v] of webResponse.headers.entries()) {
      res.setHeader(k, v);
    }
    try {
      for await (const chunk of webResponse.body as any) {
        res.write(chunk);
      }
    } finally {
      res.end();
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
  if (formId) schemaCache.delete(formId);
  res.status(204).end();
});
