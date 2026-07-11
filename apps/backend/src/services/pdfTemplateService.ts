import { readFile } from 'node:fs/promises';
import { checkTemplate, getDefaultFont, BLANK_PDF, type Font, type Template } from '@pdfme/common';
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
 * Font name bound-field elements reference (must match PDF_FIELD_FONT_NAME
 * in form-app's fieldBinding.ts). Noto Sans Tamil covers Tamil AND basic
 * Latin, so it renders any answer regardless of script — pdfme's default
 * Roboto has no Tamil glyphs.
 */
export const TAMIL_FONT_NAME = 'NotoSansTamil';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let cachedFonts: Font | null = null;

/**
 * pdfme font map for generation: default Roboto (fallback) plus Noto Sans
 * Tamil read from the backend's committed asset. src/services and
 * dist/services sit at the same depth, so the relative URL resolves in
 * dev (tsx), tests and the built image alike.
 */
export async function getPdfFonts(): Promise<Font> {
  if (cachedFonts) return cachedFonts;
  const fontUrl = new URL(
    '../../assets/fonts/NotoSansTamil-Regular.ttf',
    import.meta.url
  );
  const data = await readFile(fontUrl);
  cachedFonts = { ...getDefaultFont(), [TAMIL_FONT_NAME]: { data } };
  return cachedFonts;
}

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
 * Deterministic per-field-type sample answers for previewing a template
 * before any real responses exist. Choice fields use the field's own
 * options so the preview reflects the actual form.
 */
export function buildSampleResponseData(deserializedSchema: any): Record<string, any> {
  const data: Record<string, any> = {};
  for (const page of deserializedSchema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (!field?.id) continue;
      const options: string[] = Array.isArray(field.options) ? field.options : [];
      switch (field.type) {
        case FieldType.RICH_TEXT_FIELD:
          break;
        case FieldType.EMAIL_FIELD:
          data[field.id] = 'sample@example.com';
          break;
        case FieldType.NUMBER_FIELD:
          data[field.id] = 42;
          break;
        case FieldType.DATE_FIELD: {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          data[field.id] = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
          break;
        }
        case FieldType.PHONE_NUMBER_FIELD:
          data[field.id] = '+14155552671';
          break;
        case FieldType.SELECT_FIELD:
        case FieldType.RADIO_FIELD:
          data[field.id] = options[0] ?? 'Option 1';
          break;
        case FieldType.CHECKBOX_FIELD:
          data[field.id] = options.length > 0 ? options.slice(0, 2) : ['Option 1'];
          break;
        case FieldType.FILE_UPLOAD_FIELD:
          data[field.id] = ['sample/sample-document.pdf'];
          break;
        case FieldType.TEXT_AREA_FIELD:
          data[field.id] =
            'This is a sample long answer that shows how a multi-line response will appear in the generated PDF.';
          break;
        default:
          data[field.id] = 'Sample answer';
      }
    }
  }
  return data;
}

/**
 * Field descriptors for the AI sample-data prompt (id, friendly type name,
 * label, options). Rich text is excluded; labels are capped defensively.
 */
export function buildAiFieldEntries(
  deserializedSchema: any
): { id: string; type: string; label: string; options?: string[] }[] {
  const entries: { id: string; type: string; label: string; options?: string[] }[] = [];
  for (const page of deserializedSchema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (!field?.id || field.type === FieldType.RICH_TEXT_FIELD) continue;
      const options = Array.isArray(field.options) ? field.options : undefined;
      entries.push({
        id: field.id,
        type: String(field.type).replace(/_field$/, '').replace(/_/g, ' '),
        label: String(field.label ?? '').slice(0, 200),
        ...(options?.length ? { options } : {}),
      });
    }
  }
  return entries;
}

/**
 * Merge AI-generated answers over the deterministic sample data, accepting
 * each value only when it is valid for the field's type (options verbatim,
 * parseable numbers/dates); anything invalid keeps the deterministic value.
 * File uploads always stay deterministic — the model cannot invent R2 keys.
 */
export function coerceAiSampleData(
  deserializedSchema: any,
  aiAnswers: Record<string, string>
): Record<string, any> {
  const data = buildSampleResponseData(deserializedSchema);
  for (const page of deserializedSchema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (!field?.id) continue;
      const raw = aiAnswers[field.id];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const value = raw.trim();
      const options: string[] = Array.isArray(field.options) ? field.options : [];

      switch (field.type) {
        case FieldType.RICH_TEXT_FIELD:
        case FieldType.FILE_UPLOAD_FIELD:
          break;
        case FieldType.NUMBER_FIELD: {
          // Number('') === 0, so an entirely non-numeric answer must be
          // rejected before parsing, not coerced to zero
          const cleaned = value.replace(/[^\d.-]/g, '');
          const num = Number(cleaned);
          if (cleaned !== '' && Number.isFinite(num)) data[field.id] = num;
          break;
        }
        case FieldType.DATE_FIELD:
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) data[field.id] = value;
          break;
        case FieldType.SELECT_FIELD:
        case FieldType.RADIO_FIELD:
          if (options.includes(value)) data[field.id] = value;
          break;
        case FieldType.CHECKBOX_FIELD: {
          const chosen = value
            .split(',')
            .map((part) => part.trim())
            .filter((part) => options.includes(part));
          if (chosen.length > 0) data[field.id] = chosen;
          break;
        }
        default:
          data[field.id] = value;
      }
    }
  }
  return data;
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
 * schemas. Three binding conventions, checked in order:
 *
 * 1. Bound fields — text elements carrying a `dculusFieldId` custom prop
 *    (inserted by the designer's form-fields panel; content is the display
 *    label and is ignored). Resolves to the formatted response value, or ''
 *    when the field was deleted / left unanswered.
 * 2. Inline field tokens — text elements carrying `dculusTextTemplate`
 *    (the `{token}` source string) plus a `dculusFieldVars` map
 *    (token → fieldId), written by the designer's text editor. The
 *    element's `content` is display-only (labels inline, shown on the
 *    canvas) and is ignored; each `{token}` in the template is replaced
 *    with the field's formatted value; unmapped `{…}` braces are left
 *    untouched.
 * 3. Legacy/manual — {{fieldId}} placeholders inside text content (same
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
      let content = typeof schema.content === 'string' ? schema.content : '';
      const boundFieldId =
        typeof schema.dculusFieldId === 'string' ? schema.dculusFieldId : undefined;

      if (boundFieldId && schema.type === 'text') {
        inputs[schema.name] = substitutionValues[boundFieldId] ?? '';
        continue;
      }

      if (schema.type === 'text') {
        const fieldVars = schema.dculusFieldVars;
        if (
          fieldVars &&
          typeof fieldVars === 'object' &&
          typeof schema.dculusTextTemplate === 'string'
        ) {
          content = schema.dculusTextTemplate;
          for (const [token, fieldId] of Object.entries(fieldVars)) {
            if (typeof fieldId !== 'string') continue;
            const value = substitutionValues[fieldId] ?? '';
            // Standalone {token} only — never the inner braces of a legacy
            // {{fieldId}} placeholder when a token name collides with an id
            content = content.replace(
              new RegExp(`(?<!\\{)\\{${escapeRegExp(token)}\\}(?!\\})`, 'g'),
              () => value
            );
          }
        }
        inputs[schema.name] = substitutePlaceholdersPlainText(
          content,
          substitutionValues,
          fieldLabels
        );
      } else {
        inputs[schema.name] = content;
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
      options: { font: await getPdfFonts() },
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
