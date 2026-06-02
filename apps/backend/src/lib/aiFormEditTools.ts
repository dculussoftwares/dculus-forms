import { tool } from 'ai';
import { z } from 'zod';
import { countResponsesPerField, countResponsesReferencingAnyField } from '../services/responseService.js';

// Field type tokens the AI uses (kept in sync with addField's fieldType enum).
const FIELD_TYPE_TOKENS = ['text', 'textarea', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'file'] as const;

// Normalize a stored field type (e.g. 'text_input_field' / 'TEXT_INPUT_FIELD') to the short token.
const STORED_TYPE_TO_TOKEN: Record<string, string> = {
  text_input_field: 'text',  TEXT_INPUT_FIELD: 'text',
  text_area_field: 'textarea', TEXT_AREA_FIELD: 'textarea',
  email_field: 'email',      EMAIL_FIELD: 'email',
  number_field: 'number',    NUMBER_FIELD: 'number',
  date_field: 'date',        DATE_FIELD: 'date',
  select_field: 'select',    SELECT_FIELD: 'select',
  radio_field: 'radio',      RADIO_FIELD: 'radio',
  checkbox_field: 'checkbox', CHECKBOX_FIELD: 'checkbox',
  file_upload_field: 'file', FILE_UPLOAD_FIELD: 'file',
};

function findFieldInSchema(
  schema: { pages: any[] },
  fieldId: string
): { pageId: string; field: any } | null {
  for (const page of (schema.pages ?? []) as any[]) {
    const field = (page.fields ?? []).find((f: any) => f.id === fieldId);
    if (field) return { pageId: page.id, field };
  }
  return null;
}

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

