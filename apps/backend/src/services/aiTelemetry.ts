import type { LanguageModelUsage } from 'ai';
import { logger } from '../lib/logger.js';
// Phase 2.1: types centralised in @dculus/types — import from built dist.
// Run `pnpm --filter @dculus/types build` after changing packages/types/src/ai.ts.
export type { TurnTelemetry, UsageStats, IntentTier, ModelTier } from '@dculus/types/ai.js';
import type { TurnTelemetry } from '@dculus/types/ai.js';

/**
 * Pull the cache-aware token breakdown out of an AI SDK usage object.
 *
 * Cached prompt tokens live in `usage.inputTokenDetails.cacheReadTokens` for the OpenAI/Azure
 * chat path (NOT in `providerMetadata.openai.cachedPromptTokens`, which does not exist in
 * @ai-sdk/openai@3). `usage.cachedInputTokens` is the deprecated alias — we fall back to it.
 */
export function extractUsageStats(usage: LanguageModelUsage | undefined): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  cacheHitRatio: number;
} {
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  const cachedInputTokens =
    usage?.inputTokenDetails?.cacheReadTokens ?? usage?.cachedInputTokens ?? 0;
  const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens;
  const cacheHitRatio = inputTokens > 0 ? cachedInputTokens / inputTokens : 0;
  return { inputTokens, outputTokens, cachedInputTokens, totalTokens, cacheHitRatio };
}

/** Structured per-turn telemetry log. Cheap, non-blocking; safe to call in onFinish. */
export function recordTurnTelemetry(stats: TurnTelemetry): void {
  logger.info(
    {
      aiTelemetry: true,
      conversationId: stats.conversationId,
      formId: stats.formId,
      formFieldCount: stats.formFieldCount,
      model: stats.model,
      intentTier: stats.intentTier,
      modelTier: stats.modelTier,
      inputTokens: stats.inputTokens,
      outputTokens: stats.outputTokens,
      cachedInputTokens: stats.cachedInputTokens,
      cacheHitRatio: Number(stats.cacheHitRatio.toFixed(3)),
      totalTokens: stats.totalTokens,
    },
    'AI chat turn complete'
  );
}
