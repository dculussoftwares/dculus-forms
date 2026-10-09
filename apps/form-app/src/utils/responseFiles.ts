/**
 * Helpers shared by every place that shows or downloads respondent files.
 */

export type FileKind = 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'audio' | 'video' | 'text' | 'other';

// Mirrors PREVIEWABLE_MIME_TYPES in the backend's responseFileDownloadService.ts:
// only these open inline; everything else (HTML, SVG, …) always downloads.
const PREVIEWABLE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']);

const EXTENSION_KINDS: Record<string, FileKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', heic: 'image', svg: 'image',
  pdf: 'pdf',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document', pages: 'document',
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet', csv: 'spreadsheet', numbers: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation', key: 'presentation',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
  mp3: 'audio', wav: 'audio', m4a: 'audio', ogg: 'audio',
  mp4: 'video', mov: 'video', webm: 'video', avi: 'video',
  txt: 'text', md: 'text', json: 'text',
};

export const fileKind = (name: string, mimeType?: string | null): FileKind => {
  if (mimeType?.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (mimeType?.startsWith('video/')) return 'video';
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_KINDS[extension] ?? 'other';
};

export const isPreviewable = (mimeType?: string | null): boolean =>
  !!mimeType && PREVIEWABLE_MIME_TYPES.has(mimeType);

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export const formatBytes = (bytes: number | null | undefined, locale?: string): string => {
  if (bytes === null || bytes === undefined || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 || value >= 10 ? 0 : 1 }).format(value);
  return `${formatted} ${BYTE_UNITS[unit]}`;
};

/**
 * Display name recovered from a storage key, for places that only have the key:
 * `files/form-response/{formId}/{timestamp}-{uuid}-{name}{ext}` → `{name}{ext}`.
 */
export const fileNameFromKey = (key: string): string => {
  const segment = key.split('/').pop() || key;
  return segment.replace(/^\d{13}-[0-9a-f-]{36}-/, '') || segment;
};

/** Short response label, matching ZIP folder names and the table's short response ID. */
export const responseLabel = (responseId: string, submittedAt: string): string =>
  `${submittedAt.slice(0, 10)} ${responseId.slice(-6)}`;

/** Start a browser download for a (pre-signed) URL without leaving the page. */
export const triggerDownload = (url: string, filename?: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

export interface ResponseFileFolder<T> {
  id: string;
  label: string;
  /** Secondary line, e.g. the respondent's email. */
  detail?: string | null;
  files: T[];
}

interface FolderableFile {
  responseId: string;
  submittedAt: string;
  respondentEmail: string | null;
  fieldId: string;
}

/**
 * Folders for the Files view, mirroring the ZIP layout: one per question in
 * form order (empty ones included, so owners see every upload question), or
 * one per response, newest first.
 */
export const buildFileFolders = <T extends FolderableFile>(
  files: T[],
  questions: { fieldId: string; label: string }[],
  grouping: 'QUESTION' | 'RESPONSE'
): ResponseFileFolder<T>[] => {
  if (grouping === 'QUESTION') {
    return questions.map((question, index) => ({
      id: question.fieldId,
      label: `${String(index + 1).padStart(2, '0')} ${question.label}`,
      files: files.filter((file) => file.fieldId === question.fieldId),
    }));
  }

  const byResponse = new Map<string, ResponseFileFolder<T>>();
  for (const file of files) {
    const folder = byResponse.get(file.responseId) ?? {
      id: file.responseId,
      label: responseLabel(file.responseId, file.submittedAt),
      detail: file.respondentEmail,
      files: [],
    };
    folder.files.push(file);
    byResponse.set(file.responseId, folder);
  }
  return [...byResponse.values()].sort((a, b) => b.files[0].submittedAt.localeCompare(a.files[0].submittedAt));
};
