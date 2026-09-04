/**
 * Response meta-filters — filterable properties that describe a response itself (quiz
 * grade, submission analytics, respondent identity, edit history, completeness, PDF
 * generation status) rather than a value the respondent typed into a form field.
 *
 * These are NOT FillableFormField instances (there's no form field behind "Browser" or
 * "Last Edited By") — they're a parallel, lightweight descriptor consumed by FilterRow.tsx
 * alongside the real `FillableFormField[]`, mirroring the __submittedAt/__tags special
 * fieldId convention the backend (responseFilterService.ts / responseQueryBuilder.ts)
 * already uses. Every field id here has a matching branch in both of those backend files.
 */

export type MetaFieldKind = 'text' | 'number' | 'date' | 'enum' | 'boolean';

export type MetaFilterSection =
  | 'quiz'
  | 'submission'
  | 'respondent'
  | 'editHistory'
  | 'response'
  | 'pdf';

export const META_FILTER_SECTION_ORDER: MetaFilterSection[] = [
  'quiz',
  'submission',
  'respondent',
  'editHistory',
  'response',
  'pdf',
];

/** A fixed two-value choice (e.g. Passed/Failed, Authenticated/Anonymous) — value is the
 * literal string sent as filter.value; labelKey resolves via the filterRow i18n namespace. */
export interface MetaBooleanOption {
  value: string;
  labelKey: string;
}

export interface MetaEnumOption {
  value: string;
  labelKey: string;
}

export interface MetaFilterField {
  id: string;
  section: MetaFilterSection;
  kind: MetaFieldKind;
  labelKey: string;
  labelValues?: Record<string, string | number>;
  /** Cosmetic suffix shown next to a number input, for a symbol that's the same across
   * locales (e.g. '%'). For a word-based unit that needs translation, use `unitKey`
   * instead — the renderer prefers `unitKey` over `unit` when both would apply. */
  unit?: string;
  /** i18n key (under the filterRow namespace) resolving to a translated unit word, e.g.
   * "sec" / "வினாடி" for completion time. */
  unitKey?: string;
  /** Overrides the kind's default operator list — only completenessPercent uses this,
   * to drop IS_EMPTY/IS_NOT_EMPTY (it's a computed value, never actually absent). */
  operators?: string[];
  enumOptions?: MetaEnumOption[];
  booleanOptions?: [MetaBooleanOption, MetaBooleanOption];
  /** kind: 'text' fields only — renders as a dropdown-plus-free-text combobox
   * (AsyncValueCombobox) offering distinct values actually seen in the data
   * (backend: responseFieldSuggestions.ts's SUGGESTIBLE_FIELD_IDS — keep in sync),
   * while still accepting arbitrary typed text (a value not yet seen, or a
   * CONTAINS/STARTS_WITH fragment). Plain fields without this stay a bare text Input. */
  supportsSuggestions?: boolean;
}

const QUIZ_META_FIELDS: MetaFilterField[] = [
  { id: '__gradePercentage', section: 'quiz', kind: 'number', labelKey: 'metaFields.gradePercentage', unit: '%' },
  {
    id: '__gradePassed',
    section: 'quiz',
    kind: 'boolean',
    labelKey: 'metaFields.gradePassed',
    booleanOptions: [
      { value: 'true', labelKey: 'metaBooleanLabels.gradePassed.true' },
      { value: 'false', labelKey: 'metaBooleanLabels.gradePassed.false' },
    ],
  },
  {
    id: '__gradeStatus',
    section: 'quiz',
    kind: 'enum',
    labelKey: 'metaFields.gradeStatus',
    enumOptions: [
      { value: 'AUTO_GRADED', labelKey: 'metaEnumOptions.gradeStatus.AUTO_GRADED' },
      { value: 'NEEDS_REVIEW', labelKey: 'metaEnumOptions.gradeStatus.NEEDS_REVIEW' },
      { value: 'REVIEWED', labelKey: 'metaEnumOptions.gradeStatus.REVIEWED' },
      { value: 'RELEASED', labelKey: 'metaEnumOptions.gradeStatus.RELEASED' },
    ],
  },
  { id: '__gradeAttempt', section: 'quiz', kind: 'number', labelKey: 'metaFields.gradeAttempt' },
];

const SUBMISSION_META_FIELDS: MetaFilterField[] = [
  { id: '__completionTimeSeconds', section: 'submission', kind: 'number', labelKey: 'metaFields.completionTimeSeconds', unitKey: 'metaUnits.seconds' },
  { id: '__browser', section: 'submission', kind: 'text', labelKey: 'metaFields.browser', supportsSuggestions: true },
  { id: '__operatingSystem', section: 'submission', kind: 'text', labelKey: 'metaFields.operatingSystem', supportsSuggestions: true },
  { id: '__country', section: 'submission', kind: 'text', labelKey: 'metaFields.country', supportsSuggestions: true },
];

