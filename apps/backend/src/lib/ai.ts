import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

type ProviderName = 'azure' | 'openai';

const provider: ProviderName = (process.env.AI_PROVIDER as ProviderName) ?? 'azure';

function buildAzureModel(deployment: string): LanguageModel {
  const azure = createAzure({
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai`,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    // Azure uses deployment-based URLs and Chat Completions API, not the
    // new OpenAI Responses API (which Azure doesn't support yet).
    apiVersion: '2024-08-01-preview',
    useDeploymentBasedUrls: true,
  });
  return azure.chat(deployment);
}

function buildOpenAIModel(model: string): LanguageModel {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return openai(model) as LanguageModel;
}

// Primary model — used for form generation (structured output)
export function getPrimaryModel(): LanguageModel {
  if (provider === 'openai') return buildOpenAIModel(process.env.OPENAI_PRIMARY_MODEL ?? 'gpt-4o');
  return buildAzureModel(process.env.AZURE_OPENAI_PRIMARY_DEPLOYMENT ?? 'gpt-4o');
}

// Fast model — used for lightweight tasks (suggestions, etc.)
export function getFastModel(): LanguageModel {
  if (provider === 'openai') return buildOpenAIModel(process.env.OPENAI_FAST_MODEL ?? 'gpt-4o-mini');
  return buildAzureModel(process.env.AZURE_OPENAI_FAST_DEPLOYMENT ?? 'gpt-4o-mini');
}

export const AI_TOKEN_LIMITS: Record<string, number> = {
  free: 50_000,
  starter: 500_000,
  advanced: 5_000_000,
};
