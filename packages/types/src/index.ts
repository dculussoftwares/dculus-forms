// Form related types
export interface Form {
  id: string;
  title: string;
  description?: string;
  shortUrl: string;
  formSchema: FormSchema;
  isPublished: boolean;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormSchema {
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;
}

export interface FormPage {
  id: string;
  title: string;
  fields: FormField[];
  order: number;
}

export type LayoutCode = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'L9';

export interface FormLayout {
  theme: ThemeType;
  textColor: string;
  spacing: SpacingType;
  code: LayoutCode; // Layout code (L1-L9)
  content: string; // Rich text content for layout
  customBackGroundColor: string; // Custom background color overlay for background image layer
  customCTAButtonName?: string; // Custom call to action name
  backgroundImageKey: string; // Image key of layout background image
  pageMode: PageModeType; // Page navigation mode
  isCustomBackgroundColorEnabled?: boolean; // Toggle between custom color overlay vs blur background
}

export enum ThemeType {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

export enum SpacingType {
  COMPACT = 'compact',
  NORMAL = 'normal',
  SPACIOUS = 'spacious',
}

export enum PageModeType {
  SINGLE_PAGE = 'single_page',
  MULTIPAGE = 'multipage',
}

export class FormField {
  id: string;
  type: FieldType;
  constructor(id: string) {
    this.id = id;
    this.type = FieldType.FORM_FIELD;
  }
}

export class FillableFormFieldValidation {
  required: boolean;
  type: FieldType;
  constructor(required: boolean) {
    this.required = required;
    this.type = FieldType.FORM_FIELD;
  }
}

export class FillableFormField extends FormField {
  label: string;
  defaultValue: string;
  prefix: string;
  hint: string;
  placeholder: string;
  validation: FillableFormFieldValidation;

  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation
  ) {
    super(id);
    this.label = label;
    this.defaultValue = defaultValue;
    this.prefix = prefix;
    this.hint = hint;
    this.placeholder = placeholder;
    this.validation = validation;
  }
}

export class TextInputField extends FillableFormField {
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.TEXT_INPUT_FIELD;
  }
}

export class TextAreaField extends FillableFormField {
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.TEXT_AREA_FIELD;
  }
}

export class EmailField extends FillableFormField {
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.EMAIL_FIELD;
  }
}

export class NumberField extends FillableFormField {
  min?: number;
  max?: number;
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    min?: number,
    max?: number
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.NUMBER_FIELD;
    this.min = min;
    this.max = max;
  }
}

export class SelectField extends FillableFormField {
  options: string[];
  multiple: boolean;
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    options: string[] = [],
    multiple: boolean = false
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.SELECT_FIELD;
    this.options = options;
    this.multiple = multiple;
  }
}

export class RadioField extends FillableFormField {
  options: string[];
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    options: string[] = []
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.RADIO_FIELD;
    this.options = options;
  }
}

export class CheckboxField extends FillableFormField {
  options: string[];
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    options: string[] = []
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.CHECKBOX_FIELD;
    this.options = options;
  }
}

export class DateField extends FillableFormField {
  minDate?: string;
  maxDate?: string;
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    minDate?: string,
    maxDate?: string
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.DATE_FIELD;
    this.minDate = minDate;
    this.maxDate = maxDate;
  }
}

export enum FieldType {
  TEXT = 'text',
  TEXT_INPUT_FIELD = 'text_input_field',
  EMAIL_FIELD = 'email_field',
  NUMBER_FIELD = 'number_field',
  TEXT_AREA_FIELD = 'text_area_field',
  SELECT_FIELD = 'select_field',
  CHECKBOX_FIELD = 'checkbox_field',
  RADIO_FIELD = 'radio_field',
  DATE_FIELD = 'date_field',
  FORM_FIELD = 'form_field',
  FILLABLE_FORM_FIELD = 'fillable_form_field',
}

// Serialization/Deserialization utilities for FormField classes
export const serializeFormField = (field: FormField): any => {
  return {
    ...field,
    __type: field.type
  };
};

export const deserializeFormField = (data: any): FormField => {
  const validation = data.validation ? new FillableFormFieldValidation(data.validation.required) : new FillableFormFieldValidation(false);
  
  switch (data.type || data.__type) {
    case FieldType.TEXT_INPUT_FIELD:
      return new TextInputField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation
      );
    case FieldType.TEXT_AREA_FIELD:
      return new TextAreaField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation
      );
    case FieldType.EMAIL_FIELD:
      return new EmailField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation
      );
    case FieldType.NUMBER_FIELD:
      return new NumberField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation,
        data.min,
        data.max
      );
    case FieldType.SELECT_FIELD:
      return new SelectField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation,
        data.options || [],
        data.multiple || false
      );
    case FieldType.RADIO_FIELD:
      return new RadioField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation,
        data.options || []
      );
    case FieldType.CHECKBOX_FIELD:
      return new CheckboxField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation,
        data.options || []
      );
    case FieldType.DATE_FIELD:
      return new DateField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        validation,
        data.minDate,
        data.maxDate
      );
    default:
      return new FormField(data.id);
  }
};

export const serializeFormSchema = (schema: FormSchema): any => {
  return {
    ...schema,
    pages: schema.pages.map(page => ({
      ...page,
      fields: page.fields.map(serializeFormField)
    }))
  };
};

export const deserializeFormSchema = (data: any): FormSchema => {
  return {
    ...data,
    pages: (data.pages || []).map((page: any) => ({
      ...page,
      fields: (page.fields || []).map(deserializeFormField)
    }))
  };
};


// Response types
export interface FormResponse {
  id: string;
  formId: string;
  data: Record<string, any>;
  submittedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// GraphQL types
export interface GraphQLContext {
  user?: any; // Will be extended later with auth
  prisma?: any; // Prisma client instance
}

// Common types
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Re-export validation schemas and types
export * from './validation';


// Re-export React Hook Form utilities
export * from './formHookUtils';
