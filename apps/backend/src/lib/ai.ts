import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { IntentTier } from './intentClassifier.js';

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
    env('AI_PRIMARY_MODEL') ?? 'gpt-5.4-mini',
  );
}

// Fast model — lightweight fire-and-forget tasks (auto-title generation).
// Configured via AI_FAST_BASE_URL / AI_FAST_API_KEY / AI_FAST_MODEL.
export function getFastModel(): LanguageModel {
  return buildModel(
    env('AI_FAST_BASE_URL')!,
    env('AI_FAST_API_KEY')!,
    env('AI_FAST_MODEL') ?? 'gpt-5.4-nano',
  );
}

// Returns the resolved primary model id — used for telemetry only.
export function getPrimaryModelId(): string {
  return env('AI_PRIMARY_MODEL') ?? 'gpt-5.4-mini';
}

/**
 * Route a request to the appropriate model tier based on classified intent.
 *
 * Two-tier routing strategy (Option A — no new infrastructure required):
 *   'nano' → gpt-5.4-nano (fast model)  — simple CRUD ops + questions
 *   'mini' → gpt-5.4-mini (primary model) — complex analysis, remix, bulk edits
 *
 * Both models are already deployed in ai.tf. This reuses the existing env vars:
 *   AI_FAST_*   → nano (previously only used for auto-title generation)
 *   AI_PRIMARY_* → mini (form edit agent + form generation + field insights)
 */
export function getRoutedModel(tier: 'nano' | 'mini'): LanguageModel {
  if (tier === 'nano') return getFastModel();
  return getPrimaryModel();
}

/** Returns the model ID string for the given tier — used for telemetry logging. */
export function getRoutedModelId(tier: 'nano' | 'mini'): string {
  if (tier === 'nano') return env('AI_FAST_MODEL') ?? 'gpt-5.4-nano';
  return env('AI_PRIMARY_MODEL') ?? 'gpt-5.4-mini';
}

/**
 * Convenience: resolve intent tier → model tier → model in one call.
 * Avoids importing intentToModelTier in the ai.ts module (keeps deps clean).
 */
export function getModelForIntent(intent: IntentTier): LanguageModel {
  return intent === 'complex' ? getPrimaryModel() : getFastModel();
}

export function getModelIdForIntent(intent: IntentTier): string {
  return intent === 'complex'
    ? (env('AI_PRIMARY_MODEL') ?? 'gpt-5.4-mini')
    : (env('AI_FAST_MODEL') ?? 'gpt-5.4-nano');
}

// GPT models on Azure AI Services use automatic prompt caching — no explicit
// cache key is needed. Always returns undefined; callers handle this
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
