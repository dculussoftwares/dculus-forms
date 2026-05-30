import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getModelForPlan } from '../lib/ai.js';
import { logger } from '../lib/logger.js';

export type AIFormMode = 'quick' | 'standard' | 'professional';

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
  // Azure OpenAI structured output requires all properties in the required array;
  // use nullable instead of optional so every key is always present.
  placeholder: z.string().nullable().describe('Helper text inside the input, or null'),
  required: z.boolean(),
  options: z
    .array(AIFieldOptionSchema)
    .nullable()
    .describe('Option list for select/radio/checkbox types, or null for others'),
});

const AILayoutSchema = z.object({
  content: z
    .string()
    .describe(
      'HTML intro text shown above the form fields. Use only <h1> for the form title and <p> for a 1-2 sentence description. No other tags.'
    ),
  customCTAButtonName: z
    .string()
    .describe(
      'Short button label to start filling the form, e.g. "Submit Application", "Book Now", "Get Started", "Begin Survey". Max 4 words.'
    ),
});

const AIFormSchema = z.object({
  suggestedTitle: z.string().describe('A short title for this form'),
  fields: z
    .array(AIFieldSchema)
    .min(1)
    .max(20)
    .describe('The list of form fields to create'),
  layout: AILayoutSchema.describe('Intro content and CTA button text for the form'),
});

export type AIGeneratedField = z.infer<typeof AIFieldSchema>;
export type AIGeneratedLayout = z.infer<typeof AILayoutSchema>;
export type AIGeneratedForm = z.infer<typeof AIFormSchema> & { tokensUsed: number };

const LAYOUT_PROMPT = `
Also generate a layout object:
- content: HTML intro shown above the form. Use <h1> for the form title and one <p> with a 1-2 sentence description relevant to the form's purpose. No other HTML tags.
- customCTAButtonName: A short (max 4 words) action-oriented button label to start the form, matching the form's context (e.g. "Submit Application", "Book My Spot", "Start Survey", "Get Started").`;

const MODE_SYSTEM_PROMPTS: Record<AIFormMode, string> = {
  quick: `You are a form builder assistant. Create MINIMAL forms with at most 5 fields.
Focus only on the most essential information — nothing extra.
Use simple field types (text, email, number, textarea).
Keep labels short and direct. Set placeholder to null unless it genuinely helps.
Set options to null for non-choice fields.
${LAYOUT_PROMPT}`,

  standard: `You are a form builder assistant. Create well-balanced forms with 6–10 fields.
Include appropriate field types (text, email, number, date, select, radio, checkbox, textarea, file).
Mix field types naturally — use radio or select for categorical choices, textarea for long answers.
Keep labels concise and user-friendly. Set placeholder to null if not needed.
Set options to null for non-choice fields.
${LAYOUT_PROMPT}`,

  professional: `You are a form builder assistant. Create comprehensive, professional forms with 10–20 fields.
Use a rich variety of field types. Include detailed labels and helpful placeholder text where appropriate.
Group related fields logically. Use radio/select for categorical choices, checkboxes for multi-select,
textarea for open-ended answers, and specialized types (date, file, number) where natural.
Set options to null for non-choice fields. Set placeholder to null only if truly unnecessary.
${LAYOUT_PROMPT}`,
};

export async function generateFormWithAI(
  prompt: string,
  mode: AIFormMode = 'standard',
  userPlan: string = 'free'
): Promise<AIGeneratedForm> {
  logger.info({ prompt, mode }, 'Generating form with AI');

  const { output, usage } = await generateText({
    model: await getModelForPlan(userPlan, 'primary'),
    output: Output.object({ schema: AIFormSchema }),
    system: MODE_SYSTEM_PROMPTS[mode],
    prompt: `Create a form for: ${prompt}`,
  });

  const tokensUsed = usage?.totalTokens ?? 0;

  logger.info({ tokensUsed, fieldCount: output.fields.length, mode }, 'AI form generation complete');

  return { ...output, tokensUsed };
}
