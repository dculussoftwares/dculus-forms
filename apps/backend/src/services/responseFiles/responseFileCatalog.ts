import { FieldType } from '@dculus/types';
import { logger } from '../../lib/logger.js';
import { formFileRepository, formRepository, responseRepository } from '../../repositories/index.js';
import { getFileMetadata } from '../fileUploadService.js';
import { getFormSchemaFromHocuspocus } from '../hocuspocus.js';
import { iterateResponsesByFormId } from '../responseService.js';
import type { ResponseFilter } from '../responseFilterService.js';

/**
 * Builds the list of respondent-uploaded files for a form, always starting from
 * live (non-deleted) responses. Never from a FormFile listing: that table also
 * holds uploads from abandoned submissions and from soft-deleted responses,
 * neither of which may be browsed or exported.
 */

export interface ResponseFileEntry {
  key: string;
  responseId: string;
  submittedAt: Date;
  respondentEmail: string | null;
  fieldId: string;
  fieldLabel: string;
  /** Position of the field in the form (0-based), for stable folder ordering. */
  fieldOrder: number;
  originalName: string;
  size: number | null;
  mimeType: string | null;
}

export interface ResponseFileQuery {
  filters?: ResponseFilter[];
  filterLogic?: 'AND' | 'OR';
  /** Restrict to these responses (bulk selection / single response). */
  responseIds?: string[];
  /** Restrict to these files (selection in the Files view); unknown keys are ignored. */
  fileKeys?: string[];
}

export interface FileUploadFieldInfo {
  id: string;
  label: string;
  order: number;
}

/** The slice of a (live or stored) form schema this module reads. */
interface FormSchemaLike {
  pages?: Array<{ fields?: Array<{ id?: string; type?: string; label?: string }> }>;
}

interface ResponseRow {
  id: string;
  data: unknown;
  submittedAt: Date | string;
  respondentEmail?: string | null;
}

/**
 * Respondent files live under `files/form-response/{formId}/` (see
 * fileUploadService.generateS3Key). Any key outside the form's own prefix is
 * ignored, so a tampered response value can never pull another form's file.
 */
export const isResponseFileKeyForForm = (key: unknown, formId: string): key is string =>
  typeof key === 'string' &&
  key.startsWith(`files/form-response/${formId}/`) &&
  !key.slice(`files/form-response/${formId}/`.length).includes('/');

/** Display name recovered from a key: `{timestamp}-{uuid}-{name}{ext}` → `{name}{ext}`. */
export const fileNameFromKey = (key: string): string => {
  const segment = key.split('/').pop() ?? key;
  return segment.replace(/^\d{13}-[0-9a-f-]{36}-/, '') || segment;
};

const loadFormSchema = async (formId: string): Promise<FormSchemaLike | null> => {
  try {
    const live: FormSchemaLike | null = await getFormSchemaFromHocuspocus(formId);
    if (live?.pages?.length) return live;
  } catch (error) {
    logger.warn(`Falling back to stored schema for form ${formId}:`, error);
  }
  const form = await formRepository.findUnique({ where: { id: formId }, select: { formSchema: true } });
  return (form?.formSchema as FormSchemaLike | null) ?? null;
};

/** File upload fields in form order, including soft-deleted ones that may still hold answers. */
export const listFileUploadFields = (schema: FormSchemaLike | null): FileUploadFieldInfo[] => {
  const fields: FileUploadFieldInfo[] = [];
  for (const page of schema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (field?.type === FieldType.FILE_UPLOAD_FIELD && field.id) {
        fields.push({ id: field.id, label: String(field.label || 'Untitled question'), order: fields.length });
      }
    }
  }
  return fields;
};

async function* iterateResponses(formId: string, query: ResponseFileQuery): AsyncGenerator<ResponseRow[]> {
  if (query.responseIds) {
    yield await responseRepository.findMany({
      where: { id: { in: query.responseIds }, formId, deletedAt: null },
      orderBy: { submittedAt: 'desc' },
    });
    return;
  }
  yield* iterateResponsesByFormId(formId, {
    filters: query.filters?.length ? query.filters : undefined,
    filterLogic: query.filterLogic,
  });
}

