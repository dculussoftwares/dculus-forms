import { createAzure } from '@ai-sdk/azure';
import type { LanguageModel } from 'ai';
import { getConfig } from '../services/aiConfigService.js';

// Single Foundry client — the *.services.ai.azure.com/openai endpoint is
// OpenAI-compatible and routes to any model (GPT, Phi-4, Llama, Mistral)
// by deployment/model name. Same API key and format for all.
function buildClient() {
  const endpoint = process.env.AZURE_AI_FOUNDRY_ENDPOINT ?? '';
  const apiKey   = process.env.AZURE_AI_API_KEY ?? '';
  return createAzure({
    baseURL: `${endpoint}openai`,
    apiKey,
  });
}

export async function getModelForPlan(plan: string, role: 'primary' | 'fast'): Promise<LanguageModel> {
  try {
    const config = await getConfig(plan);
    const modelName = role === 'primary' ? config.primaryModel : config.fastModel;
    return buildClient().chat(modelName);
  } catch {
    const fallback = role === 'primary' ? 'gpt-4o' : 'gpt-4o-mini';
    return buildClient().chat(fallback);
  }
}

export const AI_TOKEN_LIMITS: Record<string, number> = {
  free:     50_000,
  starter:  500_000,
  advanced: 5_000_000,
};
