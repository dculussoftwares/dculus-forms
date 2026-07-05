const LEGACY_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a Submission Limits time-window boundary value into a Date.
 *
 * `startDate`/`endDate` may be either a legacy "YYYY-MM-DD" string (forms
 * saved before time-of-day support was added — interpreted as local
 * midnight, matching the pre-existing behavior of @dculus/utils's
 * parseLocalDate/parseCalendarDate, duplicated here rather than imported —
 * see the note above this step) or a full ISO 8601 datetime string (an
 * already-absolute UTC instant, produced by `.toISOString()` when the user
 * picks a specific time).
 */
export function parseTimeWindowInstant(value: string): Date {
  if (LEGACY_DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}
