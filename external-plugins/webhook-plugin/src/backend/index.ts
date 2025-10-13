/**
 * Webhook Notifier Plugin - Backend
 *
 * Sends form submission data to a custom webhook URL with:
 * - Retry logic (up to 3 attempts)
 * - Custom headers support
 * - Configurable timeout
 * - Detailed logging
 */

import { z } from 'zod';

// Note: These imports are from the internal codebase
// For external developers using @dculus/plugin-sdk, imports would be:
// import { BasePlugin, type PluginContext } from '@dculus/plugin-sdk';
import { BasePlugin, type PluginContext } from '../../../../apps/backend/src/plugins/base/BasePlugin.js';
import type { FormSubmittedEvent } from '../../../../apps/backend/src/lib/events.js';

// Plugin configuration interface
interface WebhookConfig {
  webhookUrl: string;
  method: 'POST' | 'PUT';
  customHeaders: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  includeMetadata: boolean;
  isEnabled: boolean;
}

/**
 * Webhook Notifier Plugin
 *
 * Posts form submission data to external webhook URLs
 */
export default class WebhookNotifierPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'webhook-notifier',
      name: 'Webhook Notifier',
      description: 'Send form submissions to a custom webhook URL with retry logic',
      icon: '🔔',
      category: 'integration',
      version: '1.0.0',
    });
  }

  /**
   * Define configuration schema
   */
  getConfigSchema() {
    return z.object({
      webhookUrl: z.string().url('Must be a valid URL'),
      method: z.enum(['POST', 'PUT']).default('POST'),
      customHeaders: z.record(z.string()).default({}),
      timeout: z.number().min(1000).max(30000).default(5000),
      retryAttempts: z.number().min(0).max(5).default(3),
      includeMetadata: z.boolean().default(true),
      isEnabled: z.boolean().default(true),
    });
  }

  /**
   * Handle form submission event
   */
  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext
  ): Promise<void> {
    const config = (await this.getConfig(event.formId)) as WebhookConfig | null;

    if (!config || !config.isEnabled) {
      console.log(`[WebhookNotifier] Plugin disabled for form: ${event.formId}`);
      return;
    }

    console.log(`[WebhookNotifier] Processing webhook for form: ${event.formId}`);

    // Fetch form and response data
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);
    const organization = await context.getOrganization();

    // Build webhook payload
    const payload: any = {
      event: 'form.submitted',
      timestamp: event.submittedAt.toISOString(),
      response: {
        id: response.id,
        data: response.data,
        submittedAt: response.submittedAt.toISOString(),
      },
    };

    // Add optional metadata
    if (config.includeMetadata) {
      payload.form = {
        id: form.id,
        title: form.title,
      };
      payload.organization = {
        id: organization.id,
        name: organization.name,
      };
    }

    // Send webhook with retry logic
    await this.sendWebhookWithRetry(config, payload);
  }

  /**
   * Send webhook with automatic retry logic
   */
  private async sendWebhookWithRetry(
    config: WebhookConfig,
    payload: any
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.retryAttempts + 1; attempt++) {
      try {
        console.log(`[WebhookNotifier] Attempt ${attempt} - Sending to ${config.webhookUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(config.webhookUrl, {
          method: config.method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Dculus-Forms-Webhook/1.0',
            ...config.customHeaders,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}: ${response.statusText}`);
        }

        console.log(`[WebhookNotifier] ✅ Successfully sent webhook (attempt ${attempt})`);
        console.log(`[WebhookNotifier] Response status: ${response.status}`);

        return; // Success - exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.error(`[WebhookNotifier] ❌ Attempt ${attempt} failed:`, error);

        if (attempt < config.retryAttempts + 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          console.log(`[WebhookNotifier] Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error(`[WebhookNotifier] ❌ All ${config.retryAttempts + 1} attempts failed`);
    throw new Error(
      `Failed to send webhook after ${config.retryAttempts + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Called when plugin is enabled for a form
   */
  async onEnabled(formId: string, config: WebhookConfig): Promise<void> {
    console.log(`[WebhookNotifier] ✅ Enabled for form: ${formId}`);
    console.log(`[WebhookNotifier] Webhook URL: ${config.webhookUrl}`);
    console.log(`[WebhookNotifier] Method: ${config.method}`);
    console.log(`[WebhookNotifier] Retry attempts: ${config.retryAttempts}`);
  }

  /**
   * Called when plugin is disabled for a form
   */
  async onDisabled(formId: string): Promise<void> {
    console.log(`[WebhookNotifier] ❌ Disabled for form: ${formId}`);
  }

  /**
   * Called when plugin is uninstalled from a form
   */
  async onUninstalled(formId: string): Promise<void> {
    console.log(`[WebhookNotifier] 🗑️ Uninstalled from form: ${formId}`);
  }
}
