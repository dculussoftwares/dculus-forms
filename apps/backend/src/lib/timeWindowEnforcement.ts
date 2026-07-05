import type { TimeWindowSettings } from '@dculus/types';
import { createGraphQLError } from '#graphql-errors';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';

const LEGACY_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `startDate`/`endDate` are either a legacy "YYYY-MM-DD" value (padded to
 * the server's local day boundary, unchanged behavior for forms saved
 * before time-of-day support existed) or a full ISO 8601 datetime string
 * (already an absolute UTC instant — no padding or timezone math needed).
 */
function parseTimeWindowBoundary(value: string, boundary: 'start' | 'end'): Date {
  if (LEGACY_DATE_ONLY_RE.test(value)) {
    return new Date(value + (boundary === 'start' ? 'T00:00:00' : 'T23:59:59'));
  }
  return new Date(value);
}

/**
 * Shared by both the `formByShortUrl` query (form-viewer landing) and the
 * `submitResponse` mutation (actual submission) so a form is gated
 * identically whether a visitor is just viewing it or submitting to it.
 */
export function enforceTimeWindow(timeWindow: TimeWindowSettings, now: Date = new Date()): void {
  if (!timeWindow.enabled) return;

  if (timeWindow.startDate) {
    const startDate = parseTimeWindowBoundary(timeWindow.startDate, 'start');
    if (isNaN(startDate.getTime())) {
      throw createGraphQLError('Form has an invalid start date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    if (now < startDate) {
      throw createGraphQLError('Form is not yet open for submissions', GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN);
    }
  }

  if (timeWindow.endDate) {
    const endDate = parseTimeWindowBoundary(timeWindow.endDate, 'end');
    if (isNaN(endDate.getTime())) {
      throw createGraphQLError('Form has an invalid end date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
    }
    if (now > endDate) {
      throw createGraphQLError('Form submission period has ended', GRAPHQL_ERROR_CODES.FORM_CLOSED);
    }
  }
}
