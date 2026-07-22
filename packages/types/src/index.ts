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
 * - Added TEXT_FIELD_VALIDATION type for specialized validation objects
 */

import { sanitizeConditions, type ConditionalRule } from './conditions.js';

// Form Settings types
export interface ThankYouSettings {
  enabled: boolean;
  message: string;
}

export interface MaxResponsesSettings {
  enabled: boolean;
  limit: number;
}

export interface TimeWindowSettings {
  enabled: boolean;
  // Either a legacy "YYYY-MM-DD" date (whole-day window, pre-existing forms)
  // or a full ISO 8601 datetime string (absolute UTC instant, precise
  // start/end time) — see apps/form-app/src/lib/timeWindowDateTime.ts and
  // apps/backend/src/graphql/resolvers/responses.ts for the parsing logic.
  startDate?: string;
  endDate?: string;
}

export interface SubmissionLimitsSettings {
  maxResponses?: MaxResponsesSettings;
  timeWindow?: TimeWindowSettings;
}

export type ResponseCopyMode = 'always' | 'respondentChoice';

export interface ResponseCopySettings {
  enabled: boolean;
  mode: ResponseCopyMode;
  emailFieldId?: string;
  pdfTemplateId?: string;
  subject?: string;
}

export interface AccessControlSettings {
  enabled: boolean;
  requireSignIn: boolean;
  // Lowercase, no leading "@" (e.g. "dculus.com") — matched against the
  // verified respondent email's domain.
  allowedDomains?: string[];
}

export interface FormSettings {
  thankYou?: ThankYouSettings;
  submissionLimits?: SubmissionLimitsSettings;
  responseCopy?: ResponseCopySettings;
  accessControl?: AccessControlSettings;
  // Independent of accessControl.enabled — asks respondents to sign in
  // (Google/OTP) purely to capture a verified email, without restricting
  // who may respond (no domain allowlist applies to this flag alone).
  collectRespondentEmail?: boolean;
}

// Form related types
export interface Form {
  id: string;
  title: string;
  description?: string;
  shortUrl: string;
  formSchema: FormSchema;
  settings?: FormSettings;
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
  conditions?: ConditionalRule[]; // absent = no conditional logic (back-compat)
}

export interface FormPage {
  id: string;
  title: string;
  fields: FormField[];
  order: number;
}

export type LayoutCode =
  | 'L1'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'L5'
  | 'L6'
  | 'L7'
  | 'L8'
  | 'L9';

export interface FormLayout {
  theme: ThemeType;
  textColor: string;
  spacing: SpacingType;
  code: LayoutCode; // Layout code (L1-L9)
  content: string; // Rich text content for layout
  customBackGroundColor: string; // Custom background color overlay for background image layer
  customCTAButtonName?: string; // Custom call to action name
  backgroundImageKey: string; // Image key of layout background image
  backgroundVideoKey?: string; // Video key of layout background video (mutually exclusive with backgroundImageKey)
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
 * 7. Field editor hook (apps/form-app/src/hooks/useFieldEditor.ts - extractFieldData and handleSave)
 * 8. Form builder store (apps/form-app/src/store/useFormBuilderStore.ts):
 *    - createFormField function for field creation
 *    - serializeFieldToYMap function for YJS storage
 *    - extractFieldData function for YJS retrieval
 *    - createYJSFieldMap function for validation storage
 *    - updateField function for field updates (handle validation object format)
 *    - deserializePagesFromYJS function for page loading
 * 9. Seed templates (apps/backend/src/scripts/seed-templates.ts)
 *
 * CRITICAL: For fields with specialized validation (like TextFieldValidation):
 * - Ensure validation data is properly stored in YJS validation maps
 * - Update updateField function to handle validation object format from field editor
 * - Test both field saving and field duplication after changes
 */
export class FormField {
  id: string;
  type: FieldType;
  deleted?: boolean;
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
    this.type = FieldType.FILLABLE_FORM_FIELD;
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

  constructor(required: boolean, minLength?: number, maxLength?: number) {
    super(required);
    this.type = FieldType.TEXT_FIELD_VALIDATION;
    this.minLength = minLength;
    this.maxLength = maxLength;
  }
}

/**
 * Specialized validation class for checkbox fields
 * Contains selection limit validation properties (minSelections/maxSelections)
 *
 * Similar to TextFieldValidation but for validating checkbox selection constraints
 */
export class CheckboxFieldValidation extends FillableFormFieldValidation {
  minSelections?: number;
  maxSelections?: number;