const KEY_LOOKUP_CHUNK = 1000;
const METADATA_LOOKUP_CONCURRENCY = 16;

type FileRecord = { originalName: string; size: number; mimeType: string };

/**
 * Respondent uploads made before they were recorded as FormFile rows have no
 * metadata. Recover it from the stored object (size and content type), keep the
 * name from the key, and save it so each file is only looked up once.
 */
const backfillFileRecords = async (formId: string, keys: string[]): Promise<Map<string, FileRecord>> => {
  const recovered = new Map<string, FileRecord>();
  let next = 0;
  const worker = async () => {
    while (next < keys.length) {
      const key = keys[next++];
      try {
        const metadata = await getFileMetadata(key);
        if (!metadata) continue;
        recovered.set(key, {
          originalName: fileNameFromKey(key),
          size: metadata.size,
          mimeType: metadata.contentType || 'application/octet-stream',
        });
      } catch (error) {
        logger.warn(`[Response files] Could not read metadata for ${key}:`, error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(METADATA_LOOKUP_CONCURRENCY, keys.length) }, worker));

  if (recovered.size > 0) {
    try {
      await formFileRepository.createManySkippingDuplicates(
        [...recovered].map(([key, record]) => ({ key, type: 'FormResponse', formId, url: key, ...record }))
      );
    } catch (error) {
      // Saving is an optimisation; the recovered values are still used for this request.
      logger.warn('[Response files] Could not save recovered file metadata:', error);
    }
  }
  return recovered;
};

/** FormFile metadata (original name, size, type) keyed by storage key, looked up in chunks. */
const loadFileRecords = async (formId: string, keys: string[]) => {
  const unique = [...new Set(keys)];
  const recordByKey = new Map<string, FileRecord>();
  for (let i = 0; i < unique.length; i += KEY_LOOKUP_CHUNK) {
    const records = await formFileRepository.findMany({
      where: { formId, key: { in: unique.slice(i, i + KEY_LOOKUP_CHUNK) } },
      select: { key: true, originalName: true, size: true, mimeType: true },
    });
    for (const { key, ...record } of records) recordByKey.set(key, record);
  }

  const unknownKeys = unique.filter((key) => !recordByKey.has(key));
  for (const [key, record] of await backfillFileRecords(formId, unknownKeys)) recordByKey.set(key, record);
  return recordByKey;
};

/** Ids of the form's file-upload questions, including ones since removed from the form. */
export const getFileUploadFieldIds = async (formId: string): Promise<string[]> =>
  listFileUploadFields(await loadFormSchema(formId)).map((field) => field.id);

export const collectResponseFiles = async (
  formId: string,
  query: ResponseFileQuery = {}
): Promise<{ fields: FileUploadFieldInfo[]; files: ResponseFileEntry[] }> => {
  const fields = listFileUploadFields(await loadFormSchema(formId));
  if (fields.length === 0) return { fields, files: [] };

  const selectedKeys = query.fileKeys ? new Set(query.fileKeys) : null;
  const files: Omit<ResponseFileEntry, 'originalName' | 'size' | 'mimeType'>[] = [];
  for await (const batch of iterateResponses(formId, query)) {
    for (const response of batch) {
      const data = (response.data ?? {}) as Record<string, unknown>;
      for (const field of fields) {
        const value = data[field.id];
        const keys = Array.isArray(value) ? value : [value];
        for (const key of keys) {
          if (!isResponseFileKeyForForm(key, formId) || (selectedKeys && !selectedKeys.has(key))) continue;
          files.push({
            key,
            responseId: response.id,
            submittedAt: new Date(response.submittedAt),
            respondentEmail: response.respondentEmail ?? null,
            fieldId: field.id,
            fieldLabel: field.label,
            fieldOrder: field.order,
          });
        }
      }
    }
  }

  const recordByKey = await loadFileRecords(formId, files.map((file) => file.key));

  return {
    fields,
    files: files.map((file) => {
      const record = recordByKey.get(file.key);
      return {
        ...file,
        originalName: record?.originalName || fileNameFromKey(file.key),
        size: record?.size ?? null,
        mimeType: record?.mimeType ?? null,
      };
    }),
  };
};
