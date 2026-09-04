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
  correctAnswers: z
    .array(z.string())
    .nullable()
    .describe(
      'QUIZ ONLY: exact label string(s) of the correct option(s) for this question, copied verbatim from this field\'s "options". One entry for a single-answer (radio) question, two or more for a multi-answer (checkbox) question. null for non-quiz forms and for any field that is not a graded question.'
    ),
  section: z
    .string()
    .describe(
      'Short name (2-4 words) of the logical section/page this field belongs to, e.g. "Personal Information", "Contact Details". Fields with the same section name, listed consecutively, are grouped onto the same page.'
    ),
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
      "options": null,
      "correctAnswers": null,
      "section": "Personal Information"
    }
  ],
  "layout": {
    "content": "<h1>Title</h1><p>One or two sentence description.</p>",
    "customCTAButtonName": "Submit"
  }
}

Strict rules:
- "suggestedTitle" MUST be a short descriptive title string.
- Each field MUST have: type, label, placeholder (string or null), required (boolean), options (array or null), correctAnswers (array or null), section (string).
- "required" MUST be true or false — never omit it.
- "placeholder" MUST be a string or null — never omit it.
- "options" MUST be an array of {"value": "...", "label": "..."} objects for select/radio/checkbox fields; null for all other field types.
- "correctAnswers" MUST be null for a normal (non-quiz) form.
- "section" MUST be a short (2-4 word) name for the logical group/page this field belongs to. List fields belonging to the same section consecutively — they will become one page together.
- "layout.content" MUST use only <h1> and <p> tags — no other HTML.
- "layout.customCTAButtonName" MUST be a short action-oriented label (max 4 words).`;

const MODE_SYSTEM_PROMPTS: Record<AIFormMode, string> = {
  quick: `You are a form builder assistant. Create MINIMAL forms with at most 5 fields.
Focus only on the most essential information — nothing extra.
Use simple field types (text, email, number, textarea).
Keep labels short and direct. Set placeholder to null unless it genuinely helps.
Set options to null for non-choice fields.
Assign every field the same "section" name (e.g. "Details") since a quick form is a single short page.
${JSON_SCHEMA_RULES}`,

  standard: `You are a form builder assistant. Create well-balanced forms with 6–10 fields.
Include appropriate field types (text, email, phone, number, date, select, radio, checkbox, textarea, file).
Mix field types naturally — use radio or select for categorical choices, textarea for long answers,
and phone for phone/contact-number questions instead of a plain text field.
Keep labels concise and user-friendly. Set placeholder to null if not needed.
Set options to null for non-choice fields.
Organize fields into 2-3 logical sections with short, descriptive names (e.g. "Personal Information", "Preferences") —
list fields belonging to the same section consecutively so each section becomes its own page.
${JSON_SCHEMA_RULES}`,

  professional: `You are a form builder assistant. Create comprehensive, professional forms with 10–20 fields.
