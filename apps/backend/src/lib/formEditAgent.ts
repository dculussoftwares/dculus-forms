import { ToolLoopAgent, InferAgentUIMessage, stepCountIs, pruneMessages, type ModelMessage } from 'ai';
import { getPrimaryModel, buildPromptCacheOptions } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

const COMPACTION_THRESHOLD_TOKENS = 50_000;
const estimateTokens = (msgs: ModelMessage[]) => JSON.stringify(msgs).length / 4;

export interface FormEditAgentOptions {
  /** System prompt. Keep this BYTE-STABLE across turns so the prefix cache hits. */
  instructions?: string;
  /** Stable per-conversation key for prefix-cache affinity (the conversation id). */
  cacheKey?: string;
  /** Omit read tools (listFields/getField) when the form snapshot is already in context. */
  includeReadTools?: boolean;
}

export function createFormEditAgent(
  schema: { pages: any[] },
  options: FormEditAgentOptions = {}
) {
  const { instructions, cacheKey, includeReadTools = true } = options;
  const tools = createFormEditTools(schema, { includeReadTools });
  const providerOptions = buildPromptCacheOptions(cacheKey);

  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(15),
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
