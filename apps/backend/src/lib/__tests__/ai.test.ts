import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock provider SDK — model construction must not require real credentials.
const openaiChat = vi.fn((model: string) => ({ kind: 'openai', model }));
const openaiCallable = Object.assign(vi.fn(), { chat: openaiChat });
const createOpenAI = vi.fn(() => openaiCallable);

vi.mock('@ai-sdk/openai', () => ({ createOpenAI }));

const PRIMARY_BASE_URL = 'https://my-resource.openai.azure.com/openai/v1';
const PRIMARY_API_KEY = 'primary-key';
const FAST_BASE_URL = 'https://my-resource.openai.azure.com/openai/v1';
const FAST_API_KEY = 'fast-key';

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const defaults: Record<string, string> = {
    AI_PRIMARY_BASE_URL: PRIMARY_BASE_URL,
    AI_PRIMARY_API_KEY: PRIMARY_API_KEY,
    AI_PRIMARY_MODEL: 'gpt-5.4-mini',
    AI_FAST_BASE_URL: FAST_BASE_URL,
    AI_FAST_API_KEY: FAST_API_KEY,
    AI_FAST_MODEL: 'gpt-5.4-nano',
  };
  Object.assign(process.env, defaults, overrides);
}

function clearEnv() {
  for (const k of [
    'AI_PRIMARY_BASE_URL', 'AI_PRIMARY_API_KEY', 'AI_PRIMARY_MODEL',
    'AI_FAST_BASE_URL', 'AI_FAST_API_KEY', 'AI_FAST_MODEL',
  ]) delete process.env[k];
}

describe('getPrimaryModel', () => {
  beforeEach(() => { vi.resetModules(); clearEnv(); });

  it('uses createOpenAI with the primary base URL and key', async () => {
    setEnv();
    const { getPrimaryModel } = await import('../ai.js');
    const model = getPrimaryModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-5.4-mini' });
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: PRIMARY_BASE_URL, apiKey: PRIMARY_API_KEY }),
    );
  });

  it('falls back to gpt-5.4-mini when AI_PRIMARY_MODEL is unset', async () => {
    setEnv({ AI_PRIMARY_MODEL: undefined });
    const { getPrimaryModel } = await import('../ai.js');
    const model = getPrimaryModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-5.4-mini' });
  });
});

describe('getFastModel', () => {
  beforeEach(() => { vi.resetModules(); clearEnv(); });

  it('uses createOpenAI with the fast base URL and key', async () => {
    setEnv();
    const { getFastModel } = await import('../ai.js');
    const model = getFastModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-5.4-nano' });
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: FAST_BASE_URL, apiKey: FAST_API_KEY }),
    );
  });

  it('falls back to gpt-5.4-nano when AI_FAST_MODEL is unset', async () => {
    setEnv({ AI_FAST_MODEL: undefined });
    const { getFastModel } = await import('../ai.js');
    const model = getFastModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-5.4-nano' });
  });
});

describe('getPrimaryModelId', () => {
  beforeEach(() => { vi.resetModules(); clearEnv(); });

  it('returns AI_PRIMARY_MODEL env var', async () => {
    setEnv({ AI_PRIMARY_MODEL: 'gpt-5.4-mini' });
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('gpt-5.4-mini');
  });

  it('falls back to gpt-5.4-mini when unset', async () => {
    setEnv({ AI_PRIMARY_MODEL: undefined });
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('gpt-5.4-mini');
  });
});

describe('buildPromptCacheOptions', () => {
  beforeEach(() => vi.resetModules());

  it('always returns undefined (Azure AI Services uses automatic prompt caching)', async () => {
    const { buildPromptCacheOptions } = await import('../ai.js');
    expect(buildPromptCacheOptions('conv-123')).toBeUndefined();
    expect(buildPromptCacheOptions(undefined)).toBeUndefined();
  });
});

describe('AI_CREDIT_LIMITS_FALLBACK', () => {
  beforeEach(() => vi.resetModules());

  it('has exactly free:200, starter:2000, advanced:20000', async () => {
    const { AI_CREDIT_LIMITS_FALLBACK } = await import('../ai.js');
    expect(AI_CREDIT_LIMITS_FALLBACK).toEqual({
      free: 200,
      starter: 2_000,
      advanced: 20_000,
    });
  });
});

describe('tokensToMilliCredits', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.AI_CREDIT_WEIGHT_NANO;
    delete process.env.AI_CREDIT_WEIGHT_MINI;
  });

  it('converts 2000 nano tokens to 2000 mCr using the default weight (1)', async () => {
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(2000, 'nano')).toBe(2000);
  });

  it('converts 2000 mini tokens to 10000 mCr using the default weight (5)', async () => {
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(2000, 'mini')).toBe(10_000);
  });

  it('honors AI_CREDIT_WEIGHT_MINI env override', async () => {
    process.env.AI_CREDIT_WEIGHT_MINI = '2.5';
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(2000, 'mini')).toBe(5000);
  });

  it.each(['abc', '0', '-1'])(
    'falls back to the default mini weight when AI_CREDIT_WEIGHT_MINI=%s is invalid',
    async (invalid) => {
      process.env.AI_CREDIT_WEIGHT_MINI = invalid;
      const { tokensToMilliCredits } = await import('../ai.js');
      expect(tokensToMilliCredits(2000, 'mini')).toBe(10_000);
    },
  );

  it('returns 0 for zero tokens', async () => {
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(0, 'nano')).toBe(0);
  });

  it('returns 0 for negative tokens', async () => {
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(-100, 'nano')).toBe(0);
  });

  it('rounds fractional results using Math.round semantics', async () => {
    process.env.AI_CREDIT_WEIGHT_MINI = '0.5';
    const { tokensToMilliCredits } = await import('../ai.js');
    expect(tokensToMilliCredits(1, 'mini')).toBe(1);
  });
});
