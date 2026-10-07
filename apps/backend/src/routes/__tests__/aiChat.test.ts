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

  it('drops layout fields from the Prisma fallback so the AI snapshot never lists them', async () => {
    vi.mocked(prisma.collaborativeDocument.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.form.findUnique).mockResolvedValueOnce({
      formSchema: {
        pages: [{
          id: 'p1',
          title: 'P1',
          fields: [
            { id: 'g1', type: 'grid_field', columnWidths: [50, 50] },
            { id: 'f1', type: 'text_input_field', label: 'Name', gridId: 'g1', gridColumn: 0 },
            { id: 'f2', type: 'email_field', label: 'Email', gridId: 'g1', gridColumn: 1 },
          ],
        }],
      },
    } as any);

    const { getFormSchema, buildEphemeralContext } = await import('../aiChat.js');
    const schema = await getFormSchema('form-fallback-grid');
    expect(schema.pages[0].fields.map((f: { id: string }) => f.id)).toEqual(['f1', 'f2']);

    const context = buildEphemeralContext(undefined, schema);
    expect(context).toContain('2 fields');
    expect(context).not.toContain('g1');
  });

});

vi.mock('../../services/aiChatService.js', () => ({
  findOwnedConversation: vi.fn().mockResolvedValue({ id: 'conv-1', formId: 'form-1', organizationId: 'org-1' }),
  loadConversationMessages: vi.fn().mockResolvedValue([]),
  saveConversationMessages: vi.fn().mockResolvedValue(undefined),
  autoGenerateTitle: vi.fn(),
  truncateToolResults: vi.fn().mockImplementation((msgs: any[]) => msgs),
  // Phase 1.3: history management — pass-through by default so route tests are unaffected
  pruneToolCallsFromHistory: vi.fn().mockImplementation((msgs: any[]) => msgs),
  summarizeHistoryIfNeeded: vi.fn().mockImplementation((msgs: any[]) => Promise.resolve(msgs)),
  MAX_TOOL_RESULT_CHARS: 8_000,
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

// Permission threading: the route resolves the caller's form permission (full tier only)
// to decide whether the plugin tools are offered to the agent.
vi.mock('../../graphql/resolvers/formSharing.js', () => ({
  checkFormAccess: vi.fn().mockResolvedValue({ hasAccess: true, permission: 'OWNER', form: {} }),
  PermissionLevel: { OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER', NO_ACCESS: 'NO_ACCESS' },
}));

vi.mock('../../lib/formEditAgent.js', () => ({
  createFormEditAgent: vi.fn().mockReturnValue({
    stream: vi.fn(),
    tools: {},
  }),
}));

vi.mock('yjs', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    Doc: vi.fn().mockImplementation(() => ({
      getMap: vi.fn().mockReturnValue({ get: vi.fn() }),
    })),
    applyUpdate: vi.fn(),
  };
});

vi.mock('ai', () => ({
  validateUIMessages: vi.fn().mockImplementation(({ messages }) => Promise.resolve(messages)),
  convertToModelMessages: vi.fn().mockResolvedValue([{ role: 'user', content: 'hi' }]),
  pruneMessages: vi.fn().mockImplementation(({ messages }) => messages), // pass-through
  streamText: vi.fn(),
  createIdGenerator: vi.fn(() => () => 'msg-generated'),
  wrapLanguageModel: vi.fn(({ model }) => model),
  defaultSettingsMiddleware: vi.fn(() => ({})),
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

import {
  aiChatRouter,
  getFormSchema,
  buildEphemeralContext,
  countFields,
  STATIC_SYSTEM_PROMPT,
  QUESTION_SYSTEM_PROMPT,
  SNAPSHOT_FIELD_THRESHOLD,
} from '../aiChat.js';
import { checkAITokenBudget, recordAITokenUsage } from '../../services/aiUsageService.js';
import { createFormEditAgent } from '../../lib/formEditAgent.js';
import { findOwnedConversation, saveConversationMessages, truncateToolResults } from '../../services/aiChatService.js';
import { pruneMessages, validateUIMessages, streamText } from 'ai';
import { requireOrganizationMembership } from '../../middleware/better-auth-middleware.js';
import { checkFormAccess } from '../../graphql/resolvers/formSharing.js';

/** Stand-in for result.pipeUIMessageStreamToResponse: writes the given SSE chunks and ends. */
function pipeChunks(chunks: string[] = []) {
  return vi.fn((res: import('http').ServerResponse) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(chunks.join(''));
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
    vi.mocked(findOwnedConversation).mockResolvedValue({ id: 'conv-1', formId: 'form-1', organizationId: 'org-1' } as any);
    // clearAllMocks keeps queued *Once values; reset so an unconsumed one can't leak into the next test.
    vi.mocked(checkFormAccess)
      .mockReset()
      .mockResolvedValue({ hasAccess: true, permission: 'OWNER', form: {} } as any);
    // Restore streamText default after clearAllMocks wipes it. The route pipes
    // `webResponse.body` with `for await`, so the body must be a real ReadableStream.
    vi.mocked(streamText).mockReturnValue({
      consumeStream: vi.fn(),
      totalUsage: Promise.resolve({ totalTokens: 5 }),
      pipeUIMessageStreamToResponse: pipeChunks(['data: {"type":"start"}\n\n']),
    } as any);
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
    vi.mocked(findOwnedConversation).mockResolvedValue(null);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [] },
      conversationId: 'bad-conv',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(404);
  });

  it('returns 404 when the conversation belongs to a different organization', async () => {
    vi.mocked(findOwnedConversation).mockResolvedValue({ id: 'conv-1', formId: 'form-1', organizationId: 'org-2' } as any);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(404);
    expect(vi.mocked(checkAITokenBudget)).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller lost edit access to the form', async () => {
    vi.mocked(checkFormAccess).mockResolvedValueOnce({ hasAccess: false, permission: 'VIEWER', form: {} } as any);

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'add a text field' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(403);
    expect(vi.mocked(checkFormAccess)).toHaveBeenCalledWith('user-1', 'form-1', 'EDITOR');
    expect(vi.mocked(createFormEditAgent)).not.toHaveBeenCalled();
  });

  it('returns 403 when the form access lookup throws', async () => {
    vi.mocked(checkFormAccess).mockRejectedValueOnce(new Error('Form not found'));

    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(403);
  });

  it('pipes UI message stream through to response', async () => {
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
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

  it('offers plugin tools (canManagePlugins: true) to form owners on complex turns', async () => {
    const { checkFormAccess } = await import('../../graphql/resolvers/formSharing.js');
    vi.mocked(checkFormAccess).mockResolvedValueOnce({ hasAccess: true, permission: 'OWNER', form: {} } as any);
    const streamData = 'data: {"type":"text","value":"ok"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    // "add a webhook..." classifies as complex → full tool tier → permission lookup runs
    const text = 'add a webhook when the form is submitted';
    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: text, parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(checkFormAccess)).toHaveBeenCalledWith('user-1', 'form-1', 'EDITOR');
    expect(vi.mocked(createFormEditAgent)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toolTier: 'full', canManagePlugins: true })
    );
  });

  it('withholds plugin tools (canManagePlugins: false) from non-owners on complex turns', async () => {
    const { checkFormAccess } = await import('../../graphql/resolvers/formSharing.js');
    vi.mocked(checkFormAccess).mockResolvedValueOnce({ hasAccess: true, permission: 'EDITOR', form: {} } as any);
    const streamData = 'data: {"type":"text","value":"ok"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    const text = 'add a webhook when the form is submitted';
    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: text, parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(createFormEditAgent)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ canManagePlugins: false })
    );
  });

  it('withholds plugin tools from owners on simple (non-full-tier) turns', async () => {
    const streamData = 'data: {"type":"text","value":"ok"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
      }),
    };
    (createFormEditAgent as any).mockReturnValue(mockAgent);

    const text = 'add a text field for feedback';
    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: text, parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(createFormEditAgent)).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ toolTier: 'core', canManagePlugins: false })
    );
  });

  it('answers question-intent messages via streamText with a UI message stream, not plain text', async () => {
    // "explain" matches QUESTION_PATTERNS — the turn skips the tool agent.
    const text = 'Can you explain how conditions work?';
    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(res.status).toBe(200);
    expect(vi.mocked(createFormEditAgent)).toHaveBeenCalledTimes(1); // validation tool set only, no agent run
    expect(vi.mocked(streamText)).toHaveBeenCalledWith(expect.objectContaining({ system: QUESTION_SYSTEM_PROMPT }));
    const result = vi.mocked(streamText).mock.results[0].value;
    expect(result.pipeUIMessageStreamToResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ generateMessageId: expect.any(Function), onFinish: expect.any(Function) })
    );
  });

  it('returns 500 when the question stream cannot start', async () => {
    vi.mocked(streamText).mockImplementationOnce(() => { throw new Error('streamText failed'); });

    const text = 'Can you explain how conditions work?';
    const res = await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });
    expect(res.status).toBe(500);
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
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
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
    let capturedOnFinish: ((args: { responseMessage: any }) => Promise<void>) | undefined;
    const totalUsage = Promise.resolve({ totalTokens: 42 });

    (createFormEditAgent as any).mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        totalUsage,
        pipeUIMessageStreamToResponse: vi.fn((res: import('http').ServerResponse, { onFinish }: any) => {
          capturedOnFinish = onFinish;
          res.end();
        }),
      }),
    });

    await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    expect(capturedOnFinish).toBeDefined();
    const responseMessage = { id: 'msg-generated', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] };
    await capturedOnFinish!({ responseMessage });

    // Exactly this turn is persisted: the user message, then the assistant reply.
    expect(vi.mocked(saveConversationMessages)).toHaveBeenCalledWith(
      'conv-1',
      [expect.objectContaining({ id: 'm1', role: 'user' }), responseMessage],
      42
    );
    // message "Hi" classifies as 'simple' intent -> intentToModelTier('simple') === 'nano'
    expect(vi.mocked(recordAITokenUsage)).toHaveBeenCalledWith('org-1', 42, 'nano');
  });

  it('applies truncateToolResults before saving messages in onFinish', async () => {
    let capturedOnFinish: ((args: { responseMessage: any }) => Promise<void>) | undefined;
    const totalUsage = Promise.resolve({ totalTokens: 10 });

    (createFormEditAgent as any).mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        totalUsage,
        pipeUIMessageStreamToResponse: vi.fn((res: import('http').ServerResponse, { onFinish }: any) => {
          capturedOnFinish = onFinish;
          res.end();
        }),
      }),
    });

    await request(app).post('/chat').send({
      message: { id: 'm1', role: 'user', content: 'Hi', parts: [{ type: 'text', text: 'Hi' }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
    });

    await capturedOnFinish!({ responseMessage: { id: 'a1', role: 'assistant', parts: [] } });

    expect(vi.mocked(truncateToolResults)).toHaveBeenCalledWith(expect.any(Array));
    expect(vi.mocked(saveConversationMessages)).toHaveBeenCalled();
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
    vi.mocked(findOwnedConversation).mockResolvedValue({ id: 'conv-1', formId: 'form-1', organizationId: 'org-1' } as any);
  });

  it('calls pruneMessages on converted model messages', async () => {
    const streamData = 'data: {"type":"text","value":"hello"}\n\n';
    const mockAgent = {
      stream: vi.fn().mockResolvedValue({
        consumeStream: vi.fn(),
        pipeUIMessageStreamToResponse: pipeChunks([streamData]),
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

describe('STATIC_SYSTEM_PROMPT', () => {
  it('is byte-stable — contains NO per-turn data (no page id, no form structure)', () => {
    // The whole point of the cache rework: the system prompt must not embed dynamic content.
    expect(STATIC_SYSTEM_PROMPT).not.toMatch(/id:p\d/);
    expect(STATIC_SYSTEM_PROMPT).not.toMatch(/\(\d+f,/);
    expect(STATIC_SYSTEM_PROMPT).not.toContain('Current page id:');
    // Compressed prompt still references the key tools used in workflow rules.
    expect(STATIC_SYSTEM_PROMPT).toContain('updateFields');
    expect(STATIC_SYSTEM_PROMPT).toContain('removeFields');
    expect(STATIC_SYSTEM_PROMPT).toContain('relocateField');
    // Legacy tool names must be gone.
    expect(STATIC_SYSTEM_PROMPT).not.toContain('bulkUpdateFields');
    expect(STATIC_SYSTEM_PROMPT).not.toContain('bulkRemoveFields');
    expect(STATIC_SYSTEM_PROMPT).not.toContain('copyField');
    expect(STATIC_SYSTEM_PROMPT).toContain('<current_context>');
    // Note: 'reorder' is now embedded in the reorder tool description rather than
    // the static system prompt — this is intentional for the compressed prompt design.
  });

  it('contains explicit merge-pages workflow instruction to prevent field data loss', () => {
    // Root cause fix: the AI was calling removePage without relocating fields first,
    // causing all fields on merged pages to be permanently deleted.
    expect(STATIC_SYSTEM_PROMPT).toMatch(/merge|consolidat/i);
    expect(STATIC_SYSTEM_PROMPT).toContain('relocateField');
    // Must explicitly say to move fields BEFORE deleting the page
    expect(STATIC_SYSTEM_PROMPT).toMatch(/relocateField.{0,200}removePage|move.{0,200}fields.{0,200}before.{0,200}delet/is);
  });
});

describe('countFields', () => {
  it('sums fields across all pages', () => {
    const schema = {
      pages: [
        { id: 'p1', fields: [{}, {}, {}] },
        { id: 'p2', fields: [{}, {}] },
        { id: 'p3', fields: [] },
      ],
    };
    expect(countFields(schema)).toBe(5);
  });

  it('returns 0 for an empty form', () => {
    expect(countFields({ pages: [] })).toBe(0);
  });

  it('excludes grid layout fields', () => {
    const schema = {
      pages: [
        {
          id: 'p1',
          fields: [
            { id: 'g1', type: 'grid_field', columnWidths: [50, 50] },
            { id: 'f1', type: 'text_input_field', gridId: 'g1', gridColumn: 0 },
            { id: 'f2', type: 'rich_text_field', gridId: 'g1', gridColumn: 1 },
          ],
        },
      ],
    };
    expect(countFields(schema)).toBe(2);
  });
});

describe('buildEphemeralContext', () => {
  it('emits a full compact snapshot for small forms', () => {
    const schema = {
      pages: [
        { id: 'p1', title: 'Personal Info', fields: [
          { id: 'f1', type: 'text_input_field', label: 'Full Name', required: true },
          { id: 'f2', type: 'email_field', label: 'Email', required: false },
        ] },
        { id: 'p2', title: 'Contact', fields: [] },
      ],
    };
    const ctx = buildEphemeralContext('p1', schema);
    expect(ctx).toContain('<current_context>');
    expect(ctx).toContain('</current_context>');
    expect(ctx).toContain('Current page id: p1');
    expect(ctx).toContain('Form has 2 pages and 2 fields.');
    // compact per-field rows present
    expect(ctx).toContain('f1|text|"Full Name"|req');
    expect(ctx).toContain('f2|email|"Email"|opt');
    expect(ctx).toContain('p2 "Contact" [id:p2]: (empty)');
    // not the large-form hint
    expect(ctx).not.toContain('Large form');
  });

  it('falls back to a page summary (no per-field rows) for large forms', () => {
    const pages = [
      {
        id: 'p1',
        title: 'Big',
        fields: Array.from({ length: SNAPSHOT_FIELD_THRESHOLD + 1 }, (_, i) => ({
          id: `f${i}`, type: 'text_input_field', label: `Field ${i}`, required: false,
        })),
      },
    ];
    const ctx = buildEphemeralContext('p1', { pages });
    expect(ctx).toContain('Large form');
    expect(ctx).toMatch(/p1:"Big"\(\d+f,id:p1\)/);
    // no per-field pipe rows
    expect(ctx).not.toContain('|text|"Field 0"|');
  });

  it('handles an empty form and a null page title and singular counts', () => {
    expect(buildEphemeralContext(undefined, { pages: [] })).toContain('The form is empty');

    const ctx = buildEphemeralContext(undefined, {
      pages: [{ id: 'p9', title: null, fields: [{ id: 'f1', type: 'text_input_field', label: 'X', required: false }] }],
    });
    expect(ctx).toContain('The user is on the first page.');
    expect(ctx).toContain('Form has 1 page and 1 field.');
    expect(ctx).toContain('p1 "Page 1" [id:p9]');
  });
});
