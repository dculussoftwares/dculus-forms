import type { DateTimeRangeValue } from '@dculus/ui';

export interface SubmittedAtGraphqlFilter {
  fieldId: '__submittedAt';
  operator: 'DATE_LAST_N_DAYS' | 'DATE_BETWEEN';
  value?: string;
  values?: string[];
  dateRange?: { from?: string; to?: string };
  numberRange?: { min?: number; max?: number };
}

const PRESET_DAYS: Record<'last1d' | 'last7d' | 'last30d', string> = {
  last1d: '1',
  last7d: '7',
  last30d: '30',
};

export function buildSubmittedAtGraphqlFilter(
  filter: DateTimeRangeValue | null
): SubmittedAtGraphqlFilter | null {
  if (!filter) return null;

  if (filter.preset === 'custom') {
    return {
      fieldId: '__submittedAt',
      operator: 'DATE_BETWEEN',
      value: undefined,
      values: undefined,
      dateRange: { from: filter.from.toISOString(), to: filter.to.toISOString() },
      numberRange: undefined,
    };
  }

  return {
    fieldId: '__submittedAt',
    operator: 'DATE_LAST_N_DAYS',
    value: PRESET_DAYS[filter.preset],
    values: undefined,
    dateRange: undefined,
    numberRange: undefined,
  };
}
