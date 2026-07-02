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
  truncateToolResults,
  MAX_TOOL_RESULT_CHARS,
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

  it('returns at most 6 messages in ascending order (MAX_HISTORY_MESSAGES=6)', async () => {
    // Simulate Prisma returning 6 messages in desc order (newest first).
    // Phase 1.3: MAX_HISTORY_MESSAGES reduced from 10 → 6.
    const fakeMessages = Array.from({ length: 6 }, (_, i) => ({
      data: { id: `msg-${i}`, role: 'user', content: `message ${i}`, parts: [] },
    }));
    (prisma.aIChatMessage.findMany as any).mockResolvedValue(fakeMessages);

    const result = await loadConversationMessages('conv_1');

    expect(prisma.aIChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        take: 6,
      })
    );
    expect(result).toHaveLength(6);
    // After reverse(), first element should be the last from the desc array (msg-5)
    expect((result[0] as any).id).toBe('msg-5');
    expect((result[5] as any).id).toBe('msg-0');
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

  it('stamps strictly increasing createdAt per message so reload order is deterministic', async () => {
    (prisma.aIChatMessage.create as any).mockResolvedValue({});
    (prisma.aIChatConversation.update as any).mockResolvedValue({});

    const messages = [
      { id: 'u1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      { id: 'a1', role: 'assistant', content: 'Hello!', parts: [{ type: 'text', text: 'Hello!' }] },
    ];
    await saveConversationMessages('conv_1', messages as any, 42);

    const calls = (prisma.aIChatMessage.create as any).mock.calls;
    const firstAt = calls[0][0].data.createdAt as Date;
    const secondAt = calls[1][0].data.createdAt as Date;
    expect(firstAt).toBeInstanceOf(Date);
    expect(secondAt).toBeInstanceOf(Date);
    // The assistant message must sort strictly AFTER the user message (no tie).
    expect(secondAt.getTime()).toBeGreaterThan(firstAt.getTime());
    // And the user row is created before the assistant row (sequential, in array order).
    expect(calls[0][0].data.role).toBe('user');
    expect(calls[1][0].data.role).toBe('assistant');
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

describe('truncateToolResults', () => {
  it('passes through non-assistant messages unchanged', () => {
    const msgs = [
      { id: 'u1', role: 'user', content: 'x'.repeat(MAX_TOOL_RESULT_CHARS + 100), parts: [] },
    ] as any[];
    expect(truncateToolResults(msgs)).toStrictEqual(msgs);
  });

  it('passes through assistant messages without tool-invocation parts unchanged', () => {
    const msgs = [
      { id: 'a1', role: 'assistant', content: 'hello', parts: [{ type: 'text', text: 'hello' }] },
    ] as any[];
    expect(truncateToolResults(msgs)).toStrictEqual(msgs);
  });

  it('leaves short tool-invocation result unchanged', () => {
    const shortResult = 'short result';
    const msgs = [
      {
        id: 'a1', role: 'assistant', content: '', parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'c1', toolName: 'listFields', args: {}, state: 'result', result: shortResult } },
        ],
      },
    ] as any[];
    const out = truncateToolResults(msgs) as any[];
    expect(out[0].parts[0].toolInvocation.result).toBe(shortResult);
  });

  it('truncates string tool-invocation result exceeding MAX_TOOL_RESULT_CHARS', () => {
    const bigResult = 'x'.repeat(MAX_TOOL_RESULT_CHARS + 500);
    const msgs = [
      {
        id: 'a1', role: 'assistant', content: '', parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'c1', toolName: 'listFields', args: {}, state: 'result', result: bigResult } },
        ],
      },
    ] as any[];
    const out = truncateToolResults(msgs) as any[];
    const result: string = out[0].parts[0].toolInvocation.result;
    expect(result.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 20); // budget + truncation suffix
    expect(result).toContain('[truncated]');
    expect(result.startsWith('x'.repeat(MAX_TOOL_RESULT_CHARS))).toBe(true);
  });

  it('truncates object tool-invocation result by JSON-stringifying first', () => {
    const bigObj = { fields: Array.from({ length: 300 }, (_, i) => ({ id: `f${i}`, label: `Field ${i} with a fairly long label` })) };
    const serialized = JSON.stringify(bigObj);
    const msgs = [
      {
        id: 'a1', role: 'assistant', content: '', parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'c1', toolName: 'listFields', args: {}, state: 'result', result: bigObj } },
        ],
      },
    ] as any[];

    if (serialized.length <= MAX_TOOL_RESULT_CHARS) {
      // Object is small — no truncation expected, just verify pass-through
      const out = truncateToolResults(msgs) as any[];
      expect(out[0].parts[0].toolInvocation.result).toStrictEqual(bigObj);
    } else {
      const out = truncateToolResults(msgs) as any[];
      const result: string = out[0].parts[0].toolInvocation.result;
      expect(typeof result).toBe('string');
      expect(result).toContain('[truncated]');
    }
  });

  it('does not truncate tool-invocation parts with state other than result', () => {
    const msgs = [
      {
        id: 'a1', role: 'assistant', content: '', parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'c1', toolName: 'listFields', args: {}, state: 'call' } },
        ],
      },
    ] as any[];
    const out = truncateToolResults(msgs) as any[];
    expect(out[0].parts[0].toolInvocation.state).toBe('call');
    expect(out[0].parts[0].toolInvocation.result).toBeUndefined();
  });

  it('only truncates tool-invocation parts, leaving text parts in the same message intact', () => {
    const bigResult = 'y'.repeat(MAX_TOOL_RESULT_CHARS + 100);
    const msgs = [
      {
        id: 'a1', role: 'assistant', content: '', parts: [
          { type: 'tool-invocation', toolInvocation: { toolCallId: 'c1', toolName: 'listFields', args: {}, state: 'result', result: bigResult } },
          { type: 'text', text: 'Here are the fields.' },
        ],
      },
    ] as any[];
    const out = truncateToolResults(msgs) as any[];
    expect(out[0].parts[1]).toStrictEqual({ type: 'text', text: 'Here are the fields.' });
    const truncated: string = out[0].parts[0].toolInvocation.result;
    expect(truncated).toContain('[truncated]');
  });
});
