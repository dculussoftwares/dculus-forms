import ExcelJS from 'exceljs';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { z } from 'zod';
import { FormResponse, FormSchema, FieldType, QuestionGradeResult } from '@dculus/types';
import {
  getPluginTypesWithData,
  getPluginExport,
  pluginTypeFromMetadataKey,
} from '../plugins/core/exportRegistry.js';

// TODO(#289): remove once Story 14 (#303, plugin deprecation) lands. Native
// quiz columns are now built directly below from ResponseGrade / legacy
// metadata, and the quiz-grading key is explicitly excluded from the generic
// plugin-column loop (see LEGACY_QUIZ_METADATA_KEY) — this import no longer
// contributes any export columns. It stays only so other code that still
// expects the quiz plugin type to be registered keeps working until #303
// removes it at the source.
import '../plugins/quiz/index.js';
import { logger } from '../lib/logger.js';

export type ExportFormat = 'excel' | 'csv';

/**
 * Native Quiz (epic #289, Story 12/#301): a response's persisted grade,
 * trimmed to exactly what the export needs. Build this from `ResponseGrade`
 * rows (see `services/quiz/gradingService.getGradesForForm`) keyed by
 * `responseId`.
 */
export interface QuizGradeExportRow {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  gradedAt: Date | string | null;
  detail: QuestionGradeResult[];
}

export interface UnifiedExportData {
  formTitle: string;
  responses: FormResponse[];
  formSchema: FormSchema;
  format: ExportFormat;
  /**
   * Optional map of plugin type → plugin config JSON.  When supplied, the
   * export service passes each plugin's stored config to
   * `getColumnsWithConfig()` so plugins can honour user-configured column
   * names (e.g. the quiz plugin's `columnName` setting).
   */
  pluginConfigs?: Record<string, Record<string, any>>;
  /**
   * Only forms that actually capture respondent identity (accessControl or
   * collectRespondentEmail enabled) get a "Respondent Email" column — most
   * forms are anonymous and `response.respondentEmail` is always null there.
   */
  includeRespondentEmail?: boolean;
  /**
   * Native Quiz (epic #289): whether `form.settings.quiz?.enabled` is true.
   * Native gradebook columns are emitted when this is true OR when any
   * response carries a `quizGrades` entry or legacy quiz-grading plugin
   * metadata — see `buildQuizExportPlan`. Absent/false with no quiz data
   * anywhere in the responses means zero quiz columns, byte-identical to a
   * form that never had quiz mode at all.
   */
  quizEnabled?: boolean;
  /** responseId -> persisted ResponseGrade row, for quiz-enabled forms. */
  quizGrades?: Record<string, QuizGradeExportRow>;
  /** Emit one column per graded question, headed by the question label. */
  includeQuizQuestionColumns?: boolean;
}

export interface ExportResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

