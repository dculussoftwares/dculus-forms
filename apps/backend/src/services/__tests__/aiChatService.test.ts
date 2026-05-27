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

vi.mock('../../lib/aiFormEditTools.js', () => ({
  createFormEditTools: vi.fn(() => ({})),
}));

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'Short title' }),
  stepCountIs: vi.fn((n: number) => ({ type: 'stepCount', count: n })),
  streamText: vi.fn().mockReturnValue({
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Hello ' };
      yield { type: 'text-delta', textDelta: 'world' };
      yield { type: 'finish', finishReason: 'stop', usage: { totalTokens: 50 } };
    })(),
  }),
}));

import { prisma } from '../../lib/prisma.js';
import {
  createConversation,
  listConversations,
  getConversation,
  deleteConversation,
  renameConversation,
  saveUserMessage,
  buildChatStream,
} from '../aiChatService.js';

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

describe('saveUserMessage', () => {
  it('creates a message with role=user', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({ id: 'msg_1', role: 'user', content: 'Hello' });
    const result = await saveUserMessage('conv_1', 'Hello');
    expect(prisma.aIChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: 'conv_1', role: 'user', content: 'Hello' }),
    });
    expect(result.role).toBe('user');
  });
});

describe('buildChatStream', () => {
  it('returns an object with fullStream AsyncIterable', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({
      id: 'conv_1', title: 'Test', userId: 'user_1', formId: 'form_1',
    });
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([]);
    const result = await buildChatStream('conv_1', 'user_1');
    expect(result).toHaveProperty('fullStream');
    expect(typeof result.fullStream[Symbol.asyncIterator]).toBe('function');
  });

  it('accepts an optional currentPageId', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue({
      id: 'conv_1', title: 'Test', userId: 'user_1', formId: 'form_1',
    });
    (prisma.aIChatMessage.findMany as any).mockResolvedValue([]);
    const result = await buildChatStream('conv_1', 'user_1', 'page_2');
    expect(result).toHaveProperty('fullStream');
  });

  it('throws if conversation not found', async () => {
    (prisma.aIChatConversation.findFirst as any).mockResolvedValue(null);
    await expect(buildChatStream('missing', 'user_1')).rejects.toThrow('Conversation not found');
  });
});
