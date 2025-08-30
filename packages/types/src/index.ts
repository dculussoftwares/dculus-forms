/**
 * @fileoverview FormField Type System - Central type definitions for the collaborative form builder
 * 
 * This file contains the core FormField class hierarchy and type definitions used throughout
 * the dculus-forms monorepo. All form fields extend from the base FormField class.
 * 
 * 🚨 IMPORTANT: When adding new field types or modifying existing ones, you must update
 * multiple files across the codebase. See the checklist in the FormField class documentation.
 * 
 * ARCHITECTURE OVERVIEW:
 * 
 * FormField (base)
 * └── FillableFormField (adds label, validation, etc.)
 *     ├── TextInputField (uses TextFieldValidation for character limits)
 *     ├── TextAreaField (uses TextFieldValidation for character limits)  
 *     ├── EmailField (uses base FillableFormFieldValidation)
 *     ├── NumberField (adds min/max properties)
 *     ├── SelectField (adds options array, multiple boolean)
 *     ├── RadioField (adds options array)
 *     ├── CheckboxField (adds options array)
 *     └── DateField (adds minDate/maxDate properties)
 * 
 * VALIDATION SYSTEM:
 * 
 * FillableFormFieldValidation (base)
 * └── TextFieldValidation (adds minLength/maxLength for text fields)
 * 
 * SERIALIZATION:
 * - serializeFormField() converts instances to plain objects for storage
 * - deserializeFormField() reconstructs instances from stored data
 * - Used for database storage and YJS collaborative editing
 * 
 * RECENT CHANGES:
 * - Added TextFieldValidation class for character limit support
 * - Updated TextInputField and TextAreaField to use specialized validation
 * - Enhanced deserialization to handle character limits
 * - Updated seed templates to use new validation structure
 */

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

/**
 * Base FormField class - all form fields extend from this
 * 
 * When adding new field types or properties, ensure you update:
 * 1. Field class definitions (below)
 * 2. FieldType enum (below)
 * 3. Serialization/deserialization functions (deserializeFormField)
 * 4. Validation schemas (validation.ts - getFieldValidationSchema)
 * 5. Form renderer (packages/ui/src/renderers/FormFieldRenderer.tsx)
 * 6. Field settings components (apps/form-app/src/components/form-builder/field-settings/)
 * 7. Field editor hook (apps/form-app/src/hooks/useFieldEditor.ts - extractFieldData)
 * 8. Seed templates (apps/backend/src/scripts/seed-templates.ts)
 */
export class FormField {
  id: string;
  type: FieldType;
  constructor(id: string) {
    this.id = id;
    this.type = FieldType.FORM_FIELD;
  }
}

/**
 * Base validation class for fillable form fields
 * 
 * When creating specialized validation classes:
 * 1. Extend this class (like TextFieldValidation)
 * 2. Update field classes to use specialized validation
 * 3. Update validation schemas in validation.ts
 * 4. Update deserializeFormField function
 * 5. Update field editor extractFieldData and save logic
 */
export class FillableFormFieldValidation {
  required: boolean;
  type: FieldType;
  constructor(required: boolean) {
    this.required = required;
    this.type = FieldType.FORM_FIELD;
  }
}

/**
 * Specialized validation class for text fields (TextInputField and TextAreaField)
 * Contains character limit validation properties
 * 
 * Example of extending validation for other field types:
 * - Create similar classes for specific validation needs
 * - Update corresponding field classes to use the specialized validation
 * - Ensure validation schemas match the structure
 */
export class TextFieldValidation extends FillableFormFieldValidation {
  minLength?: number;
  maxLength?: number;
  
  constructor(
    required: boolean, 
    minLength?: number, 
    maxLength?: number
  ) {
    super(required);
    this.minLength = minLength;
    this.maxLength = maxLength;
  }
}

/**
 * Base class for fields that can be filled by users
 * Contains common properties like label, placeholder, validation, etc.
 * 
 * When adding new fillable properties:
 * 1. Add the property here
 * 2. Update constructor parameters
 * 3. Update extractFieldData in useFieldEditor.ts
 * 4. Update validation schemas in validation.ts
 * 5. Update field settings components
 * 6. Update form renderer display logic
 */
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

/**
 * Text input field with character limit support
 * Uses TextFieldValidation for minLength/maxLength validation
 * 
 * When adding field-specific properties:
 * 1. Add properties to this class
 * 2. Update constructor parameters
 * 3. Update FieldType enum
 * 4. Update deserializeFormField switch case
 * 5. Update FormFieldRenderer switch case
 * 6. Add field-specific settings component
 * 7. Update FieldTypeSpecificSettings
 * 8. Update extractFieldData in useFieldEditor
 * 9. Update validation schema in validation.ts
 */
export class TextInputField extends FillableFormField {
  validation: TextFieldValidation;
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: TextFieldValidation
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.TEXT_INPUT_FIELD;
    this.validation = validation;
  }
}

/**
 * Text area field with character limit support
 * Uses TextFieldValidation for minLength/maxLength validation
 * 
 * Example of field with specialized validation - follows same pattern as TextInputField
 */