// Helper function to format values based on field type
const formatFieldValue = (
  value: any,
  fieldType?: FieldType,
  format: ExportFormat = 'excel'
): string => {
  if (value === null || value === undefined) return '';

  // Handle arrays (checkboxes, multi-select)
  if (Array.isArray(value)) {
    return format === 'csv' ? value.join('; ') : value.join(', ');
  }

  // Convert to string
  let stringValue = String(value);

  // Handle specific field types
  if (fieldType) {
    switch (fieldType) {
      case FieldType.DATE_FIELD: {
        const str = String(value ?? '');
        if (!str) { stringValue = ''; break; }
        // YYYY-MM-DD string — parse as local date to avoid UTC day shift
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
          const [y, m, d] = str.substring(0, 10).split('-').map(Number);
          const date = new Date(y, m - 1, d);
          stringValue = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } else {
          // Legacy: epoch-ms numeric string
          const timestamp = parseInt(str, 10);
          const date = new Date(timestamp);
          stringValue = isNaN(date.getTime()) ? str : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        break;
      }
      case FieldType.FILE_UPLOAD_FIELD: {
        // Values are arrays of R2 keys — export as comma-separated filenames
        if (Array.isArray(value)) {
          stringValue = value
            .map((key: string) => String(key).split('/').pop() || key)
            .join(format === 'csv' ? '; ' : ', ');
        }
        break;
      }
      case FieldType.PHONE_NUMBER_FIELD: {
        // Values are stored as a plain E.164 string — export in spaced
        // international format; fall back to the raw value if unparseable.
        const parsed = parsePhoneNumberFromString(stringValue);
        if (parsed) stringValue = parsed.formatInternational();
        break;
      }
      default:
        // Use the string value as is
        break;
    }
  }

  // CSV-specific escaping
  if (format === 'csv') {
    if (
      stringValue.includes('"') ||
      stringValue.includes(',') ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      stringValue = '"' + stringValue.replace(/"/g, '""') + '"';
    }
  }

  return stringValue;
};

// Helper function to escape CSV field names
const escapeCsvFieldName = (fieldName: string): string => {
  if (
    fieldName.includes('"') ||
    fieldName.includes(',') ||
    fieldName.includes('\n') ||
    fieldName.includes('\r')
  ) {
    return '"' + fieldName.replace(/"/g, '""') + '"';
  }
  return fieldName;
};

// ---------------------------------------------------------------------------
// Native Quiz gradebook columns (epic #289, Story 12/#301)
// ---------------------------------------------------------------------------

// The quiz-grading plugin stored its metadata under this bare key, or
// `${LEGACY_QUIZ_METADATA_KEY}:${pluginId}` for instance-scoped configs (see
// apps/backend/src/plugins/quiz/types.ts). Excluded from the generic
// plugin-column loop below so legacy data never produces a second set of
// quiz columns alongside the native ones.
const LEGACY_QUIZ_METADATA_KEY = 'quiz-grading';

const isLegacyQuizMetadataKey = (key: string): boolean =>
  key === LEGACY_QUIZ_METADATA_KEY || key.startsWith(`${LEGACY_QUIZ_METADATA_KEY}:`);

const hasLegacyQuizMetadata = (responses: FormResponse[]): boolean =>
  responses.some(
    (r) => r.metadata && Object.keys(r.metadata).some(isLegacyQuizMetadataKey)
  );

interface NormalizedQuizQuestion {
  fieldId: string;
  label: string;
  pointsAwarded: number;
  pointValue: number;
}

interface NormalizedQuizGrade {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  status: string;
  gradedAt: Date | string | null;
  questions: NormalizedQuizQuestion[];
}

const normalizeNativeGrade = (row: QuizGradeExportRow): NormalizedQuizGrade => ({
  score: row.score,
  maxScore: row.maxScore,
  percentage: row.percentage,
  passed: row.passed,
  status: row.status,
  gradedAt: row.gradedAt,
  questions: (row.detail ?? []).map((q) => ({
    fieldId: q.fieldId,
    label: q.fieldLabel,
    pointsAwarded: q.pointsAwarded,
    pointValue: q.pointValue,
  })),
});

// Legacy plugin metadata (QuizGradingMetadata, @dculus/types) is untrusted
// persisted JSON — validate it with Zod rather than trusting an `any` cast.
// Invalid/missing fields fall back to safe defaults instead of throwing, the
// same "drop, don't crash" posture as sanitizeFieldGrading in @dculus/types.
const legacyQuizFieldResultSchema = z.object({
  fieldId: z.string(),
  fieldLabel: z.string().optional(),
  marksAwarded: z.number().default(0),
  maxMarks: z.number().default(0),
});

const legacyQuizMetadataSchema = z.object({
  quizScore: z.number().default(0),
  totalMarks: z.number().default(0),
  percentage: z.number().default(0),
  passThreshold: z.number().default(60),
  gradedAt: z.union([z.string(), z.date()]).nullish(),
  gradedBy: z.enum(['plugin', 'manual']).optional(),
  fieldResults: z.array(legacyQuizFieldResultSchema).default([]),
});

// Legacy plugin metadata predates ResponseGrade and uses a different
// shape/status vocabulary — map it onto the same fields the native path
// produces so a single set of columns covers both. 'plugin' grading was
// always fully automatic; 'manual' meant a human had entered the score,
// closest today to REVIEWED.
const normalizeLegacyQuizMetadata = (raw: unknown): NormalizedQuizGrade => {
  const parsed = legacyQuizMetadataSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : legacyQuizMetadataSchema.parse({});
  return {
    score: data.quizScore,
    maxScore: data.totalMarks,
    percentage: data.percentage,
    passed: data.percentage >= data.passThreshold,
    status: data.gradedBy === 'manual' ? 'REVIEWED' : 'AUTO_GRADED',
    gradedAt: data.gradedAt ?? null,
    questions: data.fieldResults.map((fr) => ({
      fieldId: fr.fieldId,
      label: fr.fieldLabel || fr.fieldId,
      pointsAwarded: fr.marksAwarded,
      pointValue: fr.maxMarks,
    })),
  };
};

/**
 * Resolve the single grade a response should be exported with. A
 * ResponseGrade row always wins over legacy metadata — once a response has
 * a native grade it owns the export row, and the two are never combined.
 */
const resolveQuizGrade = (
  response: FormResponse,
  quizGrades: Record<string, QuizGradeExportRow>
): NormalizedQuizGrade | null => {
  const native = quizGrades[response.id];
  if (native) return normalizeNativeGrade(native);

  const metadata = response.metadata;
  if (!metadata) return null;
  const legacyKey = Object.keys(metadata).filter(isLegacyQuizMetadataKey).sort()[0];
  if (!legacyKey || !metadata[legacyKey]) return null;
  return normalizeLegacyQuizMetadata(metadata[legacyKey]);
};

const QUIZ_BASE_HEADERS = [
  'Score',
  'Max Score',
  'Percentage',
  'Result',
  'Grading Status',
  'Graded At',
];

const formatQuizGradedAt = (value: Date | string | null): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const quizBaseValues = (grade: NormalizedQuizGrade | null): string[] => {
  if (!grade) return QUIZ_BASE_HEADERS.map(() => '');
  return [
    `${grade.score}/${grade.maxScore}`,
    `${grade.maxScore}`,
    `${grade.percentage.toFixed(1)}%`,
    grade.passed ? 'Pass' : 'Fail',
    grade.status,
    formatQuizGradedAt(grade.gradedAt),
  ];
};

/** Disambiguates repeated question labels: first occurrence unchanged, then " (2)", " (3)", ... */
const dedupeLabel = (label: string, seen: Map<string, number>): string => {
  const count = (seen.get(label) ?? 0) + 1;
  seen.set(label, count);
  return count === 1 ? label : `${label} (${count})`;
};

/**
 * Stable per-question column order: schema field order first (so re-running
 * an export keeps columns in place as new responses arrive), then any
 * graded fieldId the schema doesn't know about (deleted fields, or legacy
 * plugin data for a field that's since been removed).
 */
const buildQuizQuestionColumns = (
  formSchema: FormSchema,
  grades: NormalizedQuizGrade[]
): Array<{ fieldId: string; header: string }> => {
  const ordered: Array<{ fieldId: string; label: string }> = [];
  const seenIds = new Set<string>();

  formSchema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      const grading = (field as any).grading;
      if (grading && field.id && 'label' in field && (field as any).label) {
        ordered.push({ fieldId: field.id, label: (field as any).label });
        seenIds.add(field.id);
      }
    });
  });

  // Fields the schema doesn't know about (deleted fields, or legacy data for
  // a field that's since been removed) — sorted by fieldId so their column
  // order is deterministic regardless of response/grade iteration order,
  // which changes between a full export and a filtered/selected one.
  const unknown: Array<{ fieldId: string; label: string }> = [];
  grades.forEach((grade) => {
    grade.questions.forEach((q) => {
      if (!seenIds.has(q.fieldId)) {
        unknown.push({ fieldId: q.fieldId, label: q.label });
        seenIds.add(q.fieldId);
      }
    });
  });
  unknown.sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  ordered.push(...unknown);

  const seenLabels = new Map<string, number>();
  return ordered.map(({ fieldId, label }) => ({
    fieldId,
    header: dedupeLabel(label, seenLabels),
  }));
};

