/**
 * Hello World Plugin
 *
 * A simple demonstration plugin that logs a custom message to the backend console
 * when a form is submitted. Users can configure the message via the frontend UI.
 *
 * Features:
 * - Configurable text message
 * - Logs to backend console on form submission
 * - Demonstrates plugin configuration and event handling
 */

import { BasePlugin } from '../base/BasePlugin.js';
import type { FormSubmittedEvent } from '../../lib/events.js';
import { helloWorldConfigSchema, type HelloWorldConfig } from './schema.js';

export class HelloWorldPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'hello-world',
      name: 'Hello World',
      description:
        'A simple plugin that logs a custom message when forms are submitted. Perfect for testing the plugin system!',
      icon: '👋',
      category: 'automation',
      version: '1.0.0',
    });
  }

  /**
   * Return the configuration schema for validation
   */
  getConfigSchema() {
    return helloWorldConfigSchema;
  }

  /**
   * Handle form submission event
   * This is where the plugin's custom logic executes
   */
  async onFormSubmitted(event: FormSubmittedEvent): Promise<void> {
    // Get the plugin configuration for this form
    const config = await this.getConfig(event.formId);

    if (!config) {
      console.log(
        `[HelloWorld] No configuration found for form: ${event.formId}`
      );
      return;
    }

    const typedConfig = config as HelloWorldConfig;

    // Create a beautiful console output
    const separator = '='.repeat(60);
    const timestamp = new Date(event.submittedAt).toLocaleString();

    console.log('\n' + separator);
    console.log('🎉 HELLO WORLD PLUGIN TRIGGERED!');
    console.log(separator);
    console.log(`📝 Message: ${typedConfig.message}`);
    console.log(`📋 Form ID: ${event.formId}`);
    console.log(`🆔 Response ID: ${event.responseId}`);
    console.log(`🏢 Organization ID: ${event.organizationId}`);
    console.log(`⏰ Timestamp: ${timestamp}`);
    console.log(separator + '\n');

    // You could do anything here:
    // - Send HTTP requests
    // - Write to files
    // - Call external APIs
    // - Send emails
    // - Process form data
    // - Update database records
  }

  /**
   * Lifecycle hook: called when plugin is enabled
   */
  async onEnabled(formId: string, config: any): Promise<void> {
    const typedConfig = config as HelloWorldConfig;
    console.log(
      `[HelloWorld] Plugin enabled for form ${formId} with message: "${typedConfig.message}"`
    );
  }

  /**
   * Lifecycle hook: called when plugin is disabled
   */
  async onDisabled(formId: string): Promise<void> {
    console.log(`[HelloWorld] Plugin disabled for form ${formId}`);
  }

  /**
   * Lifecycle hook: called when plugin is uninstalled
   */
  async onUninstalled(formId: string): Promise<void> {
    console.log(`[HelloWorld] Plugin uninstalled from form ${formId}`);
  }
}
