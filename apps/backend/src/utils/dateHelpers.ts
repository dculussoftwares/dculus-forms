/**
 * Safely converts a date string (either ISO string or timestamp) to a Date object
 */
export const parseDate = (dateString: string): Date => {
  // Check if it's a numeric timestamp
  if (!isNaN(Number(dateString))) {
    return new Date(Number(dateString));
  }
  // Otherwise treat as ISO string
  return new Date(dateString);
};

/**
 * Checks if a date string represents an expired date
 */
export const isDateExpired = (dateString: string): boolean => {
  const date = parseDate(dateString);
  return new Date() > date;
};