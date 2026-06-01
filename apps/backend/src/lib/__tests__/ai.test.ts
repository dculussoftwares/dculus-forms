import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the provider SDKs so model construction doesn't require real credentials/network.
const azureChat = vi.fn((d: string) => ({ kind: 'azure', deployment: d }));
const createAzure = vi.fn(() => ({ chat: azureChat }));
const openaiCallable = vi.fn((m: string) => ({ kind: 'openai', model: m }));
const createOpenAI = vi.fn(() => openaiCallable);

vi.mock('@ai-sdk/azure', () => ({ createAzure }));
vi.mock('@ai-sdk/openai', () => ({ createOpenAI }));

describe('buildPromptCacheOptions', () => {
  beforeEach(() => vi.resetModules());

  it('namespaces the cache key under "openai" (Azure chat reads provider options there)', async () => {
    const { buildPromptCacheOptions } = await import('../ai.js');
    expect(buildPromptCacheOptions('conv-123')).toEqual({
      openai: { promptCacheKey: 'conv-123' },
    });
  });

  it('returns undefined when no cache key is given', async () => {
    const { buildPromptCacheOptions } = await import('../ai.js');
    expect(buildPromptCacheOptions(undefined)).toBeUndefined();
    expect(buildPromptCacheOptions('')).toBeUndefined();
  });
});

describe('model selection — azure (default) branch', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.AI_PROVIDER;
    delete process.env.AZURE_OPENAI_PRIMARY_DEPLOYMENT;
    delete process.env.AZURE_OPENAI_FAST_DEPLOYMENT;
  });

  it('getPrimaryModelId defaults to gpt-5.4-mini', async () => {
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('gpt-5.4-mini');
  });

  it('getPrimaryModelId honors AZURE_OPENAI_PRIMARY_DEPLOYMENT', async () => {
    process.env.AZURE_OPENAI_PRIMARY_DEPLOYMENT = 'my-deploy';
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('my-deploy');
  });

  it('getPrimaryModel / getFastModel build azure chat models', async () => {
    const { getPrimaryModel, getFastModel } = await import('../ai.js');
    expect(getPrimaryModel()).toMatchObject({ kind: 'azure' });
    expect(getFastModel()).toMatchObject({ kind: 'azure' });
  });
});

describe('model selection — openai branch', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AI_PROVIDER = 'openai';
  });

  it('getPrimaryModelId returns the OpenAI model default', async () => {
    delete process.env.OPENAI_PRIMARY_MODEL;
    const { getPrimaryModelId } = await import('../ai.js');
    expect(getPrimaryModelId()).toBe('gpt-5.4-mini');
  });

  it('getPrimaryModel / getFastModel build openai models', async () => {
    const { getPrimaryModel, getFastModel } = await import('../ai.js');
    expect(getPrimaryModel()).toMatchObject({ kind: 'openai' });
    expect(getFastModel()).toMatchObject({ kind: 'openai' });
  });
});
