import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    aIModelConfig: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../../lib/prisma.js';
import {
  getConfig,
  listConfigs,
  updateConfig,
  seedDefaults,
  invalidateCache,
  SUPPORTED_MODELS,
} from '../aiConfigService.js';

beforeEach(() => {
  vi.clearAllMocks();
  invalidateCache();
});

const mockFreeConfig = {
  id: 'cfg_1',
  plan: 'free',
  primaryModel: 'gpt-4o',
  fastModel: 'gpt-4o-mini',
  updatedAt: new Date(),
  updatedBy: null,
};

describe('getConfig', () => {
  it('returns config from DB for a given plan', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    const result = await getConfig('free');
    expect(result.primaryModel).toBe('gpt-4o');
    expect(result.fastModel).toBe('gpt-4o-mini');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledWith({ where: { plan: 'free' } });
  });

  it('returns fallback defaults when DB returns null', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(null);
    const result = await getConfig('free');
    expect(result.primaryModel).toBe('gpt-4o');
    expect(result.fastModel).toBe('gpt-4o-mini');
  });

  it('serves from cache on second call', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    await getConfig('free');
    await getConfig('free');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidateCache', async () => {
    (prisma.aIModelConfig.findUnique as any).mockResolvedValue(mockFreeConfig);
    await getConfig('free');
    invalidateCache();
    await getConfig('free');
    expect(prisma.aIModelConfig.findUnique).toHaveBeenCalledTimes(2);
  });
});

describe('listConfigs', () => {
  it('returns all configs from DB', async () => {
    (prisma.aIModelConfig.findMany as any).mockResolvedValue([mockFreeConfig]);
    const result = await listConfigs();
    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe('free');
  });
});

describe('updateConfig', () => {
  it('upserts config and invalidates cache', async () => {
    const updated = { ...mockFreeConfig, primaryModel: 'Phi-4', updatedBy: 'user_1' };
    (prisma.aIModelConfig.upsert as any).mockResolvedValue(updated);
    const result = await updateConfig('free', 'Phi-4', 'gpt-4o-mini', 'user_1');
    expect(prisma.aIModelConfig.upsert).toHaveBeenCalledWith({
      where: { plan: 'free' },
      update: { primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedBy: 'user_1' },
      create: { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedBy: 'user_1' },
    });
    expect(result.primaryModel).toBe('Phi-4');
  });
});

describe('seedDefaults', () => {
  it('creates rows when table is empty', async () => {
    (prisma.aIModelConfig.count as any).mockResolvedValue(0);
    (prisma.aIModelConfig.create as any).mockResolvedValue({});
    await seedDefaults();
    expect(prisma.aIModelConfig.create).toHaveBeenCalledTimes(3);
  });

  it('skips creation when rows already exist', async () => {
    (prisma.aIModelConfig.count as any).mockResolvedValue(3);
    await seedDefaults();
    expect(prisma.aIModelConfig.create).not.toHaveBeenCalled();
  });
});

describe('SUPPORTED_MODELS', () => {
  it('includes OpenAI and non-OpenAI models', () => {
    const ids = SUPPORTED_MODELS.map(m => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('Phi-4');
    expect(ids).toContain('Meta-Llama-3.3-70B-Instruct');
  });
});
