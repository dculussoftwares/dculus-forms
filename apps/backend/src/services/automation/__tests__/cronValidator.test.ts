import { describe, it, expect } from 'vitest';
import {
  getMinCronIntervalMinutes,
  isCronTooFrequent,
  isValidCronExpression,
  isValidTimezone,
} from '../cronValidator.js';

describe('cronValidator', () => {
  describe('isValidCronExpression', () => {
    it.each([
      '0 9 * * *', // daily at 9am
      '0 0 * * 0', // weekly on Sunday midnight
      '0 0 1 * *', // monthly on the 1st
      '*/15 * * * *', // every 15 minutes
      '0 9-17 * * 1-5', // hourly range, weekday range
      '0,30 * * * *', // list
      '0 0 * * 7', // day-of-week 7 also means Sunday
    ])('accepts valid cron expression: %s', (cron) => {
      expect(isValidCronExpression(cron)).toBe(true);
    });

    it.each([
      '', // empty
      '   ', // blank
      '* * * *', // only 4 fields
      '* * * * * *', // 6 fields
      '60 * * * *', // minute out of range
      '* 24 * * *', // hour out of range
      '* * 0 * *', // day-of-month out of range (min 1)
      '* * 32 * *', // day-of-month out of range (max 31)
      '* * * 13 *', // month out of range
      '* * * * 8', // day-of-week out of range
      '* * * * abc', // non-numeric
      '*/0 * * * *', // zero step
      '1-2-3 * * * *', // malformed range
      'not a cron',
    ])('rejects invalid cron expression: %s', (cron) => {
      expect(isValidCronExpression(cron)).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isValidCronExpression(null)).toBe(false);
      expect(isValidCronExpression(undefined)).toBe(false);
      expect(isValidCronExpression(123)).toBe(false);
      expect(isValidCronExpression({})).toBe(false);
    });

    it('tolerates surrounding whitespace', () => {
      expect(isValidCronExpression('  0 9 * * *  ')).toBe(true);
    });
  });

  describe('isValidTimezone', () => {
    it('accepts real IANA timezone identifiers', () => {
      expect(isValidTimezone('America/Chicago')).toBe(true);
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('rejects bogus timezone strings', () => {
      expect(isValidTimezone('Not/A_Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });

    it('rejects non-string input', () => {
      expect(isValidTimezone(null)).toBe(false);
      expect(isValidTimezone(undefined)).toBe(false);
      expect(isValidTimezone(123)).toBe(false);
    });
  });

  describe('schedule frequency (S08-07)', () => {
    it.each([
      ['* * * * *', 1],
      ['*/5 * * * *', 5],
      ['*/7 * * * *', 4],
      ['0,10 * * * *', 10],
      ['0,50 * * * *', 10],
      ['0,50 9 * * *', 50],
      ['*/15 * * * *', 15],
      ['0,30 * * * *', 30],
      ['0 * * * *', 60],
      ['0 9 * * *', 60],
      ['0 9-10 * * *', 60],
    ])('computes minimum interval of %s as %i', (cron, expected) => {
      expect(getMinCronIntervalMinutes(cron)).toBe(expected);
    });

    it('flags crons firing more often than every 15 minutes', () => {
      expect(isCronTooFrequent('* * * * *')).toBe(true);
      expect(isCronTooFrequent('*/14 * * * *')).toBe(true);
      expect(isCronTooFrequent('*/15 * * * *')).toBe(false);
      expect(isCronTooFrequent('0 9 * * *')).toBe(false);
    });

    it('does not flag an invalid expression (validity is reported separately)', () => {
      expect(getMinCronIntervalMinutes('nope')).toBeNull();
      expect(isCronTooFrequent('nope')).toBe(false);
    });
  });
});
