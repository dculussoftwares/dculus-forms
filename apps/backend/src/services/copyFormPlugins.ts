import { generateId } from '@dculus/utils';
import type { Prisma } from '#prisma-client';
import { pluginRepository } from '../repositories/index.js';
import { logger } from '../lib/logger.js';

/**
 * Copies every plugin from one form onto another when a form is duplicated.
 *
 * Before this, duplicating a form silently dropped its plugins: a customer who wired up a
 * submission-notification email or an outbound webhook and cloned the form for next
 * quarter lost all of it with no warning.
 *
 * Copies land DISABLED. A plugin points at an external destination — a webhook URL, a
 * mailing list, a Slack channel — and a copy that arrived enabled would start firing
 * deliveries alongside the original the moment the cloned form takes a submission, with
 * nothing in the UI to explain the duplicate traffic. The owner re-enables each one after
 * confirming where it points.
 *
 * Failures are logged, not thrown: losing the plugin configs is bad, failing the whole
 * form duplication over it is worse. Mirrors `copyAutomationsToForm`.
 */
export async function copyPluginsToForm(
  sourceFormId: string,
  targetFormId: string
): Promise<number> {
  try {
    const plugins = await pluginRepository.listByForm(sourceFormId);
    if (plugins.length === 0) return 0;

    for (const plugin of plugins) {
      await pluginRepository.create({
        data: {
          id: generateId(),
          formId: targetFormId,
          type: plugin.type,
          name: plugin.name,
          enabled: false,
          config: (plugin.config ?? {}) as Prisma.InputJsonValue,
          events: plugin.events,
        },
      });
    }

    logger.info(
      `✅ Copied ${plugins.length} plugin(s) from form ${sourceFormId} to ${targetFormId} (disabled)`
    );
    return plugins.length;
  } catch (error) {
    logger.error(
      `❌ Failed to copy plugins from form ${sourceFormId} to ${targetFormId}:`,
      error
    );
    return 0;
  }
}
