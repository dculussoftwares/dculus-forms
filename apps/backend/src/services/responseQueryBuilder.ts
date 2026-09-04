/**
 * Response Query Builder Service - PostgreSQL Version
 * 
 * Builds dynamic PostgreSQL queries for filtering form responses at the database level.
 * Leverages PostgreSQL's JSONB operators and raw SQL for efficient JSON field querying.
 * 
 * Strategy:
 * - Use raw SQL with Prisma's $queryRaw for JSONB filtering
 * - All filtering is done at database level (no memory filtering)
 * - Supports case-insensitive text, numeric comparisons, date ranges, arrays
 * 
 * PostgreSQL JSONB Advantages:
 * - Native JSONB type with specialized operators (@>, ->, ->>, etc.)
 * - LOWER(), CAST(), ILIKE for case-insensitive and type-aware operations
 * - GIN indexes on JSONB columns for fast querying
 * - Full-text search capabilities
 */

import { ResponseFilter } from './responseFilterService.js';

const SAFE_FIELD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const ensureSafeFieldId = (fieldId: string): string => {
  if (!SAFE_FIELD_ID_PATTERN.test(fieldId)) {
    throw new Error(`Invalid fieldId "${fieldId}"`);
  }
  return fieldId;
};

// For PostgreSQL, we return SQL conditions and parameters
export interface RawSQLFilter {
  conditions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any[];
}

/**
 * Native Quiz (epic #289, Story 11): special fieldIds for filtering on a
 * response's ResponseGrade row, mirroring the existing __submittedAt/__tags
 * convention for non-form-field filters. Handled with a LEFT JOIN against
 * "response_grade" (aliased `rg`) rather than the JSONB `data` column, since
 * grade fields are real indexed columns, not respondent-submitted JSON.
 */
export const GRADE_FIELD_IDS = new Set([
  '__gradePercentage',
  '__gradePassed',
  '__gradeStatus',
  '__gradeAttempt',
]);

/**
 * Raw SQL join fragment shared by every grade-aware query. `"response".id` is
 * used (rather than a bare `id`) so it stays unambiguous once the join brings
 * response_grade's own `id`/`formId` columns into scope — valid even when no
 * join is present, since Postgres accepts a table's own name as its implicit
 * range variable.
 */
export const RESPONSE_GRADE_JOIN = 'LEFT JOIN "response_grade" rg ON rg."responseId" = "response".id';

/** Whether any filter in the list targets a grade field (Story 11) — used to decide whether to add RESPONSE_GRADE_JOIN. */
export function filtersNeedGradeJoin(filters?: ResponseFilter[]): boolean {
  return !!filters?.some((f) => GRADE_FIELD_IDS.has(f.fieldId));
}

/**
 * Response meta-filters (beyond quiz grading) — special fieldIds mirroring the
 * __submittedAt/__tags/__grade* convention above. Each group is backed by its own
 * LEFT JOIN, added only when a filter actually references one of its fieldIds so a
 * form that never uses them sees no SQL change at all (same "additive, zero cost
 * when unused" guarantee as RESPONSE_GRADE_JOIN).
 */
export const SUBMISSION_ANALYTICS_FIELD_IDS = new Set([
  '__completionTimeSeconds',
  '__browser',
  '__operatingSystem',
  '__country',
]);

export const LAST_EDIT_FIELD_IDS = new Set(['__lastEditedAt', '__lastEditedByEmail']);

export const PDF_GENERATED_FIELD_PREFIX = '__pdfGenerated_';

/** LEFT JOIN against the response's 1:1 submission-analytics row (device/geo/completion time). */
export const RESPONSE_SUBMISSION_ANALYTICS_JOIN =
  'LEFT JOIN "form_submission_analytics" fsa ON fsa."responseId" = "response".id';

/**
 * LEFT JOIN LATERAL pulling just the most recent edit-history row per response (and its
 * editor's email) — a LATERAL rather than a plain join because "most recent" needs an
 * ORDER BY + LIMIT 1 per response, which a plain JOIN can't express.
 */
export const RESPONSE_LAST_EDIT_JOIN =
  'LEFT JOIN LATERAL (' +
  'SELECT reh."editedAt" AS "editedAt", u.email AS "editedByEmail" ' +
  'FROM "response_edit_history" reh ' +
  'LEFT JOIN "user" u ON u.id = reh."editedById" ' +
  'WHERE reh."responseId" = "response".id ' +
  'ORDER BY reh."editedAt" DESC LIMIT 1' +
  ') leh ON true';