const quizQuestionValues = (
  grade: NormalizedQuizGrade | null,
  columns: Array<{ fieldId: string }>
): string[] => {
  if (!grade) return columns.map(() => '');
  // Indexed once per response rather than re-scanning `questions` for every
  // column — matters once a quiz has many graded questions and exports can
  // run to tens of thousands of responses.
  const byFieldId = new Map(grade.questions.map((q) => [q.fieldId, q]));
  return columns.map(({ fieldId }) => {
    const q = byFieldId.get(fieldId);
    return q ? `${q.pointsAwarded}/${q.pointValue}` : '';
  });
};

interface QuizExportPlan {
  emit: boolean;
  headers: string[];
  questionColumns: Array<{ fieldId: string; header: string }>;
  gradesByResponseId: Map<string, NormalizedQuizGrade | null>;
}

/**
 * Decides whether this export gets native quiz columns at all, and if so
 * builds the header list and a per-response lookup of the normalized grade
 * to render. Emission is gated on `quizEnabled` OR the presence of actual
 * quiz data (native or legacy) in the given responses, so a plugin-graded
 * form keeps exporting its (now-native-shaped) columns even if
 * `form.settings.quiz` was never turned on.
 */
const buildQuizExportPlan = (
  formSchema: FormSchema,
  responses: FormResponse[],
  data: Pick<UnifiedExportData, 'quizEnabled' | 'quizGrades' | 'includeQuizQuestionColumns'>
): QuizExportPlan => {
  const quizGrades = data.quizGrades ?? {};
  const emit =
    !!data.quizEnabled || Object.keys(quizGrades).length > 0 || hasLegacyQuizMetadata(responses);

  if (!emit) {
    return { emit: false, headers: [], questionColumns: [], gradesByResponseId: new Map() };
  }

  const gradesByResponseId = new Map<string, NormalizedQuizGrade | null>();
  responses.forEach((r) => gradesByResponseId.set(r.id, resolveQuizGrade(r, quizGrades)));

  const questionColumns = data.includeQuizQuestionColumns
    ? buildQuizQuestionColumns(
        formSchema,
        Array.from(gradesByResponseId.values()).filter(
          (g): g is NormalizedQuizGrade => !!g
        )
      )
    : [];

  return {
    emit: true,
    headers: [...QUIZ_BASE_HEADERS, ...questionColumns.map((c) => c.header)],
    questionColumns,
    gradesByResponseId,
  };
};