const RESPONDENT_META_FIELDS: MetaFilterField[] = [
  {
    id: '__respondentType',
    section: 'respondent',
    kind: 'boolean',
    labelKey: 'metaFields.respondentType',
    booleanOptions: [
      { value: 'authenticated', labelKey: 'metaBooleanLabels.respondentType.authenticated' },
      { value: 'anonymous', labelKey: 'metaBooleanLabels.respondentType.anonymous' },
    ],
  },
  { id: '__respondentEmail', section: 'respondent', kind: 'text', labelKey: 'metaFields.respondentEmail', supportsSuggestions: true },
  {
    id: '__duplicateEmail',
    section: 'respondent',
    kind: 'boolean',
    labelKey: 'metaFields.duplicateEmail',
    booleanOptions: [
      { value: 'true', labelKey: 'metaBooleanLabels.duplicateEmail.true' },
      { value: 'false', labelKey: 'metaBooleanLabels.duplicateEmail.false' },
    ],
  },
];

const EDIT_HISTORY_META_FIELDS: MetaFilterField[] = [
  { id: '__lastEditedAt', section: 'editHistory', kind: 'date', labelKey: 'metaFields.lastEditedAt' },
  { id: '__lastEditedByEmail', section: 'editHistory', kind: 'text', labelKey: 'metaFields.lastEditedByEmail', supportsSuggestions: true },
];

const RESPONSE_META_FIELDS: MetaFilterField[] = [
  {
    id: '__completenessPercent',
    section: 'response',
    kind: 'number',
    labelKey: 'metaFields.completenessPercent',
    unit: '%',
    operators: ['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'BETWEEN'],
  },
];

const PDF_GENERATED_PREFIX = '__pdfGenerated_';

export function buildPdfGeneratorMetaFields(
  generators: { id: string; name: string }[]
): MetaFilterField[] {
  return generators.map((g) => ({
    id: `${PDF_GENERATED_PREFIX}${g.id}`,
    section: 'pdf' as const,
    kind: 'boolean' as const,
    labelKey: 'metaFields.pdfGenerated',
    labelValues: { name: g.name },
    booleanOptions: [
      { value: 'true', labelKey: 'metaBooleanLabels.pdfGenerated.true' },
      { value: 'false', labelKey: 'metaBooleanLabels.pdfGenerated.false' },
    ],
  }));
}

export interface BuildMetaFilterFieldsOptions {
  quizEnabled?: boolean;
  pdfGenerators?: { id: string; name: string }[];
}

/** Full registry — used by the SQL-backed surfaces (Responses page, PDF generator's own
 * filter, automation digest filters). See ConditionRulesEditor.tsx for the much smaller,
 * separate registry automation CONDITION nodes use (trigger-time context only exposes
 * quizScore/quizPercentage/quizPassed, not any of these __-prefixed SQL fieldIds). */
export function buildMetaFilterFields(options: BuildMetaFilterFieldsOptions = {}): MetaFilterField[] {
  return [
    ...(options.quizEnabled ? QUIZ_META_FIELDS : []),
    ...SUBMISSION_META_FIELDS,
    ...RESPONDENT_META_FIELDS,
    ...EDIT_HISTORY_META_FIELDS,
    ...RESPONSE_META_FIELDS,
    ...(options.pdfGenerators?.length ? buildPdfGeneratorMetaFields(options.pdfGenerators) : []),
  ];
}

/**
 * Automation CONDITION nodes (form.submitted trigger only) evaluate rules against the
 * flat trigger payload (conditionEvaluator.ts → context.triggerData), NOT the SQL-backed
 * response list — so they can only reference keys the trigger payload actually carries.
 * `emitFormSubmitted` (graphql/resolvers/responses.ts) fans out
 * `quizScore`/`quizMaxScore`/`quizPercentage`/`quizPassed` there when quiz grading ran —
 * deliberately different fieldIds from `__gradePercentage`/`__gradePassed` above, which
 * only exist as SQL columns and are never in triggerData. Do not add the other meta
 * fields here; none of them are in the trigger payload.
 */
export const TRIGGER_QUIZ_META_FIELDS: MetaFilterField[] = [
  { id: 'quizPercentage', section: 'quiz', kind: 'number', labelKey: 'metaFields.quizPercentage', unit: '%' },
  {
    id: 'quizPassed',
    section: 'quiz',
    kind: 'boolean',
    labelKey: 'metaFields.quizPassed',
    booleanOptions: [
      { value: 'true', labelKey: 'metaBooleanLabels.quizPassed.true' },
      { value: 'false', labelKey: 'metaBooleanLabels.quizPassed.false' },
    ],
  },
];

export function groupMetaFieldsBySection(
  metaFields: MetaFilterField[]
): Map<MetaFilterSection, MetaFilterField[]> {
  const grouped = new Map<MetaFilterSection, MetaFilterField[]>();
  for (const field of metaFields) {
    const list = grouped.get(field.section) ?? [];
    list.push(field);
    grouped.set(field.section, list);
  }
  return grouped;
}
