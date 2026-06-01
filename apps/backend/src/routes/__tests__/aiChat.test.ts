import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../../lib/prisma.js';

describe('schema cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached schema on second call within TTL', async () => {
    const { getFormSchema } = await import('../aiChat.js');
    // first call
    const s1 = await getFormSchema('form-1');
    // second call — prisma.form.findUnique should NOT be called again
    const s2 = await getFormSchema('form-1');
    expect(s1).toBe(s2); // same reference = cache hit
    expect(vi.mocked(prisma.form.findUnique)).toHaveBeenCalledTimes(1); // cache prevented second call
  });

  it('returns empty pages when Y.js doc has no pages array', async () => {
    vi.mocked(prisma.collaborativeDocument.findFirst).mockResolvedValueOnce({
      state: new Uint8Array([0]) as any,
    } as any);

    const { getFormSchema } = await import('../aiChat.js');
    // Use a distinct formId to bypass TTL cache from previous test
    const schema = await getFormSchema('form-yjs-no-pages');
    expect(schema.pages).toEqual([]);
  });

  it('returns pages from Prisma when Y.js doc has no state', async () => {
    vi.mocked(prisma.collaborativeDocument.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.form.findUnique).mockResolvedValueOnce({
      formSchema: { pages: [{ id: 'p1', title: 'P1', fields: [] }] },
    } as any);

    const { getFormSchema } = await import('../aiChat.js');
    const schema = await getFormSchema('form-no-collab-doc');
    expect(schema.pages).toHaveLength(1);
  });

  it('falls back to Prisma when Y.js parse throws', async () => {
    vi.mocked(prisma.collaborativeDocument.findFirst).mockResolvedValueOnce({
      state: new Uint8Array([255, 255]) as any, // invalid Y.js state
    } as any);
    vi.mocked(prisma.form.findUnique).mockResolvedValueOnce({
      formSchema: { pages: [{ id: 'p1', title: 'Page 1', fields: [] }] },
    } as any);

    // Force applyUpdate to throw to exercise the catch/fallback
    const { applyUpdate } = await import('yjs');
    vi.mocked(applyUpdate).mockImplementationOnce(() => { throw new Error('bad ydoc'); });

    const { getFormSchema } = await import('../aiChat.js');
    const schema = await getFormSchema('form-yjs-throw');
    expect(schema.pages).toHaveLength(1);
  });
});

vi.mock('../../services/aiChatService.js', () => ({
  getConversation: vi.fn().mockResolvedValue({ id: 'conv-1', formId: 'form-1', messageCount: 2 }),
  loadConversationMessages: vi.fn().mockResolvedValue([]),
  saveConversationMessages: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../lib/aiFormEditTools.js', () => ({
  createFormEditTools: vi.fn().mockReturnValue({}),
}));

vi.mock('../../lib/formEditAgent.js', () => ({
  createFormEditAgent: vi.fn().mockReturnValue({
    stream: vi.fn(),
  }),
}));

vi.mock('yjs', () => ({
  Doc: vi.fn().mockImplementation(() => ({
    getMap: vi.fn().mockReturnValue({ get: vi.fn() }),
  })),
  applyUpdate: vi.fn(),
}));

vi.mock('ai', () => ({
  validateUIMessages: vi.fn().mockImplementation(({ messages }) => Promise.resolve(messages)),
  convertToModelMessages: vi.fn().mockResolvedValue([{ role: 'user', content: 'hi' }]),
  pruneMessages: vi.fn().mockImplementation(({ messages }) => messages), // pass-through
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    collaborativeDocument: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    form: {
      findUnique: vi.fn().mockResolvedValue({ formSchema: { pages: [] } }),
    },
  },
}));

