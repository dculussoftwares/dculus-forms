type SettingsRecord = Record<string, unknown>;

const asRecord = (value: unknown): SettingsRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as SettingsRecord) : {};

/**
 * `settings` is persisted as a single JSON column, so writing the incoming
 * object as-is would silently erase every key the caller left out — including
 * the OWNER-only `accessControl` / `collectRespondentEmail`. Keys that are
 * absent (`undefined`) from the incoming object are therefore "unchanged".
 */
export function mergeFormSettings(persisted: unknown, incoming: unknown): SettingsRecord {
  const merged: SettingsRecord = { ...asRecord(persisted) };
  for (const [key, value] of Object.entries(asRecord(incoming))) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

// Order-insensitive on `allowedDomains` so re-saving the same domain list in
// a different order isn't treated as a change requiring OWNER re-approval.
// Never-configured (null/undefined) and explicitly-disabled-with-no-domains
// must normalize to the SAME value — the frontend always sends a populated
// default accessControl object on every settings save (useFormSettings.ts),
// so treating "absent" and "default" as different would require OWNER
// permission for every settings save on every form that predates this field.
export function normalizeAccessControlForComparison(accessControl: any) {
  return {
    enabled: !!accessControl?.enabled,
    requireSignIn: !!accessControl?.requireSignIn,
    allowedDomains: [...(accessControl?.allowedDomains ?? [])].map((d: string) => d.toLowerCase()).sort(),
  };
}

export function hasAccessControlChanged(persisted: unknown, next: unknown): boolean {
  return (
    JSON.stringify(normalizeAccessControlForComparison(asRecord(persisted).accessControl ?? null)) !==
    JSON.stringify(normalizeAccessControlForComparison(asRecord(next).accessControl ?? null))
  );
}

export function hasCollectRespondentEmailChanged(persisted: unknown, next: unknown): boolean {
  return !!asRecord(persisted).collectRespondentEmail !== !!asRecord(next).collectRespondentEmail;
}
