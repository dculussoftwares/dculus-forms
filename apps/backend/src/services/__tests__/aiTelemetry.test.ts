import { describe, it, expect, vi } from 'vitest';
import type { LanguageModelUsage } from 'ai';
import { extractUsageStats, recordTurnTelemetry } from '../aiTelemetry.js';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('extractUsageStats', () => {
  it('reads cached tokens from inputTokenDetails.cacheReadTokens (canonical path)', () => {
    const usage = {
      inputTokens: 1000,
      outputTokens: 200,
      totalTokens: 1200,
      inputTokenDetails: { cacheReadTokens: 600, noCacheTokens: 400, cacheWriteTokens: 0 },
    } as unknown as LanguageModelUsage;

    const stats = extractUsageStats(usage);
    expect(stats.inputTokens).toBe(1000);
    expect(stats.outputTokens).toBe(200);
    expect(stats.cachedInputTokens).toBe(600);
    expect(stats.totalTokens).toBe(1200);
    expect(stats.cacheHitRatio).toBeCloseTo(0.6);
  });

  it('falls back to the deprecated cachedInputTokens field', () => {
    const usage = {
      inputTokens: 500,
      outputTokens: 100,
      totalTokens: 600,
      cachedInputTokens: 250,
    } as unknown as LanguageModelUsage;

    const stats = extractUsageStats(usage);
    expect(stats.cachedInputTokens).toBe(250);
    expect(stats.cacheHitRatio).toBeCloseTo(0.5);
  });

  it('derives totalTokens when absent and handles zero input (ratio 0, no divide-by-zero)', () => {
    const usage = { inputTokens: 0, outputTokens: 0 } as unknown as LanguageModelUsage;
    const stats = extractUsageStats(usage);
    expect(stats.cachedInputTokens).toBe(0);
    expect(stats.cacheHitRatio).toBe(0);
    expect(stats.totalTokens).toBe(0);
  });

  it('handles undefined usage entirely', () => {
    const stats = extractUsageStats(undefined);
    expect(stats).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      totalTokens: 0,
      cacheHitRatio: 0,
    });
  });

  it('derives totalTokens from input+output when totalTokens missing', () => {
    const usage = { inputTokens: 30, outputTokens: 12 } as unknown as LanguageModelUsage;
    expect(extractUsageStats(usage).totalTokens).toBe(42);
  });
});

describe('recordTurnTelemetry', () => {
  it('logs a structured telemetry line without throwing', async () => {
    const { logger } = await import('../../lib/logger.js');
    recordTurnTelemetry({
      conversationId: 'conv-1',
      formId: 'form-1',
      formFieldCount: 5,
      model: 'gpt-5.4-mini',
      inputTokens: 1000,
      outputTokens: 200,
      cachedInputTokens: 600,
      cacheHitRatio: 0.6,
      totalTokens: 1200,
    });
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({ aiTelemetry: true, cacheHitRatio: 0.6, conversationId: 'conv-1' }),
      'AI chat turn complete'
    );
  });
});
