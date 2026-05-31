import { ToolLoopAgent, InferAgentUIMessage, stepCountIs } from 'ai';
import { getPrimaryModel } from './ai.js';
import { createFormEditTools } from './aiFormEditTools.js';

export function createFormEditAgent(schema: { pages: any[] }) {
  const tools = createFormEditTools(schema);
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools,
  });
}

// Type-level only — never called at runtime. Provides InferAgentUIMessage inference.
function _getProtoAgent() {
  return new ToolLoopAgent({
    model: getPrimaryModel(),
    stopWhen: stepCountIs(8),
    tools: createFormEditTools({ pages: [] }),
  });
}

export type FormEditAgentUIMessage = InferAgentUIMessage<ReturnType<typeof _getProtoAgent>>;