export class TextAreaField extends FillableFormField {
  validation: TextFieldValidation;
  
  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: TextFieldValidation
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.TEXT_AREA_FIELD;
    this.validation = validation;
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

/**
 * Number field with min/max range validation
 * Example of field-specific properties (min, max) stored directly on field
 * 
 * Pattern for fields with constraints:
 * - Add constraint properties to field class
 * - Include in constructor parameters
 * - Handle in deserializeFormField
 * - Add to extractFieldData in useFieldEditor
 * - Create specialized settings component
 * - Add validation in validation schema
 */
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

/**
 * Serialization utility for FormField classes
 * Converts field instances to plain objects for storage
 * 
 * When adding new field types: No changes needed here - uses spread operator
 */
export const serializeFormField = (field: FormField): any => {
  return {
    ...field,
    __type: field.type
  };
};

/**
 * Deserialization utility for FormField classes
 * Reconstructs field instances from stored data
 * 
 * CRITICAL: When adding new field types, you MUST:
 * 1. Add new case to switch statement
 * 2. Create appropriate validation object using getValidation helper
 * 3. Pass all constructor parameters in correct order
 * 4. Handle any field-specific properties (like min/max, options, etc.)
 * 
 * The getValidation helper automatically handles:
 * - TextFieldValidation for TEXT_INPUT_FIELD and TEXT_AREA_FIELD
 * - FillableFormFieldValidation for all other field types
 */
export const deserializeFormField = (data: any): FormField => {
  const getValidation = (data: any, fieldType: FieldType) => {
    if (!data.validation) {
      return fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD
        ? new TextFieldValidation(false)
        : new FillableFormFieldValidation(false);
    }
    
    if (fieldType === FieldType.TEXT_INPUT_FIELD || fieldType === FieldType.TEXT_AREA_FIELD) {
      return new TextFieldValidation(
        data.validation.required || false,
        data.validation.minLength,
        data.validation.maxLength
      );
    }
    
    return new FillableFormFieldValidation(data.validation.required || false);
  };
  
  switch (data.type || data.__type) {
    case FieldType.TEXT_INPUT_FIELD:
      return new TextInputField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(data, FieldType.TEXT_INPUT_FIELD) as TextFieldValidation
      );
    case FieldType.TEXT_AREA_FIELD:
      return new TextAreaField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(data, FieldType.TEXT_AREA_FIELD) as TextFieldValidation
      );
    case FieldType.EMAIL_FIELD:
      return new EmailField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(data, FieldType.EMAIL_FIELD) as FillableFormFieldValidation
      );
    case FieldType.NUMBER_FIELD:
      return new NumberField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(data, FieldType.NUMBER_FIELD) as FillableFormFieldValidation,
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
        getValidation(data, FieldType.SELECT_FIELD) as FillableFormFieldValidation,
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
        getValidation(data, FieldType.RADIO_FIELD) as FillableFormFieldValidation,
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
        getValidation(data, FieldType.CHECKBOX_FIELD) as FillableFormFieldValidation,
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
        getValidation(data, FieldType.DATE_FIELD) as FillableFormFieldValidation,
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
    layout: schema.layout, // Explicitly preserve layout object
    pages: schema.pages.map(page => ({
      ...page,
      fields: page.fields.map(serializeFormField)
    }))
  };
};

export const deserializeFormSchema = (data: any): FormSchema => {
  return {
    ...data,
    layout: data.layout, // Explicitly preserve layout object
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
export * from './validation.js';


// Re-export React Hook Form utilities
export * from './formHookUtils.js';

/**
 * 📋 INTEGRATION CHECKLIST - When adding new field types or properties:
 * 
 * REQUIRED FILES TO UPDATE:
 * 
 * 1. 📄 packages/types/src/index.ts (THIS FILE)
 *    - Add field class with proper inheritance
 *    - Add FieldType enum value  
 *    - Update deserializeFormField switch case
 *    - Add validation class if needed
 * 
 * 2. 📄 packages/types/src/validation.ts
 *    - Add Zod validation schema for new field type
 *    - Update getFieldValidationSchema function
 *    - Add cross-field validation if needed
 * 
 * 3. 📄 packages/ui/src/renderers/FormFieldRenderer.tsx
 *    - Add switch case for new field type
 *    - Handle rendering logic and validation display
 *    - Add character counting or constraint display
 * 
 * 4. 📄 apps/form-app/src/components/form-builder/field-settings/
 *    - Create new settings component for field-specific properties
 *    - Update FieldTypeSpecificSettings.tsx to include new component
 * 
 * 5. 📄 apps/form-app/src/hooks/useFieldEditor.ts
 *    - Update extractFieldData function to handle new properties
 *    - Update save logic if specialized validation is used
 *    - Add field watching for validation triggers
 * 
 * 6. 📄 apps/backend/src/scripts/seed-templates.ts
 *    - Update template examples to use new field types
 *    - Ensure proper validation objects are used
 * 
 * TESTING CHECKLIST:
 * 
 * ✅ Field creation in form builder
 * ✅ Field settings save/load correctly  
 * ✅ Field rendering in form viewer
 * ✅ Form submission with validation
 * ✅ Serialization/deserialization works
 * ✅ Template seeding succeeds
 * ✅ Character limits display and validate (for text fields)
 * ✅ Cross-field validation works (min ≤ max constraints)
 * 
 * EXAMPLES:
 * 
 * For reference on implementing character limits (TextInputField/TextAreaField):
 * - See TextFieldValidation class implementation
 * - See CharacterLimitSettings component
 * - See FormFieldRenderer character count display
 * - See validation schema with cross-field validation
 * 
 * For reference on field constraints (NumberField):
 * - See min/max properties stored directly on field
 * - See NumberRangeSettings component  
 * - See validation schema with range validation
 */