  constructor(
    required: boolean,
    minSelections?: number,
    maxSelections?: number
  ) {
    super(required);
    this.type = FieldType.CHECKBOX_FIELD_VALIDATION;
    this.minSelections = minSelections;
    this.maxSelections = maxSelections;
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
 * Base class for fields that don't accept user input
 * Used for display-only fields like rich text, instructions, etc.
 *
 * When adding new non-fillable properties:
 * 1. Add properties to specific field classes (not here)
 * 2. Update FieldType enum
 * 3. Update deserializeFormField switch case
 * 4. Update FormFieldRenderer switch case
 * 5. Add field-specific settings component
 * 6. Update field settings configuration
 */
export class NonFillableFormField extends FormField {
  constructor(id: string) {
    super(id);
    this.type = FieldType.NON_FILLABLE_FORM_FIELD;
  }
}

/**
 * Rich text field for displaying formatted content (read-only)
 * Contains content property for storing HTML
 *
 * When modifying:
 * 1. Update RichTextSettings component
 * 2. Update FormFieldRenderer case
 * 3. Update field data extraction
 * 4. Update validation schema
 * 5. Update YJS serialization
 */
export class RichTextFormField extends NonFillableFormField {
  content: string;

  constructor(id: string, content: string = '') {
    super(id);
    this.content = content;
    this.type = FieldType.RICH_TEXT_FIELD;
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

  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    validation: FillableFormFieldValidation,
    options: string[] = []
  ) {
    // SelectField doesn't use placeholder - pass empty string
    super(id, label, defaultValue, prefix, hint, '', validation);
    this.type = FieldType.SELECT_FIELD;
    this.options = options;
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
    validation: FillableFormFieldValidation,
    options: string[] = []
  ) {
    // RadioField doesn't use placeholder - pass empty string
    super(id, label, defaultValue, prefix, hint, '', validation);
    this.type = FieldType.RADIO_FIELD;
    this.options = options;
  }
}

export class CheckboxField extends FillableFormField {
  options: string[];
  defaultValues: string[]; // Array of default selected values
  validation: CheckboxFieldValidation;

  constructor(
    id: string,
    label: string,
    defaultValues: string | string[], // Accept both for backwards compatibility during deserialization
    prefix: string,
    hint: string,
    placeholder: string,
    validation: CheckboxFieldValidation,
    options: string[] = []
  ) {
    // Pass empty string to parent constructor since we don't use the inherited defaultValue
    super(id, label, '', prefix, hint, placeholder, validation);
    this.type = FieldType.CHECKBOX_FIELD;
    this.validation = validation;
    this.options = options;

    // Normalise legacy string representation to array.
    // Try JSON.parse first (modern format: '["val1","val2"]') so values
    // containing commas are preserved; fall back to comma-split for old data.
    if (Array.isArray(defaultValues)) {
      this.defaultValues = defaultValues;
    } else if (defaultValues) {
      try {
        const parsed = JSON.parse(defaultValues);
        this.defaultValues = Array.isArray(parsed) ? parsed : [defaultValues];
      } catch {
        this.defaultValues = defaultValues.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      this.defaultValues = [];
    }
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

export class FileUploadField extends FillableFormField {
  allowedMimeTypes?: string[];
  maxFileSizeMb?: number;
  maxFiles?: number;

  constructor(
    id: string,
    label: string,
    prefix: string,
    hint: string,
    validation: FillableFormFieldValidation,
    allowedMimeTypes?: string[],
    maxFileSizeMb?: number,
    maxFiles?: number
  ) {
    super(id, label, '', prefix, hint, '', validation);
    this.type = FieldType.FILE_UPLOAD_FIELD;
    this.allowedMimeTypes = allowedMimeTypes;
    this.maxFileSizeMb = maxFileSizeMb;
    this.maxFiles = maxFiles;
  }
}

/**
 * Phone number field with country-aware validation.
 *
 * The stored/submitted value is always a plain E.164 string (e.g. "+14155552671"),
 * same value shape as every other fillable field. `defaultCountry` is only a UI hint
 * (ISO 3166-1 alpha-2, e.g. "IN") used to pre-select the country selector when the
 * field is empty — it is not needed to interpret a non-empty value, since a leading
 * "+" already encodes the country unambiguously.
 *
 * Uses the base FillableFormFieldValidation (required only) — "is this a valid phone
 * number" is a format rule enforced in the Zod schemas (validation.ts and
 * packages/ui/src/utils/zodSchemaBuilder.ts), not a configurable numeric bound like
 * TextFieldValidation's min/max.
 */
export class PhoneNumberField extends FillableFormField {
  defaultCountry?: string;

  constructor(
    id: string,
    label: string,
    defaultValue: string,
    prefix: string,
    hint: string,
    placeholder: string,
    validation: FillableFormFieldValidation,
    defaultCountry?: string
  ) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.PHONE_NUMBER_FIELD;
    this.defaultCountry = defaultCountry;
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
  FILE_UPLOAD_FIELD = 'file_upload_field',
  PHONE_NUMBER_FIELD = 'phone_number_field',
  RICH_TEXT_FIELD = 'rich_text_field',
  FORM_FIELD = 'form_field',
  FILLABLE_FORM_FIELD = 'fillable_form_field',
  NON_FILLABLE_FORM_FIELD = 'non_fillable_form_field',
  TEXT_FIELD_VALIDATION = 'text_field_validation',
  CHECKBOX_FIELD_VALIDATION = 'checkbox_field_validation',
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
    __type: field.type,
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
export const deserializeFormField = (data: any): FormField | null => {
  const getValidation = (data: any, fieldType: FieldType) => {
    if (!data.validation) {
      if (
        fieldType === FieldType.TEXT_INPUT_FIELD ||
        fieldType === FieldType.TEXT_AREA_FIELD
      ) {
        return new TextFieldValidation(false);
      } else if (fieldType === FieldType.CHECKBOX_FIELD) {
        return new CheckboxFieldValidation(false);
      }
      return new FillableFormFieldValidation(false);
    }

    if (
      fieldType === FieldType.TEXT_INPUT_FIELD ||
      fieldType === FieldType.TEXT_AREA_FIELD
    ) {
      return new TextFieldValidation(
        data.validation.required || false,
        data.validation.minLength,
        data.validation.maxLength
      );
    }

    if (fieldType === FieldType.CHECKBOX_FIELD) {
      return new CheckboxFieldValidation(
        data.validation.required || false,
        data.validation.minSelections,
        data.validation.maxSelections
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
        getValidation(
          data,
          FieldType.EMAIL_FIELD
        ) as FillableFormFieldValidation
      );
    case FieldType.NUMBER_FIELD:
      return new NumberField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(
          data,
          FieldType.NUMBER_FIELD
        ) as FillableFormFieldValidation,
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
        getValidation(
          data,
          FieldType.SELECT_FIELD
        ) as FillableFormFieldValidation,
        data.options || []
      );
    case FieldType.RADIO_FIELD:
      return new RadioField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        getValidation(
          data,
          FieldType.RADIO_FIELD
        ) as FillableFormFieldValidation,
        data.options || []
      );
    case FieldType.CHECKBOX_FIELD:
      return new CheckboxField(
        data.id,
        data.label || '',
        data.defaultValues || data.defaultValue || [], // Support both new and legacy formats
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(
          data,
          FieldType.CHECKBOX_FIELD
        ) as CheckboxFieldValidation,
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
        getValidation(
          data,
          FieldType.DATE_FIELD
        ) as FillableFormFieldValidation,
        data.minDate,
        data.maxDate
      );
    case FieldType.FILE_UPLOAD_FIELD:
      return new FileUploadField(
        data.id,
        data.label || '',
        data.prefix || '',
        data.hint || '',
        getValidation(
          data,
          FieldType.FILE_UPLOAD_FIELD
        ) as FillableFormFieldValidation,
        data.allowedMimeTypes,
        data.maxFileSizeMb,
        data.maxFiles
      );
    case FieldType.PHONE_NUMBER_FIELD:
      return new PhoneNumberField(
        data.id,
        data.label || '',
        data.defaultValue || '',
        data.prefix || '',
        data.hint || '',
        data.placeholder || '',
        getValidation(
          data,
          FieldType.PHONE_NUMBER_FIELD
        ) as FillableFormFieldValidation,
        data.defaultCountry
      );
    case FieldType.RICH_TEXT_FIELD: {
      const richTextContent = data.content || '';
      return new RichTextFormField(data.id, richTextContent);
    }
    default:
      console.warn(
        `[deserializeFormField] Unknown field type "${(data as { type?: string }).type}" for id "${data.id}". Skipping field.`
      );
      return null;
  }
};

export const serializeFormSchema = (schema: FormSchema): any => {
  return {
    ...schema,
    layout: schema.layout, // Explicitly preserve layout object
    pages: schema.pages.map((page) => ({
      ...page,
      fields: page.fields.map(serializeFormField),
    })),
  };
};

export const deserializeFormSchema = (data: any): FormSchema => {
  const schema: FormSchema = {
    ...data,
    layout: data.layout, // Explicitly preserve layout object
    pages: (data.pages || []).map((page: any) => ({
      ...page,
      fields: (page.fields || [])
        .map((fieldData: any) => {
          const field = deserializeFormField(fieldData);
          if (field && fieldData.deleted) field.deleted = true;
          return field;
        })
        .filter((f: FormField | null): f is FormField => f !== null),
    })),
  };

  // Conditions come from persisted JSON / Y.js — validate at this trust
  // boundary so malformed rules are dropped rather than propagated
  const conditions = sanitizeConditions(data?.conditions);
  if (conditions) {
    schema.conditions = conditions;
  } else {
    delete schema.conditions;
  }

  return schema;
};

export interface EmailFieldInfo {
  id: string;
  label: string;
  required: boolean;
}

// Finds every EmailField in a (deserialized) form schema, in page/field order.
// Shared by the email plugin config, the response-copy settings UI, and form-viewer's
// respondent "send me a copy" checkbox, so recipient-field discovery stays consistent.
export const extractEmailFields = (schema: FormSchema | null | undefined): EmailFieldInfo[] => {
  if (!schema?.pages) return [];
  const fields: EmailFieldInfo[] = [];
  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (field instanceof EmailField) {
        fields.push({
          id: field.id,
          label: field.label || 'Unlabeled Field',
          required: field.validation?.required ?? false,
        });
      }
    }
  }
  return fields;
};

// Plugin Metadata Types
export type PluginMetadata = Record<string, any>;

// Quiz-specific metadata (stored under 'quiz-grading' key)
export interface QuizFieldResult {
  fieldId: string;
  fieldLabel: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
}

export interface QuizGradingMetadata {
  quizScore: number;
  totalMarks: number;
  percentage: number;
  passThreshold: number;
  fieldResults: QuizFieldResult[];
  gradedAt: string;
  gradedBy: 'plugin' | 'manual';
}

// Response types
export interface ResponseTag {
  id: string;
  formId: string;
  name: string;
  color: string;
  createdAt: Date;
}

export interface FormResponse {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata?: PluginMetadata;
  respondentEmail?: string;
  submittedAt: Date;
  tags?: ResponseTag[];
  hasBeenEdited?: boolean;
  lastEditedAt?: string;
  lastEditedBy?: User;
  totalEdits?: number;
  editHistory?: ResponseEditHistory[];
}

// Response Edit Tracking Types
export interface ResponseEditHistory {
  id: string;
  responseId: string;
  editedBy: User;
  editedAt: string;
  editType: EditType;
  editReason?: string;
  ipAddress?: string;
  userAgent?: string;
  totalChanges: number;
  changesSummary?: string;
  fieldChanges: ResponseFieldChange[];
}

export interface ResponseFieldChange {
  id: string;
  fieldId: string;
  fieldLabel: string;
  fieldType: string;
  previousValue: any;
  newValue: any;
  changeType: ChangeType;
  valueChangeSize?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export enum EditType {
  MANUAL = 'MANUAL',
  SYSTEM = 'SYSTEM',
  BULK = 'BULK',
}

export enum ChangeType {
  ADD = 'ADD',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// Input types for mutations
export interface UpdateResponseInput {
  responseId: string;
  data: Record<string, any>;
  editReason?: string;
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

// Re-export conditional logic types and evaluator
export * from './conditions.js';

// Re-export validation schemas and types
export * from './validation.js';

// Re-export React Hook Form utilities
export * from './formHookUtils.js';

// Re-export plugin types
export * from './plugins.js';

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
 *    - Update handleSave function if specialized validation is used
 *    - Add field watching for validation triggers
 *
 * 6. 📄 apps/form-app/src/store/useFormBuilderStore.ts (CRITICAL for YJS collaboration)
 *    - Update createFormField function for proper field instantiation
 *    - Update serializeFieldToYMap function for YJS storage
 *    - Update extractFieldData function for YJS data retrieval
 *    - Update createYJSFieldMap function for validation object storage
 *    - Update updateField function to handle validation object format from field editor
 *    - Update deserializePagesFromYJS function for proper deserialization
 *
 * 7. 📄 apps/backend/src/scripts/seed-templates.ts
 *    - Update template examples to use new field types
 *    - Ensure proper validation objects are used
 *
 * TESTING CHECKLIST:
 *
 * ✅ Field creation in form builder
 * ✅ Field settings save/load correctly
 * ✅ Field duplication preserves all properties (including validation constraints)
 * ✅ Field rendering in form viewer
 * ✅ Form submission with validation
 * ✅ Serialization/deserialization works
 * ✅ YJS collaborative editing preserves validation data
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

export {
  GRAPHQL_ERROR_CODES,
  type GraphQLErrorCode,
  isGraphQLErrorCode,
} from './graphql.js';
