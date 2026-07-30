import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAiChatRepository } from '../aiChatRepository.js';

const prismaMock = vi.hoisted(() => ({
  aIChatConversation: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    count: vi.fn().mockResolvedValue(0),
  },
  aIChatMessage: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../baseRepository.js', () => ({
  resolvePrisma: () => prismaMock,
}));

describe('aiChatRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.aIChatConversation.findMany.mockResolvedValue([]);
    prismaMock.aIChatConversation.findUnique.mockResolvedValue(null);
    prismaMock.aIChatConversation.findFirst.mockResolvedValue(null);
    prismaMock.aIChatConversation.create.mockResolvedValue({});
    prismaMock.aIChatConversation.update.mockResolvedValue({});
    prismaMock.aIChatConversation.delete.mockResolvedValue({});
    prismaMock.aIChatConversation.count.mockResolvedValue(0);
    prismaMock.aIChatMessage.findMany.mockResolvedValue([]);
    prismaMock.aIChatMessage.create.mockResolvedValue({});
  });

  it('should proxy basic prisma delegate methods', async () => {
    const repo = createAiChatRepository();
    const args = { where: { id: 'conv-1' } };
    await repo.findMany(args);
    await repo.findUnique(args as any);
    await repo.create({ data: { id: 'conv-1' } } as any);
    await repo.update({ where: { id: 'conv-1' }, data: { title: 'New' } } as any);
    await repo.delete({ where: { id: 'conv-1' } } as any);
    await repo.count(args as any);
    await repo.findManyMessages({ where: { conversationId: 'conv-1' } } as any);
    await repo.createMessage({ data: { conversationId: 'conv-1' } } as any);

    expect(prismaMock.aIChatConversation.findMany).toHaveBeenCalledWith(args);
    expect(prismaMock.aIChatConversation.findUnique).toHaveBeenCalledWith(args);
    expect(prismaMock.aIChatConversation.create).toHaveBeenCalled();
    expect(prismaMock.aIChatConversation.update).toHaveBeenCalled();
    expect(prismaMock.aIChatConversation.delete).toHaveBeenCalled();
    expect(prismaMock.aIChatConversation.count).toHaveBeenCalledWith(args);
    expect(prismaMock.aIChatMessage.findMany).toHaveBeenCalled();
    expect(prismaMock.aIChatMessage.create).toHaveBeenCalled();
  });

  it('should expose domain helpers for conversations', async () => {
    const repo = createAiChatRepository();

    await repo.createConversation({ formId: 'f1', organizationId: 'o1', userId: 'u1', title: 'New conversation' } as any);
    expect(prismaMock.aIChatConversation.create).toHaveBeenCalledWith({
      data: { formId: 'f1', organizationId: 'o1', userId: 'u1', title: 'New conversation' },
    });

    await repo.listConversationsByForm('f1', 'o1', 'u1');
    expect(prismaMock.aIChatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId: 'f1', organizationId: 'o1', userId: 'u1' },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      })
    );

    await repo.findConversationById('conv-1', 'u1');
    expect(prismaMock.aIChatConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1', userId: 'u1' },
        include: expect.objectContaining({
          messages: { orderBy: { createdAt: 'asc' } },
          _count: { select: { messages: true } },
        }),
      })
    );

    await repo.findConversationByUser('conv-1', 'u1');
    expect(prismaMock.aIChatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-1', userId: 'u1' },
    });

    await repo.deleteConversation('conv-1');
    expect(prismaMock.aIChatConversation.delete).toHaveBeenCalledWith({ where: { id: 'conv-1' } });

    await repo.updateConversation('conv-1', { title: 'Renamed' });
    expect(prismaMock.aIChatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { title: 'Renamed' },
    });

    await repo.touchConversation('conv-1');
    expect(prismaMock.aIChatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'conv-1' }, data: expect.objectContaining({ updatedAt: expect.any(Date) }) })
    );
  });

  it('should expose domain helpers for messages', async () => {
    const repo = createAiChatRepository();

    await repo.listRecentMessages('conv-1', 6);
    expect(prismaMock.aIChatMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { data: true },
    });

    await repo.createConversationMessage({ conversationId: 'conv-1', role: 'user', content: 'hi', data: {} } as any);
    expect(prismaMock.aIChatMessage.create).toHaveBeenCalledWith({
      data: { conversationId: 'conv-1', role: 'user', content: 'hi', data: {} },
    });
  });
});
