import { buildSubmittedAtGraphqlFilter } from '../submittedAtFilter';

describe('buildSubmittedAtGraphqlFilter', () => {
  test('returns null for "All time" (null filter)', () => {
    expect(buildSubmittedAtGraphqlFilter(null)).toBeNull();
  });

  test('maps last1d preset to DATE_LAST_N_DAYS with value "1"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last1d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '1',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps last7d preset to DATE_LAST_N_DAYS with value "7"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last7d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '7',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps last30d preset to DATE_LAST_N_DAYS with value "30"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last30d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '30',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps custom range to DATE_BETWEEN with ISO dateRange', () => {
    const from = new Date('2026-01-03T09:00:00.000-05:00');
    const to = new Date('2026-01-10T17:30:00.000-05:00');
    expect(buildSubmittedAtGraphqlFilter({ preset: 'custom', from, to })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_BETWEEN',
      value: undefined,
      values: undefined,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      numberRange: undefined,
    });
  });
});
