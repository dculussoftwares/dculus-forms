import {
  FieldType,
  FILE_UPLOAD_DEFAULT_MAX_FILES,
  deserializeFormSchema,
  evaluateConditions,
  isLayoutField,
  type FormField,
  type FormPage,
  type FormResponsesByPage,
} from '@dculus/types';
import { GRAPHQL_ERROR_CODES } from '@dculus/types/graphql.js';
import { parseCalendarDate } from '@dculus/utils';
import { z } from 'zod';
import { createGraphQLError } from '#graphql-errors';
import { isResponseFileKeyForForm } from '../services/responseFiles/responseFileCatalog.js';

/**
 * S04-04: server-side validation of respondent answers against the form's live
 * schema. The viewer validates too, but `submitResponse` is a public mutation
 * callable directly, so every rule the viewer enforces is re-checked here.
 */

const EMAIL_SCHEMA = z.string().email();
const E164_PATTERN = /^\+[1-9]\d{1,14}$/;
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AnswerField = FormField & Record<string, any>;

const ANSWERABLE_TYPES = new Set<string>([
  FieldType.TEXT_INPUT_FIELD,
  FieldType.TEXT_AREA_FIELD,
  FieldType.EMAIL_FIELD,
  FieldType.NUMBER_FIELD,
  FieldType.SELECT_FIELD,
  FieldType.RADIO_FIELD,
  FieldType.CHECKBOX_FIELD,
  FieldType.DATE_FIELD,
  FieldType.FILE_UPLOAD_FIELD,
  FieldType.PHONE_NUMBER_FIELD,
]);

export interface ValidateAnswersOptions {
  formId: string;
  /** Skip "required" and minimum-count rules (work-in-progress data). */
  partial?: boolean;
}

const isEmptyValue = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const fail = (field: AnswerField, reason: string): never => {
  const label = typeof field.label === 'string' && field.label ? field.label : 'a field';
  throw createGraphQLError(`Invalid answer for "${label}": ${reason}`, GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
};

const checkText = (field: AnswerField, value: unknown, required: boolean, partial: boolean): void => {
  if (typeof value !== 'string') return fail(field, 'a text value is required');
  const length = value.trim().length;
  const { minLength, maxLength } = field.validation ?? {};
  if (required && length === 0 && !partial) return fail(field, 'this field is required');
  if (length === 0) return;
  if (!partial && typeof minLength === 'number' && minLength > 0 && length < minLength) {
    return fail(field, `must be at least ${minLength} characters`);
  }
  if (typeof maxLength === 'number' && maxLength > 0 && length > maxLength) {
    return fail(field, `cannot exceed ${maxLength} characters`);
  }
};

const checkNumber = (field: AnswerField, value: unknown): void => {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return fail(field, 'must be a valid number');
  if (typeof field.min === 'number' && numeric < field.min) return fail(field, `must be at least ${field.min}`);
  if (typeof field.max === 'number' && numeric > field.max) return fail(field, `must be no more than ${field.max}`);
};

const checkDate = (field: AnswerField, value: unknown): void => {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) return fail(field, 'must be a valid date');
  const date = parseCalendarDate(value);
  if (Number.isNaN(date.getTime()) || value !== formatCalendar(date)) return fail(field, 'must be a valid date');
  if (field.minDate && date < parseCalendarDate(field.minDate)) return fail(field, 'is before the earliest allowed date');
  if (field.maxDate && date > parseCalendarDate(field.maxDate)) return fail(field, 'is after the latest allowed date');
};

const formatCalendar = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const checkChoice = (field: AnswerField, value: unknown): void => {
  if (typeof value !== 'string') return fail(field, 'a selected option is required');
  if (!Array.isArray(field.options) || !field.options.includes(value)) {
    return fail(field, 'is not one of the available options');
  }
};

const checkCheckbox = (field: AnswerField, value: unknown, required: boolean, partial: boolean): void => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return fail(field, 'a list of selected options is required');
  }
  const options: unknown[] = Array.isArray(field.options) ? field.options : [];
  if (value.some((item) => !options.includes(item)) || new Set(value).size !== value.length) {
    return fail(field, 'contains an option that is not available');
  }
  const { minSelections, maxSelections } = field.validation ?? {};
  if (!partial && required && value.length === 0) return fail(field, 'select at least one option');
  if (!partial && value.length > 0 && typeof minSelections === 'number' && value.length < minSelections) {
    return fail(field, `select at least ${minSelections} options`);
  }
  if (typeof maxSelections === 'number' && maxSelections > 0 && value.length > maxSelections) {
    return fail(field, `select at most ${maxSelections} options`);
  }
};

