import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('schema cache', () => {
  it('returns cached schema on second call within TTL', async () => {
    const { getFormSchema } = await import('../aiChat.js');
    // first call
    const s1 = await getFormSchema('form-1');
    // second call — prisma.form.findUnique should NOT be called again
    const s2 = await getFormSchema('form-1');
    expect(s1).toBe(s2); // same reference = cache hit
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
  convertToModelMessages: vi.fn().mockResolvedValue([]),
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

import { aiChatRouter } from '../aiChat.js';
import { checkAITokenBudget } from '../../services/aiUsageService.js';
import { createFormEditAgent } from '../../lib/formEditAgent.js';
import { getConversation } from '../../services/aiChatService.js';

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
});
