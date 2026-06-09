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

// Both models are served via the Azure AI Services OpenAI-compatible endpoint:
//   https://{resource}.openai.azure.com/openai/v1
// This endpoint accepts Bearer auth and requires no api-version query param.
// .chat() forces Chat Completions (/chat/completions); the default provider call
// uses the newer Responses API (/responses) which Azure does not support.
function buildModel(baseUrl: string, apiKey: string, model: string): LanguageModel {
  return createOpenAI({ baseURL: baseUrl, apiKey }).chat(model) as LanguageModel;
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
export function getFastModel(): LanguageModel {
  return buildModel(
    env('AI_FAST_BASE_URL')!,
    env('AI_FAST_API_KEY')!,
    env('AI_FAST_MODEL') ?? 'gpt-4.1-nano',
  );
}

// Returns the resolved primary model id — used for telemetry only.
export function getPrimaryModelId(): string {
  return env('AI_PRIMARY_MODEL') ?? 'DeepSeek-V3-0324';
}

// DeepSeek on Azure AI Services uses implicit prefix caching — no explicit cache
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