const quizRowValues = (plan: QuizExportPlan, responseId: string): string[] => {
  const grade = plan.gradesByResponseId.get(responseId) ?? null;
  return [...quizBaseValues(grade), ...quizQuestionValues(grade, plan.questionColumns)];
};

// Extract field information from responses or schema
const extractFieldInfo = (
  formSchema: FormSchema,
  responses: FormResponse[]
): { fieldInfo: Record<string, string>; orderedFieldIds: string[] } => {
  const fieldInfo: Record<string, string> = {};
  let orderedFieldIds: string[] = [];

  if (formSchema.pages.length === 0 && responses.length > 0) {
    logger.info(
      'Unified Export - Form schema is empty, extracting field info from response data...'
    );

    // Get all unique field IDs from all responses
    const allFieldIds = new Set<string>();
    responses.forEach((response) => {
      Object.keys(response.data).forEach((fieldId) => {
        allFieldIds.add(fieldId);
      });
    });

    // Convert to array and sort for consistent column order
    orderedFieldIds = Array.from(allFieldIds).sort();

    // Create a mapping of field ID to a human-readable label
    orderedFieldIds.forEach((fieldId) => {
      let label = fieldId;
      if (fieldId.includes('field-')) {
        const parts = fieldId.split('-');
        if (parts.length > 2) {
          label = `Field ${parts[2]}`;
        } else {
          label = `Field ${fieldId.slice(0, 8)}`;
        }
      } else if (fieldId.length > 20) {
        label = `Field ${fieldId.slice(0, 8)}`;
      }
      fieldInfo[fieldId] = label;
    });

    logger.info(
      'Unified Export - Extracted field info:',
      Object.keys(fieldInfo).length,
      'fields'
    );
  } else {
    // Active and soft-deleted fields from schema
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (field.type && field.id && 'label' in field && (field as any).label) {
          const label = (field as any).label;
          fieldInfo[field.id] = field.deleted
            ? `${label} (deleted)`
            : label;
          orderedFieldIds.push(field.id);
        }
      });
    });

    // Orphan field IDs: in response data but not in schema at all
    const knownIds = new Set(orderedFieldIds);
    const orphanIds = new Set<string>();
    responses.forEach((response) => {
      Object.keys(response.data).forEach((id) => {
        if (!knownIds.has(id)) orphanIds.add(id);
      });
    });
    orphanIds.forEach((id) => {
      fieldInfo[id] = 'Unknown field (deleted)';
      orderedFieldIds.push(id);
    });
  }

  return { fieldInfo, orderedFieldIds };
};

