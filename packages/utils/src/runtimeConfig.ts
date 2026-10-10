type RuntimeConfig = Record<string, string | undefined>;

/**
 * Reads a value injected at deploy time through /config.js (`window.__APP_CONFIG__`),
 * falling back to the build-time value (Vite env) for local development.
 */
export function getRuntimeConfig(key: string, buildTimeValue?: string): string | undefined {
  const injected = (globalThis as { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__?.[key];
  return injected || buildTimeValue || undefined;
}
