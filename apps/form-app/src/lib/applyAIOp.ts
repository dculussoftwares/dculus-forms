import { FieldType } from '@dculus/types';
import type { FormBuilderState } from '../store/types/store.types';

const API_URL = import.meta.env.VITE_API_URL as string;

function invalidateSchema(formId: string): void {
  fetch(`${API_URL}/api/ai/invalidate-schema`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ formId }),
  }).catch(() => { /* fire-and-forget, ignore failures */ });
}

const AI_TYPE_MAP: Record<string, FieldType> = {
  text: FieldType.TEXT_INPUT_FIELD,
  textarea: FieldType.TEXT_AREA_FIELD,
  email: FieldType.EMAIL_FIELD,
  number: FieldType.NUMBER_FIELD,
  date: FieldType.DATE_FIELD,
  select: FieldType.SELECT_FIELD,
  radio: FieldType.RADIO_FIELD,
  checkbox: FieldType.CHECKBOX_FIELD,
  file: FieldType.FILE_UPLOAD_FIELD,
};

const CHOICE_TYPES = new Set([FieldType.SELECT_FIELD, FieldType.RADIO_FIELD, FieldType.CHECKBOX_FIELD]);

function findPageForField(pages: any[], fieldId: string): string | null {
  for (const page of pages) {
    if ((page.fields ?? []).some((f: any) => f.id === fieldId)) return page.id;
  }
  return null;
}

export function applyAIOp(
  op: any,
  store: Pick<
    FormBuilderState,
    | 'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField'
    | 'reorderFields' | 'updateLayout' | 'updatePageTitle' | 'reorderPages'
    | 'addPageAtPosition' | 'removePage' | 'setSelectedPage'
    | 'setAIHighlightedFieldId' | 'setPendingValidationSuggestions'
  >,
  formId?: string
): void {
  if (!op?.type) return;

  switch (op.type) {
    case 'ADD_FIELD': {
      const targetPageId: string | undefined = (store.pages as any[]).find((p: any) => p.id === op.pageId)?.id;
      if (!targetPageId) {
        console.warn('[applyAIOp] ADD_FIELD: pageId not found in store, skipping', op.pageId);
        break;
      }

      const fieldType = AI_TYPE_MAP[op.fieldType] ?? FieldType.TEXT_INPUT_FIELD;
      const isChoice = CHOICE_TYPES.has(fieldType);
      const fieldData = {
        label: op.label,
        required: op.required ?? false,
        placeholder: op.placeholder ?? '',
        defaultValue: '',
        prefix: '',
        hint: '',
        ...(isChoice && { options: op.options ?? ['Option 1', 'Option 2'] }),
      };

      if (op.insertAfterFieldId) {
        const page = (store.pages as any[]).find((p: any) => p.id === targetPageId);
        const idx = (page?.fields ?? []).findIndex((f: any) => f.id === op.insertAfterFieldId);
        if (idx !== -1) {
          store.addFieldAtIndex(targetPageId, fieldType, fieldData, idx + 1);
          // highlight the newly inserted field (now at idx+1)
          const updatedPage = (store.pages as any[]).find((p: any) => p.id === targetPageId);
          const newFieldId = updatedPage?.fields?.[idx + 1]?.id;
          if (newFieldId) {
            store.setAIHighlightedFieldId(newFieldId);
            setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
          }
          break;
        }
      }
      store.addField(targetPageId, fieldType, fieldData);
      // highlight the last field on the page (the one just added)
      const updatedPage = (store.pages as any[]).find((p: any) => p.id === targetPageId);
      const fields = updatedPage?.fields ?? [];
      const newFieldId = fields[fields.length - 1]?.id;
      if (newFieldId) {
        store.setAIHighlightedFieldId(newFieldId);
        setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
      }
      break;
    }

    case 'UPDATE_FIELD': {
      const pageId = findPageForField(store.pages, op.fieldId);
      if (!pageId) return;
      store.updateField(pageId, op.fieldId, op.updates);
      store.setAIHighlightedFieldId(op.fieldId);
      setTimeout(() => store.setAIHighlightedFieldId(null), 2000);
      break;
    }

    case 'REMOVE_FIELD': {
      const pageId = findPageForField(store.pages, op.fieldId);
      if (!pageId) return;
      store.removeField(pageId, op.fieldId);
      break;
    }

    case 'REORDER_FIELDS': {
      const page = (store.pages as any[]).find((p: any) => p.id === op.pageId);
      if (!page) return;
      const current: string[] = (page.fields ?? []).map((f: any) => f.id);
      const desired: string[] = op.fieldIds ?? [];
      for (let i = 0; i < desired.length; i++) {
        const fromIdx = current.indexOf(desired[i]);
        if (fromIdx !== -1 && fromIdx !== i) {
          store.reorderFields(op.pageId, fromIdx, i);
          const [moved] = current.splice(fromIdx, 1);
          current.splice(i, 0, moved);
        }
      }
      break;
    }

    case 'UPDATE_LAYOUT': {
      // Whitelist only the fields the AI updateLayout tool exposes.
      // If the tool schema grows, add the new fields here too.
      const updates: Record<string, unknown> = {};
      if (op.content !== undefined) updates.content = op.content;
      if (op.customCTAButtonName !== undefined) updates.customCTAButtonName = op.customCTAButtonName;
      store.updateLayout(updates);
      break;
    }

    case 'RENAME_PAGE': {
      const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (!pageExists) return;
      store.updatePageTitle(op.pageId, op.newTitle);
      break;
    }

    case 'REORDER_PAGES': {
      const desired: string[] = op.pageIds ?? [];
      const current: string[] = (store.pages as any[]).map((p: any) => p.id);
      for (let i = 0; i < desired.length; i++) {
        const fromIdx = current.indexOf(desired[i]);
        if (fromIdx !== -1 && fromIdx !== i) {
          store.reorderPages(fromIdx, i);
          const [moved] = current.splice(fromIdx, 1);
          current.splice(i, 0, moved);
        }
      }
      break;
    }

    case 'ADD_PAGE': {
      // Pass the pre-generated pageId from the backend so subsequent ADD_FIELD ops
      // can reference the new page by the same ID the AI already knows.
      store.addPageAtPosition(op.title ?? 'New Page', op.insertAfterPageId ?? null, op.pageId);
      break;
    }

    case 'REMOVE_PAGE': {
      if ((store.pages as any[]).length <= 1) return;
      const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (!pageExists) return;
      store.removePage(op.pageId);
      break;
    }

    case 'NAVIGATE_TO_PAGE': {
      const pageExists = (store.pages as any[]).some((p: any) => p.id === op.pageId);
      if (pageExists) store.setSelectedPage(op.pageId);
      break;
    }

    case 'PROPOSE_VALIDATION': {
      store.setPendingValidationSuggestions(op.suggestions ?? []);
      break;
    }
  }

  // Invalidate backend schema cache after any mutation
  // PROPOSE_VALIDATION does not mutate the form, so skip invalidation for it
  if (formId && op.type !== 'PROPOSE_VALIDATION') invalidateSchema(formId);
}
