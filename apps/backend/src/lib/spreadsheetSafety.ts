// Leading characters that make Excel / Sheets / LibreOffice evaluate a cell as a formula.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * Neutralizes spreadsheet formula injection: text that starts with a formula trigger gets a
 * leading single quote, which spreadsheet apps treat as a text marker. Plain numeric strings
 * are left alone because they cannot execute anything. Non-string values pass through.
 */
export function neutralizeFormula<T>(value: T): T | string {
  if (typeof value !== 'string' || !FORMULA_PREFIX.test(value) || PLAIN_NUMBER.test(value)) return value;
  return `'${value}`;
}
