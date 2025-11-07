/**
 * Expect Helper Utilities for Integration Tests
 *
 * Simple assertion utilities for Cucumber step definitions
 */

/**
 * Assert that a value is truthy
 */
export function expect(value: any, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected value to be truthy, but got: ${value}`);
  }
}

/**
 * Assert that two values are equal
 */
export function expectEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`
    );
  }
}

/**
 * Assert that two values are deeply equal (for objects/arrays)
 */
export function expectDeepEqual<T>(actual: T, expected: T, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);

  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${actualStr} to deeply equal ${expectedStr}`
    );
  }
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function expectDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || `Expected value to be defined, but got: ${value}`);
  }
}

/**
 * Assert that a value is null or undefined
 */
export function expectUndefined(value: any, message?: string): void {
  if (value !== null && value !== undefined) {
    throw new Error(message || `Expected value to be null or undefined, but got: ${value}`);
  }
}

/**
 * Assert that a string contains a substring
 */
export function expectContains(haystack: string, needle: string, message?: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(
      message || `Expected "${haystack}" to contain "${needle}"`
    );
  }
}

/**
 * Assert that an array contains a value
 */
export function expectArrayContains<T>(array: T[], value: T, message?: string): void {
  if (!array.includes(value)) {
    throw new Error(
      message || `Expected array to contain ${JSON.stringify(value)}, but got: ${JSON.stringify(array)}`
    );
  }
}

/**
 * Assert that a value is greater than another value
 */
export function expectGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(
      message || `Expected ${actual} to be greater than ${expected}`
    );
  }
}

/**
 * Assert that a value is less than another value
 */
export function expectLessThan(actual: number, expected: number, message?: string): void {
  if (actual >= expected) {
    throw new Error(
      message || `Expected ${actual} to be less than ${expected}`
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
 * Assert that an object has a property
 */
export function expectHasProperty(obj: any, property: string, message?: string): void {
  if (!(property in obj)) {
    throw new Error(
      message || `Expected object to have property "${property}", but got: ${JSON.stringify(obj)}`
    );
  }
}

/**
 * Assert that an array has a specific length
 */
export function expectLength(array: any[], length: number, message?: string): void {
  if (array.length !== length) {
    throw new Error(
      message || `Expected array length to be ${length}, but got ${array.length}`
    );
  }
}

/**
 * Assert that a function throws an error
 */
export async function expectThrows(
  fn: () => any | Promise<any>,
  message?: string
): Promise<void> {
  let threw = false;

  try {
    await fn();
  } catch (error) {
    threw = true;
  }

  if (!threw) {
    throw new Error(message || 'Expected function to throw an error, but it did not');
  }
}

/**
 * Assert that a response has a successful status
 */
export function expectSuccessResponse(response: any, message?: string): void {
  if (!response || !response.data) {
    throw new Error(message || `Expected successful response, but got: ${JSON.stringify(response)}`);
  }

  if (response.data.errors && response.data.errors.length > 0) {
    throw new Error(
      message || `Expected successful response, but got errors: ${JSON.stringify(response.data.errors)}`
    );
  }
}

/**
 * Assert that a GraphQL response has no errors
 */
export function expectNoGraphQLErrors(response: any, message?: string): void {
  if (response?.data?.errors && response.data.errors.length > 0) {
    throw new Error(
      message || `Expected no GraphQL errors, but got: ${JSON.stringify(response.data.errors)}`
    );
  }
}

/**
 * Assert that a GraphQL response has errors
 */
export function expectGraphQLError(response: any, errorMessage?: string): void {
  if (!response?.data?.errors || response.data.errors.length === 0) {
    throw new Error('Expected GraphQL errors, but response was successful');
  }

  if (errorMessage) {
    const hasMatchingError = response.data.errors.some((error: any) =>
      error.message.includes(errorMessage)
    );

    if (!hasMatchingError) {
      throw new Error(
        `Expected error message containing "${errorMessage}", but got: ${JSON.stringify(response.data.errors)}`
      );
    }
  }
}