// Generate CSV content
const generateCsvContent = (data: UnifiedExportData): string => {
  const { responses, formSchema, pluginConfigs = {}, includeRespondentEmail } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(
    formSchema,
    responses
  );

  const quizPlan = buildQuizExportPlan(formSchema, responses, data);

  // Get plugin types that have data in any response — quiz-grading is
  // handled natively above (quizPlan) and excluded here so it never
  // produces a second set of quiz columns.
  const activePluginTypes = getPluginTypesWithData(responses).filter(
    (key) => pluginTypeFromMetadataKey(key) !== LEGACY_QUIZ_METADATA_KEY
  );

  // Build CSV header
  const headers = ['Response ID', 'Submitted At', 'Tags'];
  if (includeRespondentEmail) headers.push('Respondent Email');
  quizPlan.headers.forEach((h) => headers.push(escapeCsvFieldName(h)));

  // Add plugin columns — use getColumnsWithConfig when available and config is present
  // activePluginTypes is now a list of metadata keys (e.g. 'quiz-grading:pluginId')
  activePluginTypes.forEach((metadataKey) => {
    const pluginType = pluginTypeFromMetadataKey(metadataKey);
    const pluginExport = getPluginExport(pluginType);
    if (pluginExport) {
      const config = pluginConfigs[metadataKey];
      const pluginColumns =
        config && pluginExport.getColumnsWithConfig
          ? pluginExport.getColumnsWithConfig(config)
          : pluginExport.getColumns();
      pluginColumns.forEach((col) => headers.push(escapeCsvFieldName(col)));
    }
  });

  // Add form field columns
  orderedFieldIds.forEach((fieldId) => {
    headers.push(escapeCsvFieldName(fieldInfo[fieldId]));
  });

  // P1-11: Accumulate rows in an array and join once at the end.
  // The previous pattern used string concatenation inside a loop which
  // caused O(n²) memory allocation behaviour at large response counts
  // because every `csvContent += ...` copies the entire accumulated string.
  const rows: string[] = [headers.join(',')];

  // Add data rows
  responses.forEach((response) => {
    const row: string[] = [];

    // Add basic fields
    row.push(escapeCsvFieldName(response.id));
    row.push(
      escapeCsvFieldName(
        new Date(
          typeof response.submittedAt === 'string'
            ? parseInt(response.submittedAt, 10)
            : response.submittedAt
        ).toLocaleString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      )
    );
    row.push(escapeCsvFieldName((response.tags ?? []).map((t) => t.name).join(', ')));
    if (includeRespondentEmail) row.push(escapeCsvFieldName(response.respondentEmail || ''));

    if (quizPlan.emit) {
      quizRowValues(quizPlan, response.id).forEach((value) => {
        row.push(escapeCsvFieldName(value));
      });
    }

    // Add plugin data
    activePluginTypes.forEach((metadataKey) => {
      const pluginType = pluginTypeFromMetadataKey(metadataKey);
      const pluginExport = getPluginExport(pluginType);
      if (pluginExport) {
        const pluginMetadata = response.metadata?.[metadataKey];
        const values = pluginExport.getValues(pluginMetadata);
        values.forEach((value) => {
          row.push(
            escapeCsvFieldName(
              value !== null && value !== undefined ? String(value) : ''
            )
          );
        });
      }
    });

    // Add form field data in consistent order
    orderedFieldIds.forEach((fieldId) => {
      const value = response.data[fieldId];

      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find((f) => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }

      row.push(formatFieldValue(value, fieldType, 'csv'));
    });

    rows.push(row.join(','));
  });

  // Calculate plugin column count for logging
  const pluginColumnCount = activePluginTypes.reduce((count, metadataKey) => {
    const pluginExport = getPluginExport(pluginTypeFromMetadataKey(metadataKey));
    if (!pluginExport) return count;
    const config = pluginConfigs[metadataKey];
    const cols =
      config && pluginExport.getColumnsWithConfig
        ? pluginExport.getColumnsWithConfig(config)
        : pluginExport.getColumns();
    return count + cols.length;
  }, 0);

  logger.info(
    `Unified Export - Generated CSV with ${responses.length} rows and ${headers.length} columns (${pluginColumnCount} plugin columns, ${quizPlan.headers.length} quiz columns)`
  );
  return rows.join('\n');
};

