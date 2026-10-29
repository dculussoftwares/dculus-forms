import { describe, it, expect } from 'vitest';
import { neutralizeFormula } from '../spreadsheetSafety.js';

describe('neutralizeFormula', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@SUM(A1)', '\t=1', '\r=1', '=HYPERLINK("http://x","y")'])(
    'prefixes %j',
    (value) => {
      expect(neutralizeFormula(value)).toBe(`'${value}`);
    }
  );

  it.each(['hello', '', ' =1', 'a=b', '-5', '+12.5', '42'])('leaves %j unchanged', (value) => {
    expect(neutralizeFormula(value)).toBe(value);
  });

  it('passes non-strings through', () => {
    expect(neutralizeFormula(5)).toBe(5);
    expect(neutralizeFormula(null)).toBeNull();
  });
});
