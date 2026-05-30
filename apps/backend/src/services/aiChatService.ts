import { generateText, streamText, stepCountIs } from 'ai';
import { prisma } from '../lib/prisma.js';
import { getModelForPlan } from '../lib/ai.js';
import { createFormEditTools } from '../lib/aiFormEditTools.js';
import { logger } from '../lib/logger.js';

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

export async function saveUserMessage(conversationId: string, content: string) {
  return prisma.aIChatMessage.create({
    data: { conversationId, role: 'user', content },
  });
}

export async function saveAssistantMessage(
  conversationId: string,
  content: string,
  operations: object[],
  tokensUsed: number
) {
  return prisma.aIChatMessage.create({
    data: { conversationId, role: 'assistant', content, operations, tokensUsed },
  });
}

export async function buildChatStream(
  conversationId: string,
  userId: string,
  currentPageId: string | undefined,
  userPlan: string,
) {
  const conv = await prisma.aIChatConversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conv) throw new Error('Conversation not found');

  const history = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  const pageContext = currentPageId
    ? `The user is currently viewing page ID: ${currentPageId}. When the user says "this page" or "current page", they mean this page.`
    : 'The user is on the first page.';

  const systemPrompt = `You are an AI assistant that helps users edit their multi-page form.

Key rules:
- Always call listFields (without a pageId) first to see ALL pages and their fields before making edits.
- Use getField to read a field's full details before updating it.
- When adding a field to a specific page, use that page's exact ID from listFields.
- ${pageContext}
- When the user mentions "page 1", "page 2" etc., match by position in the listFields result (first page = page 1, second = page 2).
- Make only the changes the user requests. Confirm what you did in your final text response.
- You can add pages with addPage (insertAfterPageId: null appends at end) and remove pages with removePage. Never call removePage when there is only one page.`;

  const messages = history.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const tools = createFormEditTools(conv.formId);

  const model = await getModelForPlan(userPlan, 'primary');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stream = streamText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(8), // allows listFields + getField + up to 6 mutation calls per turn
  }) as unknown as { fullStream: AsyncIterable<any>; text: Promise<string>; usage: Promise<{ totalTokens: number }> };

  return stream;
}

// Fire-and-forget: generates a short title from the first user message
export function autoGenerateTitle(conversationId: string, firstMessage: string, userPlan: string): void {
  getModelForPlan(userPlan, 'fast')
    .then((model) =>
      generateText({
        model,
        prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
      })
    )
    .then(({ text }) => {
      const title = text.trim().slice(0, 60);
      return prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
