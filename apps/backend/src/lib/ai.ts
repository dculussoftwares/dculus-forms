import { createAzure } from '@ai-sdk/azure';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

// Returns the env var value only when it is a non-empty, non-"undefined" string.
// process.env coerces undefined to the literal string "undefined" (via Object.assign
// in tests), and empty string means "not configured", so both are treated as absent.
function env(key: string): string | undefined {
  const val = process.env[key];
  if (!val || val === 'undefined') return undefined;
  return val;
}

// Builds a LanguageModel from generic env-var-driven config.
// When apiVersion is provided the endpoint is Azure OpenAI (needs api-version
// query param) so we use @ai-sdk/azure. Otherwise it is an OpenAI-compatible
// MaaS endpoint (DeepSeek on Azure Foundry, etc.) and we use @ai-sdk/openai
// with a custom baseURL.
function buildModel(
  baseUrl: string,
  apiKey: string,
  model: string,
  apiVersion?: string,
): LanguageModel {
  if (apiVersion) {
    const azure = createAzure({ baseURL: baseUrl, apiKey, apiVersion });
    return azure.chat(model);
  }
  const openai = createOpenAI({ baseURL: baseUrl, apiKey });
  return openai(model) as LanguageModel;
}

// Primary model — form editing chat (streaming + tool calls) and form
// generation / field insights (structured output).
// Configured via AI_PRIMARY_BASE_URL / AI_PRIMARY_API_KEY / AI_PRIMARY_MODEL.
export function getPrimaryModel(): LanguageModel {
  return buildModel(
    env('AI_PRIMARY_BASE_URL')!,
    env('AI_PRIMARY_API_KEY')!,
    env('AI_PRIMARY_MODEL') ?? 'DeepSeek-V3-0324',
  );
}

// Fast model — lightweight fire-and-forget tasks (auto-title generation).
// Configured via AI_FAST_BASE_URL / AI_FAST_API_KEY / AI_FAST_MODEL.
// Set AI_FAST_API_VERSION for Azure OpenAI deployments; omit for MaaS endpoints.
export function getFastModel(): LanguageModel {
  return buildModel(
    env('AI_FAST_BASE_URL')!,
    env('AI_FAST_API_KEY')!,
    env('AI_FAST_MODEL') ?? 'gpt-4.1-nano',
    env('AI_FAST_API_VERSION'),
  );
}

// Returns the resolved primary model id — used for telemetry only.
export function getPrimaryModelId(): string {
  return env('AI_PRIMARY_MODEL') ?? 'DeepSeek-V3-0324';
}

// DeepSeek on Azure Foundry uses implicit prefix caching — no explicit cache
// key is needed or supported. Always returns undefined; callers handle this
// with `...(providerOptions ? { providerOptions } : {})`.
export function buildPromptCacheOptions(
  _cacheKey: string | undefined,
): undefined {
  return undefined;
}

export const AI_TOKEN_LIMITS: Record<string, number> = {
  free: 200_000,
  starter: 2_000_000,
  advanced: 20_000_000,
};
