import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

export function createFormEditAgent(schema: { pages: any[] }, instructions?: string) {
  const tools = createFormEditTools(schema);
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools,
    ...(instructions ? { instructions } : {}),
  });
}

export type FormEditAgentUIMessage = InferAgentUIMessage<ReturnType<typeof createFormEditAgent>>;
