import type { Prisma } from '#prisma-client';
import { resolvePrisma, type RepositoryContext } from './baseRepository.js';

/**
 * Factory for AI chat data access, covering both `AIChatConversation` and
 * `AIChatMessage` Prisma models.
 */
export const createAiChatRepository = (context?: RepositoryContext) => {
  const prisma = resolvePrisma(context);

  /** --- Generic delegate passthroughs (AIChatConversation) --- */
  const findMany = <T extends Prisma.AIChatConversationFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AIChatConversationFindManyArgs>
  ) => prisma.aIChatConversation.findMany(args);

  const findUnique = <T extends Prisma.AIChatConversationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIChatConversationFindUniqueArgs>
  ) => prisma.aIChatConversation.findUnique(args);

  const create = <T extends Prisma.AIChatConversationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIChatConversationCreateArgs>
  ) => prisma.aIChatConversation.create(args);

  const update = <T extends Prisma.AIChatConversationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIChatConversationUpdateArgs>
  ) => prisma.aIChatConversation.update(args);

  const remove = <T extends Prisma.AIChatConversationDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIChatConversationDeleteArgs>
  ) => prisma.aIChatConversation.delete(args);

  const count = <T extends Prisma.AIChatConversationCountArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AIChatConversationCountArgs>
  ) => prisma.aIChatConversation.count(args);

  /** --- Domain-oriented helpers for AIChatConversation --- */

  const createConversation = async (
    data: Prisma.AIChatConversationCreateArgs['data']
  ) => prisma.aIChatConversation.create({ data });

  const listConversationsByForm = async (
    formId: string,
    organizationId: string,
    userId: string
  ) =>
    prisma.aIChatConversation.findMany({
      where: { formId, organizationId, userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });

  const findConversationById = async (id: string, userId: string) =>
    prisma.aIChatConversation.findFirst({
      where: { id, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        _count: { select: { messages: true } },
      },
    });

  const findConversationByUser = async (id: string, userId: string) =>
    prisma.aIChatConversation.findFirst({ where: { id, userId } });

  const deleteConversation = async (id: string) =>
    prisma.aIChatConversation.delete({ where: { id } });

  const updateConversation = async (
    id: string,
    data: Prisma.AIChatConversationUpdateInput
  ) => prisma.aIChatConversation.update({ where: { id }, data });

  const touchConversation = async (id: string) =>
    prisma.aIChatConversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

  /** --- Generic delegate passthroughs (AIChatMessage) --- */
  const findManyMessages = <T extends Prisma.AIChatMessageFindManyArgs>(
    args?: Prisma.SelectSubset<T, Prisma.AIChatMessageFindManyArgs>
  ) => prisma.aIChatMessage.findMany(args);

  const createMessage = <T extends Prisma.AIChatMessageCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.AIChatMessageCreateArgs>
  ) => prisma.aIChatMessage.create(args);

  /** --- Domain-oriented helpers for AIChatMessage --- */

  const listRecentMessages = async (conversationId: string, take: number) =>
    prisma.aIChatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take,
      select: { data: true },
    });

  const createConversationMessage = async (
    data: Prisma.AIChatMessageCreateArgs['data']
  ) => prisma.aIChatMessage.create({ data });

  return {
    // Generic operations (used when custom queries are needed)
    findMany,
    findUnique,
    create,
    update,
    delete: remove,
    count,
    findManyMessages,
    createMessage,

    // Domain helpers (preferred for service layer)
    createConversation,
    listConversationsByForm,
    findConversationById,
    findConversationByUser,
    deleteConversation,
    updateConversation,
    touchConversation,
    listRecentMessages,
    createConversationMessage,
  };
};

export type AiChatRepository = ReturnType<typeof createAiChatRepository>;

export const aiChatRepository = createAiChatRepository();
