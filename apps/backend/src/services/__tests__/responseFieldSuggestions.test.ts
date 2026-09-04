import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQueryRaw = vi.fn();

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { getDistinctResponseFieldValues, SUGGESTIBLE_FIELD_IDS } from '../responseFieldSuggestions.js';

describe('getDistinctResponseFieldValues', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns [] immediately for a fieldId with no suggestion support (no query issued)', async () => {
    const result = await getDistinctResponseFieldValues('form-1', '__gradePercentage');
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns [] for a plain form-field id', async () => {
    const result = await getDistinctResponseFieldValues('form-1', 'some-form-field-id');
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('unwraps { value } rows into a flat string array for __browser', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ value: 'Chrome' }, { value: 'Firefox' }]);
    const result = await getDistinctResponseFieldValues('form-1', '__browser', 'chr');
    expect(result).toEqual(['Chrome', 'Firefox']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('supports every field in SUGGESTIBLE_FIELD_IDS (each issues a query, none throws)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    for (const fieldId of SUGGESTIBLE_FIELD_IDS) {
      mockQueryRaw.mockClear();
      await expect(getDistinctResponseFieldValues('form-1', fieldId)).resolves.toEqual([]);
      expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    }
  });

  it('caps limit at 50 even when a larger value is requested', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await getDistinctResponseFieldValues('form-1', '__browser', undefined, 500);
    // The tagged-template call's args include the interpolated values in order;
    // the last one is the LIMIT value from buildRawQuery's template parts.
    const callArgs = mockQueryRaw.mock.calls[0];
    expect(callArgs).toContain(50);
  });

  it('floors limit at 1 even when zero or negative is requested', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await getDistinctResponseFieldValues('form-1', '__browser', undefined, -5);
    const callArgs = mockQueryRaw.mock.calls[0];
    expect(callArgs).toContain(1);
  });
});
