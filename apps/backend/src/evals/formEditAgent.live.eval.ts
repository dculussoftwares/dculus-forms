/**
 * Live evals for the AI form-editing chat: each case sends one user message through the same
 * routing, prompts and tools as POST /chat, then grades the tool calls and the reply text.
 *
 * Opt-in — needs AI_PRIMARY_* and AI_FAST_* in apps/backend/.env:
 *   pnpm --filter backend eval:ai
 *
 * Tools only echo operations (the browser applies them to Y.js), so nothing here writes data.
 */
import { describe, it, expect, vi } from 'vitest';
import { generateText, type ModelMessage } from 'ai';
import { createFormEditAgent } from '../lib/formEditAgent.js';
import { getModelForIntent } from '../lib/ai.js';
import { classifyIntent, intentToModelTier, intentToToolTier } from '../lib/intentClassifier.js';
import { STATIC_SYSTEM_PROMPT, QUESTION_SYSTEM_PROMPT, buildEphemeralContext } from '../routes/aiChat.js';

// The route module pulls in auth and DB layers at import time; the agent itself never needs them.
vi.mock('../middleware/better-auth-middleware.js', () => ({}));
vi.mock('../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../services/responseService.js', () => ({
  countResponsesPerField: async () => ({}),
  countResponsesReferencingAnyField: async () => 0,
}));

const configured = ['AI_PRIMARY_BASE_URL', 'AI_PRIMARY_API_KEY', 'AI_FAST_BASE_URL', 'AI_FAST_API_KEY'].every((key) =>
  Boolean(process.env[key])
);

const SCHEMA = {
  pages: [
    {
      id: 'page-1',
      title: 'About you',
      fields: [
        { id: 'f-name', type: 'text_input_field', label: 'Full name', required: true },
        { id: 'f-age', type: 'number_field', label: 'Age', required: false },
        { id: 'f-contact', type: 'radio_field', label: 'Contact method', required: true, options: ['Email', 'Phone'] },
        { id: 'f-phone', type: 'text_input_field', label: 'Phone', required: false },
      ],
    },
    { id: 'page-2', title: 'Feedback', fields: [{ id: 'f-comments', type: 'text_area_field', label: 'Comments', required: false }] },
  ],
};

interface ToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
}

interface Turn {
  intent: ReturnType<typeof classifyIntent>;
  calls: ToolCall[];
  outputs: Record<string, unknown>;
  text: string;
}

/** Mirrors POST /chat: classify → (question: no tools) | (agent with the routed tool tier). */
async function runTurn(message: string): Promise<Turn> {
  const intent = classifyIntent(message);
  const messages: ModelMessage[] = [
    { role: 'user', content: message },
    { role: 'user', content: buildEphemeralContext('page-1', SCHEMA) },
  ];

  if (intent === 'question') {
    const { text } = await generateText({ model: getModelForIntent(intent), instructions: QUESTION_SYSTEM_PROMPT, messages });
    return { intent, calls: [], outputs: {}, text };
  }

  const agent = createFormEditAgent(SCHEMA, {
    instructions: STATIC_SYSTEM_PROMPT,
    includeReadTools: false, // small form: the snapshot is inline, as in the route
    modelTier: intentToModelTier(intent),
    toolTier: intentToToolTier(intent),
  });
  const result = await agent.generate({ messages });
  const calls: ToolCall[] = result.steps.flatMap((step) =>
    step.toolCalls.flatMap((c) => (c ? [{ toolCallId: c.toolCallId, toolName: c.toolName, input: c.input }] : []))
  );
  const outputs: Record<string, unknown> = {};
  for (const r of result.steps.flatMap((step) => step.toolResults)) {
    if (r) outputs[r.toolCallId] = r.output;
  }
  return { intent, calls, outputs, text: result.text };
}

const callsTo = (turn: Turn, toolName: string) => turn.calls.filter((c) => c.toolName === toolName);

