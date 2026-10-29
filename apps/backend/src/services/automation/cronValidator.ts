// Tiny standalone validator for standard 5-field cron expressions (minute hour dom month dow) —
// no heavyweight dependency (issue #201). pg-boss's own scheduler accepts the same 5-field
// format (6-field/seconds is discouraged since schedules are only checked every ~30s).

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

/** Shortest gap a schedule automation may run at; a per-minute cron would flood runs and the queue. */
export const MIN_SCHEDULE_INTERVAL_MINUTES = 15;

function expandCronField(field: string, { min, max }: FieldRange): number[] {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const [rangeOrValue, step] = part.split('/');
    const stepSize = step === undefined ? 1 : Number(step);
    let start = min;
    let end = max;
    if (rangeOrValue !== '*') {
      const range = /^(\d+)-(\d+)$/.exec(rangeOrValue);
      start = range ? Number(range[1]) : Number(rangeOrValue);
      // `5/10` means "from 5 to the end of the range, every 10".
      end = range ? Number(range[2]) : step === undefined ? start : max;
    }
    for (let value = start; value <= end; value += stepSize) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
}

/**
 * Smallest gap, in minutes, between two firings of a valid cron expression, looking only at the
 * minute and hour fields (day/month/weekday only ever remove firings, never add closer ones).
 * Returns null for an invalid expression.
 */
export function getMinCronIntervalMinutes(cron: unknown): number | null {
  if (!isValidCronExpression(cron)) return null;
  const [minuteField, hourField] = cron.trim().split(/\s+/);
  const minutes = expandCronField(minuteField, FIELD_RANGES[0]);
  const hours = expandCronField(hourField, FIELD_RANGES[1]);

  let smallest = Infinity;
  for (let i = 1; i < minutes.length; i++) smallest = Math.min(smallest, minutes[i] - minutes[i - 1]);

  // Firings in consecutive hours (including 23 -> 0) are separated by the wrap-around gap.
  const hourSet = new Set(hours);
  const hasConsecutiveHours = hours.some((hour) => hourSet.has((hour + 1) % 24));
  if (hasConsecutiveHours) smallest = Math.min(smallest, 60 - minutes[minutes.length - 1] + minutes[0]);

  // Across hours that are not adjacent the gap is at least an hour, which always passes.
  return Number.isFinite(smallest) ? smallest : 60;
}

/** True when the cron fires more often than {@link MIN_SCHEDULE_INTERVAL_MINUTES} allows. */
export function isCronTooFrequent(cron: unknown): boolean {
  const interval = getMinCronIntervalMinutes(cron);
  return interval !== null && interval < MIN_SCHEDULE_INTERVAL_MINUTES;
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
