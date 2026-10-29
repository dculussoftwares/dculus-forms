import { automationRepository } from '../repositories/automationRepository.js';
import { pluginRepository } from '../repositories/pluginRepository.js';
import { cancelRunsForAutomation } from './automation/triggerService.js';
import { unscheduleAutomationCron } from './automation/cronSchedule.js';
import { logger } from '../lib/logger.js';

/**
 * A soft-deleted form must stop emailing, posting and syncing its responses: disables its
 * plugins and pauses its active automations, cancelling their in-flight runs and cron schedules.
 * Best-effort per step so a failure here never blocks the deletion itself.
 */
export const disableFormIntegrations = async (formId: string): Promise<void> => {
  try {
    await pluginRepository.disableAllByForm(formId);
  } catch (error) {
    logger.error(`Failed to disable plugins for deleted form ${formId}:`, error);
  }

  try {
    const active = await automationRepository.listActiveIdsByForm(formId);
    if (active.length === 0) return;

    const ids = active.map(automation => automation.id);
    await automationRepository.pauseByIds(ids);
    for (const id of ids) {
      await unscheduleAutomationCron(id).catch(error =>
        logger.error(`Failed to unschedule cron for automation ${id}:`, error)
      );
      await cancelRunsForAutomation(id, 'form deleted');
    }
  } catch (error) {
    logger.error(`Failed to pause automations for deleted form ${formId}:`, error);
  }
};