/** LEFT JOIN against the form's cached field count, used to compute __completenessPercent. */
export const RESPONSE_FORM_METADATA_JOIN =
  'LEFT JOIN "form_metadata" fm ON fm."formId" = "response"."formId"';

/** SQL expression for __completenessPercent: non-empty top-level keys in `data`, as a % of the form's cached field count. */
const COMPLETENESS_PERCENT_EXPR =
  '((SELECT COUNT(*) FROM jsonb_each("response".data) e ' +
  "WHERE e.value IS NOT NULL AND e.value <> 'null'::jsonb AND e.value <> '\"\"'::jsonb" +
  ')::numeric / NULLIF(fm."fieldCount", 0) * 100)';

export function filtersNeedSubmissionAnalyticsJoin(filters?: ResponseFilter[]): boolean {
  return !!filters?.some((f) => SUBMISSION_ANALYTICS_FIELD_IDS.has(f.fieldId));
}

export function filtersNeedLastEditJoin(filters?: ResponseFilter[]): boolean {
  return !!filters?.some((f) => LAST_EDIT_FIELD_IDS.has(f.fieldId));
}

export function filtersNeedFormMetadataJoin(filters?: ResponseFilter[]): boolean {
  return !!filters?.some((f) => f.fieldId === '__completenessPercent');
}

/**
 * Composes every LEFT JOIN a filter/sort set actually needs into one clause. Replaces the
 * single-purpose "gradeJoinNeeded ? RESPONSE_GRADE_JOIN : ''" check that predates the meta
 * filters above — a form that filters on none of them gets the exact same SQL as before.
 */
export function buildJoinClause(filters?: ResponseFilter[], needsGradeJoin = false): string {
  const joins: string[] = [];
  if (filtersNeedGradeJoin(filters) || needsGradeJoin) joins.push(RESPONSE_GRADE_JOIN);
  if (filtersNeedSubmissionAnalyticsJoin(filters)) joins.push(RESPONSE_SUBMISSION_ANALYTICS_JOIN);
  if (filtersNeedLastEditJoin(filters)) joins.push(RESPONSE_LAST_EDIT_JOIN);
  if (filtersNeedFormMetadataJoin(filters)) joins.push(RESPONSE_FORM_METADATA_JOIN);
  return joins.join(' ');
}

/** The non-dynamic (static-id) response/respondent fieldIds — __duplicateEmail,
 * __respondentType, __respondentEmail need no join, so they aren't in any of the
 * Set-based join checks above, but still need to be recognized as meta (not form-data)
 * fieldIds by the in-memory context-attachment path. __pdfGenerated_* is dynamic and
 * checked separately via its prefix. */
export const RESPONDENT_META_FIELD_IDS = new Set([
  '__respondentType',
  '__respondentEmail',
  '__duplicateEmail',
]);

export const COMPLETENESS_FIELD_ID = '__completenessPercent';

export function isPdfGeneratedFieldId(fieldId: string): boolean {
  return fieldId.startsWith(PDF_GENERATED_FIELD_PREFIX);
}

export function pdfGeneratorIdFromFieldId(fieldId: string): string {
  return fieldId.slice(PDF_GENERATED_FIELD_PREFIX.length);
}

/** Every special (non-form-field) fieldId this module understands, used by the in-memory
 * context-attachment path to know when a response needs enrichment before filtering. */
export function isMetaFilterFieldId(fieldId: string): boolean {
  return (
    fieldId === '__submittedAt' ||
    fieldId === '__tags' ||
    GRADE_FIELD_IDS.has(fieldId) ||
    SUBMISSION_ANALYTICS_FIELD_IDS.has(fieldId) ||
    LAST_EDIT_FIELD_IDS.has(fieldId) ||
    RESPONDENT_META_FIELD_IDS.has(fieldId) ||
    fieldId === COMPLETENESS_FIELD_ID ||
    isPdfGeneratedFieldId(fieldId)
  );
}

/**
 * Determines if filters can be fully executed at database level
 * With raw PostgreSQL queries, ALL filters can be executed at database level
 */
export function canFilterAtDatabase(_filters?: ResponseFilter[]): boolean {
  // All filters can be executed at database level using raw SQL
  return true;
}

