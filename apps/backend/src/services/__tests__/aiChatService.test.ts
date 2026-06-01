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
