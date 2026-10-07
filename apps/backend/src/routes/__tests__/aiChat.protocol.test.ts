/**
 * Wire-protocol contract for POST /chat, exercised with the REAL AI SDK and a mock model.
 *
 * The route tests in aiChat.test.ts mock the `ai` package, so they cannot catch a response the
 * browser can't read. These tests parse the HTTP body exactly the way useChat's
 * DefaultChatTransport does (SSE → uiMessageChunkSchema → readUIMessageStream) and assert on the
 * assistant message the user would actually see, plus what gets persisted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';

// The provider-level stream part type, derived so this test needs no direct @ai-sdk/provider dep.
type LanguageModelV3StreamPart =
  Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer P> ? P : never;

const model = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('../../lib/ai.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/ai.js')>()),
  getModelForIntent: () => model.current,
  getRoutedModel: () => model.current,
}));

vi.mock('../../services/aiChatService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/aiChatService.js')>()),
  findOwnedConversation: vi.fn().mockResolvedValue({ id: 'conv-1', formId: 'form-1', organizationId: 'org-1' }),
  loadConversationMessages: vi.fn().mockResolvedValue([]),
  saveConversationMessages: vi.fn().mockResolvedValue(undefined),
  autoGenerateTitle: vi.fn(),
}));

vi.mock('../../services/aiUsageService.js', () => ({
  checkAITokenBudget: vi.fn().mockResolvedValue({ allowed: true, used: 0, limit: 50_000 }),
  recordAITokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/better-auth-middleware.js', () => ({
  requireAuth: vi.fn(),
  requireOrganizationMembership: vi.fn().mockResolvedValue({}),
  createBetterAuthContext: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, isAuthenticated: true }),
}));

vi.mock('../../graphql/resolvers/formSharing.js', () => ({
  checkFormAccess: vi.fn().mockResolvedValue({ hasAccess: true, permission: 'EDITOR', form: {} }),
  PermissionLevel: { OWNER: 'OWNER', EDITOR: 'EDITOR', VIEWER: 'VIEWER', NO_ACCESS: 'NO_ACCESS' },
}));

vi.mock('../../services/responseService.js', () => ({
  countResponsesPerField: vi.fn().mockResolvedValue({}),
  countResponsesReferencingAnyField: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    collaborativeDocument: { findFirst: vi.fn().mockResolvedValue(null) },
    form: {
      findUnique: vi.fn().mockResolvedValue({
        formSchema: {
          pages: [{ id: 'page-1', title: 'Details', fields: [{ id: 'f-name', type: 'text_input_field', label: 'Name' }] }],
        },
      }),
    },
  },
}));

import { aiChatRouter } from '../aiChat.js';
import { saveConversationMessages } from '../../services/aiChatService.js';
import { recordAITokenUsage } from '../../services/aiUsageService.js';

const USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

function textStep(id: string, ...deltas: string[]): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id },
    ...deltas.map((delta) => ({ type: 'text-delta' as const, id, delta })),
    { type: 'text-end', id },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: USAGE },
  ];
}

function toolCallStep(toolName: string, input: object): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage: USAGE },
  ];
}

/** A mock model that streams the given steps in order, one per model call. */
function mockModel(...steps: LanguageModelV3StreamPart[][]) {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async () => ({ stream: convertArrayToReadableStream(steps[call++] ?? steps.at(-1)!) }),
  });
}

/** Decode the HTTP body the same way the browser's DefaultChatTransport does. */
async function readAssistantMessage(body: string): Promise<UIMessage> {
  const chunks = parseJsonEventStream({
    stream: new Response(body).body!,
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        if (!chunk.success) throw chunk.error;
        controller.enqueue(chunk.value as UIMessageChunk);
      },
    })
  );
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({ stream: chunks })) last = message;
  if (!last) throw new Error('response contained no UI message');
  return last;
}

function sendChat(text: string) {
  const app = express();
  app.use(express.json());
  app.use('/', aiChatRouter);
  return request(app)
    .post('/chat')
    .buffer(true)
    .parse((res, done) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => done(null, data));
    })
    .send({
      message: { id: 'user-msg-1', role: 'user', parts: [{ type: 'text', text }] },
      conversationId: 'conv-1',
      organizationId: 'org-1',
      currentPageId: 'page-1',
    });
}

/** onFinish runs after the body is flushed; wait for the turn to be persisted. */
async function persistedTurn(): Promise<UIMessage[]> {
  await vi.waitFor(() => expect(saveConversationMessages).toHaveBeenCalled());
  return vi.mocked(saveConversationMessages).mock.calls[0][1];
}

describe('POST /chat wire protocol (real AI SDK, mock model)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('streams question answers as a UI message stream the chat panel can render', async () => {
    model.current = mockModel(textStep('t1', 'Conditions ', 'show or hide fields.'));

    const res = await sendChat('Can you explain how conditions work?');

    expect(res.status).toBe(200);
    expect(res.headers['x-vercel-ai-ui-message-stream']).toBe('v1');
    const assistant = await readAssistantMessage(res.body);
    expect(assistant.parts).toContainEqual(
      expect.objectContaining({ type: 'text', text: 'Conditions show or hide fields.' })
    );

    const [user, persisted] = await persistedTurn();
    expect(user).toMatchObject({ id: 'user-msg-1', role: 'user' });
    expect(persisted.id).toMatch(/^msg-/);
    expect(persisted.id).toBe(assistant.id); // client and DB agree on the message id
    expect(recordAITokenUsage).toHaveBeenCalledWith('org-1', 120, 'nano');
  });

  it('runs the tool loop and streams typed tool parts followed by the reply', async () => {
    const addField = {
      pageId: 'page-1',
      insertAfterFieldId: 'f-name',
      fieldType: 'email',
      label: 'Email',
      required: true,
      placeholder: null,
      options: null,
    };
    model.current = mockModel(toolCallStep('addField', addField), textStep('t2', 'Added **Email**.'));

    const res = await sendChat('add an email field');

    expect(res.status).toBe(200);
    const assistant = await readAssistantMessage(res.body);
    const toolPart = assistant.parts.find((p) => p.type === 'tool-addField');
    expect(toolPart).toMatchObject({ state: 'output-available', output: { type: 'ADD_FIELD', ...addField } });
    expect(assistant.parts.at(-1)).toMatchObject({ type: 'text', text: 'Added **Email**.' });

    const [, persisted] = await persistedTurn();
    expect(persisted.parts.some((p) => p.type === 'tool-addField')).toBe(true);
  });
});
