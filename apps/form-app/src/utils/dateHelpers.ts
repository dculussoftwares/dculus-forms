/**
 * Safely converts a date string (either ISO string or timestamp) to a Date object.
 * For full ISO datetime strings or numeric timestamps — keeps UTC semantics.
 * For date-only strings ("YYYY-MM-DD") use parseLocalDate instead.
 */
export const parseDate = (dateString: string): Date => {
  if (!isNaN(Number(dateString))) {
    return new Date(Number(dateString));
  }
  return new Date(dateString);
};

/**
 * Parses a "YYYY-MM-DD" date string as a LOCAL date (not UTC).
 *
 * WHY: `new Date("2024-01-04")` treats the string as UTC midnight.
 * In UTC+5:30 that becomes "2024-01-03 18:30 local" → shows as Jan 3.
 * Using new Date(y, m-1, d) always produces local midnight → correct day.
 */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Formats a Date as "YYYY-MM-DD" using LOCAL date parts.
 *
 * WHY: date.toISOString() converts to UTC first.
 * In UTC+5:30, selecting Jan 4 at local midnight gives UTC "2024-01-03T18:30Z",
 * so toISOString().split('T')[0] returns "2024-01-03" — off by one.
 * Reading local parts directly avoids this.
 */
export const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Checks if a date string represents an expired date
 */
export const isDateExpired = (dateString: string): boolean => {
  const date = parseDate(dateString);
  return new Date() > date;
};