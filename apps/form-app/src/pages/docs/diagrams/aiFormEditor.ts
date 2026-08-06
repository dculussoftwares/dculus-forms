import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/08-ai-form-editor.md`.
 *
 * The important edge is the one leaving the backend: tool results stream to the
 * browser, and the *browser* writes to Y.js. Drawing the edit as something the
 * server does would misrepresent the whole design — and would not explain why AI
 * edits show up for other collaborators.
 */
export const aiFormEditor: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'message',
      data: {
        label: 'User message',
        kind: 'entry',
        file: 'apps/form-app/src/hooks/useAIChat.ts',
        line: 123,
        does: 'Sent from the AI drawer in the builder to POST /api/ai/chat.',
        note: 'A REST route rather than a GraphQL mutation because the response streams.',
      },
    },
    {
      id: 'guards',
      data: {
        label: 'Guards',
        kind: 'gate',
        file: 'apps/backend/src/services/aiUsageService.ts',
        line: 207,
        does: 'Org membership, then AI credit budget, then conversation ownership. Over budget returns 402.',
        note: 'The budget check is a soft pre-check, not an atomic reservation — concurrent requests from one org can both pass. Reserving atomically would serialise every AI request in the org.',
      },
    },
    {
      id: 'context',
      data: {
        label: 'Compress the context',
        kind: 'effect',
        file: 'apps/backend/src/services/aiChatService.ts',
        does: 'Truncates tool results at 8k chars, prunes old tool payloads, summarises past four user turns, and reads the Y.js schema behind a 10-second cache.',
        note: 'Under 40 fields the whole form is inlined and read tools are dropped; over it, the snapshot shrinks to a page summary and listFields/getField come back. You pay for one or the other, never both.',
      },
    },
    {
      id: 'intent',
      data: {
        label: 'classifyIntent',
        kind: 'gate',
        file: 'apps/backend/src/lib/intentClassifier.ts',
        line: 76,
        does: 'Pure regex, no API call. Routes to nano + core tools, mini + full tools, or a no-agent question path.',
        note: 'Questions skip the tool loop entirely, saving roughly 2,100 tokens of tool schemas that were never going to be called. Ambiguous messages default to nano.',
      },
    },
    {
      id: 'agent',
      data: {
        label: 'ToolLoopAgent',
        kind: 'effect',
        file: 'apps/backend/src/lib/formEditAgent.ts',
        does: 'Runs the tool loop — 8 steps on nano, 15 on mini — pruning mid-loop once context passes ~50k tokens.',
        note: 'The prompt is split so its prefix stays byte-identical across turns: static system prompt, tools, history, then ALL per-turn data in a trailing ephemeral message that must never be persisted.',
        shared: 'Prefix stability is what makes caching work',
      },
    },
    {
      id: 'apply',
      data: {
        label: 'Browser applies the ops',
        kind: 'write',
        file: 'apps/form-app/src/lib/applyAIOp.ts',
        does: 'Tools return operation descriptions; the browser applies them to the Zustand store, which writes to Y.js.',
        note: 'The backend never edits the form. That is why AI edits sync to other collaborators and join the undo stack for free. Applied tool-call ids are deduplicated so a re-streamed part cannot apply twice.',
        shared: 'Syncs through the collaboration path',
      },
    },
    {
      id: 'proposals',
      data: {
        label: 'Proposal cards',
        kind: 'gate',
        file: 'apps/form-app/src/store/slices/aiSlice.ts',
        does: 'Destructive and suggestive tools enqueue a confirmation instead of mutating — deletes, type conversions, validation and condition suggestions.',
        note: 'The system prompt instructs the model to say "will be once confirmed" rather than "deleted", because nothing has happened yet.',
      },
    },
    {
      id: 'usage',
      data: {
        label: 'AIUsage',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 726,
        does: 'Converts tokens to milli-credits at a per-tier rate and charges the organization for the period.',
        note: 'AI credits take their period from Subscription.currentPeriodStart — a different clock from views and submissions, which reset on renewal.',
      },
    },
  ],
  edges: [
    { source: 'message', target: 'guards' },
    { source: 'guards', target: 'context' },
    { source: 'context', target: 'intent' },
    { source: 'intent', target: 'agent' },
    { source: 'agent', target: 'apply', label: 'streamed tool results' },
    { source: 'agent', target: 'proposals', label: 'awaiting confirmation' },
    { source: 'agent', target: 'usage', async: true },
  ],
};