// Generate Excel content using exceljs
const generateExcelContent = async (
  data: UnifiedExportData
): Promise<Buffer> => {
  const { responses, formSchema, pluginConfigs = {}, includeRespondentEmail } = data;
  const { fieldInfo, orderedFieldIds } = extractFieldInfo(
    formSchema,
    responses
  );

  const quizPlan = buildQuizExportPlan(formSchema, responses, data);

  // Get plugin types that have data in any response — quiz-grading is
  // handled natively above (quizPlan) and excluded here so it never
  // produces a second set of quiz columns.
  const activePluginTypes = getPluginTypesWithData(responses).filter(
    (key) => pluginTypeFromMetadataKey(key) !== LEGACY_QUIZ_METADATA_KEY
  );

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Responses');

  // Build headers
  const headers = ['Response ID', 'Submitted At', 'Tags'];
  if (includeRespondentEmail) headers.push('Respondent Email');
  headers.push(...quizPlan.headers);

  // Add plugin columns to headers — use getColumnsWithConfig when available and config is present
  activePluginTypes.forEach((metadataKey) => {
    const pluginType = pluginTypeFromMetadataKey(metadataKey);
    const pluginExport = getPluginExport(pluginType);
    if (pluginExport) {
      const config = pluginConfigs[metadataKey];
      const cols =
        config && pluginExport.getColumnsWithConfig
          ? pluginExport.getColumnsWithConfig(config)
          : pluginExport.getColumns();
      headers.push(...cols);
    }
  });

  // Add form field columns
  orderedFieldIds.forEach((fieldId) => {
    headers.push(fieldInfo[fieldId]);
  });

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  });

  // Add data rows
  responses.forEach((response: FormResponse) => {
    const rowData: any[] = [];

    // Add basic fields
    rowData.push(response.id);
    rowData.push(
      new Date(
        typeof response.submittedAt === 'string'
          ? parseInt(response.submittedAt, 10)
          : response.submittedAt
      ).toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    );
    rowData.push((response.tags ?? []).map((t) => t.name).join(', '));
    if (includeRespondentEmail) rowData.push(response.respondentEmail || '');

    if (quizPlan.emit) {
      rowData.push(...quizRowValues(quizPlan, response.id));
    }

    // Add plugin data
    activePluginTypes.forEach((metadataKey) => {
      const pluginType = pluginTypeFromMetadataKey(metadataKey);
      const pluginExport = getPluginExport(pluginType);
      if (pluginExport) {
        const pluginMetadata = response.metadata?.[metadataKey];
        const values = pluginExport.getValues(pluginMetadata);
        values.forEach((value) => {
          rowData.push(
            value !== null && value !== undefined ? String(value) : ''
          );
        });
      }
    });

    // Add form field data in consistent order
    orderedFieldIds.forEach((fieldId) => {
      const value = response.data[fieldId];

      // Find field type if available from schema
      let fieldType: FieldType | undefined;
      if (formSchema.pages.length > 0) {
        for (const page of formSchema.pages) {
          const field = page.fields.find((f) => f.id === fieldId);
          if (field) {
            fieldType = field.type;
            break;
          }
        }
      }

      rowData.push(formatFieldValue(value, fieldType, 'excel') || '');
    });

    worksheet.addRow(rowData);
  });

  // Auto-size columns based on content
  worksheet.columns.forEach((column, _index) => {
    let maxWidth = 10; // minimum width
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value?.toString() || '';
      maxWidth = Math.max(maxWidth, Math.min(cellValue.length + 2, 50)); // max width 50
    });
    column.width = maxWidth;
  });

  // Calculate total columns (basic + plugin + form fields)
  const pluginColumnCount = activePluginTypes.reduce((count, metadataKey) => {
    const pluginExport = getPluginExport(pluginTypeFromMetadataKey(metadataKey));
    if (!pluginExport) return count;
    const config = pluginConfigs[metadataKey];
    const cols =
      config && pluginExport.getColumnsWithConfig
        ? pluginExport.getColumnsWithConfig(config)
        : pluginExport.getColumns();
    return count + cols.length;
  }, 0);
  logger.info(
    `Unified Export - Generated Excel with ${responses.length} rows and ${headers.length} columns (${pluginColumnCount} plugin columns, ${quizPlan.headers.length} quiz columns)`
  );

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * Generate export file (Excel or CSV) from form responses
 */
