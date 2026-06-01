import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIChatConversation: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aIChatMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../lib/ai.js', () => ({
  getPrimaryModel: vi.fn(() => 'mock-model'),
  getFastModel: vi.fn(() => 'mock-fast-model'),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Short title' }),
  stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', count: n })),
}));

import { prisma } from '../../lib/prisma.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  loadConversationMessages,
  saveConversationMessages,
  autoGenerateTitle,
} from '../aiChatService.js';

beforeEach(() => vi.clearAllMocks());

describe('createConversation', () => {
  it('calls prisma.aIChatConversation.create with correct fields', async () => {
    (prisma.aIChatConversation.create as any).mockResolvedValue({ id: 'conv_1', title: 'New conversation' });
    const result = await createConversation('form_1', 'org_1', 'user_1');
    expect(prisma.aIChatConversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ formId: 'form_1', organizationId: 'org_1', userId: 'user_1' }),
    });
    expect(result.id).toBe('conv_1');
  });
});

describe('listConversations', () => {
  it('queries by formId and userId ordered by updatedAt desc', async () => {
    (prisma.aIChatConversation.findMany as any).mockResolvedValue([]);
    await listConversations('form_1', 'org_1', 'user_1');
    expect(prisma.aIChatConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { formId: 'form_1', organizationId: 'org_1', userId: 'user_1' },
        orderBy: { updatedAt: 'desc' },
      })
    );
  });
});

describe('getConversation', () => {
  it('returns null when conversation not found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue(null);
    const result = await getConversation('missing', 'user_1');
    expect(result).toBeNull();
  });

  it('returns conversation with messageCount when found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({
      id: 'conv_1', title: 'Test', _count: { messages: 3 },
    });
    const result = await getConversation('conv_1', 'user_1');
    expect(result?.messageCount).toBe(3);
  });
});

describe('deleteConversation', () => {
  it('returns false when conversation not found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue(null);
    const result = await deleteConversation('missing', 'user_1');
    expect(result).toBe(false);
  });

  it('deletes and returns true when found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({ id: 'conv_1' });
    (prisma.aIChatConversation.delete as any).mockResolvedValue({});
    const result = await deleteConversation('conv_1', 'user_1');
    expect(result).toBe(true);
    expect(prisma.aIChatConversation.delete).toHaveBeenCalledWith({ where: { id: 'conv_1' } });
  });
});

describe('renameConversation', () => {
  it('returns null when conversation not found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue(null);
    const result = await renameConversation('missing', 'user_1', 'New Title');
    expect(result).toBeNull();
  });

  it('renames with given title when found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({ id: 'conv_1' });
    (prisma.aIChatConversation.update as any).mockResolvedValue({ id: 'conv_1', title: 'New Title' });
    const result = await renameConversation('conv_1', 'user_1', 'New Title');
    expect((result as any).title).toBe('New Title');
    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'New Title' } })
    );
  });

  it('falls back to "Untitled conversation" when title is blank', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({ id: 'conv_1' });
    (prisma.aIChatConversation.update as any).mockResolvedValue({ id: 'conv_1', title: 'Untitled conversation' });
    await renameConversation('conv_1', 'user_1', '   ');
    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { title: 'Untitled conversation' } })
    );
  });
});

describe('loadConversationMessages', () => {
  it('returns UIMessage[] from data column', async () => {
    const uiMsg = { id: 'msg-1', role: 'user', content: 'Hello', parts: [{ type: 'text', text: 'Hello' }] };
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([{ data: uiMsg }]);
    const result = await loadConversationMessages('conv_1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(uiMsg);
  });

  it('returns empty array when no messages', async () => {
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([]);
    const result = await loadConversationMessages('conv_1');
    expect(result).toEqual([]);
  });

  it('returns at most 20 messages in ascending order', async () => {
    // Simulate Prisma returning 20 messages in desc order (newest first)
    const fakeMessages = Array.from({ length: 20 }, (_, i) => ({
      data: { id: `msg-${i}`, role: 'user', content: `message ${i}`, parts: [] },
    }));
    (prisma.aIChatMessage.findMany as any).mockResolvedValue(fakeMessages);

    const result = await loadConversationMessages('conv_1');

    expect(prisma.aIChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    );
    expect(result).toHaveLength(20);
    // After reverse(), first element should be the last from the desc array (msg-19)
    expect((result[0] as any).id).toBe('msg-19');
    expect((result[19] as any).id).toBe('msg-0');
  });

  it('returns all messages when fewer than 20 exist', async () => {
    const fakeMessages = [
      { data: { id: 'msg-0', role: 'user', content: 'hi', parts: [] } },
      { data: { id: 'msg-1', role: 'assistant', content: 'hello', parts: [] } },
    ];
    (prisma.aIChatMessage.findMany as any).mockResolvedValue(fakeMessages);

    const result = await loadConversationMessages('conv_1');
    expect(result).toHaveLength(2);
  });
});

describe('saveConversationMessages', () => {
  it('creates a DB row for each message', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    const messages = [
      { id: 'u1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'a1', role: 'assistant', content: 'Hello!', parts: [{ type: 'text', text: 'Hello!' }] },
    ];

    await saveConversationMessages('conv_1', messages as any, 42);

    expect(prisma.aIChatMessage.create).toHaveBeenCalledTimes(2);
    // tokensUsed on last (assistant) message
    expect(prisma.aIChatMessage.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ role: 'assistant', tokensUsed: 42 }),
    });
    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('falls back to empty string when msg has no parts and no content', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});
    const messages = [
      { id: 'u1', role: 'user', parts: [], content: null },
    ];
    await saveConversationMessages('conv_1', messages as any, 0);
    expect(prisma.aIChatMessage.create).toHaveBeenCalled();
  });

  it('falls back to msg.content when no text part exists', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});
    const messages = [
      { id: 'u1', role: 'user', content: 'fallback content', parts: [] },
    ];
    await saveConversationMessages('conv_1', messages as any, 10);
    expect(prisma.aIChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'user' }) })
    );
  });

  it('sets tokensUsed=0 for user messages', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    const messages = [
      { id: 'u1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
    ];
    await saveConversationMessages('conv_1', messages as any, 100);

    expect(prisma.aIChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ role: 'user', tokensUsed: 0 }),
    });
  });
});

describe('autoGenerateTitle', () => {
  it('calls generateText and updates conversation title', async () => {
    const { generateText } = await import('ai');
    (generateText as any).mockResolvedValue({ text: 'My Form Title' });
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    autoGenerateTitle('conv_1', 'Help me build a contact form');
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(prisma.aIChatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv_1' },
      data: { title: 'My Form Title' },
    });
  });

  it('does not throw when the conversation is deleted before title saves', async () => {
    vi.mocked(prisma.aIChatConversation.update).mockRejectedValueOnce(
      new Error('Record not found')
    );
    await expect(
      new Promise<void>((resolve) => {
        autoGenerateTitle('conv-deleted', 'Hello world');
        setTimeout(resolve, 50);
      })
    ).resolves.toBeUndefined();
  });
});
