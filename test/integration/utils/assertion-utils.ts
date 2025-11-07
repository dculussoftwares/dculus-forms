/**
 * Assertion utilities for integration tests
 * These utilities provide consistent error messages across test scenarios
 */

/**
 * Assert that a value is defined (not null or undefined)
 */
export function expectDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined, but got null or undefined');
  }
}

/**
 * Assert that two values are equal
 */
export function expectEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    const errorMessage = message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`;
    throw new Error(errorMessage);
  }
}

/**
 * Assert that a value is truthy
 */
export function expectTruthy(value: any, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected value to be truthy, but got ${JSON.stringify(value)}`);
  }
}

/**
 * Assert that a value is falsy
 */
export function expectFalsy(value: any, message?: string): void {
  if (value) {
    throw new Error(message || `Expected value to be falsy, but got ${JSON.stringify(value)}`);
  }
}

/**
 * Assert that a value includes a substring or item
 */
export function expectIncludes<T>(array: T[] | string, item: T | string, message?: string): void {
  const includes = Array.isArray(array)
    ? array.includes(item as T)
    : (array as string).includes(item as string);

  if (!includes) {
    throw new Error(message || `Expected ${JSON.stringify(array)} to include ${JSON.stringify(item)}`);
  }
}

/**
 * Assert that an array has a specific length
 */
export function expectLength<T>(array: T[], expectedLength: number, message?: string): void {
  if (array.length !== expectedLength) {
    throw new Error(
      message || `Expected array length to be ${expectedLength}, but got ${array.length}`
    );
  }
}

/**
 * Assert that a value matches a regex pattern
 */
export function expectMatch(value: string, pattern: RegExp, message?: string): void {
  if (!pattern.test(value)) {
    throw new Error(
      message || `Expected "${value}" to match pattern ${pattern}`
    );
  }
}

/**
 * Assert that a function throws an error
 */
export async function expectThrows(
  fn: () => any | Promise<any>,
  expectedErrorMessage?: string | RegExp
): Promise<void> {
  try {
    await fn();
    throw new Error('Expected function to throw, but it did not');
  } catch (error: any) {
    if (expectedErrorMessage) {
      const errorMessage = error.message || String(error);
      if (typeof expectedErrorMessage === 'string') {
        if (!errorMessage.includes(expectedErrorMessage)) {
          throw new Error(
            `Expected error message to include "${expectedErrorMessage}", but got "${errorMessage}"`
          );
        }
      } else {
        if (!expectedErrorMessage.test(errorMessage)) {
          throw new Error(
            `Expected error message to match ${expectedErrorMessage}, but got "${errorMessage}"`
          );
        }
      }
    }
  }
}
