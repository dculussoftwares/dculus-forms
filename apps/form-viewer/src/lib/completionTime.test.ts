import { describe, it, expect } from 'vitest';
import { buildCompletionTimeInput } from './completionTime';

describe('buildCompletionTimeInput', () => {
  it('includes completionTimeSeconds when value is 0', () => {
    expect(buildCompletionTimeInput(0)).toEqual({ completionTimeSeconds: 0 });
  });

  it('includes completionTimeSeconds when value is positive', () => {
    expect(buildCompletionTimeInput(42)).toEqual({ completionTimeSeconds: 42 });
  });

  it('returns empty object when value is null (start time was not tracked)', () => {
    expect(buildCompletionTimeInput(null)).toEqual({});
  });
});
