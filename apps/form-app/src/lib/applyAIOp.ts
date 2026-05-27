import { FieldType } from '@dculus/types';
import type { FormBuilderState } from '../store/types/store.types';

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
    'pages' | 'addField' | 'addFieldAtIndex' | 'updateField' | 'removeField' | 'reorderFields' | 'updateLayout'
  >
): void {
  if (!op?.type) return;

  switch (op.type) {
    case 'ADD_FIELD': {
      const targetPageId: string = (store.pages as any[]).find((p: any) => p.id === op.pageId)?.id
        ?? (store.pages as any[])[0]?.id;
      if (!targetPageId) return;

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
          return;
        }
      }
      store.addField(targetPageId, fieldType, fieldData);
      break;
    }

    case 'UPDATE_FIELD': {
      const pageId = findPageForField(store.pages, op.fieldId);
      if (!pageId) return;
      store.updateField(pageId, op.fieldId, op.updates);
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
  }
}
