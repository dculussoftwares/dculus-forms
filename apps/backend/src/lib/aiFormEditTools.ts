import { tool } from 'ai';
import { z } from 'zod';
import * as Y from 'yjs';
import { prisma } from './prisma.js';

/**
 * Read the live form schema from the Y.js CollaborativeDocument stored by Hocuspocus.
 * Falls back to Form.formSchema (Prisma) if no collaborative document exists.
 *
 * The document name matches the safeDocumentName used by CollaborationManager on the
 * frontend: formId with all non-alphanumeric characters stripped.
 */
async function getFormSchemaFromYjs(formId: string): Promise<{ pages: any[] } | null> {
  const docName = formId.replace(/[^a-zA-Z0-9_-]/g, '');
  const collabDoc = await prisma.collaborativeDocument.findFirst({
    where: { documentName: docName },
    select: { state: true },
  });

  if (collabDoc?.state) {
    try {
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, collabDoc.state);
      const formSchemaMap = ydoc.getMap('formSchema');
      const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>> | undefined;
      if (!pagesArray) return { pages: [] };

      const pages = pagesArray.toArray().map((pageMap) => {
        const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>> | undefined;
        const fields = fieldsArray ? fieldsArray.toArray().map((fieldMap) => {
          const optionsRaw = fieldMap.get('options');
          const options = optionsRaw instanceof Y.Array ? optionsRaw.toArray() : (optionsRaw ?? null);
          return {
            id: fieldMap.get('id'),
            type: fieldMap.get('type'),
            label: fieldMap.get('label'),
            required: fieldMap.get('validation')?.get?.('required') ?? fieldMap.get('required') ?? false,
            placeholder: fieldMap.get('placeholder') ?? null,
            hint: fieldMap.get('hint') ?? null,
            options,
          };
        }) : [];
        return { id: pageMap.get('id'), title: pageMap.get('title'), fields };
      });
      return { pages };
    } catch {
      // fall through to Prisma fallback
    }
  }

  // Fallback: read from Form.formSchema (may be stale or empty for Y.js-managed forms)
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { formSchema: true },
  });
  return form ? (form.formSchema as any) : null;
}

export function createFormEditTools(formId: string) {
  async function getFormSchema() {
    return getFormSchemaFromYjs(formId);
  }

  return {
    listFields: tool({
      description:
        'List all fields in the form with their id, type, label, and required flag. Filter to a specific page with pageId. Call this before making edits to understand the current structure.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
        const schema = await getFormSchema();
        if (!schema) return { error: 'Form not found' };
        const pages: any[] = schema.pages ?? [];
        const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;
        return {
          pages: filtered.map((p: any) => ({
            id: p.id,
            fields: (p.fields ?? []).map((f: any) => ({
              id: f.id,
              type: f.type,
              label: f.label,
              required: f.required ?? false,
            })),
          })),
        };
      },
    }),

    getField: tool({
      description:
        'Get full details of a specific field: placeholder, hint, options, validation, and which page it belongs to. Use before updating a field to see its current values.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
      }),
      execute: async ({ fieldId }) => {
        const schema = await getFormSchema();
        if (!schema) return { error: 'Form not found' };
        for (const page of (schema.pages ?? []) as any[]) {
          const field = (page.fields ?? []).find((f: any) => f.id === fieldId);
          if (field) {
            return {
              pageId: page.id,
              id: field.id,
              type: field.type,
              label: field.label,
              required: field.required ?? false,
              placeholder: field.placeholder ?? null,
              hint: field.hint ?? null,
              options: field.options ?? null,
              validation: field.validation ?? null,
            };
          }
        }
        return { error: `Field ${fieldId} not found` };
      },
    }),

    addField: tool({
      description:
        'Add a new field to a page. Use insertAfterFieldId to control position; pass null to append at the end.',
      inputSchema: z.object({
        pageId: z.string().describe('ID of the page to add the field to'),
        insertAfterFieldId: z.string().nullable().describe('Insert after this field ID; null to append'),
        fieldType: z.enum(['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file']),
        label: z.string().describe('The question/label shown to users'),
        required: z.boolean(),
        placeholder: z.string().nullable(),
        options: z.array(z.string()).nullable().describe('For select/radio/checkbox only; null otherwise'),
      }),
      execute: async (args) => ({ type: 'ADD_FIELD' as const, ...args }),
    }),

    updateField: tool({
      description: 'Update one or more properties of an existing field. Only include properties you want to change. For text/textarea fields use updates.validation.minLength/maxLength. For number fields use updates.min/updates.max. For date fields use updates.minDate/updates.maxDate. For checkbox fields use updates.validation.minSelections/maxSelections.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
        updates: z.object({
          label: z.string().optional(),
          required: z.boolean().optional(),
          placeholder: z.string().optional(),
          hint: z.string().optional(),
          options: z.array(z.string()).optional(),
          // Validation rules — stored in the Y.js validation Y.Map
          validation: z.object({
            required: z.boolean().optional(),
            minLength: z.number().nullable().optional(),     // text / textarea
            maxLength: z.number().nullable().optional(),     // text / textarea
            minSelections: z.number().nullable().optional(), // checkbox
            maxSelections: z.number().nullable().optional(), // checkbox
          }).optional().describe('For text/textarea use minLength/maxLength. For checkbox use minSelections/maxSelections.'),
          // Number field — field-level properties (not in validation Y.Map)
          min: z.number().nullable().optional(),
          max: z.number().nullable().optional(),
          // Date field — field-level properties (ISO date string e.g. "2024-01-31")
          minDate: z.string().nullable().optional(),
          maxDate: z.string().nullable().optional(),
        }),
      }),
      execute: async (args) => ({ type: 'UPDATE_FIELD' as const, ...args }),
    }),

    removeField: tool({
      description: 'Remove a field from the form.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
      }),
      execute: async (args) => ({ type: 'REMOVE_FIELD' as const, ...args }),
    }),

    reorderFields: tool({
      description: 'Reorder fields on a page. Provide all field IDs for that page in the desired order.',
      inputSchema: z.object({
        pageId: z.string(),
        fieldIds: z.array(z.string()).describe('All field IDs in the new desired order'),
      }),
      execute: async (args) => ({ type: 'REORDER_FIELDS' as const, ...args }),
    }),

    updateLayout: tool({
      description: 'Update the form intro content (HTML) or the CTA button label.',
      inputSchema: z.object({
        content: z.string().optional().describe('HTML intro: <h1> title + <p> description only'),
        customCTAButtonName: z.string().optional().describe('Short CTA button label, max 4 words'),
      }),
      execute: async (args) => ({ type: 'UPDATE_LAYOUT' as const, ...args }),
    }),
  };
}

export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELD'; fieldId: string; updates: { label?: string; required?: boolean; placeholder?: string; hint?: string; options?: string[]; validation?: { required?: boolean; minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; minDate?: string | null; maxDate?: string | null } }
  | { type: 'REMOVE_FIELD'; fieldId: string }
  | { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string };