export function createFormEditTools(
  schema: { pages: any[] },
  opts?: { includeReadTools?: boolean; formId?: string }
) {
  const includeReadTools = opts?.includeReadTools !== false;
  const formId = opts?.formId;

  // Per-field response count for delete/convert warnings (0 when formId is unavailable).
  const responseCountFor = async (fieldId: string): Promise<number> => {
    if (!formId) return 0;
    const counts = await countResponsesPerField(formId, [fieldId]);
    return counts[fieldId] ?? 0;
  };

  const readTools = {
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
  };

  const mutationTools = {
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

    updateFields: tool({
      description:
        'Update one or more fields with the same changes. Single edit = 1-elem fieldIds. text: validation.min/maxLength. number: min/max. date: minDate/maxDate.',
      inputSchema: z.object({
        fieldIds: z.array(z.string()).min(1).describe('IDs of all fields to update (min 1)'),
        updates: updatesSchema,
      }),
      execute: async (args) => ({ type: 'UPDATE_FIELDS' as const, ...args }),
    }),

    removeFields: tool({
      description:
        'Propose removing one or more fields. Does NOT delete immediately — the user must confirm in a card. Single removal = 1-elem fieldIds. Call listFields first to get the IDs.',
      inputSchema: z.object({
        fieldIds: z.array(z.string()).min(1).describe('IDs of all fields to remove (min 1)'),
      }),
      execute: async ({ fieldIds }) => {
        const counts = formId ? await countResponsesPerField(formId, fieldIds) : {};
        const fields = fieldIds.map((fieldId) => {
          const found = findFieldInSchema(schema, fieldId);
          return {
            fieldId,
            label: found?.field?.label ?? fieldId,
            responseCount: counts[fieldId] ?? 0,
          };
        });
        return { type: 'PROPOSE_DELETE_FIELDS' as const, fields };
      },
    }),

    relocateField: tool({
      description:
        'Move or copy a field to another page. mode "move" relocates; "copy" duplicates. insertAfterFieldId positions it; null to append.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID — get it from listFields'),
        targetPageId: z.string().describe('Destination page ID — get it from listFields'),
        insertAfterFieldId: z.string().nullable().describe('Insert after this field ID on the target page; null to append'),
        mode: z.enum(['move', 'copy']).describe('"move" relocates the field; "copy" duplicates it'),
      }),
      execute: async (args) => ({ type: 'RELOCATE_FIELD' as const, ...args }),
    }),

    reorder: tool({
      description:
        'Reorder fields (scope "fields", pageId required) or pages (scope "pages"). Pass all ids in the new desired order.',
      inputSchema: z.object({
        scope: z.enum(['fields', 'pages']).describe('"fields" reorders fields on a page; "pages" reorders pages'),
        ids: z.array(z.string()).describe('All IDs in the new desired order'),
        pageId: z.string().optional().describe('Required when scope="fields": the page whose fields are reordered'),
      }),
      execute: async (args) => {
        if (args.scope === 'fields' && !args.pageId) {
          return { error: 'pageId is required when scope is "fields"' };
        }
        return { type: 'REORDER' as const, ...args };
      },
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
        'Propose removing a page and ALL its fields. Does NOT delete immediately — the user must confirm in a card. Cannot remove the last remaining page.',
      inputSchema: z.object({
        pageId: z.string().describe('The page ID from listFields'),
      }),
      execute: async ({ pageId }) => {
        const pages = (schema.pages ?? []) as any[];
        if (pages.length <= 1) return { error: 'Cannot remove the last page' };
        const page = pages.find((p) => p.id === pageId);
        if (!page) return { error: `Page ${pageId} not found` };
        const fieldIds = (page.fields ?? []).map((f: any) => f.id);
        const responseCount = formId
          ? await countResponsesReferencingAnyField(formId, fieldIds)
          : 0;
        return {
          type: 'PROPOSE_DELETE_PAGE' as const,
          pageId,
          pageTitle: page.title ?? 'Untitled page',
          fieldCount: fieldIds.length,
          responseCount,
        };
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

    proposeValidation: tool({
      description:
        'Propose validation rules for user review. Use instead of updateFields for validation — never apply validation without user confirmation.',
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

    proposeFieldTypeChange: tool({
      description:
        'Propose changing a field to a different type. Does NOT change immediately — the user must confirm. Converting DELETES the field and creates a new one of the new type; existing responses for it will NOT carry over.',
      inputSchema: z.object({
        fieldId: z.string().describe('The field ID to convert — get it from listFields'),
        newFieldType: z.enum(FIELD_TYPE_TOKENS).describe('The target field type'),
      }),
      execute: async ({ fieldId, newFieldType }) => {
        const found = findFieldInSchema(schema, fieldId);
        if (!found) return { error: `Field ${fieldId} not found` };
        const currentType = STORED_TYPE_TO_TOKEN[found.field.type] ?? found.field.type;
        if (currentType === newFieldType) {
          return { error: `Field is already a ${newFieldType} field` };
        }
        return {
          type: 'PROPOSE_FIELD_TYPE_CHANGE' as const,
          fieldId,
          label: found.field.label ?? fieldId,
          currentType,
          newFieldType,
          responseCount: await responseCountFor(fieldId),
        };
      },
    }),
  };

  return {
    ...(includeReadTools ? readTools : {}),
    ...mutationTools,
  };
}

export type FormOperation =
  | { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null }
  | { type: 'UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> }
  | { type: 'RELOCATE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null; mode: 'move' | 'copy' }
  | { type: 'REORDER'; scope: 'fields' | 'pages'; ids: string[]; pageId?: string }
  | { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string }
  | { type: 'RENAME_PAGE'; pageId: string; newTitle: string }
  | { type: 'ADD_PAGE'; pageId: string; title: string; insertAfterPageId: string | null }
  | { type: 'NAVIGATE_TO_PAGE'; pageId: string }
  | { type: 'PROPOSE_VALIDATION'; suggestions: Array<{ fieldId: string; fieldLabel: string; fieldType: string; validation?: { minLength?: number | null; maxLength?: number | null; minSelections?: number | null; maxSelections?: number | null }; min?: number | null; max?: number | null; required?: boolean }>; rationale: string }
  | { type: 'PROPOSE_DELETE_FIELDS'; fields: Array<{ fieldId: string; label: string; responseCount: number }> }
  | { type: 'PROPOSE_DELETE_PAGE'; pageId: string; pageTitle: string; fieldCount: number; responseCount: number }
  | { type: 'PROPOSE_FIELD_TYPE_CHANGE'; fieldId: string; label: string; currentType: string; newFieldType: string; responseCount: number };