/**
 * Builds raw SQL WHERE conditions for response filtering
 * Returns SQL conditions array and parameter values
 * @param filterLogic - 'AND' or 'OR' to combine multiple filter conditions (currently only used in service layer)
 */
export function buildPostgreSQLFilter(
  formId: string,
  filters?: ResponseFilter[],
  _filterLogic: 'AND' | 'OR' = 'AND'
): RawSQLFilter {
  const sqlConditions: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any[] = [formId]; // Start with formId as first parameter
  let paramIndex = 2; // PostgreSQL uses $1, $2, etc. ($1 is formId)

  if (!filters || filters.length === 0) {
    return { conditions: [], params: [formId] };
  }

  for (const filter of filters) {
    const { sql, values } = buildRawSQLCondition(filter, paramIndex);
    if (sql) {
      sqlConditions.push(sql);
      params.push(...values);
      paramIndex += values.length;
    }
  }

  return {
    conditions: sqlConditions,
    params,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSubmittedAtCondition(filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  const col = '"submittedAt"';
  switch (filter.operator) {
    case 'DATE_EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `DATE(${col}) = DATE($${startIndex}::timestamptz)`, values: [filter.value] };
    case 'DATE_BEFORE':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} < $${startIndex}::timestamptz`, values: [filter.value] };
    case 'DATE_AFTER':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} > $${startIndex}::timestamptz`, values: [filter.value] };
    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return { sql: '', values: [] };
      const parts: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vals: any[] = [];
      let idx = startIndex;
      if (filter.dateRange.from) { parts.push(`${col} >= $${idx}::timestamptz`); vals.push(filter.dateRange.from); idx++; }
      if (filter.dateRange.to)   { parts.push(`${col} <= $${idx}::timestamptz`); vals.push(filter.dateRange.to); }
      return parts.length ? { sql: `(${parts.join(' AND ')})`, values: vals } : { sql: '', values: [] };
    }
    case 'DATE_TODAY':
      return { sql: `DATE(${col}) = CURRENT_DATE`, values: [] };
    case 'DATE_LAST_N_DAYS': {
      const n = Math.max(1, parseInt(filter.value || '7', 10) || 7);
      return { sql: `${col} >= NOW() - ($${startIndex} || ' days')::interval`, values: [String(n)] };
    }
    default:
      return { sql: '', values: [] };
  }
}

