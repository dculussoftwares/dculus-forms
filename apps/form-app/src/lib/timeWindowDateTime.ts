const LEGACY_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a Submission Limits time-window boundary value into a Date.
 *
 * `startDate`/`endDate` may be either a legacy "YYYY-MM-DD" string (forms
 * saved before time-of-day support was added — interpreted as local
 * midnight, matching the pre-existing behavior of @dculus/utils's
 * parseLocalDate/parseCalendarDate) or a full ISO 8601 datetime string (an
 * already-absolute UTC instant, produced by `.toISOString()` when the user
 * picks a specific time).
 *
 * The local-midnight logic is duplicated here rather than imported from
 * @dculus/utils because apps/form-app/jest.config.js cannot execute
 * @dculus/utils's compiled ESM dist output under Jest.
 */
export function parseTimeWindowInstant(value: string): Date {
  if (LEGACY_DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}
