import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  disableAllByForm: vi.fn(),
  listActiveIdsByForm: vi.fn(),
  pauseByIds: vi.fn(),
  cancelRunsForAutomation: vi.fn(),
  unscheduleAutomationCron: vi.fn(),
}));

vi.mock('../../repositories/pluginRepository.js', () => ({
  pluginRepository: { disableAllByForm: mocks.disableAllByForm },
}));
vi.mock('../../repositories/automationRepository.js', () => ({
  automationRepository: { listActiveIdsByForm: mocks.listActiveIdsByForm, pauseByIds: mocks.pauseByIds },
}));
vi.mock('../automation/triggerService.js', () => ({ cancelRunsForAutomation: mocks.cancelRunsForAutomation }));
vi.mock('../automation/cronSchedule.js', () => ({ unscheduleAutomationCron: mocks.unscheduleAutomationCron }));
vi.mock('../../lib/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { disableFormIntegrations } from '../formDeletionCleanup.js';

describe('disableFormIntegrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.unscheduleAutomationCron.mockResolvedValue(undefined);
  });

  it('disables plugins and pauses, unschedules and cancels runs of active automations', async () => {
    mocks.listActiveIdsByForm.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);

    await disableFormIntegrations('form-1');

    expect(mocks.disableAllByForm).toHaveBeenCalledWith('form-1');
    expect(mocks.pauseByIds).toHaveBeenCalledWith(['a1', 'a2']);
    expect(mocks.unscheduleAutomationCron).toHaveBeenCalledWith('a1');
    expect(mocks.unscheduleAutomationCron).toHaveBeenCalledWith('a2');
    expect(mocks.cancelRunsForAutomation).toHaveBeenCalledWith('a2', 'form deleted');
  });

  it('does nothing further when no automation is active', async () => {
    mocks.listActiveIdsByForm.mockResolvedValue([]);
    await disableFormIntegrations('form-1');
    expect(mocks.pauseByIds).not.toHaveBeenCalled();
  });

  it('still pauses automations when disabling plugins fails, and never throws', async () => {
    mocks.disableAllByForm.mockRejectedValue(new Error('db down'));
    mocks.listActiveIdsByForm.mockResolvedValue([{ id: 'a1' }]);

    await expect(disableFormIntegrations('form-1')).resolves.toBeUndefined();
    expect(mocks.pauseByIds).toHaveBeenCalledWith(['a1']);
  });
});
