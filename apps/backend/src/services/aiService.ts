import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getFastModel, getPrimaryModel } from '../lib/ai.js';
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
    'phone',
  ]),
  label: z.string().describe('The question or field label shown to users'),
  // Use nullable instead of optional so every key is always present in the JSON output.
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

const JSON_SCHEMA_RULES = `
You MUST respond with valid JSON matching EXACTLY this structure — no extra keys, no wrapping object:
{
  "suggestedTitle": "Short form title",
  "fields": [
    {
      "type": "text",
      "label": "Field label",
      "placeholder": "Hint text or null",
      "required": true,
      "options": null
    }
  ],
  "layout": {
    "content": "<h1>Title</h1><p>One or two sentence description.</p>",
    "customCTAButtonName": "Submit"
  }
}

Strict rules:
- "suggestedTitle" MUST be a short descriptive title string.
- Each field MUST have: type, label, placeholder (string or null), required (boolean), options (array or null).
- "required" MUST be true or false — never omit it.
- "placeholder" MUST be a string or null — never omit it.
- "options" MUST be an array of {"value": "...", "label": "..."} objects for select/radio/checkbox fields; null for all other field types.
- "layout.content" MUST use only <h1> and <p> tags — no other HTML.
- "layout.customCTAButtonName" MUST be a short action-oriented label (max 4 words).`;

const MODE_SYSTEM_PROMPTS: Record<AIFormMode, string> = {
  quick: `You are a form builder assistant. Create MINIMAL forms with at most 5 fields.
Focus only on the most essential information — nothing extra.
Use simple field types (text, email, number, textarea).
Keep labels short and direct. Set placeholder to null unless it genuinely helps.
Set options to null for non-choice fields.
${JSON_SCHEMA_RULES}`,

  standard: `You are a form builder assistant. Create well-balanced forms with 6–10 fields.
Include appropriate field types (text, email, phone, number, date, select, radio, checkbox, textarea, file).
Mix field types naturally — use radio or select for categorical choices, textarea for long answers,
and phone for phone/contact-number questions instead of a plain text field.
Keep labels concise and user-friendly. Set placeholder to null if not needed.
Set options to null for non-choice fields.
${JSON_SCHEMA_RULES}`,

  professional: `You are a form builder assistant. Create comprehensive, professional forms with 10–20 fields.
Use a rich variety of field types. Include detailed labels and helpful placeholder text where appropriate.
Group related fields logically. Use radio/select for categorical choices, checkboxes for multi-select,
textarea for open-ended answers, and specialized types (date, file, number, phone) where natural —
use phone specifically for phone/contact-number questions instead of a plain text field.
Set options to null for non-choice fields. Set placeholder to null only if truly unnecessary.
${JSON_SCHEMA_RULES}`,
};

export async function generateFormWithAI(
  prompt: string,
  mode: AIFormMode = 'standard'
): Promise<AIGeneratedForm> {
  logger.info({ prompt, mode }, 'Generating form with AI');

  const { output, usage } = await generateText({
    model: getPrimaryModel(),
    output: Output.object({ schema: AIFormSchema }),
    system: MODE_SYSTEM_PROMPTS[mode],
    prompt: `Create a form for: ${prompt}`,
  });

  const tokensUsed = usage?.totalTokens ?? 0;

  logger.info({ tokensUsed, fieldCount: output.fields.length, mode }, 'AI form generation complete');

  return { ...output, tokensUsed };
}

// ---------------------------------------------------------------------------
// AI sample data for PDF template preview
// ---------------------------------------------------------------------------

const AISampleAnswersSchema = z.object({
  answers: z.array(
    z.object({
      fieldId: z.string().describe('The exact field id, copied verbatim'),
      value: z
        .string()
        .describe(
          'The answer. For checkbox fields: chosen options joined with ", ". For select/radio: one option verbatim. For date: YYYY-MM-DD.'
        ),
    })
  ),
});

export interface AISampleDataResult {
  /** fieldId → raw answer string as produced by the model */
  answers: Record<string, string>;
  tokensUsed: number;
}

/**
 * Generate realistic, persona-consistent sample answers for a form —
 * used by the PDF template preview's "AI sample data" mode. Runs on the
 * fast (nano) model; the caller is responsible for the credit budget
 * check and usage recording, and for validating/coercing values per
 * field type before use.
 */
export async function generateAiSampleData(fields: {
  formTitle: string;
  entries: { id: string; type: string; label: string; options?: string[] }[];
}): Promise<AISampleDataResult> {
  const fieldLines = fields.entries
    .map((f) => {
      const options = f.options?.length ? ` options: [${f.options.join(' | ')}]` : '';
      return `- id: ${f.id} | type: ${f.type} | label: ${f.label}${options}`;
    })
    .join('\n');

  const { output, usage } = await generateText({
    model: getFastModel(),
    output: Output.object({ schema: AISampleAnswersSchema }),
    system: `You fill forms with realistic sample data for previewing documents.
Invent ONE consistent fictional persona and answer every field as that persona.
Rules:
- Answer in the same language as the field label (e.g. Tamil labels get Tamil answers).
- select/radio: copy exactly one of the listed options, verbatim.
- checkbox: copy one or more listed options verbatim, joined with ", ".
- date: YYYY-MM-DD. number: digits only. email/phone: plausible but clearly fictional.
- Keep long-text answers to one or two sentences.
- Include every field id exactly once.`,
    prompt: `Form title: ${fields.formTitle || 'Untitled form'}\nFields:\n${fieldLines}`,
  });

  const answers: Record<string, string> = {};
  for (const item of output.answers) {
    answers[item.fieldId] = item.value;
  }
  return { answers, tokensUsed: usage?.totalTokens ?? 0 };
}
