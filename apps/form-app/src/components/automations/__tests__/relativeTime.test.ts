import { formatRelativeTime } from '../relativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-18T12:00:00.000Z').getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();

  test('says "now" for very recent times', () => {
    expect(formatRelativeTime(ago(5_000), 'en', now)).toBe('now');
  });

  test('uses minutes, hours and days as appropriate', () => {
    expect(formatRelativeTime(ago(5 * 60_000), 'en', now)).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(3 * 3_600_000), 'en', now)).toBe('3 hours ago');
    expect(formatRelativeTime(ago(2 * 86_400_000), 'en', now)).toBe('2 days ago');
  });

  test('localizes the output', () => {
    expect(formatRelativeTime(ago(5 * 60_000), 'ta', now)).not.toBe('5 minutes ago');
  });
});
