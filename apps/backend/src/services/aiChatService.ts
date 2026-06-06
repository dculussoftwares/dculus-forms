import { generateText } from 'ai';
import type { UIMessage } from 'ai';
import { prisma } from '../lib/prisma.js';
import { getFastModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

const MAX_HISTORY_MESSAGES = 10;

export const MAX_TOOL_RESULT_CHARS = 8_000;

export function truncateToolResults(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant') return msg;
    const parts = msg.parts as any[];
    if (!parts?.some((p: any) => p.type === 'tool-invocation')) return msg;
    const truncatedParts = parts.map((part: any) => {
      if (part.type !== 'tool-invocation' || part.toolInvocation?.state !== 'result') return part;
      const raw = part.toolInvocation.result;
      const serialized = typeof raw === 'string' ? raw : JSON.stringify(raw);
      if (serialized.length <= MAX_TOOL_RESULT_CHARS) return part;
      return {
        ...part,
        toolInvocation: {
          ...part.toolInvocation,
          result: serialized.slice(0, MAX_TOOL_RESULT_CHARS) + '\n...[truncated]',
        },
      };
    });
    return { ...msg, parts: truncatedParts };
  });
}

export async function createConversation(
  formId: string,
  organizationId: string,
  userId: string
) {
  return prisma.aIChatConversation.create({
    data: { formId, organizationId, userId, title: 'New conversation' },
  });
}

export async function listConversations(
  formId: string,
  organizationId: string,
  userId: string
) {
  const conversations = await prisma.aIChatConversation.findMany({
    where: { formId, organizationId, userId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });

  return conversations.map((c) => ({
    ...c,
    messageCount: c._count.messages,
    messages: [],
  }));
}

export async function getConversation(id: string, userId: string) {
  const conv = await prisma.aIChatConversation.findFirst({
    where: { id, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  });
  if (!conv) return null;
  return { ...conv, messageCount: conv._count.messages };
}

export async function deleteConversation(id: string, userId: string) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id, userId } });
  if (!conv) return false;
  await prisma.aIChatConversation.delete({ where: { id } });
  return true;
}

export async function renameConversation(id: string, userId: string, title: string) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id, userId } });
  if (!conv) return null;
  const safeTitle = title.trim().slice(0, 100) || 'Untitled conversation';
  return prisma.aIChatConversation.update({ where: { id }, data: { title: safeTitle } });
}

export async function loadConversationMessages(conversationId: string): Promise<UIMessage[]> {
  const messages = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: MAX_HISTORY_MESSAGES,
    select: { data: true },
  });
  return messages.reverse().map((m) => m.data as unknown as UIMessage);
}

export async function saveConversationMessages(
  conversationId: string,
  messages: UIMessage[],
  tokensUsed: number
): Promise<void> {
  // Messages arrive in correct order (user turn first, then assistant). Persisting them with
  // Promise.all gave every row of the batch an identical createdAt (Postgres now() = the
  // transaction start time), so `orderBy createdAt asc` on reload was non-deterministic and could
  // render the bubbles out of order. Stamp each message with a createdAt staggered by its index so
  // the saved order is preserved deterministically. Base is captured once so a batch is monotonic
  // and strictly after any earlier batch.
  const base = Date.now();
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLast = i === messages.length - 1;
    const textPart = (msg.parts as any[])?.find((p: any) => p.type === 'text');
    const textContent = textPart?.text ?? (msg as any).content ?? '';
    await prisma.aIChatMessage.create({
      data: {
        conversationId,
        role: msg.role,
        content: textContent,
        data: msg as any,
        tokensUsed: isLast && msg.role === 'assistant' ? tokensUsed : 0,
        createdAt: new Date(base + i),
      },
    });
  }
  await prisma.aIChatConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

// Fire-and-forget: generates a short title from the first user message
export function autoGenerateTitle(conversationId: string, firstMessage: string): void {
  generateText({
    model: getFastModel(),
    prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
  })
    .then(async ({ text }) => {
      try {
        const title = text.trim().slice(0, 60);
        await prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
      } catch (err) {
        logger.warn({ err, conversationId }, 'Failed to save auto-generated title');
      }
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
