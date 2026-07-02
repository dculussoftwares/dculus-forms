// apps/backend/src/services/__tests__/aiChatHistory.test.ts
import { describe, it, expect, vi } from 'vitest';
import type { UIMessage } from 'ai';

// ---------- helpers ----------
function makeUserMsg(text: string, id = `u-${Math.random()}`): UIMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] } as any;
}
function makeAssistantTextMsg(text: string, id = `a-${Math.random()}`): UIMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] } as any;
}
function makeAssistantToolMsg(toolNames: string[], textAfter = '', id = `a-${Math.random()}`): UIMessage {
  const parts: any[] = toolNames.map((name) => ({
    type: 'tool-invocation',
    toolInvocation: { toolName: name, state: 'result', args: {}, result: {} },
  }));
  if (textAfter) parts.push({ type: 'text', text: textAfter });
  return { id, role: 'assistant', parts } as any;
}

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateText: vi.fn().mockResolvedValue({ text: 'User added 3 fields and renamed page 1.' }) };
});
vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../../lib/ai.js', () => ({
  getFastModel: vi.fn().mockReturnValue('mock-nano'),
  getPrimaryModel: vi.fn().mockReturnValue('mock-mini'),
  getRoutedModel: vi.fn().mockReturnValue('mock-mini'),
  getModelForIntent: vi.fn().mockReturnValue('mock-mini'),
  getModelIdForIntent: vi.fn().mockReturnValue('gpt-5.4-nano'),
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

const { pruneToolCallsFromHistory, summarizeHistoryIfNeeded } = await import('../aiChatService.js');

describe('pruneToolCallsFromHistory', () => {
  it('returns messages unchanged when 4 or fewer messages', () => {
    const msgs = [makeUserMsg('hi'), makeAssistantTextMsg('hello')];
    const result = pruneToolCallsFromHistory(msgs);
    expect(result).toBe(msgs);
  });

  it('keeps the last 4 messages verbatim', () => {
    const msgs = [
      makeUserMsg('t1'), makeAssistantToolMsg(['addField'], 'Done'),
      makeUserMsg('t2'), makeAssistantToolMsg(['updateFields'], 'Updated'),
      makeUserMsg('t3'), makeAssistantTextMsg('done'),
    ];
    const result = pruneToolCallsFromHistory(msgs);
    expect(result[2]).toBe(msgs[2]);
    expect(result[3]).toBe(msgs[3]);
    expect(result[4]).toBe(msgs[4]);
    expect(result[5]).toBe(msgs[5]);
  });

  it('replaces tool-invocation parts in old messages with annotation', () => {
    const msgs = [
      makeUserMsg('t1'), makeAssistantToolMsg(['addField', 'reorder'], 'ok'),
      makeUserMsg('t2'), makeAssistantTextMsg('good'),
      makeUserMsg('t3'), makeAssistantTextMsg('fine'),
    ];
    const result = pruneToolCallsFromHistory(msgs);
    const parts = result[1].parts as any[];
    expect(parts.some((p: any) => p.type === 'tool-invocation')).toBe(false);
    const texts = parts.filter((p: any) => p.type === 'text').map((p: any) => p.text);
    expect(texts.join(' ')).toMatch(/addField|used tools/i);
  });

  it('preserves user messages in old window unchanged', () => {
    const msgs = [
      makeUserMsg('important'), makeAssistantToolMsg(['addField']),
      makeUserMsg('t2'), makeAssistantTextMsg('r'),
      makeUserMsg('t3'), makeAssistantTextMsg('r'),
    ];
    const result = pruneToolCallsFromHistory(msgs);
    expect(result[0]).toBe(msgs[0]);
  });

  it('preserves text-only assistant messages in old window unchanged', () => {
    const msgs = [
      makeUserMsg('t1'), makeAssistantTextMsg('text only'),
      makeUserMsg('t2'), makeAssistantTextMsg('r'),
      makeUserMsg('t3'), makeAssistantTextMsg('r'),
    ];
    const result = pruneToolCallsFromHistory(msgs);
    expect(result[1]).toBe(msgs[1]);
  });
});

describe('summarizeHistoryIfNeeded', () => {
  it('returns original messages when user turns at or below threshold', async () => {
    const msgs = [
      makeUserMsg('t1'), makeAssistantTextMsg('r1'),
      makeUserMsg('t2'), makeAssistantTextMsg('r2'),
      makeUserMsg('t3'), makeAssistantTextMsg('r3'),
    ];
    const result = await summarizeHistoryIfNeeded(msgs);
    expect(result).toBe(msgs);
  });

  it('injects a summary message when user turns exceed threshold', async () => {
    const msgs = [
      makeUserMsg('t1'), makeAssistantTextMsg('r1'),
      makeUserMsg('t2'), makeAssistantTextMsg('r2'),
      makeUserMsg('t3'), makeAssistantTextMsg('r3'),
      makeUserMsg('t4'), makeAssistantTextMsg('r4'),
      makeUserMsg('t5'), makeAssistantTextMsg('r5'),
    ];
    const result = await summarizeHistoryIfNeeded(msgs);
    expect(result.length).toBeLessThan(msgs.length);
    expect(result[0].role).toBe('user');
    const text = (result[0].parts as any[])[0].text as string;
    expect(text).toContain('[Earlier conversation summary:');
  });

  it('summary message contains AI-generated text', async () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? makeUserMsg(`user ${i}`) : makeAssistantTextMsg(`reply ${i}`)
    );
    const result = await summarizeHistoryIfNeeded(msgs);
    const summaryText = (result[0].parts as any[])[0].text as string;
    expect(summaryText).toContain('User added 3 fields');
  });

  it('returns full history if generateText throws', async () => {
    const { generateText } = await import('ai');
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API down'));
    const msgs = Array.from({ length: 10 }, (_, i) =>
      i % 2 === 0 ? makeUserMsg(`user ${i}`) : makeAssistantTextMsg(`reply ${i}`)
    );
    const result = await summarizeHistoryIfNeeded(msgs);
    expect(result).toBe(msgs);
  });
});
