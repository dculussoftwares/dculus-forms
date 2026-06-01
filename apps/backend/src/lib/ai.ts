import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

type ProviderName = 'azure' | 'openai';

const provider: ProviderName = (process.env.AI_PROVIDER as ProviderName) ?? 'azure';

function buildAzureModel(deployment: string): LanguageModel {
  const azure = createAzure({
    baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai`,
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
  });
  return azure.chat(deployment);
}

function buildOpenAIModel(model: string): LanguageModel {
  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  return openai(model) as LanguageModel;
}

// Primary model — form editing chat (streaming + tool calls) and form generation (structured output)
export function getPrimaryModel(): LanguageModel {
  if (provider === 'openai') return buildOpenAIModel(process.env.OPENAI_PRIMARY_MODEL ?? 'gpt-5.4-mini');
  return buildAzureModel(process.env.AZURE_OPENAI_PRIMARY_DEPLOYMENT ?? 'gpt-5.4-mini');
}

// Fast model — lightweight fire-and-forget tasks (auto-title generation, etc.)
export function getFastModel(): LanguageModel {
  if (provider === 'openai') return buildOpenAIModel(process.env.OPENAI_FAST_MODEL ?? 'gpt-5.4-nano');
  return buildAzureModel(process.env.AZURE_OPENAI_FAST_DEPLOYMENT ?? 'gpt-5.4-nano');
}

// Standardized deployments: both dev and prod use gpt-5.4-mini (primary) + gpt-5.4-nano (fast).
// Returns the resolved primary model/deployment id — used for telemetry, not for model construction.
export function getPrimaryModelId(): string {
  if (provider === 'openai') return process.env.OPENAI_PRIMARY_MODEL ?? 'gpt-5.4-mini';
  return process.env.AZURE_OPENAI_PRIMARY_DEPLOYMENT ?? 'gpt-5.4-mini';
}

// Prompt-cache provider options. The Azure chat model is an OpenAIChatLanguageModel under the
// hood and reads provider options under the "openai" namespace (verified in @ai-sdk/openai@3 —
// getArgs() parses providerOptions with a hardcoded provider:"openai"). So even for Azure the
// key MUST live under `openai`, not `azure`. A stable key (the conversation id) maximizes the
// prefix-cache hit rate across a conversation's turns.
export function buildPromptCacheOptions(
  cacheKey: string | undefined
): { openai: { promptCacheKey: string } } | undefined {
  return cacheKey ? { openai: { promptCacheKey: cacheKey } } : undefined;
}

export const AI_TOKEN_LIMITS: Record<string, number> = {
  free: 200_000,
  starter: 2_000_000,
  advanced: 20_000_000,
};