const checkFiles = (field: AnswerField, value: unknown, formId: string, required: boolean, partial: boolean): void => {
  if (!Array.isArray(value)) return fail(field, 'a list of uploaded files is required');
  if (!partial && required && value.length === 0) return fail(field, 'upload at least one file');
  const maxFiles =
    typeof field.maxFiles === 'number' && field.maxFiles > 0 ? field.maxFiles : FILE_UPLOAD_DEFAULT_MAX_FILES;
  if (value.length > maxFiles) return fail(field, `allows a maximum of ${maxFiles} files`);
  if (value.some((key) => !isResponseFileKeyForForm(key, formId))) return fail(field, 'contains an invalid file reference');
};

const checkField = (
  field: AnswerField,
  value: unknown,
  required: boolean,
  { formId, partial = false }: ValidateAnswersOptions
): void => {
  if (isEmptyValue(value) && field.type !== FieldType.CHECKBOX_FIELD && field.type !== FieldType.FILE_UPLOAD_FIELD) {
    if (required && !partial) fail(field, 'this field is required');
    return;
  }

  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
    case FieldType.TEXT_AREA_FIELD:
      return checkText(field, value, required, partial);
    case FieldType.EMAIL_FIELD:
      if (typeof value !== 'string' || !EMAIL_SCHEMA.safeParse(value.trim()).success) {
        return fail(field, 'must be a valid email address');
      }
      return;
    case FieldType.PHONE_NUMBER_FIELD:
      if (typeof value !== 'string' || !E164_PATTERN.test(value.trim())) return fail(field, 'must be a valid phone number');
      return;
    case FieldType.NUMBER_FIELD:
      return checkNumber(field, value);
    case FieldType.DATE_FIELD:
      return checkDate(field, value);
    case FieldType.SELECT_FIELD:
    case FieldType.RADIO_FIELD:
      return checkChoice(field, value);
    case FieldType.CHECKBOX_FIELD:
      return checkCheckbox(field, isEmptyValue(value) ? [] : value, required, partial);
    case FieldType.FILE_UPLOAD_FIELD:
      return checkFiles(field, isEmptyValue(value) ? [] : value, formId, required, partial);
  }
};

/**
 * Validates `data` against the form schema and returns it without keys that
 * are not live answerable fields (unknown, deleted, layout or display-only).
 * Throws BAD_USER_INPUT on the first violation. Fails closed: a schema that
 * is missing or cannot be read rejects the submission instead of skipping
 * validation.
 */
export function validateResponseAnswers(
  rawSchema: unknown,
  data: Record<string, unknown>,
  options: ValidateAnswersOptions
): Record<string, unknown> {
  const unavailable = () =>
    createGraphQLError('Form schema is unavailable', GRAPHQL_ERROR_CODES.INTERNAL_SERVER_ERROR);

  // Some rows hold the schema as a JSON-encoded string rather than a JSON object.
  let schemaInput: unknown = rawSchema;
  if (typeof schemaInput === 'string') {
    try {
      schemaInput = JSON.parse(schemaInput);
    } catch {
      throw unavailable();
    }
  }
  if (!schemaInput || typeof schemaInput !== 'object') {
    throw unavailable();
  }

  let pages: FormPage[];
  let conditions: ReturnType<typeof deserializeFormSchema>['conditions'];
  try {
    const schema = deserializeFormSchema(schemaInput);
    pages = schema.pages ?? [];
    conditions = schema.conditions;
  } catch {
    throw unavailable();
  }

  const answerable = new Map<string, { field: AnswerField; pageId: string }>();
  for (const page of pages) {
    for (const field of page.fields ?? []) {
      if (field.deleted || isLayoutField(field) || !ANSWERABLE_TYPES.has(field.type)) continue;
      answerable.set(field.id, { field: field as AnswerField, pageId: page.id });
    }
  }

  const byPage: FormResponsesByPage = {};
  const sanitized: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(data)) {
    const entry = answerable.get(fieldId);
    if (!entry) continue;
    sanitized[fieldId] = value;
    (byPage[entry.pageId] ??= {})[fieldId] = value;
  }

  const visibility = evaluateConditions(conditions, byPage, { pages });
  for (const [fieldId, { field, pageId }] of answerable) {
    if (visibility.hiddenFieldIds.has(fieldId) || visibility.hiddenPageIds.has(pageId)) continue;
    const required = visibility.requiredOverrides.get(fieldId) ?? !!field.validation?.required;
    checkField(field, sanitized[fieldId], required, options);
  }

  return sanitized;
}
