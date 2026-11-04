/**
 * What the seed would change on an existing row. Used to skip no-op updates: an update
 * bumps updatedAt, which changes every generated image URL (?v=…) and would make the
 * landing sync report every template as changed on every deploy.
 */

/** JSON with sorted object keys — Postgres jsonb does not keep key order. */
export const canonicalJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v
  );

/** Field names whose stored value differs from the desired one ([] = nothing to do). */
export const changedFields = (row: Record<string, unknown>, desired: Record<string, unknown>): string[] =>
  Object.keys(desired).filter((key) => canonicalJson(row[key] ?? null) !== canonicalJson(desired[key] ?? null));
