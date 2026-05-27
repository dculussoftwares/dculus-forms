import { tool } from 'ai';
import { z } from 'zod';

export const formEditTools = {
  inspectForm: tool({
    description:
      'Read the current form state — field IDs, labels, types, order — before making edits. Call this first when you need to reference specific field IDs.',
    parameters: z.object({}),
    execute: async () => ({
      note: 'Full form state is provided in the system prompt. Use the field IDs listed there when calling updateField, removeField, or reorderFields.',
    }),
  }),

  addField: tool({
    description: 'Add a new field to the form. Use insertAfterFieldId to control placement.',
    parameters: z.object({
      fieldType: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file']),
      label: z.string().describe('The question or field label shown to users'),
      required: z.boolean(),
      placeholder: z.string().nullable(),
      options: z.array(z.string()).nullable().describe('Options for select/radio/checkbox; null for other types'),
      insertAfterFieldId: z.string().nullable().describe('Insert after this field ID; null to append at end'),
    }),
    execute: async (args) => ({ type: 'ADD_FIELD' as const, ...args }),
  }),

  updateField: tool({
    description: 'Update one or more properties of an existing field. Only specify the properties you want to change.',
    parameters: z.object({
      fieldId: z.string().describe('The ID of the field to update (from inspectForm)'),
      updates: z.object({
        label: z.string().optional(),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        options: z.array(z.string()).optional(),
        hint: z.string().optional(),
      }),
    }),
    execute: async (args) => ({ type: 'UPDATE_FIELD' as const, ...args }),
  }),

  removeField: tool({
    description: 'Remove a field from the form.',
    parameters: z.object({
      fieldId: z.string().describe('The ID of the field to remove (from inspectForm)'),
    }),
    execute: async (args) => ({ type: 'REMOVE_FIELD' as const, ...args }),
  }),

  reorderFields: tool({
    description:
      'Reorder fields on a page. Provide the complete desired order as an array of all field IDs for that page.',
    parameters: z.object({
      pageId: z.string(),
      fieldIds: z.array(z.string()).describe('All field IDs in the desired order'),
    }),
    execute: async (args) => ({ type: 'REORDER_FIELDS' as const, ...args }),
  }),

  updateLayout: tool({
    description: 'Update the form intro content (HTML) or the CTA button label.',
    parameters: z.object({
      content: z.string().optional().describe('HTML intro: <h1> title + <p> description only'),
      customCTAButtonName: z.string().optional().describe('Short CTA button label, max 4 words'),
    }),
    execute: async (args) => ({ type: 'UPDATE_LAYOUT' as const, ...args }),
  }),
};

export type FormOperation = Awaited<ReturnType<(typeof formEditTools)[keyof typeof formEditTools]['execute']>>;
