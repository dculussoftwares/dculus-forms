const UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
];

/** "5 minutes ago" / "just now", localized — so Tamil users don't get English fragments. */
export function formatRelativeTime(value: string | number | Date, locale: string, now: number = Date.now()): string {
  const elapsed = now - new Date(value).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const { unit, ms } of UNITS) {
    if (Math.abs(elapsed) >= ms) {
      return formatter.format(-Math.round(elapsed / ms), unit);
    }
  }
  return formatter.format(0, 'second');
}
