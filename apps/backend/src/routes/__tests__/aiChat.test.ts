import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/aiChatService.js', () => ({
  saveUserMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
  getConversation: vi.fn().mockResolvedValue({ messageCount: 1, formId: 'form-1' }),
  buildChatStream: vi.fn(),
  saveAssistantMessage: vi.fn().mockResolvedValue({ id: 'msg-2' }),
  autoGenerateTitle: vi.fn(),
}));

vi.mock('../../services/aiUsageService.js', () => ({
  checkAITokenBudget: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 50000 }),
  recordAITokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn().mockResolvedValue({}),
  createBetterAuthContext: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, isAuthenticated: true }),
}));

import { aiChatRouter } from '../aiChat.js';
import { buildChatStream, saveAssistantMessage } from '../../services/aiChatService.js';
import { checkAITokenBudget } from '../../services/aiUsageService.js';

function makeAsyncIterable(parts: object[]): AsyncIterable<object> {
  return { [Symbol.asyncIterator]: async function* () { for (const p of parts) yield p; } };
}

describe('POST /chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', aiChatRouter);
    vi.clearAllMocks();
    // Restore default budget mock after any test that overrides it
    (checkAITokenBudget as any).mockResolvedValue({ allowed: true, used: 0, limit: 50000 });
  });

  it('streams text-delta chunks as NDJSON', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'text-delta', textDelta: 'Hello ' },
        { type: 'text-delta', textDelta: 'world' },
        { type: 'finish', totalUsage: { totalTokens: 42 } },
      ]),
    });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/ndjson/);
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'text', delta: 'Hello ' });
    expect(lines[1]).toEqual({ type: 'text', delta: 'world' });
    expect(lines[2]).toMatchObject({ type: 'done' });
  });

  it('streams operation chunks', async () => {
    const op = { type: 'ADD_FIELD', pageId: 'page-1', fieldType: 'text', label: 'Name', required: true, insertAfterFieldId: null, placeholder: null, options: null };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a name field' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
    expect(lines[1]).toMatchObject({ type: 'done', messageId: 'msg-2' });
  });

  it('returns error chunk when token budget exceeded', async () => {
    (checkAITokenBudget as any).mockResolvedValue({ allowed: false, used: 50000, limit: 50000 });

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0].type).toBe('error');
    expect(lines[0].error).toMatch(/token limit/i);
  });

  it('returns error chunk when stream throws', async () => {
    (buildChatStream as any).mockRejectedValue(new Error('AI unavailable'));

    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Hi' });

    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0].type).toBe('error');
  });

  it('emits status chunk for addPage tool call', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-call', toolName: 'addPage' },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a page' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'status', text: 'Adding page...' });
  });

  it('emits status chunk for removePage tool call', async () => {
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-call', toolName: 'removePage' },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Remove page 2' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'status', text: 'Removing page...' });
  });

  it('streams ADD_PAGE operation chunk', async () => {
    const op = { type: 'ADD_PAGE', title: 'Step 2', insertAfterPageId: null };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Add a page' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
  });

  it('streams REMOVE_PAGE operation chunk', async () => {
    const op = { type: 'REMOVE_PAGE', pageId: 'page-2' };
    (buildChatStream as any).mockResolvedValue({
      fullStream: makeAsyncIterable([
        { type: 'tool-result', output: op },
        { type: 'finish', totalUsage: { totalTokens: 10 } },
      ]),
    });
    const res = await request(app)
      .post('/chat')
      .send({ conversationId: 'conv-1', organizationId: 'org-1', content: 'Remove page 2' });
    const lines = res.text.trim().split('\n').map((l: string) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'operation', op });
  });
});
