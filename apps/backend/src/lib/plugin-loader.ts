import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Plugin Loader
 *
 * Dynamically loads and initializes plugins from the /plugins directory.
 * This allows plugins to be completely independent and modular.
 */

interface PluginModule {
  initializeEmailPlugin?: () => void;
  shutdownEmailPlugin?: () => Promise<void>;
}

const loadedPlugins: Map<string, PluginModule> = new Map();

/**
 * Load a plugin by ID
 */
export async function loadPlugin(pluginId: string): Promise<PluginModule | null> {
  try {
    // Construct path to plugin service
    const pluginPath = join(__dirname, '../../../../plugins', pluginId, 'backend', `${pluginId}-plugin-service.js`);

    // Dynamic import of the plugin module
    const pluginModule = await import(pluginPath);

    loadedPlugins.set(pluginId, pluginModule);
    console.log(`✅ Loaded plugin: ${pluginId}`);

    return pluginModule;
  } catch (error: any) {
    console.error(`❌ Failed to load plugin ${pluginId}:`, error.message);
    return null;
  }
}

/**
 * Initialize all plugins
 */
export async function initializePlugins() {
  // For now, we'll manually load known plugins
  // In the future, this could scan the plugins directory
  const plugins = ['email'];

  for (const pluginId of plugins) {
    const plugin = await loadPlugin(pluginId);

    if (plugin && plugin.initializeEmailPlugin) {
      plugin.initializeEmailPlugin();
    }
  }

  console.log(`🔌 Initialized ${loadedPlugins.size} plugins`);
}

/**
 * Shutdown all plugins
 */
export async function shutdownPlugins() {
  for (const [pluginId, plugin] of loadedPlugins.entries()) {
    try {
      if (plugin.shutdownEmailPlugin) {
        await plugin.shutdownEmailPlugin();
      }
      console.log(`✅ Shutdown plugin: ${pluginId}`);
    } catch (error) {
      console.error(`❌ Failed to shutdown plugin ${pluginId}:`, error);
    }
  }

  loadedPlugins.clear();
}