/** Grader shared by every case: the reply must suit the narrow chat panel (system prompt rule 12). */
function expectChatReply(text: string) {
  expect(text.trim().length, 'assistant should confirm in text').toBeGreaterThan(0);
  expect(text.length, 'reply should stay short').toBeLessThanOrEqual(600);
  expect(text, 'no Markdown headings').not.toMatch(/^#{1,6}\s/m);
  expect(text, 'no Markdown tables').not.toMatch(/^\s*\|.*\|\s*$/m);
  expect(text, 'no code blocks').not.toContain('```');
  expect(text, 'no internal ids').not.toMatch(/\b(f-[a-z]+|page-\d)\b/);
}

describe.skipIf(!configured)('form edit agent (live model)', () => {
  it('adds a field at the requested position', async () => {
    const turn = await runTurn('add an email field after Full name');
    const [call] = callsTo(turn, 'addField');
    expect(call?.input).toMatchObject({ fieldType: 'email', pageId: 'page-1', insertAfterFieldId: 'f-name' });
    expectChatReply(turn.text);
  });

  it('updates an existing field instead of adding a new one', async () => {
    const turn = await runTurn('make Phone required');
    expect(callsTo(turn, 'addField')).toHaveLength(0);
    const [call] = callsTo(turn, 'updateFields');
    expect(call?.input).toMatchObject({ fieldIds: ['f-phone'] });
    const { updates } = call?.input as { updates: { required?: boolean; validation?: { required?: boolean } } };
    expect(updates.required ?? updates.validation?.required).toBe(true);
    expectChatReply(turn.text);
  });

  it('proposes deletion and does not claim it already happened', async () => {
    const turn = await runTurn('delete the Age question');
    expect(callsTo(turn, 'removeFields')[0]?.input).toMatchObject({ fieldIds: ['f-age'] });
    expect(turn.text).not.toMatch(/\b(has been|was|is now|successfully) (deleted|removed)\b/i);
    expectChatReply(turn.text);
  });

  it('adds a page and puts the new field on the returned page id', async () => {
    const turn = await runTurn('add a page called Payment with a card number field');
    const [addPage] = callsTo(turn, 'addPage');
    const newPageId = (turn.outputs[addPage?.toolCallId] as { pageId?: string } | undefined)?.pageId;
    expect(newPageId).toBeTruthy();
    expect(callsTo(turn, 'addField').some((c) => (c.input as { pageId: string }).pageId === newPageId)).toBe(true);
    expectChatReply(turn.text);
  });

  it('keys a quiz question with an answer that is one of its options', async () => {
    const turn = await runTurn('add a quiz question asking for the capital of France with 4 options');
    const [call] = callsTo(turn, 'addField');
    const input = call?.input as { fieldType: string; options: string[]; correctAnswers?: string[] };
    expect(input.fieldType).toBe('radio');
    expect(input.correctAnswers).toEqual(['Paris']);
    expect(input.options).toContain('Paris');
    expectChatReply(turn.text);
  });

  it('proposes a field type change for "change X to a dropdown"', async () => {
    const turn = await runTurn('change the Age field to a dropdown');
    expect(callsTo(turn, 'proposeFieldTypeChange')[0]?.input).toMatchObject({ fieldId: 'f-age', newFieldType: 'select' });
    expectChatReply(turn.text);
  });

  it('proposes a show-if condition rule', async () => {
    const turn = await runTurn('show the Phone field only if Contact method is Phone');
    const [call] = callsTo(turn, 'upsertConditionRule');
    expect(call).toBeDefined();
    expect(turn.outputs[call.toolCallId]).toMatchObject({ type: 'PROPOSE_CONDITION_RULE' });
    expectChatReply(turn.text);
  });

  it('moves a field across pages', async () => {
    const turn = await runTurn('move the Phone field to the Feedback page');
    expect(callsTo(turn, 'relocateField')[0]?.input).toMatchObject({ fieldId: 'f-phone', targetPageId: 'page-2', mode: 'move' });
    expectChatReply(turn.text);
  });

  it('answers product questions without tools and without claiming edits', async () => {
    const turn = await runTurn('what field types do you support?');
    expect(turn.intent).toBe('question');
    expect(turn.text).toMatch(/dropdown|select/i);
    expect(turn.text).not.toMatch(/\bI('ve| have) (added|changed|updated|removed)\b/i);
    expectChatReply(turn.text);
  });
});
