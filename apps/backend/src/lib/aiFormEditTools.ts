import { tool } from 'ai';
import { z } from 'zod';

export function createFormEditTools(schema: { pages: any[] }) {
  return {
    listFields: tool({
      description:
        'List all fields in the form with their id, type, label, and required flag. Filter to a specific page with pageId. Call this before making edits to understand the current structure.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
        const pages: any[] = schema.pages ?? [];
        const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;
        return {
          totalPages: pages.length,
          pages: filtered.map((p: any) => ({
            pageNumber: pages.indexOf(p) + 1,
            id: p.id,
            title: p.title ?? `Page ${pages.indexOf(p) + 1}`,
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
        'Add a new field to a page. Use the pageId from listFields (match by pageNumber for user-facing page numbers). Use insertAfterFieldId to control position; pass null to append at the end.',
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
          validation: z.object({
            required: z.boolean().optional(),
            minLength: z.number().nullable().optional(),
            maxLength: z.number().nullable().optional(),
            minSelections: z.number().nullable().optional(),
            maxSelections: z.number().nullable().optional(),
          }).optional(),
          min: z.number().nullable().optional(),
          max: z.number().nullable().optional(),
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

    renamePage: tool({
      description: 'Rename a page. Get the pageId from listFields.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
        newTitle: z.string().max(50).describe('New title for the page'),
      }),
      execute: async (args) => ({ type: 'RENAME_PAGE' as const, ...args }),
    }),

    reorderPages: tool({
      description: 'Reorder pages. Provide ALL page IDs in the desired new order.',
      inputSchema: z.object({
        pageIds: z.array(z.string()).describe('All page IDs in the desired order'),
      }),
      execute: async (args) => ({ type: 'REORDER_PAGES' as const, ...args }),
    }),

    addPage: tool({
      description:
        'Add a new empty page to the form. insertAfterPageId: pass a page ID to insert after that page, or null to append at the end.',
      inputSchema: z.object({
        title: z.string().max(50).describe('Title for the new page'),
        insertAfterPageId: z.string().nullable().describe('Insert after this page ID; null to append at end'),
      }),
      execute: async (args) => ({ type: 'ADD_PAGE' as const, ...args }),
    }),

    removePage: tool({
      description:
        'Remove a page and ALL its fields permanently. Cannot remove the last remaining page.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
      }),
      execute: async ({ pageId }) => {
        if ((schema.pages ?? []).length <= 1) return { error: 'Cannot remove the last page' };
        return { type: 'REMOVE_PAGE' as const, pageId };
      },
    }),
  };
}

export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELD'; fieldId: string; updates: { label?: string; required?: boolean; placeholder?: string; hint?: string; options?: string[]; validation?: { required?: boolean; minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; minDate?: string | null; maxDate?: string | null } }
  | { type: 'REMOVE_FIELD'; fieldId: string }
  | { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string }
  | { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
  | { type: 'REORDER_PAGES'; pageIds: string[] }
  | { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null }
  | { type: 'REMOVE_PAGE'; pageId: string };
