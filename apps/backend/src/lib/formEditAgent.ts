import { ToolLoopAgent, InferAgentUIMessage, stepCountIs, pruneMessages, type ModelMessage } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

const COMPACTION_THRESHOLD_TOKENS = 50_000;
const estimateTokens = (msgs: ModelMessage[]) => JSON.stringify(msgs).length / 4;

export function createFormEditAgent(schema: { pages: any[] }, instructions?: string) {
  const tools = createFormEditTools(schema);
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(15),
    tools,
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
