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
    AI_PRIMARY_MODEL: 'DeepSeek-V3-0324',
    AI_FAST_BASE_URL: FAST_BASE_URL,
    AI_FAST_API_KEY: FAST_API_KEY,
    AI_FAST_MODEL: 'gpt-4.1-nano',
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
    expect(model).toMatchObject({ kind: 'openai', model: 'DeepSeek-V3-0324' });
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: PRIMARY_BASE_URL, apiKey: PRIMARY_API_KEY }),
    );
  });

  it('falls back to DeepSeek-V3-0324 when AI_PRIMARY_MODEL is unset', async () => {
    setEnv({ AI_PRIMARY_MODEL: undefined });
    const { getPrimaryModel } = await import('../ai.js');
    const model = getPrimaryModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'DeepSeek-V3-0324' });
  });
});

describe('getFastModel', () => {
  beforeEach(() => { vi.resetModules(); clearEnv(); });

  it('uses createOpenAI with the fast base URL and key', async () => {
    setEnv();
    const { getFastModel } = await import('../ai.js');
    const model = getFastModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-4.1-nano' });
    expect(createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: FAST_BASE_URL, apiKey: FAST_API_KEY }),
    );
  });

  it('falls back to gpt-4.1-nano when AI_FAST_MODEL is unset', async () => {
    setEnv({ AI_FAST_MODEL: undefined });
    const { getFastModel } = await import('../ai.js');
    const model = getFastModel();
    expect(model).toMatchObject({ kind: 'openai', model: 'gpt-4.1-nano' });
  });
});

describe('getPrimaryModelId', () => {
  beforeEach(() => { vi.resetModules(); clearEnv(); });

  it('returns AI_PRIMARY_MODEL env var', async () => {
    setEnv({ AI_PRIMARY_MODEL: 'DeepSeek-V3-0324' });
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('DeepSeek-V3-0324');
  });

  it('falls back to DeepSeek-V3-0324 when unset', async () => {
    setEnv({ AI_PRIMARY_MODEL: undefined });
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('DeepSeek-V3-0324');
  });
});

describe('buildPromptCacheOptions', () => {
  beforeEach(() => vi.resetModules());

  it('always returns undefined (Azure AI Services uses implicit prefix caching)', async () => {
    const { buildPromptCacheOptions } = await import('../ai.js');
    expect(buildPromptCacheOptions('conv-123')).toBeUndefined();
    expect(buildPromptCacheOptions(undefined)).toBeUndefined();
  });
});
