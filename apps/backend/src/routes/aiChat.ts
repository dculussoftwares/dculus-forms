import { Router, type Router as ExpressRouter } from 'express';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
import { prisma } from '../lib/prisma.js';
import {
  saveUserMessage,
  getConversation,
  buildChatStream,
  saveAssistantMessage,
  autoGenerateTitle,
} from '../services/aiChatService.js';
import {
  checkAITokenBudget,
  recordAITokenUsage,
} from '../services/aiUsageService.js';
import { logger } from '../lib/logger.js';
import type { FormOperation } from '../lib/aiFormEditTools.js';

const MUTATION_OP_TYPES = new Set(['ADD_FIELD', 'UPDATE_FIELD', 'REMOVE_FIELD', 'REORDER_FIELDS', 'UPDATE_LAYOUT', 'RENAME_PAGE', 'REORDER_PAGES', 'ADD_PAGE', 'REMOVE_PAGE']);

export const aiChatRouter: ExpressRouter = Router();

aiChatRouter.post('/chat', async (req, res) => {
  const auth = await createBetterAuthContext(req);

  try {
    requireAuth(auth);
  } catch {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { conversationId, organizationId, content, currentPageId } = req.body as {
    conversationId: string;
    organizationId: string;
    content: string;
    currentPageId?: string;
  };

  if (!conversationId || !organizationId || !content?.trim()) {
    res.status(400).json({ error: 'conversationId, organizationId, and content are required' });
    return;
  }

  try {
    await requireOrganizationMembership(auth, organizationId);
  } catch {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  function write(chunk: object) {
    res.write(JSON.stringify(chunk) + '\n');
  }

  try {
    // 1. Check token budget
    const budget = await checkAITokenBudget(organizationId);
    if (!budget.allowed) {
      write({ type: 'error', error: `AI token limit reached (${budget.used.toLocaleString()} / ${budget.limit.toLocaleString()} used). Upgrade your plan to continue.` });
      res.end();
      return;
    }

    // 2. Verify conversation ownership BEFORE writing to DB
    const conv = await getConversation(conversationId, auth.user!.id);
    if (!conv) {
      write({ type: 'error', error: 'Conversation not found' });
      res.end();
      return;
    }

    // 3. Now safe to save user message
    await saveUserMessage(conversationId, content);

    // 4a. Resolve subscription plan for model selection
    const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
    const userPlan = subscription?.planId ?? 'free';

    // 4. Auto-title on first message (fire-and-forget)
    if (conv.messageCount <= 1) {
      autoGenerateTitle(conversationId, content, userPlan);
    }

    // 5. Build stream
    const stream = await buildChatStream(conversationId, auth.user!.id, currentPageId, userPlan);

    const operations: FormOperation[] = [];
    let fullText = '';

    const TOOL_STATUS_MAP: Record<string, string> = {
      listFields: 'Reading form structure...',
      getField: 'Checking field details...',
      addField: 'Adding field...',
      updateField: 'Updating field...',
      removeField: 'Removing field...',
      reorderFields: 'Reordering fields...',
      updateLayout: 'Updating layout...',
      renamePage: 'Renaming page...',
      reorderPages: 'Reordering pages...',
      addPage: 'Adding page...',
      removePage: 'Removing page...',
    };

    for await (const part of stream.fullStream) {
      if (part.type === 'tool-call') {
        const toolName = (part as any).toolName as string;
        write({ type: 'status', text: TOOL_STATUS_MAP[toolName] ?? 'Working...' });
      }

      if (part.type === 'text-delta') {
        const delta: string = (part as any).textDelta ?? (part as any).text ?? '';
        fullText += delta;
        write({ type: 'text', delta });
      }

      if (part.type === 'tool-result') {
        const op = (part as any).output as (FormOperation & { type?: string }) | undefined;
        if (op && op.type && MUTATION_OP_TYPES.has(op.type)) {
          operations.push(op);
          write({ type: 'operation', op });
        }
      }

      if (part.type === 'finish') {
        const tokensUsed: number =
          (part as any).totalUsage?.totalTokens ??
          (part as any).usage?.totalTokens ?? 0;
        const saved = await saveAssistantMessage(conversationId, fullText, operations, tokensUsed);
        await recordAITokenUsage(organizationId, tokensUsed);
        write({ type: 'done', messageId: saved.id });
        res.end();
      }
    }

    // Guard: finish may not have fired (model abort/timeout)
    if (!res.writableEnded) {
      const saved = await saveAssistantMessage(conversationId, fullText, operations, 0);
      await recordAITokenUsage(organizationId, 0);
      write({ type: 'done', messageId: saved.id });
      res.end();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error({ errMsg, conversationId }, 'AI chat stream failed');
    write({ type: 'error', error: 'AI processing failed. Please try again.' });
    res.end();
  }
});