/**
 * Grade percentage filter (0..100), built against the joined `rg` alias.
 * Native Quiz (epic #289, Story 11).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGradePercentageCondition(filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  switch (filter.operator) {
    case 'EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `rg.percentage = $${startIndex}::numeric`, values: [filter.value] };
    case 'NOT_EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `(rg.percentage IS NULL OR rg.percentage != $${startIndex}::numeric)`, values: [filter.value] };
    case 'GREATER_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `rg.percentage > $${startIndex}::numeric`, values: [filter.value] };
    case 'GREATER_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `rg.percentage >= $${startIndex}::numeric`, values: [filter.value] };
    case 'LESS_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `rg.percentage < $${startIndex}::numeric`, values: [filter.value] };
    case 'LESS_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `rg.percentage <= $${startIndex}::numeric`, values: [filter.value] };
    case 'BETWEEN': {
      if (!filter.numberRange) return { sql: '', values: [] };
      const conditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      let idx = startIndex;
      if (filter.numberRange.min !== undefined) {
        conditions.push(`rg.percentage >= $${idx}::numeric`);
        values.push(filter.numberRange.min);
        idx++;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push(`rg.percentage <= $${idx}::numeric`);
        values.push(filter.numberRange.max);
      }
      if (conditions.length === 0) return { sql: '', values: [] };
      return { sql: `(${conditions.join(' AND ')})`, values };
    }
    default:
      return { sql: '', values: [] };
  }
}

/** Grade pass/fail filter. Native Quiz (epic #289, Story 11). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGradePassedCondition(filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  if (filter.operator !== 'EQUALS' || filter.value === undefined) return { sql: '', values: [] };
  const boolValue = filter.value === 'true';
  return { sql: `rg.passed = $${startIndex}::boolean`, values: [boolValue] };
}

/** Grade status filter (AUTO_GRADED / NEEDS_REVIEW / REVIEWED / RELEASED). Native Quiz (epic #289, Story 11). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildGradeStatusCondition(filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  switch (filter.operator) {
    case 'EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `rg.status = $${startIndex}`, values: [filter.value] };
    case 'NOT_EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `(rg.status IS NULL OR rg.status != $${startIndex})`, values: [filter.value] };
    case 'IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const placeholders = filter.values.map((_, i) => `$${startIndex + i}`).join(', ');
      return { sql: `rg.status = ANY(ARRAY[${placeholders}]::text[])`, values: filter.values };
    }
    case 'NOT_IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const placeholders = filter.values.map((_, i) => `$${startIndex + i}`).join(', ');
      return {
        sql: `(rg.status IS NULL OR NOT (rg.status = ANY(ARRAY[${placeholders}]::text[])))`,
        values: filter.values,
      };
    }
    default:
      return { sql: '', values: [] };
  }
}

/**
 * Generic builders for the meta filters below — each operates on a plain SQL
 * column/expression (already table-qualified) rather than a JSONB accessor, so they're
 * shared across every meta field of a given kind instead of one bespoke function per field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTextColumnCondition(col: string, filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  switch (filter.operator) {
    case 'IS_EMPTY':
      return { sql: `(${col} IS NULL OR ${col} = '')`, values: [] };
    case 'IS_NOT_EMPTY':
      return { sql: `(${col} IS NOT NULL AND ${col} != '')`, values: [] };
    case 'EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `LOWER(${col}) = LOWER($${startIndex})`, values: [String(filter.value)] };
    case 'NOT_EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `(${col} IS NULL OR LOWER(${col}) != LOWER($${startIndex}))`, values: [String(filter.value)] };
    case 'CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} ILIKE $${startIndex}`, values: [`%${filter.value}%`] };
    case 'NOT_CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `(${col} IS NULL OR ${col} NOT ILIKE $${startIndex})`, values: [`%${filter.value}%`] };
    case 'STARTS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} ILIKE $${startIndex}`, values: [`${filter.value}%`] };
    case 'ENDS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} ILIKE $${startIndex}`, values: [`%${filter.value}`] };
    default:
      return { sql: '', values: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildNumberColumnCondition(
  expr: string,
  filter: ResponseFilter,
  startIndex: number,
  opts: { allowEmpty: boolean } = { allowEmpty: true }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { sql: string; values: any[] } {
  switch (filter.operator) {
    case 'IS_EMPTY':
      return opts.allowEmpty ? { sql: `${expr} IS NULL`, values: [] } : { sql: '', values: [] };
    case 'IS_NOT_EMPTY':
      return opts.allowEmpty ? { sql: `${expr} IS NOT NULL`, values: [] } : { sql: '', values: [] };
    case 'EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `${expr} = $${startIndex}::numeric`, values: [filter.value] };
    case 'NOT_EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `(${expr} IS NULL OR ${expr} != $${startIndex}::numeric)`, values: [filter.value] };
    case 'GREATER_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `${expr} > $${startIndex}::numeric`, values: [filter.value] };
    case 'GREATER_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `${expr} >= $${startIndex}::numeric`, values: [filter.value] };
    case 'LESS_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `${expr} < $${startIndex}::numeric`, values: [filter.value] };
    case 'LESS_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return { sql: `${expr} <= $${startIndex}::numeric`, values: [filter.value] };
    case 'BETWEEN': {
      if (!filter.numberRange) return { sql: '', values: [] };
      const conditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      let idx = startIndex;
      if (filter.numberRange.min !== undefined) {
        conditions.push(`${expr} >= $${idx}::numeric`);
        values.push(filter.numberRange.min);
        idx++;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push(`${expr} <= $${idx}::numeric`);
        values.push(filter.numberRange.max);
      }
      if (conditions.length === 0) return { sql: '', values: [] };
      return { sql: `(${conditions.join(' AND ')})`, values };
    }
    default:
      return { sql: '', values: [] };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDateColumnCondition(col: string, filter: ResponseFilter, startIndex: number): { sql: string; values: any[] } {
  switch (filter.operator) {
    case 'IS_EMPTY':
      return { sql: `${col} IS NULL`, values: [] };
    case 'IS_NOT_EMPTY':
      return { sql: `${col} IS NOT NULL`, values: [] };
    case 'DATE_EQUALS':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `DATE(${col}) = DATE($${startIndex}::timestamptz)`, values: [filter.value] };
    case 'DATE_BEFORE':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} < $${startIndex}::timestamptz`, values: [filter.value] };
    case 'DATE_AFTER':
      if (!filter.value) return { sql: '', values: [] };
      return { sql: `${col} > $${startIndex}::timestamptz`, values: [filter.value] };
    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return { sql: '', values: [] };
      const parts: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vals: any[] = [];
      let idx = startIndex;
      if (filter.dateRange.from) { parts.push(`${col} >= $${idx}::timestamptz`); vals.push(filter.dateRange.from); idx++; }
      if (filter.dateRange.to)   { parts.push(`${col} <= $${idx}::timestamptz`); vals.push(filter.dateRange.to); }
      return parts.length ? { sql: `(${parts.join(' AND ')})`, values: vals } : { sql: '', values: [] };
    }
    case 'DATE_TODAY':
      return { sql: `DATE(${col}) = CURRENT_DATE`, values: [] };
    case 'DATE_LAST_N_DAYS': {
      const n = Math.max(1, parseInt(filter.value || '7', 10) || 7);
      return { sql: `${col} >= NOW() - ($${startIndex} || ' days')::interval`, values: [String(n)] };
    }
    default:
      return { sql: '', values: [] };
  }
}

const ensureSafeGeneratorId = (id: string): string => {
  if (!SAFE_FIELD_ID_PATTERN.test(id)) {
    throw new Error(`Invalid PDF generator id "${id}"`);
  }
  return id;
};

/**
 * Builds raw SQL condition for a single filter
 * Returns SQL string with PostgreSQL placeholders ($1, $2, etc.) and parameter values
 */
