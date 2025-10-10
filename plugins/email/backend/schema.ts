import { z } from 'zod';

/**
 * Email Plugin Configuration Schema
 */
export const emailConfigSchema = z.object({
  recipientEmail: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
  sendToSubmitter: z.boolean().default(false).optional(),
  submitterEmailFieldId: z.string().optional()
});

export type EmailPluginConfig = z.infer<typeof emailConfigSchema>;
