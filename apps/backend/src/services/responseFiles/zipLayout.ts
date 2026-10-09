import path from 'path';
import type { ResponseFileEntry } from './responseFileCatalog.js';

/**
 * Pure helpers that turn a catalog of respondent files into safe, human-readable
 * ZIP entry paths plus a manifest. Nothing here touches storage, so every rule
 * (sanitisation, zip-slip, de-duplication) is unit-testable in isolation.
 */

export type ResponseFileGrouping = 'question' | 'response';

export interface ZipEntryPlan {
  /** Full entry path inside the archive, always relative and `/`-separated. */
  path: string;
  file: ResponseFileEntry;
}

const MAX_SEGMENT_LENGTH = 120;
const MAX_EXTENSION_LENGTH = 16;
// Windows refuses these as file or folder names, with or without an extension.
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
// Cells starting with these are evaluated as formulas by Excel/Sheets.
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

const truncateCodePoints = (value: string, max: number): string =>
  Array.from(value).slice(0, Math.max(0, max)).join('');

/**
 * Make one path segment (folder or file name) safe on every OS: no separators,
 * no traversal (`..`), no control characters, no leading dots, no Windows
 * reserved names, bounded length with the extension preserved.
 */
export const sanitizePathSegment = (raw: string, fallback = 'file'): string => {
  let segment = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    // Windows silently drops trailing dots and spaces.
    .replace(/[. ]+$/, '');

  if (!segment) segment = fallback;
  if (WINDOWS_RESERVED_NAME.test(segment)) segment = `_${segment}`;

  if (Array.from(segment).length > MAX_SEGMENT_LENGTH) {
    const extension = path.extname(segment);
    const keepExtension = extension.length > 1 && extension.length <= MAX_EXTENSION_LENGTH;
    const base = keepExtension ? segment.slice(0, -extension.length) : segment;
    const suffix = keepExtension ? extension : '';
    segment = `${truncateCodePoints(base, MAX_SEGMENT_LENGTH - suffix.length).trimEnd()}${suffix}`;
  }

  return segment;
};

/** `name.ext` → `name (2).ext`, case-insensitively unique within one folder. */
const claimUniqueName = (name: string, taken: Set<string>): string => {
  const extension = path.extname(name);
  const base = extension ? name.slice(0, -extension.length) : name;
  let candidate = name;
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
    candidate = `${base} (${n})${extension}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Short, stable label for a response, e.g. `2026-10-08 k2p9qa`. The ID suffix
 * matches the short response ID shown in the responses table.
 */
export const responseLabel = (responseId: string, submittedAt: Date): string =>
  `${formatDate(submittedAt)} ${responseId.slice(-6)}`;

const questionFolder = (file: ResponseFileEntry): string => {
  const order = String(file.fieldOrder + 1).padStart(2, '0');
  return sanitizePathSegment(`${order} ${file.fieldLabel}`, `${order} Question`);
};

export const archiveRootName = (formTitle: string, now = new Date()): string =>
  sanitizePathSegment(`${formTitle} files ${formatDate(now)}`, `form files ${formatDate(now)}`);

/**
 * Lay files out as `root/<question>/<response> - <name>` (grouping by question,
 * like Google and Microsoft Forms) or `root/<response>/<question> - <name>`
 * (grouping by response, like Jotform). Every segment goes through
 * {@link sanitizePathSegment}, so no entry can escape the root folder.
 */
export const planZipEntries = (
  files: ResponseFileEntry[],
  grouping: ResponseFileGrouping,
  root: string
): ZipEntryPlan[] => {
  const takenByFolder = new Map<string, Set<string>>();

  return files.map((file) => {
    const response = responseLabel(file.responseId, file.submittedAt);
    const [folder, prefix] =
      grouping === 'question'
        ? [questionFolder(file), response]
        : [sanitizePathSegment(response), file.fieldLabel];

    const taken = takenByFolder.get(folder) ?? new Set<string>();
    takenByFolder.set(folder, taken);

    const name = claimUniqueName(sanitizePathSegment(`${prefix} - ${file.originalName}`), taken);
    return { path: `${root}/${folder}/${name}`, file };
  });
};

const csvCell = (value: string | number | null | undefined): string => {
  let text = value === null || value === undefined ? '' : String(value);
  if (CSV_FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * `manifest.csv` mapping every archived path back to its response, so files
 * stay traceable after the ZIP is extracted. `status` is `missing` for files
 * that could not be read from storage. Guards against CSV formula injection
 * since names and labels are respondent/owner controlled.
 */
export const buildManifestCsv = (
  entries: ZipEntryPlan[],
  root: string,
  missing: ReadonlySet<ResponseFileEntry> = new Set()
): string => {
  const header = ['path', 'status', 'response_id', 'submitted_at', 'respondent_email', 'question', 'original_name', 'size_bytes', 'content_type'];
  const rows = entries.map(({ path: entryPath, file }) => [
    entryPath.slice(root.length + 1),
    missing.has(file) ? 'missing' : 'included',
    file.responseId,
    file.submittedAt.toISOString(),
    file.respondentEmail,
    file.fieldLabel,
    file.originalName,
    file.size,
    file.mimeType,
  ]);
  // BOM so Excel opens UTF-8 (Tamil labels, accented names) correctly.
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
};
