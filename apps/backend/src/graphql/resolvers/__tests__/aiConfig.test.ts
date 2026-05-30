import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/aiConfigService.js', () => ({
  listConfigs: vi.fn(),
  updateConfig: vi.fn(),
  SUPPORTED_MODELS: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'Phi-4',  label: 'Phi-4' },
  ],
}));

import { aiConfigResolvers } from '../aiConfig.js';
import { listConfigs, updateConfig } from '../../../services/aiConfigService.js';

const adminAuth = { isAuthenticated: true, user: { id: 'u1', role: 'admin' }, session: {} };
const superAdminAuth = { isAuthenticated: true, user: { id: 'u2', role: 'superAdmin' }, session: {} };
const userAuth = { isAuthenticated: true, user: { id: 'u3', role: 'user' }, session: {} };
const unauthenticated = { isAuthenticated: false, user: null, session: null };

beforeEach(() => vi.clearAllMocks());

describe('aiModelConfigs query', () => {
  it('returns config list for admin', async () => {
    (listConfigs as any).mockResolvedValue([{ id: '1', plan: 'free', primaryModel: 'gpt-4o', fastModel: 'gpt-4o-mini' }]);
    const result = await aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: adminAuth });
    expect(result).toHaveLength(1);
    expect(result[0].plan).toBe('free');
  });

  it('returns config list for superAdmin', async () => {
    (listConfigs as any).mockResolvedValue([]);
    const result = await aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: superAdminAuth });
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws for non-admin user', async () => {
    await expect(
      aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: userAuth })
    ).rejects.toThrow();
  });

  it('throws for unauthenticated', async () => {
    await expect(
      aiConfigResolvers.Query.aiModelConfigs({}, {}, { auth: unauthenticated })
    ).rejects.toThrow();
  });
});

describe('aiSupportedModels query', () => {
  it('returns supported models list for admin', async () => {
    const result = await aiConfigResolvers.Query.aiSupportedModels({}, {}, { auth: adminAuth });
    expect(result.map((m: any) => m.id)).toContain('gpt-4o');
    expect(result.map((m: any) => m.id)).toContain('Phi-4');
  });
});

describe('updateAIModelConfig mutation', () => {
  it('updates config and returns updated row for admin', async () => {
    const updated = { id: '1', plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini', updatedAt: new Date(), updatedBy: 'u1' };
    (updateConfig as any).mockResolvedValue(updated);
    const result = await aiConfigResolvers.Mutation.updateAIModelConfig(
      {},
      { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini' },
      { auth: adminAuth }
    );
    expect(result.primaryModel).toBe('Phi-4');
    expect(updateConfig).toHaveBeenCalledWith('free', 'Phi-4', 'gpt-4o-mini', 'u1');
  });

  it('throws for non-admin user', async () => {
    await expect(
      aiConfigResolvers.Mutation.updateAIModelConfig(
        {},
        { plan: 'free', primaryModel: 'Phi-4', fastModel: 'gpt-4o-mini' },
        { auth: userAuth }
      )
    ).rejects.toThrow();
  });
});
