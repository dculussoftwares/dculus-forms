import { generateText, streamText } from 'ai';
import { prisma } from '../lib/prisma.js';
import { getPrimaryModel, getFastModel } from '../lib/ai.js';
import { formEditTools } from '../lib/aiFormEditTools.js';
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
  return prisma.aIChatConversation.update({ where: { id }, data: { title } });
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

export async function buildStreamForConversation(
  conversationId: string,
  userId: string,
  currentFormState: object,
  latestUserMessage: string
) {
  const conv = await prisma.aIChatConversation.findFirst({ where: { id: conversationId, userId } });
  if (!conv) throw new Error('Conversation not found');

  const history = await prisma.aIChatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });

  // Build a compact form state description for the system prompt
  let formStateText = 'Form state unavailable.';
  try {
    const schema = currentFormState as any;
    const pages = schema?.pages ?? [];
    const fieldLines = pages.flatMap((p: any) =>
      (p.fields ?? []).map(
        (f: any) => `  - [${f.id}] type=${f.type} label="${f.label}" required=${f.required} pageId=${p.id}`
      )
    );
    formStateText = fieldLines.length
      ? `Current form fields:\n${fieldLines.join('\n')}`
      : 'The form currently has no fields.';
  } catch {
    /* ignore serialization errors */
  }

  const systemPrompt = `You are an AI assistant that helps users edit and improve their form.
You can add, update, remove, and reorder fields using the provided tools.
Always call inspectForm first if you need to reference specific field IDs.
Make only the changes the user requests. Confirm what you did in your final text response.

${formStateText}`;

  const messages = [
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: latestUserMessage },
  ];

  return streamText({
    model: getPrimaryModel(),
    system: systemPrompt,
    messages,
    tools: formEditTools,
    maxSteps: 5,
  });
}

// Fire-and-forget: generates a short title from the first user message
export function autoGenerateTitle(conversationId: string, firstMessage: string): void {
  generateText({
    model: getFastModel(),
    prompt: `Generate a short title (max 7 words, no quotes) for a form editing conversation that starts with: "${firstMessage.slice(0, 200)}"`,
  })
    .then(({ text }) => {
      const title = text.trim().slice(0, 60);
      return prisma.aIChatConversation.update({ where: { id: conversationId }, data: { title } });
    })
    .catch((err) => logger.warn({ err, conversationId }, 'Failed to auto-generate conversation title'));
}
