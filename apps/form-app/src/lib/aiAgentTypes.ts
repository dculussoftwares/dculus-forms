import type { UIMessage } from 'ai';

export type ToolState = 'input-streaming' | 'input-available' | 'output-available';

// Read-only tools
export interface ListFieldsToolPart {
  type: 'tool-listFields';
  toolCallId: string;
  state: ToolState;
  input?: { pageId?: string };
  output?: { pages: { id: string; fields: { id: string; type: string; label: string; required: boolean }[] }[] };
}

export interface GetFieldToolPart {
  type: 'tool-getField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string };
  output?: { id: string; type: string; label: string; required: boolean; pageId: string; placeholder?: string | null; hint?: string | null; options?: string[] | null };
}

// Mutation tools
export interface AddFieldToolPart {
  type: 'tool-addField';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null };
  output?: { type: 'ADD_FIELD'; pageId: string; insertAfterFieldId: string | null; fieldType: string; label: string; required: boolean; placeholder: string | null; options: string[] | null };
}

export interface UpdateFieldToolPart {
  type: 'tool-updateField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string; updates: Record<string, unknown> };
  output?: { type: 'UPDATE_FIELD'; fieldId: string; updates: Record<string, unknown> };
}

export interface RemoveFieldToolPart {
  type: 'tool-removeField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string };
  output?: { type: 'REMOVE_FIELD'; fieldId: string };
}

export interface ReorderFieldsToolPart {
  type: 'tool-reorderFields';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; fieldIds: string[] };
  output?: { type: 'REORDER_FIELDS'; pageId: string; fieldIds: string[] };
}

export interface UpdateLayoutToolPart {
  type: 'tool-updateLayout';
  toolCallId: string;
  state: ToolState;
  input?: { content?: string; customCTAButtonName?: string };
  output?: { type: 'UPDATE_LAYOUT'; content?: string; customCTAButtonName?: string };
}

export interface RenamePageToolPart {
  type: 'tool-renamePage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string; newTitle: string };
  output?: { type: 'RENAME_PAGE'; pageId: string; newTitle: string };
}

export interface ReorderPagesToolPart {
  type: 'tool-reorderPages';
  toolCallId: string;
  state: ToolState;
  input?: { pageIds: string[] };
  output?: { type: 'REORDER_PAGES'; pageIds: string[] };
}

export interface AddPageToolPart {
  type: 'tool-addPage';
  toolCallId: string;
  state: ToolState;
  input?: { title: string; insertAfterPageId: string | null };
  output?: { type: 'ADD_PAGE'; title: string; insertAfterPageId: string | null };
}

export interface RemovePageToolPart {
  type: 'tool-removePage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string };
  output?: { type: 'REMOVE_PAGE'; pageId: string };
}

export interface NavigateToPageToolPart {
  type: 'tool-navigateToPage';
  toolCallId: string;
  state: ToolState;
  input?: { pageId: string };
  output?: { type: 'NAVIGATE_TO_PAGE'; pageId: string };
}

export interface ProposeValidationToolPart {
  type: 'tool-proposeValidation';
  toolCallId: string;
  state: ToolState;
  input?: { suggestions: any[]; rationale: string };
  output?: { type: 'PROPOSE_VALIDATION'; suggestions: any[]; rationale: string };
}

export interface BulkUpdateFieldsToolPart {
  type: 'tool-bulkUpdateFields';
  toolCallId: string;
  state: ToolState;
  input?: { fieldIds: string[]; updates: Record<string, unknown> };
  output?: { type: 'BULK_UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> };
}

export type FormEditToolPart =
  | ListFieldsToolPart
  | GetFieldToolPart
  | AddFieldToolPart
  | UpdateFieldToolPart
  | RemoveFieldToolPart
  | ReorderFieldsToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | ReorderPagesToolPart
  | AddPageToolPart
  | RemovePageToolPart
  | NavigateToPageToolPart
  | ProposeValidationToolPart
  | BulkUpdateFieldsToolPart;

export type FormEditAgentUIMessage = Omit<UIMessage, 'parts'> & {
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'reasoning'; reasoning: string }
    | FormEditToolPart
  >;
};

export type MutationToolPart =
  | AddFieldToolPart
  | UpdateFieldToolPart
  | RemoveFieldToolPart
  | ReorderFieldsToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | ReorderPagesToolPart
  | AddPageToolPart
  | RemovePageToolPart
  | NavigateToPageToolPart
  | BulkUpdateFieldsToolPart;

export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateField', 'removeField', 'reorderFields',
  'updateLayout', 'renamePage', 'reorderPages', 'addPage', 'removePage',
  'navigateToPage', 'bulkUpdateFields',
]);
