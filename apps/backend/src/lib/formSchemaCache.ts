/**
 * @fileoverview Centralised in-memory schema cache for the AI form editor.
 *
 * Phase 2.2: Extracted from aiChat.ts so that any route or service can
 * invalidate the cache when the form schema changes (e.g. after a Y.js push,
 * a manual DB update, or a template reset).
 *
 * TTL: 10 s — balances freshness vs. Y.js parse overhead on every turn.
 */

export interface CachedSchema {
  schema: { pages: any[] };
  cachedAt: number;
}

const SCHEMA_CACHE_TTL_MS = 10_000;

const cache = new Map<string, CachedSchema>();

/** Retrieve a cached schema, or null if it is missing / stale. */
export function getCachedSchema(formId: string): { pages: any[] } | null {
  const hit = cache.get(formId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt >= SCHEMA_CACHE_TTL_MS) {
    cache.delete(formId);
    return null;
  }
  return hit.schema;
}

/** Store a freshly-fetched schema in the cache. */
export function setCachedSchema(formId: string, schema: { pages: any[] }): void {
  cache.set(formId, { schema, cachedAt: Date.now() });
}

/**
 * Invalidate the cached schema for a specific form.
 * Call this whenever the form schema is mutated outside the AI editor
 * (e.g. Y.js sync push, manual DB update, template reset).
 */
export function invalidateCachedSchema(formId: string): void {
  cache.delete(formId);
}

/** Flush the entire cache. Useful for tests. */
export function clearSchemaCache(): void {
  cache.clear();
}

/** Return the current cache size (for telemetry / debugging). */
export function schemaCacheSize(): number {
  return cache.size;
}