export function buildRawSQLCondition(
  filter: ResponseFilter,
  startIndex: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { sql: string; values: any[] } {
  if (filter.fieldId === '__submittedAt') {
    return buildSubmittedAtCondition(filter, startIndex);
  }

  if (filter.fieldId === '__tags') {
    if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
    const placeholders = filter.values.map((_, i) => `$${startIndex + i}`).join(', ');
    return {
      sql: `EXISTS (
        SELECT 1 FROM "response_tag_assignment" rta
        WHERE rta."responseId" = "response".id
        AND rta."tagId" = ANY(ARRAY[${placeholders}]::text[])
      )`,
      values: filter.values,
    };
  }

  if (filter.fieldId === '__gradePercentage') {
    if (filter.operator === 'IS_EMPTY') return { sql: 'rg.percentage IS NULL', values: [] };
    if (filter.operator === 'IS_NOT_EMPTY') return { sql: 'rg.percentage IS NOT NULL', values: [] };
    return buildGradePercentageCondition(filter, startIndex);
  }

  if (filter.fieldId === '__gradePassed') {
    if (filter.operator === 'IS_EMPTY') return { sql: 'rg.passed IS NULL', values: [] };
    if (filter.operator === 'IS_NOT_EMPTY') return { sql: 'rg.passed IS NOT NULL', values: [] };
    return buildGradePassedCondition(filter, startIndex);
  }

  if (filter.fieldId === '__gradeStatus') {
    if (filter.operator === 'IS_EMPTY') return { sql: 'rg.status IS NULL', values: [] };
    if (filter.operator === 'IS_NOT_EMPTY') return { sql: 'rg.status IS NOT NULL', values: [] };
    return buildGradeStatusCondition(filter, startIndex);
  }

  // Native Quiz: attempt number, for retake-enabled quizzes. Same rg join as the three fields above.
  if (filter.fieldId === '__gradeAttempt') {
    return buildNumberColumnCondition('rg."attemptNumber"', filter, startIndex);
  }

  if (filter.fieldId === '__completionTimeSeconds') {
    return buildNumberColumnCondition('fsa."completionTimeSeconds"', filter, startIndex);
  }
  if (filter.fieldId === '__browser') {
    return buildTextColumnCondition('fsa.browser', filter, startIndex);
  }
  if (filter.fieldId === '__operatingSystem') {
    return buildTextColumnCondition('fsa."operatingSystem"', filter, startIndex);
  }
  if (filter.fieldId === '__country') {
    return buildTextColumnCondition('fsa."countryAlpha2"', filter, startIndex);
  }

  // Respondent identity: derived from whether the response carries an authenticated
  // respondentUserId (only ever set when the form's accessControl setting is enabled).
  if (filter.fieldId === '__respondentType') {
    if (filter.operator !== 'EQUALS' || !filter.value) return { sql: '', values: [] };
    return filter.value === 'authenticated'
      ? { sql: '"response"."respondentUserId" IS NOT NULL', values: [] }
      : { sql: '"response"."respondentUserId" IS NULL', values: [] };
  }
  if (filter.fieldId === '__respondentEmail') {
    return buildTextColumnCondition('"response"."respondentEmail"', filter, startIndex);
  }

  // Same email submitted more than once for this form (non-deleted responses only).
  // A response with no respondentEmail matches neither "Duplicate" nor "Unique" — the
  // concept doesn't apply to it.
  if (filter.fieldId === '__duplicateEmail') {
    if (filter.operator !== 'EQUALS' || !filter.value) return { sql: '', values: [] };
    const dupExists = `EXISTS (
      SELECT 1 FROM "response" r2
      WHERE r2."formId" = "response"."formId"
        AND r2.id <> "response".id
        AND r2."deletedAt" IS NULL
        AND r2."respondentEmail" = "response"."respondentEmail"
    )`;
    const hasEmail = `"response"."respondentEmail" IS NOT NULL`;
    return filter.value === 'true'
      ? { sql: `(${hasEmail} AND ${dupExists})`, values: [] }
      : { sql: `(${hasEmail} AND NOT ${dupExists})`, values: [] };
  }

  if (filter.fieldId === '__lastEditedAt') {
    return buildDateColumnCondition('leh."editedAt"', filter, startIndex);
  }
  if (filter.fieldId === '__lastEditedByEmail') {
    return buildTextColumnCondition('leh."editedByEmail"', filter, startIndex);
  }

  // Non-empty top-level keys in `data`, as a % of the form's cached field count
  // (form_metadata.fieldCount) — an approximation of "fillable fields answered", not exact
  // (fieldCount includes non-fillable rich-text fields too), but close enough to be useful
  // and avoids re-parsing the form schema per response.
  if (filter.fieldId === '__completenessPercent') {
    return buildNumberColumnCondition(COMPLETENESS_PERCENT_EXPR, filter, startIndex, { allowEmpty: false });
  }

  // Dynamic, one per PdfGenerator: whether this response already has a successfully
  // generated PDF from that generator. generatorId is passed as a bound parameter, never
  // interpolated into the SQL string, even though ensureSafeGeneratorId also validates it.
  if (filter.fieldId.startsWith(PDF_GENERATED_FIELD_PREFIX)) {
    const generatorId = ensureSafeGeneratorId(filter.fieldId.slice(PDF_GENERATED_FIELD_PREFIX.length));
    if (filter.operator !== 'EQUALS' || !filter.value) return { sql: '', values: [] };
    const genExists = `EXISTS (
      SELECT 1 FROM "pdf_generation_result" pgr
      WHERE pgr."generatorId" = $${startIndex}
        AND pgr."responseId" = "response".id
        AND pgr.status = 'success'
    )`;
    return filter.value === 'true'
      ? { sql: genExists, values: [generatorId] }
      : { sql: `NOT ${genExists}`, values: [generatorId] };
  }

  const safeFieldId = ensureSafeFieldId(filter.fieldId);
  const jsonAccessor = `data->'${safeFieldId}'`;
  const textAccessor = `data->>'${safeFieldId}'`;

  switch (filter.operator) {
    case 'IS_EMPTY':
      // Check if field is null, empty string, or empty array
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR 
          ${textAccessor} = '' OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND jsonb_array_length(${jsonAccessor}) = 0)
        )`,
        values: [],
      };

    case 'IS_NOT_EMPTY':
      // Check if field exists, is not empty, and not an empty array
      return {
        sql: `(
          ${jsonAccessor} IS NOT NULL AND 
          ${textAccessor} != '' AND
          NOT (jsonb_typeof(${jsonAccessor}) = 'array' AND jsonb_array_length(${jsonAccessor}) = 0)
        )`,
        values: [],
      };

    case 'EQUALS':
      // Handle both string equality and array exact match
      if (filter.value === undefined && (!filter.values || filter.values.length === 0)) {
        return { sql: '', values: [] };
      }
      // For string comparison (single value)
      if (filter.value !== undefined) {
        return {
          sql: `LOWER(${textAccessor}) = LOWER($${startIndex})`,
          values: [String(filter.value)],
        };
      }
      // For array exact match (multiple values) - used by checkbox fields
      // Order-independent comparison: array contains exactly these values, no more, no less
      if (filter.values && filter.values.length > 0) {
        const placeholders = filter.values
          .map((_, idx) => `$${startIndex + idx}`)
          .join(', ');
        return {
          sql: `(
            jsonb_typeof(${jsonAccessor}) = 'array' AND
            jsonb_array_length(${jsonAccessor}) = ${filter.values.length} AND
            NOT EXISTS (
              SELECT 1 FROM unnest(ARRAY[${placeholders}]::text[]) AS expected(val)
              WHERE NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
                WHERE LOWER(elem) = LOWER(expected.val)
              )
            )
          )`,
          values: filter.values.map((value) => String(value)),
        };
      }
      return { sql: '', values: [] };

    case 'NOT_EQUALS':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `LOWER(${textAccessor}) != LOWER($${startIndex})`,
        values: [String(filter.value)],
      };

    case 'CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      // Handle both string contains (case-insensitive) and array contains
      // For arrays: Check if the value exists in the array
      // For strings: Use ILIKE for case-insensitive substring match
      return {
        sql: `(
          (jsonb_typeof(${jsonAccessor}) = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = $${startIndex}
          )) OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND ${textAccessor} ILIKE $${startIndex + 1})
        )`,
        values: [String(filter.value).toLowerCase(), `%${filter.value}%`],
      };

    case 'NOT_CONTAINS':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = $${startIndex}
          )) OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND ${textAccessor} NOT ILIKE $${startIndex + 1})
        )`,
        values: [String(filter.value).toLowerCase(), `%${filter.value}%`],
      };

    case 'STARTS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `${textAccessor} ILIKE $${startIndex}`,
        values: [`${filter.value}%`],
      };

    case 'ENDS_WITH':
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `${textAccessor} ILIKE $${startIndex}`,
        values: [`%${filter.value}`],
      };

    case 'GREATER_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Safe numeric cast: validate the value is a number before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric > $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'GREATER_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric >= $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'LESS_THAN':
      if (filter.value === undefined) return { sql: '', values: [] };
      // Safe numeric cast: validate the value is a number before casting
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric < $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'LESS_THAN_OR_EQUAL':
      if (filter.value === undefined) return { sql: '', values: [] };
      return {
        sql: `(
          CASE 
            WHEN ${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$' 
            THEN (${textAccessor})::numeric <= $${startIndex}::numeric
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };

    case 'BETWEEN': {
      if (!filter.numberRange) return { sql: '', values: [] };
      const conditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any[] = [];
      let idx = startIndex;

      // Safe numeric cast: only process if value matches numeric pattern
      const numericCheck = `${textAccessor} ~ '^-?[0-9]+(\\.[0-9]+)?$'`;

      if (filter.numberRange.min !== undefined) {
        conditions.push(`(${textAccessor})::numeric >= $${idx}::numeric`);
        values.push(filter.numberRange.min);
        idx++;
      }
      if (filter.numberRange.max !== undefined) {
        conditions.push(`(${textAccessor})::numeric <= $${idx}::numeric`);
        values.push(filter.numberRange.max);
      }

      if (conditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(
          CASE 
            WHEN ${numericCheck}
            THEN ${conditions.join(' AND ')}
            ELSE FALSE
          END
        )`,
        values,
      };
    }

    case 'IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          (jsonb_typeof(${jsonAccessor}) = 'string' AND LOWER(${textAccessor}) = ANY(ARRAY[${placeholders}]::text[])) OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = ANY(ARRAY[${placeholders}]::text[])
          ))
        )`,
        values: loweredValues,
      };
    }

    case 'NOT_IN': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          ${jsonAccessor} IS NULL OR
          (jsonb_typeof(${jsonAccessor}) = 'string' AND NOT (LOWER(${textAccessor}) = ANY(ARRAY[${placeholders}]::text[]))) OR
          (jsonb_typeof(${jsonAccessor}) = 'array' AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
            WHERE LOWER(elem) = ANY(ARRAY[${placeholders}]::text[])
          ))
        )`,
        values: loweredValues,
      };
    }

    case 'CONTAINS_ALL': {
      if (!filter.values || filter.values.length === 0) return { sql: '', values: [] };
      const loweredValues = filter.values.map((value) => String(value).toLowerCase());
      const placeholders = loweredValues.map((_, idx) => `$${startIndex + idx}`).join(', ');
      return {
        sql: `(
          jsonb_typeof(${jsonAccessor}) = 'array' AND
          NOT EXISTS (
            SELECT 1 FROM unnest(ARRAY[${placeholders}]::text[]) AS expected(val)
            WHERE NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(${jsonAccessor}) elem
              WHERE LOWER(elem) = expected.val
            )
          )
        )`,
        values: loweredValues,
      };
    }

    // Date operators
    // Stored as YYYY-MM-DD string; WHEN isEpoch is a legacy fallback for
    // epoch-ms numeric strings from before the ba4023b5 date-format migration.
    case 'DATE_EQUALS': {
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          CASE
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN DATE((${textAccessor})::timestamp) = DATE($${startIndex}::timestamp)
            WHEN ${textAccessor} ~ '^[0-9]+$'
            THEN DATE(to_timestamp((${textAccessor})::bigint / 1000)) = DATE($${startIndex}::timestamp)
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_BEFORE': {
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          CASE
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN (${textAccessor})::timestamp < $${startIndex}::timestamp
            WHEN ${textAccessor} ~ '^[0-9]+$'
            THEN to_timestamp((${textAccessor})::bigint / 1000) < $${startIndex}::timestamp
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_AFTER': {
      if (!filter.value) return { sql: '', values: [] };
      return {
        sql: `(
          CASE
            WHEN ${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
            THEN (${textAccessor})::timestamp > $${startIndex}::timestamp
            WHEN ${textAccessor} ~ '^[0-9]+$'
            THEN to_timestamp((${textAccessor})::bigint / 1000) > $${startIndex}::timestamp
            ELSE FALSE
          END
        )`,
        values: [filter.value],
      };
    }

    case 'DATE_BETWEEN': {
      if (!filter.dateRange) return { sql: '', values: [] };
      const ymdConditions: string[] = [];
      const epochConditions: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dateValues: any[] = [];
      let dateIdx = startIndex;

      const isYMD = `${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`;
      const isEpoch = `${textAccessor} ~ '^[0-9]+$'`;

      if (filter.dateRange.from) {
        ymdConditions.push(`(${textAccessor})::timestamp >= $${dateIdx}::timestamp`);
        epochConditions.push(`to_timestamp((${textAccessor})::bigint / 1000) >= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.from);
        dateIdx++;
      }
      if (filter.dateRange.to) {
        ymdConditions.push(`(${textAccessor})::timestamp <= $${dateIdx}::timestamp`);
        epochConditions.push(`to_timestamp((${textAccessor})::bigint / 1000) <= $${dateIdx}::timestamp`);
        dateValues.push(filter.dateRange.to);
      }

      if (ymdConditions.length === 0) return { sql: '', values: [] };
      return {
        sql: `(
          CASE
            WHEN ${isYMD}
            THEN ${ymdConditions.join(' AND ')}
            WHEN ${isEpoch}
            THEN ${epochConditions.join(' AND ')}
            ELSE FALSE
          END
        )`,
        values: dateValues,
      };
    }

    case 'DATE_TODAY': {
      // Stored as YYYY-MM-DD string; legacy fallback for epoch-ms numeric strings
      const isYMD = `${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`;
      const isEpoch = `${textAccessor} ~ '^[0-9]+$'`;
      return {
        sql: `(
          CASE
            WHEN ${isYMD}
            THEN (${textAccessor})::date = CURRENT_DATE
            WHEN ${isEpoch}
            THEN DATE(to_timestamp((${textAccessor})::bigint / 1000)) = CURRENT_DATE
            ELSE FALSE
          END
        )`,
        values: [],
      };
    }

    case 'DATE_LAST_N_DAYS': {
      const daysValue = filter.value && filter.value.trim() !== '' ? filter.value : '7';
      const days = parseInt(daysValue, 10);
      if (isNaN(days) || days < 0) {
        return { sql: '', values: [] };
      }

      // Stored as YYYY-MM-DD string; legacy fallback for epoch-ms numeric strings
      const isYMD = `${textAccessor} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`;
      const isEpoch = `${textAccessor} ~ '^[0-9]+$'`;
      const sql = `(
          CASE
            WHEN ${isYMD}
            THEN (${textAccessor})::date >= (CURRENT_DATE - $${startIndex}::integer)
              AND (${textAccessor})::date <= CURRENT_DATE
            WHEN ${isEpoch}
            THEN to_timestamp((${textAccessor})::bigint / 1000) >= (CURRENT_DATE - $${startIndex}::integer)
              AND to_timestamp((${textAccessor})::bigint / 1000) <= NOW()
            ELSE FALSE
          END
        )`;

      return {
        sql,
        values: [days],
      };
    }

    default:
      return { sql: '', values: [] };
  }
}
