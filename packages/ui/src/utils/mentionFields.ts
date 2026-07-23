import { FormPage } from '@dculus/types';

export interface MentionFieldOption {
  fieldId: string;
  label: string;
}

/**
 * Collects {fieldId, label} pairs for every fillable field across a form's pages,
 * for use as the `mentionFields` option list on LexicalRichTextEditor. Duck-types
 * on `label` rather than `instanceof FillableFormField` since fields flowing through
 * the collaborative store aren't always reconstructed class instances (same fallback
 * used in FormFieldRenderer.tsx).
 */
export function extractMentionFields(pages: FormPage[] = []): MentionFieldOption[] {
  const mentionFields: MentionFieldOption[] = [];

  for (const page of pages) {
    for (const field of page.fields || []) {
      const label = (field as any)?.label;
      if (field?.id && typeof label === 'string' && label.length > 0) {
        mentionFields.push({ fieldId: field.id, label });
      }
    }
  }

  return mentionFields;
}
