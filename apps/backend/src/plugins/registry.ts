import type { PluginHandler } from './types.js';

/**
 * Plugin Registry
 * Maps plugin types to their handler functions
 *
 * This registry allows for automatic plugin discovery and execution
 * without hard-coded switch statements throughout the codebase.
 */

// Registry mapping plugin types to handlers
const pluginRegistry: Map<string, PluginHandler> = new Map();

/**
 * Register a plugin handler
 * @param type - Plugin type identifier (e.g., 'webhook', 'email')
 * @param handler - Plugin handler function
 */
export const registerPlugin = (type: string, handler: PluginHandler): void => {
  if (pluginRegistry.has(type)) {
    console.warn(`[Plugin Registry] Plugin type "${type}" is already registered. Overwriting...`);
  }
  pluginRegistry.set(type, handler);
  console.log(`[Plugin Registry] Registered plugin type: ${type}`);
};

/**
 * Get handler for a specific plugin type
 * @param type - Plugin type identifier
 * @returns Plugin handler function or undefined if not found
 */
export const getPluginHandler = (type: string): PluginHandler | undefined => {
  return pluginRegistry.get(type);
};

/**
 * Check if a plugin type is registered
 * @param type - Plugin type identifier
 * @returns True if plugin is registered
 */
export const hasPlugin = (type: string): boolean => {
  return pluginRegistry.has(type);
};

/**
 * Get all registered plugin types
 * @returns Array of plugin type identifiers
 */
export const getAvailablePluginTypes = (): string[] => {
  return Array.from(pluginRegistry.keys());
};

/**
 * Unregister a plugin (useful for testing)
 * @param type - Plugin type identifier
 * @returns True if plugin was removed
 */
export const unregisterPlugin = (type: string): boolean => {
  return pluginRegistry.delete(type);
};

/**
 * Clear all registered plugins (useful for testing)
 */
export const clearRegistry = (): void => {
  pluginRegistry.clear();
};
