import { generateObject } from 'ai';
import { z } from 'zod';
import { getPrimaryModel } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

const AIFieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const AIFieldSchema = z.object({
  type: z.enum([
    'text',
    'textarea',
    'email',
    'number',
    'date',
    'select',
    'radio',
    'checkbox',
    'file',
  ]),
  label: z.string().describe('The question or field label shown to users'),
  placeholder: z.string().optional().describe('Helper text inside the input'),
  required: z.boolean().default(false),
  options: z
    .array(AIFieldOptionSchema)
    .optional()
    .describe('Required for select, radio, checkbox types'),
});

const AIFormSchema = z.object({
  suggestedTitle: z.string().describe('A short title for this form'),
  fields: z
    .array(AIFieldSchema)
    .min(1)
    .max(20)
    .describe('The list of form fields to create'),
});

export type AIGeneratedField = z.infer<typeof AIFieldSchema>;
export type AIGeneratedForm = z.infer<typeof AIFormSchema> & { tokensUsed: number };

export async function generateFormWithAI(prompt: string): Promise<AIGeneratedForm> {
  logger.info({ prompt }, 'Generating form with AI');

  const { object, usage } = await generateObject({
    model: getPrimaryModel(),
    schema: AIFormSchema,
    system: `You are a form builder assistant. When given a description, produce a well-structured form with appropriate field types.
Use "text" for short free-text answers, "textarea" for long answers, "email" for email addresses,
"number" for numeric values, "date" for dates, "select" or "radio" for single-choice from a list,
"checkbox" for multiple selections, and "file" for file uploads.
Always include a mix of field types that best suits the use case described.
Keep labels concise and user-friendly. Add placeholder text where it helps clarify expected input.`,
    prompt: `Create a form for: ${prompt}`,
  });

  const tokensUsed = (usage?.totalTokens ?? 0);

  logger.info({ tokensUsed, fieldCount: object.fields.length }, 'AI form generation complete');

  return { ...object, tokensUsed };
}
