import { FormField, FormPage } from '@dculus/types';
import { FieldTypeConfig } from '../components/form-builder/FieldTypesPanel';

// Drag & Drop Type Definitions
export type DragType = 'field-type' | 'field' | 'page-item' | 'page';

export interface FieldTypeDragData {
  type: 'field-type';
  fieldType: FieldTypeConfig;
}

export interface FieldDragData {
  type: 'field';
  field: FormField;
  pageId: string;
}

export interface PageItemDragData {
  type: 'page-item';
  page: FormPage;
}

export interface PageDropData {
  type: 'page';
  pageId: string;
  accepts?: string[];
}

export type DragData = FieldTypeDragData | FieldDragData | PageItemDragData | PageDropData;

// Active drag state
export interface ActiveDragState {
  id: string | null;
  item: FieldTypeConfig | FormField | FormPage | null;
}

// Drag handlers interface
export interface DragHandlers {
  onDragStart: (event: any) => void;
  onDragOver: (event: any) => void;
  onDragEnd: (event: any) => void;
}

// Form field creation data
export interface FieldCreationData {
  label: string;
  required: boolean;
  placeholder: string;
  defaultValue: string;
  prefix: string;
  hint: string;
  options?: string[];
  multiple?: boolean;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
}