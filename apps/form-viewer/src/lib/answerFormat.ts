import { FieldType, FillableFormField, type FormSchema } from '@dculus/types';

export interface AnsweredQuestion {
  fieldId: string;
  label: string;
  /** Display text, or null when the respondent left it blank. */
  answer: string | null;
}

/** "forms/f1/1712345678901-<uuid>-cv.pdf" → "cv.pdf", matching the renderer's file chips. */
export const fileNameFromKey = (key: string) =>
  (key.split('/').pop() ?? key).replace(/^\d{13}-[0-9a-f-]{36}-/i, '');

const formatAnswer = (type: string, value: unknown, labels: { yes: string; no: string }): string | null => {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    const items = value.filter((item) => item !== null && item !== undefined && item !== '').map(String);
    if (items.length === 0) return null;
    return (type === FieldType.FILE_UPLOAD_FIELD ? items.map(fileNameFromKey) : items).join(', ');
  }
  if (typeof value === 'boolean') return value ? labels.yes : labels.no;
  return typeof value === 'object' ? null : String(value);
};

/** Every question on the form as it looks now, paired with the respondent's answer. */
export function listAnsweredQuestions(
  schema: FormSchema,
  data: Record<string, unknown>,
  labels: { yes: string; no: string }
): AnsweredQuestion[] {
  return schema.pages.flatMap((page) =>
    page.fields
      .filter((field): field is FillableFormField => field instanceof FillableFormField && !field.deleted)
      .map((field) => ({
        fieldId: field.id,
        label: field.label,
        answer: formatAnswer(field.type, data[field.id], labels),
      }))
  );
}
