import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseDate, isDateExpired } from '../dateHelpers.js';

describe('dateHelpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseDate', () => {
    it('should parse ISO date string', () => {
      const isoString = '2024-05-15T10:30:00.000Z';
      const result = parseDate(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(isoString);
    });

    it('should parse numeric timestamp string', () => {
      const timestamp = '1715770200000'; // May 15, 2024 10:30:00 GMT
      const result = parseDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(1715770200000);
    });

    it('should parse timestamp as number converted to string', () => {
      const timestamp = String(Date.now());
      const result = parseDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(Number(timestamp));
    });

    it('should handle ISO string with timezone', () => {
      const isoString = '2024-05-15T10:30:00+05:30';
      const result = parseDate(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-05-15T05:00:00.000Z');
    });

    it('should handle ISO string without milliseconds', () => {
      const isoString = '2024-05-15T10:30:00Z';
      const result = parseDate(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-05-15T10:30:00.000Z');
    });

    it('should handle date-only ISO string', () => {
      const dateString = '2024-05-15';
      const result = parseDate(dateString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2024-05-15');
    });

    it('should handle timestamp 0 (Unix epoch)', () => {
      const result = parseDate('0');

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('1970-01-01T00:00:00.000Z');
    });

    it('should handle negative timestamp', () => {
      const timestamp = '-86400000'; // One day before epoch
      const result = parseDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(-86400000);
    });

    it('should handle future timestamp', () => {
      const futureTimestamp = '2556057600000'; // Jan 1, 2051
      const result = parseDate(futureTimestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(2556057600000);
    });

    it('should handle current timestamp', () => {
      const now = Date.now();
      const result = parseDate(String(now));

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(now);
    });

    it('should handle ISO string with fractional seconds', () => {
      const isoString = '2024-05-15T10:30:00.123Z';
      const result = parseDate(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(isoString);
    });

    it('should handle ISO string with microseconds', () => {
      const isoString = '2024-05-15T10:30:00.123456Z';
      const result = parseDate(isoString);

      expect(result).toBeInstanceOf(Date);
      // JavaScript Date only supports milliseconds, so microseconds are truncated
      expect(result.toISOString()).toBe('2024-05-15T10:30:00.123Z');
    });

    it('should distinguish between timestamp and ISO string', () => {
      const timestamp = '1715765400000'; // May 15, 2024 09:30:00 GMT
      const isoString = '2024-05-15T09:30:00.000Z';

      const resultTimestamp = parseDate(timestamp);
      const resultISO = parseDate(isoString);

      expect(resultTimestamp.toISOString()).toBe('2024-05-15T09:30:00.000Z');
      expect(resultISO.toISOString()).toBe('2024-05-15T09:30:00.000Z');
    });

    it('should handle whitespace in ISO string', () => {
      const isoString = ' 2024-05-15T10:30:00Z ';
      const result = parseDate(isoString);

      // Date constructor handles whitespace
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle invalid date string', () => {
      const invalidString = 'not-a-date';
      const result = parseDate(invalidString);

      expect(result).toBeInstanceOf(Date);
      expect(isNaN(result.getTime())).toBe(true);
    });

    it('should handle empty string', () => {
      const result = parseDate('');

      expect(result).toBeInstanceOf(Date);
      // Empty string might be treated as epoch or NaN depending on implementation
      // Since Number('') is 0, it will create epoch date
      expect(result.getTime()).toBe(0); // Epoch
    });

    it('should handle very large timestamp', () => {
      const largeTimestamp = '8640000000000000'; // Maximum timestamp
      const result = parseDate(largeTimestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(8640000000000000);
    });

    it('should handle very small timestamp', () => {
      const smallTimestamp = '-8640000000000000'; // Minimum timestamp
      const result = parseDate(smallTimestamp);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(-8640000000000000);
    });

    it('should parse date string in different formats', () => {
      // RFC 2822 format
      const rfc2822 = 'Wed, 15 May 2024 10:30:00 GMT';
      const result = parseDate(rfc2822);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2024-05-15T10:30:00.000Z');
    });

    it('should handle short date format', () => {
      const shortDate = '5/15/2024';
      const result = parseDate(shortDate);

      expect(result).toBeInstanceOf(Date);
      expect(result.getMonth()).toBe(4); // May is month 4 (0-indexed)
      expect(result.getDate()).toBe(15);
      expect(result.getFullYear()).toBe(2024);
    });

    it('should consistently handle same input', () => {
      const input = '2024-05-15T10:30:00.000Z';

      const result1 = parseDate(input);
      const result2 = parseDate(input);

      expect(result1.getTime()).toBe(result2.getTime());
    });

    it('should handle timestamp with decimal point', () => {
      const timestamp = '1715770200000.5';
      const result = parseDate(timestamp);

      expect(result).toBeInstanceOf(Date);
      // JavaScript will parse this as a number and truncate decimals
      expect(result.getTime()).toBe(1715770200000);
    });
  });

  describe('isDateExpired', () => {
    it('should return true for past date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const pastDate = '2024-05-15T10:00:00.000Z';
      const result = isDateExpired(pastDate);

      expect(result).toBe(true);
    });

    it('should return false for future date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const futureDate = '2024-05-15T14:00:00.000Z';
      const result = isDateExpired(futureDate);

      expect(result).toBe(false);
    });

    it('should return false for current date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const currentDate = '2024-05-15T12:00:00.000Z';
      const result = isDateExpired(currentDate);

      expect(result).toBe(false);
    });

    it('should handle timestamp format for past date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const pastTimestamp = String(now.getTime() - 3600000); // 1 hour ago
      const result = isDateExpired(pastTimestamp);

      expect(result).toBe(true);
    });

    it('should handle timestamp format for future date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const futureTimestamp = String(now.getTime() + 3600000); // 1 hour from now
      const result = isDateExpired(futureTimestamp);

      expect(result).toBe(false);
    });

    it('should return true for date one day ago', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const yesterday = '2024-05-14T12:00:00.000Z';
      const result = isDateExpired(yesterday);

      expect(result).toBe(true);
    });

    it('should return false for date one day ahead', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const tomorrow = '2024-05-16T12:00:00.000Z';
      const result = isDateExpired(tomorrow);

      expect(result).toBe(false);
    });

    it('should return true for date one second ago', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const oneSecondAgo = '2024-05-15T11:59:59.000Z';
      const result = isDateExpired(oneSecondAgo);

      expect(result).toBe(true);
    });

    it('should return false for date one second ahead', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const oneSecondAhead = '2024-05-15T12:00:01.000Z';
      const result = isDateExpired(oneSecondAhead);

      expect(result).toBe(false);
    });

    it('should return true for date one millisecond ago', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const oneMillisecondAgo = String(now.getTime() - 1);
      const result = isDateExpired(oneMillisecondAgo);

      expect(result).toBe(true);
    });

    it('should return false for date one millisecond ahead', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const oneMillisecondAhead = String(now.getTime() + 1);
      const result = isDateExpired(oneMillisecondAhead);

      expect(result).toBe(false);
    });

    it('should handle epoch date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const epoch = '0';
      const result = isDateExpired(epoch);

      expect(result).toBe(true);
    });

    it('should handle far future date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const farFuture = '2050-01-01T00:00:00.000Z';
      const result = isDateExpired(farFuture);

      expect(result).toBe(false);
    });

    it('should handle far past date', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const farPast = '2000-01-01T00:00:00.000Z';
      const result = isDateExpired(farPast);

      expect(result).toBe(true);
    });

    it('should handle different timezones', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const withTimezone = '2024-05-15T10:00:00+05:30'; // Converts to 04:30 UTC
      const result = isDateExpired(withTimezone);

      expect(result).toBe(true);
    });

    it('should consistently evaluate same input', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const pastDate = '2024-05-15T10:00:00.000Z';

      const result1 = isDateExpired(pastDate);
      const result2 = isDateExpired(pastDate);

      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });

    it('should handle invalid date string', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const invalidDate = 'invalid-date';
      const result = isDateExpired(invalidDate);

      // Invalid dates result in NaN, which fails the comparison
      expect(result).toBe(false);
    });

    it('should update correctly when system time changes', () => {
      // Set initial time
      vi.setSystemTime(new Date('2024-05-15T12:00:00.000Z'));

      const testDate = '2024-05-15T13:00:00.000Z';

      // Should be future
      expect(isDateExpired(testDate)).toBe(false);

      // Advance time past the test date
      vi.setSystemTime(new Date('2024-05-15T14:00:00.000Z'));

      // Should now be past
      expect(isDateExpired(testDate)).toBe(true);
    });

    it('should handle date exactly at midnight', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const midnight = '2024-05-15T00:00:00.000Z';
      const result = isDateExpired(midnight);

      expect(result).toBe(true);
    });

    it('should handle date at end of year', () => {
      const now = new Date('2024-01-01T00:00:00.000Z');
      vi.setSystemTime(now);

      const endOfLastYear = '2023-12-31T23:59:59.999Z';
      const result = isDateExpired(endOfLastYear);

      expect(result).toBe(true);
    });

    it('should handle leap year date', () => {
      const now = new Date('2024-03-01T00:00:00.000Z');
      vi.setSystemTime(now);

      const leapDay = '2024-02-29T00:00:00.000Z';
      const result = isDateExpired(leapDay);

      expect(result).toBe(true);
    });

    it('should handle daylight saving time transition', () => {
      const now = new Date('2024-03-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const dstDate = '2024-03-10T12:00:00.000Z';
      const result = isDateExpired(dstDate);

      expect(result).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should parse and check expiration in workflow', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const tokenExpiry = '2024-05-15T14:00:00.000Z';

      const parsedDate = parseDate(tokenExpiry);
      expect(parsedDate).toBeInstanceOf(Date);

      const isExpired = isDateExpired(tokenExpiry);
      expect(isExpired).toBe(false);

      // Token is valid for 2 more hours
      expect(parsedDate.getTime() - now.getTime()).toBe(7200000);
    });

    it('should handle timestamp-based expiration check', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const expiryTimestamp = String(now.getTime() + 3600000); // 1 hour from now

      const parsed = parseDate(expiryTimestamp);
      const expired = isDateExpired(expiryTimestamp);

      expect(parsed.getTime()).toBe(now.getTime() + 3600000);
      expect(expired).toBe(false);
    });

    it('should validate token expiration', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const validToken = '2024-05-15T14:00:00.000Z';
      const expiredToken = '2024-05-15T10:00:00.000Z';

      expect(isDateExpired(validToken)).toBe(false);
      expect(isDateExpired(expiredToken)).toBe(true);
    });

    it('should handle session timeout scenario', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const sessionStart = now.getTime();
      const sessionDuration = 1800000; // 30 minutes
      const sessionExpiry = String(sessionStart + sessionDuration);

      // Immediately after creation
      expect(isDateExpired(sessionExpiry)).toBe(false);

      // After 20 minutes
      vi.setSystemTime(new Date(sessionStart + 1200000));
      expect(isDateExpired(sessionExpiry)).toBe(false);

      // After 35 minutes (expired)
      vi.setSystemTime(new Date(sessionStart + 2100000));
      expect(isDateExpired(sessionExpiry)).toBe(true);
    });

    it('should handle multiple date formats in same workflow', () => {
      const now = new Date('2024-05-15T12:00:00.000Z');
      vi.setSystemTime(now);

      const isoDate = '2024-05-15T14:00:00.000Z';
      const timestampDate = String(now.getTime() + 7200000); // Same as isoDate

      const parsedISO = parseDate(isoDate);
      const parsedTimestamp = parseDate(timestampDate);

      expect(parsedISO.getTime()).toBe(parsedTimestamp.getTime());
      expect(isDateExpired(isoDate)).toBe(isDateExpired(timestampDate));
    });
  });
});
