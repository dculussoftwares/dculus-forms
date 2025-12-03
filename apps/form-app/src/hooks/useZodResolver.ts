import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback } from 'react';
import type { ZodSchema } from 'zod';

/**
 * Custom zodResolver wrapper that handles ZodErrors thrown in production builds.
 * 
 * In production, zodResolver can throw ZodErrors as uncaught promise rejections
 * instead of properly returning them to react-hook-form's error state.
 * This wrapper catches those errors and converts them to the proper format.
 * 
 * @param schema - Zod validation schema
 * @returns A resolver function compatible with react-hook-form
 * 
 * @example
 * ```typescript
 * const schema = z.object({ name: z.string() });
 * const resolver = useZodResolver(schema);
 * 
 * const form = useForm({
 *   resolver,
 *   // ...other options
 * });
 * ```
 */
export const useZodResolver = (schema: ZodSchema) => {
    return useCallback(
        async (values: any, context: any, options: any) => {
            try {
                // Call the standard zodResolver
                const result = await zodResolver(schema as any)(values, context, options);
                return result;
            } catch (error: any) {
                // If it's a ZodError, convert it to react-hook-form format
                if (error?.issues) {
                    const formErrors: any = {};

                    for (const issue of error.issues) {
                        const path = issue.path.join('.');
                        formErrors[path] = {
                            type: issue.code,
                            message: issue.message,
                        };
                    }

                    return {
                        values: {},
                        errors: formErrors,
                    };
                }

                // If it's not a ZodError, re-throw it
                throw error;
            }
        },
        [schema]
    );
};