Use a rich variety of field types. Include detailed labels and helpful placeholder text where appropriate.
Group related fields logically. Use radio/select for categorical choices, checkboxes for multi-select,
textarea for open-ended answers, and specialized types (date, file, number, phone) where natural —
use phone specifically for phone/contact-number questions instead of a plain text field.
Set options to null for non-choice fields. Set placeholder to null only if truly unnecessary.
Organize fields into 3-6 logical sections with short, descriptive names (e.g. "Personal Information",
"Employment History", "Emergency Contact") — list fields belonging to the same section consecutively,
keeping each section to roughly 2-6 fields, so each section becomes its own page.
${JSON_SCHEMA_RULES}`,
};

// Appended to the mode prompt when generating a quiz. The generator must both
// mark the correct option(s) AND we reshuffle them afterwards (prepareQuizFields)
// so the answer is never predictably first — LLMs strongly bias the correct
// choice to position 1 when left to their own ordering.
const QUIZ_RULES = `
This is a QUIZ, not a plain form. Additional rules:
- Every graded question MUST be a "radio" field (exactly one correct answer) or a "checkbox" field (two or more correct answers). Never use "select" for a question.
- Give each question 3–5 options: the correct answer(s) plus plausible, non-trivial distractors.
- "correctAnswers" MUST contain the exact label string(s) of the correct option(s), copied verbatim from that same field's "options" — one entry for a "radio" question, two or more for a "checkbox" question.
- Do NOT always put the correct option first; vary its position (it is reshuffled anyway).
- Any non-question field (e.g. the respondent's name) MUST have "correctAnswers": null.`;

const MODE_SYSTEM_PROMPTS_QUIZ = Object.fromEntries(
  (Object.keys(MODE_SYSTEM_PROMPTS) as AIFormMode[]).map((m) => [
    m,
    `${MODE_SYSTEM_PROMPTS[m]}\n${QUIZ_RULES}`,
  ])
) as Record<AIFormMode, string>;

// Fisher–Yates; returns a new array, does not mutate the input.
function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * For a quiz generation result: shuffle each question's options so the correct
 * choice isn't predictably first, and drop any `correctAnswers` entry the model
 * hallucinated that doesn't match a real option. A question left without a
 * usable key comes back with `correctAnswers: null` (keyed = false downstream).
 * Exported for unit testing — pure, no I/O.
 */
export function prepareQuizFields(fields: AIGeneratedField[]): AIGeneratedField[] {
  return fields.map((field) => {
    if (!field.options || field.options.length < 2) {
      return { ...field, correctAnswers: null };
    }
    const options = shuffled(field.options);
    const labels = new Set(options.map((o) => o.label));
    const correct = (field.correctAnswers ?? []).filter((a) => labels.has(a));
    return { ...field, options, correctAnswers: correct.length > 0 ? correct : null };
  });
}

export async function generateFormWithAI(
  prompt: string,
  mode: AIFormMode = 'standard',
  opts: { quiz?: boolean } = {}
): Promise<AIGeneratedForm> {
  const quiz = opts.quiz ?? false;
  logger.info({ prompt, mode, quiz }, 'Generating form with AI');

  const { output, usage } = await generateText({
    model: getPrimaryModel(),
    output: Output.object({ schema: AIFormSchema }),
    system: quiz ? MODE_SYSTEM_PROMPTS_QUIZ[mode] : MODE_SYSTEM_PROMPTS[mode],
    prompt: quiz ? `Create a quiz for: ${prompt}` : `Create a form for: ${prompt}`,
  });

  const tokensUsed = usage?.totalTokens ?? 0;

  const fields = quiz
    ? prepareQuizFields(output.fields)
    : output.fields.map((f) => ({ ...f, correctAnswers: null }));

  logger.info({ tokensUsed, fieldCount: fields.length, mode, quiz }, 'AI form generation complete');

  return { ...output, fields, tokensUsed };
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

// ---------------------------------------------------------------------------
// AI fake responses (bulk test-data generation for the Responses table)
// ---------------------------------------------------------------------------

const AIFakeResponsesSchema = z.object({
  responses: z.array(
    z.object({
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
    })
  ),
});

export interface AIFakeResponsesResult {
  /** One fieldId → answer map per generated response, in order. */
  responses: Record<string, string>[];
  tokensUsed: number;
}

/**
 * Generate `count` distinct, diverse fake form responses in a single model
 * call — used by the Responses table's "Fake Response" AI action. Runs on
 * the fast (nano) model; the caller is responsible for the credit budget
 * check and usage recording, and for validating/coercing values per field
 * type before use. File-upload fields must be excluded from `entries` —
 * the model cannot invent real file keys.
 */
export async function generateAiFakeResponses(fields: {
  formTitle: string;
  entries: { id: string; type: string; label: string; options?: string[] }[];
  count: number;
}): Promise<AIFakeResponsesResult> {
  const fieldLines = fields.entries
    .map((f) => {
      const options = f.options?.length ? ` options: [${f.options.join(' | ')}]` : '';
      return `- id: ${f.id} | type: ${f.type} | label: ${f.label}${options}`;
    })
    .join('\n');

  const { output, usage } = await generateText({
    model: getFastModel(),
    output: Output.object({ schema: AIFakeResponsesSchema }),
    system: `You generate realistic, DIVERSE fake form submissions for testing a form builder.
Invent ${fields.count} DIFFERENT fictional personas — one per response — varying age, background, tone, and answer length. Never repeat the same persona or the same set of answers across responses.
Rules:
- Answer in the same language as the field label (e.g. Tamil labels get Tamil answers).
- select/radio: copy exactly one of the listed options, verbatim. Spread choices across the available options across the ${fields.count} responses — do not let every response pick the same option.
- checkbox: copy one or more listed options verbatim, joined with ", ". Vary the selection across responses.
- date: YYYY-MM-DD, spread across a plausible range rather than reusing one date.
- number: digits only, varied values.
- email/phone: plausible but clearly fictional, unique per persona.
- Keep long-text answers to one or two sentences; vary length and tone across responses.
- Include every field id exactly once per response.
- Return exactly ${fields.count} responses.`,
    prompt: `Form title: ${fields.formTitle || 'Untitled form'}\nFields:\n${fieldLines}`,
  });

  const responses = output.responses.map((r) => {
    const answers: Record<string, string> = {};
    for (const item of r.answers) {
      answers[item.fieldId] = item.value;
    }
    return answers;
  });

  return { responses, tokensUsed: usage?.totalTokens ?? 0 };
}
