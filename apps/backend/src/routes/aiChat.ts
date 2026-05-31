import { Readable } from 'stream';
import { Router, type Router as ExpressRouter } from 'express';
import { validateUIMessages, convertToModelMessages } from 'ai';
import type { UIMessage } from 'ai';
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

function buildSystemPrompt(currentPageId: string | undefined, schema: { pages: any[] }): string {
  const pageContext = currentPageId
    ? `The user is currently viewing page ID: ${currentPageId}. When the user says "this page" or "current page", they mean this page.`
    : 'The user is on the first page.';

  const totalPages = schema.pages.length;
  const schemaContext = totalPages > 0
    ? `\nCurrent form has ${totalPages} page${totalPages !== 1 ? 's' : ''}. Structure:\n${JSON.stringify(
        schema.pages.map((p: any, i: number) => ({
          pageNumber: i + 1,
          id: p.id,
          title: p.title ?? `Page ${i + 1}`,
          fieldCount: (p.fields ?? []).length,
        })),
        null, 2
      )}`
    : '';

  return `You are an AI assistant that helps users edit their multi-page form.
${pageContext}
- Call listFields only when the above schema is insufficient or the user asks about all fields.
- Use getField to read a field's full details before updating it.
- When the user mentions "page 1", "page 2" etc., match by position using the page numbers shown above.
- If the user references a page that does not exist, use this logic:
  • If the requested page number is exactly one more than the current total (e.g. "page 5" when there are 4 pages), immediately call addPage then immediately call addField (or whatever action was requested) — do NOT write any text first. Describe what you did only in your final response after all tool calls are complete.
  • If the requested page number is more than one beyond the current total — reply immediately with plain text: "The form has ${totalPages} page${totalPages !== 1 ? 's' : ''}. Which page did you mean?" Do NOT call any tools at all for this case.
- When the user says "all fields" or "every field" without naming a specific page, ALWAYS call listFields without a pageId first to get all pages and fields, then apply the change to every field returned across all pages.
- Make only the changes the user requests. Confirm what you did in your final text response.
- When you call addPage, the result contains a pageId field. Use that exact pageId value as the pageId argument for any subsequent addField calls on that new page. Never guess or invent a page ID.
- You can add pages with addPage and remove pages with removePage. Never call removePage when there is only one page.
${schemaContext}`;
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

  // Read Y.js schema once
  const schema = await getFormSchemaFromYjs(conv.formId) ?? { pages: [] };
  const systemPrompt = buildSystemPrompt(currentPageId, schema);

  // Validate messages (handles tool call/result shapes in history)
  let validated: UIMessage[];
  try {
    const tools = createFormEditAgent(schema).tools as Record<string, any>;
    validated = await validateUIMessages({ messages: allMessages, tools }) as UIMessage[];
  } catch {
    logger.warn({ conversationId }, 'validateUIMessages failed — falling back to unvalidated messages');
    validated = allMessages;
  }

  const agent = createFormEditAgent(schema, systemPrompt);

  try {
    const modelMessages = await convertToModelMessages(validated);
    const result = await agent.stream({ messages: modelMessages });

    // Ensure onFinish fires even if client disconnects
    result.consumeStream();

    const webResponse = result.toUIMessageStreamResponse({
      originalMessages: validated as any,
      onFinish: async ({ messages: finalMessages }: { messages: UIMessage[] }) => {
        const newMessages = finalMessages.slice(previous.length);
        // Get usage from the resolved promise
        const usage = await result.totalUsage;
        const tokensUsed = usage?.totalTokens ?? 0;
        await saveConversationMessages(conversationId, newMessages, tokensUsed);
        await recordAITokenUsage(organizationId, tokensUsed);
      },
    });

    // Bridge Web API Response → Express response
    res.status(webResponse.status);
    for (const [k, v] of webResponse.headers.entries()) {
      res.setHeader(k, v);
    }
    Readable.fromWeb(webResponse.body as any).pipe(res);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ errMsg, conversationId }, 'AI chat stream failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI processing failed. Please try again.' });
    }
    res.end();
  }
});
