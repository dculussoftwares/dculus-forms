/**
 * Frontend mirror of apps/backend/src/services/automation/cronValidator.ts (#201) — kept as a
 * separate copy (not a shared package import) since the backend module lives outside form-app's
 * build graph, same reason types.ts in this folder mirrors the backend graph types by hand.
 * Used for instant client-side feedback in the schedule trigger config panel; the server
 * re-validates authoritatively on save/activate regardless.
 */

interface FieldRange {
  min: number;
  max: number;
}

const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day of week (0 and 7 both mean Sunday)
];

function isValidCronField(field: string, { min, max }: FieldRange): boolean {
  if (field.length === 0) return false;
  return field.split(',').every((part) => {
    const [rangeOrValue, step] = part.split('/');
    if (part.split('/').length > 2) return false;
    if (step !== undefined && !/^\d+$/.test(step)) return false;
    if (step !== undefined && Number(step) <= 0) return false;

    if (rangeOrValue === '*') return true;

    const rangeMatch = /^(\d+)-(\d+)$/.exec(rangeOrValue);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      return start >= min && end <= max && start <= end;
    }

    if (/^\d+$/.test(rangeOrValue)) {
      const value = Number(rangeOrValue);
      return value >= min && value <= max;
    }

    return false;
  });
}

/** Validates a standard 5-field cron expression (minute hour day-of-month month day-of-week). */
export function isValidCronExpression(cron: unknown): cron is string {
  if (typeof cron !== 'string') return false;
  const trimmed = cron.trim();
  if (trimmed.length === 0) return false;

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) return false;

  return fields.every((field, index) => isValidCronField(field, FIELD_RANGES[index]));
}

/** Validates an IANA timezone identifier using the runtime's own Intl support (no new deps). */
export function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || timezone.trim().length === 0) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
