import { ToolLoopAgent, InferAgentUIMessage, stepCountIs, pruneMessages, type ModelMessage } from 'ai';
import { getRoutedModel, buildPromptCacheOptions } from './ai.js';
import { createFormEditTools, type ToolTier } from './aiFormEditTools.js';

const COMPACTION_THRESHOLD_TOKENS = 50_000;
const estimateTokens = (msgs: ModelMessage[]) => JSON.stringify(msgs).length / 4;

export interface FormEditAgentOptions {
  /** System prompt. Keep this BYTE-STABLE across turns so the prefix cache hits. */
  instructions?: string;
  /** Stable per-conversation key for prefix-cache affinity (the conversation id). */
  cacheKey?: string;
  /** Omit read tools (listFields/getField) when the form snapshot is already in context. */
  includeReadTools?: boolean;
  /** Form id — lets delete/convert tools query response counts for confirmation warnings. */
  formId?: string;
  /**
   * Model tier for two-tier routing:
   *   'nano' → gpt-5.4-nano, stepCountIs(8)  — simple CRUD ops + questions
   *   'mini' → gpt-5.4-mini, stepCountIs(15) — complex analysis, remix, bulk edits
   * Defaults to 'mini' (existing behaviour) so callers not yet routing remain unaffected.
   */
  modelTier?: 'nano' | 'mini';
  /**
   * Tool tier for conditional tool inclusion.
   * Defaults to 'full' (all tools) so callers not yet routing remain unaffected.
   */
  toolTier?: ToolTier;
}

export function createFormEditAgent(
  schema: { pages: any[] },
  options: FormEditAgentOptions = {}
) {
  const { instructions, cacheKey, includeReadTools = true, formId, modelTier = 'mini', toolTier = 'full' } = options;
  const tools = createFormEditTools(schema, { includeReadTools, formId, toolTier });
  const providerOptions = buildPromptCacheOptions(cacheKey);

  // nano handles simple single-step ops — cap at 8 steps to fail fast on unexpected loops.
  // mini handles complex multi-step ops — keep 15 steps for remix/merge/bulk analysis.
  const maxSteps = modelTier === 'nano' ? 8 : 15;

  return new ToolLoopAgent({
    model: getRoutedModel(modelTier),
    stopWhen: stepCountIs(maxSteps),
    tools,
    // Set once on the constructor — the AI SDK merges call-level providerOptions into every
    // step of the tool loop, so the cache key reaches each model call.
    ...(providerOptions ? { providerOptions } : {}),
    prepareStep: ({ messages }) => {
      if (estimateTokens(messages) > COMPACTION_THRESHOLD_TOKENS) {
        return {
          messages: pruneMessages({
            messages,
            reasoning: 'all',
            toolCalls: 'before-last-3-messages',
            emptyMessages: 'remove',
          }),
        };
      }
      return undefined;
    },
    ...(instructions ? { instructions } : {}),
  });
}

export type FormEditAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createFormEditAgent>>;
