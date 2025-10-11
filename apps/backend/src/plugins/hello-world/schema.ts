/**
 * Hello World Plugin - Configuration Schema
 *
 * Defines the Zod schema for validating plugin configuration.
 */

import { z } from 'zod';

export const helloWorldConfigSchema = z.object({
  message: z
    .string()
    .min(1, 'Message is required')
    .max(500, 'Message must be 500 characters or less'),
  isEnabled: z.boolean().default(true),
});

export type HelloWorldConfig = z.infer<typeof helloWorldConfigSchema>;
