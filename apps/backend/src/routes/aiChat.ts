import { Router, type Router as ExpressRouter } from 'express';
import {
  requireAuth,
  requireOrganizationMembership,
  createBetterAuthContext,
} from '../middleware/better-auth-middleware.js';
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

    // 4. Auto-title on first message (fire-and-forget)
    if (conv.messageCount <= 1) {
      autoGenerateTitle(conversationId, content);
    }

    // 5. Build stream
    const stream = await buildChatStream(conversationId, auth.user!.id, currentPageId);

    const operations: FormOperation[] = [];
    let fullText = '';

    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        const delta: string = (part as any).textDelta ?? (part as any).text ?? '';
        fullText += delta;
        write({ type: 'text', delta });
      }

      if (part.type === 'tool-result') {
        const op = (part as any).output as FormOperation | undefined;
        if (op) {
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
