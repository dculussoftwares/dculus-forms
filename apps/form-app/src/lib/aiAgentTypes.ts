import type { UIMessage } from 'ai';

export type ToolState = 'input-streaming' | 'input-available' | 'output-available';

// Read-only tools
export interface ListFieldsToolPart {
  type: 'tool-listFields';
  toolCallId: string;
  state: ToolState;
  input?: { pageId?: string };
  output?: { summary: string; pages: string[] };
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

export interface UpdateFieldsToolPart {
  type: 'tool-updateFields';
  toolCallId: string;
  state: ToolState;
  input?: { fieldIds: string[]; updates: Record<string, unknown> };
  output?: { type: 'UPDATE_FIELDS'; fieldIds: string[]; updates: Record<string, unknown> };
}

export interface RemoveFieldsToolPart {
  type: 'tool-removeFields';
  toolCallId: string;
  state: ToolState;
  input?: { fieldIds: string[] };
  output?: { type: 'REMOVE_FIELDS'; fieldIds: string[] };
}

export interface RelocateFieldToolPart {
  type: 'tool-relocateField';
  toolCallId: string;
  state: ToolState;
  input?: { fieldId: string; targetPageId: string; insertAfterFieldId: string | null; mode: 'move' | 'copy' };
  output?: { type: 'RELOCATE_FIELD'; fieldId: string; targetPageId: string; insertAfterFieldId: string | null; mode: 'move' | 'copy' };
}

export interface ReorderToolPart {
  type: 'tool-reorder';
  toolCallId: string;
  state: ToolState;
  input?: { scope: 'fields' | 'pages'; ids: string[]; pageId?: string };
  output?: { type: 'REORDER'; scope: 'fields' | 'pages'; ids: string[]; pageId?: string };
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

export interface AddPageToolPart {
  type: 'tool-addPage';
  toolCallId: string;
  state: ToolState;
  input?: { title: string; insertAfterPageId: string | null };
  output?: { type: 'ADD_PAGE'; pageId: string; title: string; insertAfterPageId: string | null };
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

export type FormEditToolPart =
  | ListFieldsToolPart
  | GetFieldToolPart
  | AddFieldToolPart
  | UpdateFieldsToolPart
  | RemoveFieldsToolPart
  | RelocateFieldToolPart
  | ReorderToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | AddPageToolPart
  | RemovePageToolPart
  | NavigateToPageToolPart
  | ProposeValidationToolPart;

export type FormEditAgentUIMessage = Omit<UIMessage, 'parts'> & {
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'reasoning'; reasoning: string }
    | FormEditToolPart
  >;
};

export type MutationToolPart =
  | AddFieldToolPart
  | UpdateFieldsToolPart
  | RemoveFieldsToolPart
  | RelocateFieldToolPart
  | ReorderToolPart
  | UpdateLayoutToolPart
  | RenamePageToolPart
  | AddPageToolPart
  | RemovePageToolPart
  | NavigateToPageToolPart;

export const MUTATION_TOOL_NAMES = new Set([
  'addField', 'updateFields', 'removeFields', 'relocateField', 'reorder',
  'updateLayout', 'renamePage', 'addPage', 'removePage', 'navigateToPage',
]);
