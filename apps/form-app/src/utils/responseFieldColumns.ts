import { FillableFormField, type FormResponse, type FormSchema } from '@dculus/types';
import { hasResponseValue } from '@dculus/utils';

export interface ResponseFieldColumnPlan {
  /** Active fields in schema order, then soft-deleted fields that hold answers. */
  fields: FillableFormField[];
  /** Answered field ids in response data that the schema doesn't know at all. */
  orphanIds: string[];
}

/**
 * Decides which field columns the responses table shows, and in what order.
 * Deleted columns always follow the active ones, and a deleted field only
 * gets a column when a response answered it: `answeredDeletedFieldIds` covers
 * the whole form (undefined while unknown, which keeps every deleted field),
 * while orphan ids can only be judged from the loaded `responses`.
 */
export const planResponseFieldColumns = (
  formSchema: FormSchema,
  responses: FormResponse[],
  answeredDeletedFieldIds: ReadonlySet<string> | undefined
): ResponseFieldColumnPlan => {
  const activeFields: FillableFormField[] = [];
  const deletedFields: FillableFormField[] = [];
  const knownFieldIds = new Set<string>();

  formSchema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      knownFieldIds.add(field.id);
      if (!(field instanceof FillableFormField)) return;
      if (!field.deleted) {
        activeFields.push(field);
      } else if (!answeredDeletedFieldIds || answeredDeletedFieldIds.has(field.id)) {
        deletedFields.push(field);
      }
    });
  });

  // Safety guard: if the schema has no fields at all, it likely hasn't finished
  // loading yet. Skip orphan detection entirely to prevent all response field IDs
  // from being incorrectly classified as "Unknown field (deleted)" before the real
  // schema arrives (race condition between GET_FORM_BY_ID and GET_FORM_RESPONSES).
  const orphanIds = new Set<string>();
  if (knownFieldIds.size > 0) {
    responses.forEach((response) => {
      Object.entries(response.data).forEach(([id, value]) => {
        if (!knownFieldIds.has(id) && hasResponseValue(value)) orphanIds.add(id);
      });
    });
  }

  return { fields: [...activeFields, ...deletedFields], orphanIds: Array.from(orphanIds).sort() };
};
