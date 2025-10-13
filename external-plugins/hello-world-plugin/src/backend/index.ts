/**
 * Hello World External Plugin - Backend
 *
 * This is a simple example plugin that demonstrates:
 * - Extending BasePlugin
 * - Using PluginContext to access form data
 * - Configuration schema with Zod
 * - Event handling for form submissions
 */

import { z } from 'zod';

// Note: These imports are from the internal codebase
// When bundled, BasePlugin and PluginContext will be inlined
// For external developers, they would import from '@dculus/plugin-sdk'
import { BasePlugin, type PluginContext } from '../../../../apps/backend/src/plugins/base/BasePlugin.js';
import type { FormSubmittedEvent } from '../../../../apps/backend/src/lib/events.js';

// Plugin configuration interface
interface HelloWorldConfig {
  greeting: string;
  showTimestamp: boolean;
  showResponseData: boolean;
  isEnabled: boolean;
}

/**
 * Hello World External Plugin
 *
 * Logs a customizable greeting when forms are submitted
 */
export default class HelloWorldExternalPlugin extends BasePlugin {
  constructor(prismaClient: any) {
    super({
      id: 'hello-world-external',
      name: 'Hello World (External)',
      description: 'A simple external plugin that logs a greeting when forms are submitted',
      icon: '👋',
      category: 'automation',
      version: '1.0.0',
    }, prismaClient);
  }

  /**
   * Define configuration schema
   * This validates the plugin configuration in the UI
   */
  getConfigSchema() {
    return z.object({
      greeting: z.string().min(1, 'Greeting is required').default('Hello World'),
      showTimestamp: z.boolean().default(true),
      showResponseData: z.boolean().default(true),
      isEnabled: z.boolean().default(true),
    });
  }

  /**
   * Handle form submission event
   * This is called automatically when a form with this plugin enabled is submitted
   */
  async onFormSubmitted(
    event: FormSubmittedEvent,
    context: PluginContext
  ): Promise<void> {
    // Get plugin configuration for this form
    const config = (await this.getConfig(event.formId)) as HelloWorldConfig | null;

    if (!config || !config.isEnabled) {
      console.log(`[HelloWorldExternal] Plugin disabled for form: ${event.formId}`);
      return;
    }

    // Use PluginContext to fetch form and response data
    // All data access is automatically scoped to the organization
    const form = await context.getForm(event.formId);
    const response = await context.getResponse(event.responseId);
    const organization = await context.getOrganization();

    // Build output message
    const separator = '='.repeat(70);
    let output = '\n' + separator + '\n';
    output += `👋 ${config.greeting.toUpperCase()} - EXTERNAL PLUGIN!\n`;
    output += separator + '\n';

    if (config.showTimestamp) {
      const timestamp = new Date(event.submittedAt).toLocaleString();
      output += `⏰ Timestamp: ${timestamp}\n`;
    }

    output += `📋 Form: "${form.title}" (${event.formId})\n`;
    output += `🆔 Response ID: ${event.responseId}\n`;
    output += `🏢 Organization: "${organization.name}" (${organization.id})\n`;

    if (config.showResponseData) {
      output += `📊 Response Data:\n`;
      output += JSON.stringify(response.data, null, 2) + '\n';
    }

    output += separator + '\n';

    // Log the message
    console.log(output);

    // You could also:
    // - Send webhook to external service
    // - Store data in external database
    // - Send email/SMS notifications
    // - Integrate with third-party APIs
  }

  /**
   * Called when plugin is enabled for a form (optional lifecycle hook)
   */
  async onEnabled(formId: string, config: HelloWorldConfig): Promise<void> {
    console.log(`[HelloWorldExternal] ✅ Enabled for form: ${formId}`);
    console.log(`[HelloWorldExternal] Greeting: "${config.greeting}"`);
  }

  /**
   * Called when plugin is disabled for a form (optional lifecycle hook)
   */
  async onDisabled(formId: string): Promise<void> {
    console.log(`[HelloWorldExternal] ❌ Disabled for form: ${formId}`);
  }

  /**
   * Called when plugin is uninstalled from a form (optional lifecycle hook)
   */
  async onUninstalled(formId: string): Promise<void> {
    console.log(`[HelloWorldExternal] 🗑️ Uninstalled from form: ${formId}`);
  }
}
