import { parseTimeWindowInstant } from '../timeWindowDateTime';

describe('parseTimeWindowInstant', () => {
  test('parses a legacy YYYY-MM-DD value as local midnight', () => {
    expect(parseTimeWindowInstant('2026-07-05').getTime()).toEqual(
      new Date(2026, 6, 5).getTime()
    );
  });

  test('parses a full ISO datetime as an absolute instant', () => {
    const iso = '2026-07-05T09:30:00.000Z';
    expect(parseTimeWindowInstant(iso).getTime()).toEqual(new Date(iso).getTime());
  });

  test('a full ISO instant with a time component differs from the legacy midnight for the same day', () => {
    const legacy = parseTimeWindowInstant('2026-07-05');
    const withTime = parseTimeWindowInstant('2026-07-05T09:30:00.000Z');
    expect(withTime.getTime()).not.toEqual(legacy.getTime());
  });
});
