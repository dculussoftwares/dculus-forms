/**
 * Recursively flattens nested error objects from react-hook-form.
 * 
 * Converts nested error structures like:
 * ```
 * { validation: { maxLength: { message: '...' } } }
 * ```
 * 
 * To flat structures like:
 * ```
 * { 'validation.maxLength': { message: '...' } }
 * ```
 * 
 * This is useful when working with nested form schemas where errors
 * may be deeply nested but need to be displayed in a flat list.
 * 
 * @param errors - The nested errors object from react-hook-form
 * @param prefix - Internal parameter for recursion (leave empty when calling)
 * @returns Flattened errors object with dot-notation keys
 * 
 * @example
 * ```typescript
 * const errors = {
 *   validation: {
 *     minLength: { message: 'Too short' },
 *     maxLength: { message: 'Too long' }
 *   }
 * };
 * 
 * const flat = flattenErrors(errors);
 * // Result: {
 * //   'validation.minLength': { message: 'Too short' },
 * //   'validation.maxLength': { message: 'Too long' }
 * // }
 * ```
 */
export const flattenErrors = (
    errors: Record<string, any>,
    prefix = ''
): Record<string, any> => {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(errors)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        // If this is an error object with a message, include it
        if (value && typeof value === 'object' && 'message' in value) {
            flattened[fullKey] = value;
        }
        // If this is a nested error object without a message, recurse
        else if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(flattened, flattenErrors(value, fullKey));
        }
    }

    return flattened;
};
