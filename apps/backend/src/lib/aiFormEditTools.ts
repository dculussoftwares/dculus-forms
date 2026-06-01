import { tool } from 'ai';
import { z } from 'zod';

const updatesSchema = z.object({
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
});

export function createFormEditTools(schema: { pages: any[] }) {
  return {
    listFields: tool({
      description:
        'List form fields in compact format: p1 "Title" [id:pageId]: fieldId|type|"label"|req/opt. Omit pageId to list all pages.',
      inputSchema: z.object({
        pageId: z.string().optional().describe('Filter to this page; omit to list all pages'),
      }),
      execute: async ({ pageId }) => {
        const pages: any[] = schema.pages ?? [];
        const filtered = pageId ? pages.filter((p: any) => p.id === pageId) : pages;

        const TYPE_MAP: Record<string, string> = {
          text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
          text_area_field: 'ta',     TEXT_AREA_FIELD: 'ta',
          email_field: 'email',      EMAIL_FIELD: 'email',
          number_field: 'num',       NUMBER_FIELD: 'num',
          date_field: 'date',        DATE_FIELD: 'date',
          select_field: 'select',    SELECT_FIELD: 'select',
          radio_field: 'radio',      RADIO_FIELD: 'radio',
          checkbox_field: 'check',   CHECKBOX_FIELD: 'check',
          file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
        };

        return {
          summary: `${pages.length} page${pages.length !== 1 ? 's' : ''} total`,
          pages: filtered.map((p: any) => {
            const pi = pages.indexOf(p) + 1;
            const fields = (p.fields ?? [])
              .map((f: any) => `${f.id}|${TYPE_MAP[f.type] ?? f.type}|"${f.label}"|${(f.required ?? false) ? 'req' : 'opt'}`)
              .join(', ');
            return `p${pi} "${p.title ?? `Page ${pi}`}" [id:${p.id}]: ${fields || '(empty)'}`;
          }),
        };
      },
    }),

    getField: tool({
      description:
        'Get field details (placeholder, hint, options, validation, pageId). Call before updating to see current values.',
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
        'Add a field to a page. pageId from listFields. insertAfterFieldId for position; null to append at end.',
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
      description: 'Update field properties. text: validation.min/maxLength. number: min/max. date: minDate/maxDate. checkbox: minSelections/maxSelections.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID from listFields'),
        updates: updatesSchema,
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
      description: 'Reorder pages. Provide all page IDs in desired new order.',
      inputSchema: z.object({
        pageIds: z.array(z.string()).describe('All page IDs in the desired order'),
      }),
      execute: async (args) => ({ type: 'REORDER_PAGES' as const, ...args }),
    }),

    addPage: tool({
      description:
        'Add a page. insertAfterPageId to position it, null to append. Use the returned pageId immediately as the pageId for addField on this page.',
      inputSchema: z.object({
        title: z.string().max(50).describe('Title for the new page'),
        insertAfterPageId: z.string().nullable().describe('Insert after this page ID; null to append at end'),
      }),
      execute: async (args) => ({
        type: 'ADD_PAGE' as const,
        // Generate the page ID here so the AI can reference it in subsequent addField calls
        pageId: `page-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        ...args,
      }),
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

    navigateToPage: tool({
      description:
        'Navigate the form builder canvas to a specific page. Call this before editing fields on a page the user is not currently viewing.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID to navigate to — get it from listFields'),
      }),
      execute: async ({ pageId }) => ({ type: 'NAVIGATE_TO_PAGE' as const, pageId }),
    }),

    bulkUpdateFields: tool({
      description:
        'Apply the same update to 3+ fields at once. Always prefer this over multiple updateField calls.',
      inputSchema: z.object({
        fieldIds: z.array(z.string()).min(2).describe('IDs of all fields to update'),
        updates: updatesSchema,
      }),
      execute: async (args) => ({ type: 'BULK_UPDATE_FIELDS' as const, ...args }),
    }),

    proposeValidation: tool({
      description:
        'Propose validation rules for user review. Use instead of updateField for validation — never apply validation without user confirmation.',
      inputSchema: z.object({
        suggestions: z.array(
          z.object({
            fieldId: z.string(),
            fieldLabel: z.string(),
            fieldType: z.string(),
            validation: z
              .object({
                minLength: z.number().nullable().optional(),
                maxLength: z.number().nullable().optional(),
                minSelections: z.number().nullable().optional(),
                maxSelections: z.number().nullable().optional(),
              })
              .optional(),
            min: z.number().nullable().optional(),
            max: z.number().nullable().optional(),
            required: z.boolean().optional(),
          })
        ),
        rationale: z.string().describe('Brief explanation of why these rules were chosen'),
      }),
      execute: async (args) => ({ type: 'PROPOSE_VALIDATION' as const, ...args }),
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
  | { type: 'ADD_PAGE'; pageId: string; title: string; insertAfterPageId: string | null }
  | { type: 'REMOVE_PAGE'; pageId: string }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'PROPOSE_VALIDATION'; suggestions: Array<{ fieldId: string; fieldLabel: string; fieldType: string; validation?: { minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; required?: boolean }>; rationale: string }
  | { type: 'BULK_UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> };