import { aiChatRouter, getFormSchema, buildSystemPrompt } from '../aiChat.js';
import { checkAITokenBudget, recordAITokenUsage } from '../../services/aiUsageService.js';
import { createFormEditAgent } from '../../lib/formEditAgent.js';
import { getConversation, saveConversationMessages } from '../../services/aiChatService.js';
import { pruneMessages, validateUIMessages } from 'ai';
import { requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';

function makeUIMessageStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('POST /chat', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', aiChatRouter);
    vi.clearAllMocks();
    (checkAITokenBudget as any).mockResolvedValue({ allowed: true, used: 0, limit: 50000 });
    (getConversation as any).mockResolvedValue({ id: 'conv-1', formId: 'form-1', messageCount: 2 });
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = await import('../../middleware/better-auth-middleware.js');
    (requireAuth as any).mockImplementationOnce(() => { throw new Error('Unauthorized'); });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when required fields missing', async () => {
    const res = await request(app).post('/chat').send({ organizationId: 'org-1' });
    expect(res.status).toBe(400);
  });

  it('returns 403 when org membership check fails', async () => {
    vi.mocked(requireOrganizationMembership).mockRejectedValueOnce(new Error('Not a member'));

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'wrong-org',
    });
    expect(res.status).toBe(403);
  });

  it('returns 402 when token budget exceeded', async () => {
    (checkAITokenBudget as any).mockResolvedValue({ allowed: false, used: 50000, limit: 50000 });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(402);
    expect(res.body.error).toMatch(/token limit/i);
  });

  it('returns 404 when conversation not found', async () => {
    (getConversation as any).mockResolvedValue(null);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [] },
      conversationId: 'bad-conv',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(404);
  });

  it('pipes UI message stream through to response', async () => {
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        toUIMessageStreamResponse: vi.fn().mockReturnValue(makeUIMessageStreamResponse([streamData])),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(mockAgent.stream).toHaveBeenCalled();
  });

  it('returns 500 when agent stream throws', async () => {
    (createFormEditAgent as any).mockReturnValue({
      stream: vi.fn().mockRejectedValue(new Error('stream exploded')),
    });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/AI processing failed/i);
  });

  it('falls back to unvalidated messages when validateUIMessages throws', async () => {
    vi.mocked(validateUIMessages).mockRejectedValueOnce(new Error('invalid shape'));
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    (createFormEditAgent as any).mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        toUIMessageStreamResponse: vi.fn().mockReturnValue(makeUIMessageStreamResponse([streamData])),
      }),
    });

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
  });

  it('invokes onFinish to save messages and record usage', async () => {
    let capturedOnFinish: ((args: { messages: any[] }) => Promise<void>) | undefined;
    const totalUsage = Promise.resolve({ totalTokens: 42 });

    (createFormEditAgent as any).mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        totalUsage,
        toUIMessageStreamResponse: vi.fn().mockImplementation(({ onFinish }: any) => {
          capturedOnFinish = onFinish;
          return makeUIMessageStreamResponse([]);
        }),
      }),
    });

    await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(capturedOnFinish).toBeDefined();
    await capturedOnFinish!({ messages: [{ id: 'a1', role: 'assistant', content: 'Hi', parts: [] }] });

    expect(vi.mocked(saveConversationMessages)).toHaveBeenCalled();
    expect(vi.mocked(recordAITokenUsage)).toHaveBeenCalledWith('org-1', 42);
  });
});

describe('context pruning', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', aiChatRouter);
    vi.clearAllMocks();
    (checkAITokenBudget as any).mockResolvedValue({ allowed: true, used: 0, limit: 50000 });
    (getConversation as any).mockResolvedValue({ id: 'conv-1', formId: 'form-1', messageCount: 2 });
  });

  it('calls pruneMessages on converted model messages', async () => {
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        toUIMessageStreamResponse: vi.fn().mockReturnValue(
          makeUIMessageStreamResponse([streamData])
        ),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(pruneMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: 'all',
        toolCalls: 'before-last-5-messages',
        emptyMessages: 'remove',
      })
    );
  });
});

describe('POST /invalidate-schema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 204 and evicts the cache entry when authenticated', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiChatRouter);

    // prime the cache first
    await getFormSchema('form-evict-me');

    const res = await request(app)
      .post('/api/ai/invalidate-schema')
      .send({ formId: 'form-evict-me' });

    expect(res.status).toBe(204);
    // cache was cleared — next getFormSchema call goes to Prisma again
    const callsBefore = vi.mocked(prisma.form.findUnique).mock.calls.length;
    await getFormSchema('form-evict-me');
    expect(vi.mocked(prisma.form.findUnique).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('returns 401 when unauthenticated', async () => {
    const { requireAuth } = await import('../../middleware/better-auth-middleware.js');
    vi.mocked(requireAuth).mockImplementationOnce(() => { throw new Error('Unauthorized'); });

    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiChatRouter);

    const res = await request(app)
      .post('/api/ai/invalidate-schema')
      .send({ formId: 'form-1' });

    expect(res.status).toBe(401);
  });
});

describe('buildSystemPrompt', () => {
  it('emits compact schema line instead of JSON block', () => {
    const schema = {
      pages: [
        { id: 'p1', title: 'Personal Info', fields: [{}, {}, {}, {}, {}] },
        { id: 'p2', title: 'Contact',       fields: [{}, {}, {}, {}, {}, {}, {}, {}] },
      ],
    };
    const prompt = buildSystemPrompt(undefined, schema);
    // compact format present
    expect(prompt).toMatch(/p1:"Personal Info"\(5f,id:p1\)/);
    expect(prompt).toMatch(/p2:"Contact"\(8f,id:p2\)/);
    // old JSON format absent
    expect(prompt).not.toContain('"pageNumber"');
    expect(prompt).not.toContain('JSON');
  });

  it('handles pages with no title using fallback', () => {
    const schema = { pages: [{ id: 'p9', title: null, fields: [] }] };
    const prompt = buildSystemPrompt(undefined, schema);
    expect(prompt).toMatch(/p1:"Page 1"\(0f,id:p9\)/);
  });

  it('returns empty schema context when form has no pages', () => {
    const prompt = buildSystemPrompt(undefined, { pages: [] });
    expect(prompt).not.toContain('Form structure');
  });

  it('uses singular "page" when form has exactly 1 page', () => {
    const schema = { pages: [{ id: 'p1', title: 'Only Page', fields: [] }] };
    const prompt = buildSystemPrompt(undefined, schema);
    expect(prompt).toMatch(/The form has 1 page[^s]/);
  });

  it('includes currentPageId context when provided', () => {
    const schema = { pages: [{ id: 'page-abc', title: 'Page 1', fields: [] }] };
    const prompt = buildSystemPrompt('page-abc', schema);
    expect(prompt).toContain('page-abc');
  });
});
