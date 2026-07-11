import { checkTemplate, BLANK_PDF, type Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import {
  text,
  multiVariableText,
  image,
  svg,
  line,
  rectangle,
  ellipse,
  table,
  date,
  time,
  dateTime,
  barcodes,
} from '@pdfme/schemas';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { FieldType } from '@dculus/types';
import { substitutePlaceholdersPlainText, createFieldLabelsMap } from '@dculus/utils';
import { downloadFileBuffer } from './fileUploadService.js';
import { logger } from '../lib/logger.js';

/**
 * PDF Template service — validation and per-response PDF generation for
 * pdfme-based templates (see PdfTemplate model).
 *
 * Templates built on an uploaded base PDF are stored with `basePdf: null`
 * (the PDF itself lives in the private R2 bucket under `fileKey`); blank
 * templates keep their `{ width, height, padding }` basePdf inline.
 */

// Element plugins available at generation time — superset of the designer palette
// (v6 requires non-text schema types to be passed explicitly via `plugins`)
export const PDF_GENERATOR_PLUGINS = {
  text,
  multiVariableText,
  image,
  svg,
  line,
  rectangle,
  ellipse,
  table,
  date,
  time,
  dateTime,
  qrcode: barcodes.qrcode,
};

/**
 * Strip the (potentially multi-MB base64) uploaded base PDF out of a template
 * before persisting. Blank-page basePdf objects ({ width, height, padding })
 * are kept inline.
 */
export function stripBasePdf(template: any, hasUploadedPdf: boolean): any {
  if (!template || typeof template !== 'object') return template;
  if (!hasUploadedPdf) return template;
  return { ...template, basePdf: null };
}

/**
 * Validate a pdfme template JSON with checkTemplate(). Stored/incoming
 * templates for uploaded PDFs have basePdf stripped, so validate against
 * BLANK_PDF in that case. Blank-page templates must supply their own
 * basePdf ({ width, height, padding }) — a missing one is a genuine
 * validation failure, not something to silently paper over, since the
 * unrepaired template would otherwise pass validation here but fail
 * later at generation time.
 */
export function validatePdfTemplate(template: any, hasUploadedPdf: boolean): void {
  const candidate = hasUploadedPdf ? { ...template, basePdf: BLANK_PDF } : template;
  checkTemplate(candidate); // throws on invalid template
}

/**
 * Format a single response value for PDF text substitution.
 * Mirrors the formatting rules of unifiedExportService (dates, file
 * uploads, phone numbers, arrays).
 */
export function formatResponseValueForPdf(value: any, fieldType?: FieldType): string {
  if (value === null || value === undefined || value === '') return '';

  if (fieldType === FieldType.FILE_UPLOAD_FIELD && Array.isArray(value)) {
    // Values are arrays of R2 keys — show filenames only
    return value
      .map((key: string) => String(key).split('/').pop() || key)
      .join(', ');
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  const stringValue = String(value);

  switch (fieldType) {
    case FieldType.DATE_FIELD: {
      // YYYY-MM-DD string — parse as local date to avoid UTC day shift
      if (/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
        const [y, m, d] = stringValue.substring(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      // Legacy: epoch-ms numeric string
      const timestamp = parseInt(stringValue, 10);
      const dateVal = new Date(timestamp);
      return isNaN(dateVal.getTime())
        ? stringValue
        : dateVal.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    case FieldType.PHONE_NUMBER_FIELD: {
      const parsed = parsePhoneNumberFromString(stringValue);
      return parsed ? parsed.formatInternational() : stringValue;
    }
    default:
      return stringValue;
  }
}

/**
 * Build fieldId → formatted-value map for substitution from a deserialized
 * form schema and raw response data.
 */
export function buildSubstitutionValues(
  deserializedSchema: any,
  responseData: Record<string, any>
): Record<string, string> {
  const fieldTypes: Record<string, FieldType> = {};
  for (const page of deserializedSchema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (field?.id) fieldTypes[field.id] = field.type;
    }
  }

  const values: Record<string, string> = {};
  for (const [fieldId, raw] of Object.entries(responseData ?? {})) {
    values[fieldId] = formatResponseValueForPdf(raw, fieldTypes[fieldId]);
  }
  return values;
}

/**
 * Hydrate a stored template's basePdf: download the uploaded base PDF from
 * the private bucket when fileKey is set; blank templates pass through.
 */
export async function hydrateTemplate(
  storedTemplate: any,
  fileKey: string | null
): Promise<Template> {
  if (!fileKey) return storedTemplate as Template;
  const pdfBuffer = await downloadFileBuffer(fileKey);
  return { ...storedTemplate, basePdf: new Uint8Array(pdfBuffer) } as Template;
}

/**
 * Build the single-record inputs map for @pdfme/generator from a template's
 * schemas. Two binding conventions, checked in order:
 *
 * 1. Bound fields — text elements carrying a `dculusFieldId` custom prop
 *    (inserted by the designer's form-fields panel; content is the display
 *    label and is ignored). Resolves to the formatted response value, or ''
 *    when the field was deleted / left unanswered.
 * 2. Legacy/manual — {{fieldId}} placeholders inside text content (same
 *    {{…}} convention as the email plugin / thank-you page, but plain
 *    text — no HTML escaping).
 *
 * readOnly elements render from their own content and must not appear in
 * inputs.
 */
export function buildTemplateInputs(
  template: Template,
  substitutionValues: Record<string, string>,
  fieldLabels: Record<string, string>
): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const page of (template.schemas ?? []) as any[][]) {
    for (const schema of page ?? []) {
      if (!schema?.name || schema.readOnly) continue;
      const content = typeof schema.content === 'string' ? schema.content : '';
      const boundFieldId =
        typeof schema.dculusFieldId === 'string' ? schema.dculusFieldId : undefined;
      if (boundFieldId && schema.type === 'text') {
        inputs[schema.name] = substitutionValues[boundFieldId] ?? '';
      } else {
        inputs[schema.name] =
          schema.type === 'text'
            ? substitutePlaceholdersPlainText(content, substitutionValues, fieldLabels)
            : content;
      }
    }
  }
  return inputs;
}

/**
 * Generate a filled PDF for one response — builds inputs via
 * buildTemplateInputs() and runs @pdfme/generator server-side.
 */
export async function generatePdfForResponse(params: {
  storedTemplate: any;
  fileKey: string | null;
  deserializedSchema: any;
  responseData: Record<string, any>;
}): Promise<Buffer> {
  const { storedTemplate, fileKey, deserializedSchema, responseData } = params;

  const template = await hydrateTemplate(storedTemplate, fileKey);
  const substitutionValues = buildSubstitutionValues(deserializedSchema, responseData);
  const fieldLabels = createFieldLabelsMap(deserializedSchema);

  const inputs = buildTemplateInputs(template, substitutionValues, fieldLabels);

  try {
    const pdf = await generate({
      template,
      inputs: [inputs],
      plugins: PDF_GENERATOR_PLUGINS,
    });
    return Buffer.from(pdf);
  } catch (error) {
    logger.error('PDF generation failed:', error);
    throw error;
  }
}

/**
 * Sanitize a template name into a safe download filename.
 */
export function buildPdfFilename(templateName: string, responseId: string): string {
  const safeName =
    templateName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-').toLowerCase() ||
    'document';
  return `${safeName}-${responseId}.pdf`;
}