export async function generateExportFile(
  data: UnifiedExportData
): Promise<ExportResult> {
  const { formTitle, format } = data;

  logger.info(
    `Unified Export - Generating ${format.toUpperCase()} export for form: ${formTitle}`
  );
  logger.info(
    `Unified Export - Form schema pages: ${data.formSchema.pages.length}`
  );
  logger.info(`Unified Export - Total responses: ${data.responses.length}`);

  let buffer: Buffer;
  let filename: string;
  let contentType: string;

  if (format === 'excel') {
    buffer = await generateExcelContent(data);
    filename = generateExcelFilename(formTitle);
    contentType =
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else {
    const csvContent = generateCsvContent(data);
    buffer = Buffer.from(csvContent, 'utf-8');
    filename = generateCsvFilename(formTitle);
    contentType = 'text/csv';
  }

  logger.info(
    `Unified Export - Generated ${format.toUpperCase()} file, size: ${buffer.length} bytes`
  );

  return {
    buffer,
    filename,
    contentType,
  };
}

/**
 * Generate filename for Excel export
 */
export function generateExcelFilename(formTitle: string): string {
  const sanitizedTitle = formTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${sanitizedTitle}_responses_${timestamp}.xlsx`;
}

/**
 * Generate filename for CSV export
 */
export function generateCsvFilename(formTitle: string): string {
  const sanitizedTitle = formTitle.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  return `${sanitizedTitle}_responses_${timestamp}.csv`;
}
