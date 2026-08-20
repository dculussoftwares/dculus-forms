#!/usr/bin/env tsx
/**
 * Migration: quiz-grading plugin -> native quiz mode
 *
 * Native Quiz epic (#289), Story 15 (#304). Converts each `quiz-grading` FormPlugin
 * instance into native `field.grading` + `settings.quiz`, so the plugin can be
 * retired without losing anyone's answer keys.
 *
 * THE HARD PART — see the spike comment on issue #304 for the full writeup:
 * a form's schema is served from `CollaborativeDocument.state` (a Y.doc) whenever
 * that row exists — `Form.formSchema` (Json column) is only the fallback the
 * server uses when Hocuspocus is unavailable. Writing the DB column alone on a
 * form that already has a materialized Y.doc is silently undone the next time
 * anyone opens the builder. So for such forms this script decodes the stored
 * Y.doc, sets `grading` on the matched fields' Y.Maps (via the same
 * `buildGradingYMap` the server itself uses to seed a fresh doc), and persists
 * the re-encoded state back through the same repository call the running
 * Hocuspocus server's own `Database` extension uses. Only forms with no
 * `CollaborativeDocument` row yet fall back to a plain `Form.formSchema` write.
 *
 * `settings.quiz` is unrelated to any of this — `FormSettings` is a plain `Json?`
 * column on `Form`, never part of the Y.doc — so it's always a normal update.
 *
 * Per FormPlugin of type 'quiz-grading':
 *   - Resolve the live schema exactly like `submitResponse` does:
 *     `getFormSchemaFromHocuspocus(formId) ?? form.formSchema`.
 *   - For each `quizFields[]` entry, find the field by `fieldId`. A missing/
 *     deleted/non-fillable field, or a `correctAnswer` no longer present in the
 *     field's current `options`, is REPORTED — never guessed — and left alone.
 *   - Matched fields get `grading: { mode: 'exact', pointValue: marks,
 *     acceptedAnswers: [correctAnswer] }`.
 *   - The form gets `settings.quiz = { enabled: true, passThresholdPercent,
 *     gradeRelease: 'never' }`. `gradeRelease: 'never'` is deliberate: the old
 *     plugin showed respondents nothing, so silently starting to reveal scores
 *     on a live form would blindside its owner. The report tells them to opt in.
 *   - A form with more than one `quiz-grading` instance only has its first
 *     ENABLED instance migrated; the rest are flagged for manual review and
 *     left completely untouched — merging conflicting answer keys is guessing.
 *   - The migrated instance is disabled (`enabled: false`) and stamped with
 *     `config.migratedToNativeAt`. It is never deleted — historical
 *     `Response.metadata['quiz-grading*']` must keep rendering.
 *
 * Safety:
 *   - `--dry-run` is the DEFAULT. Nothing is written unless `--apply` is passed.
 *   - Every form is snapshotted (current formSchema, settings, quiz plugin
 *     configs, and raw CollaborativeDocument state) to a local, gitignored
 *     JSON file before it is touched, so a bad write is reversible.
 *   - Forms are processed one at a time, in logged batches.
 *   - Idempotent: a form whose primary quiz-grading plugin already has
 *     `config.migratedToNativeAt` set is skipped entirely (report-only).
 *
 * Usage:
 *   npx tsx src/scripts/migrate-quiz-plugin-to-native.ts                     # dry run, all forms
 *   npx tsx src/scripts/migrate-quiz-plugin-to-native.ts --apply             # write changes
 *   npx tsx src/scripts/migrate-quiz-plugin-to-native.ts --form-id=abc123    # single form
 *   npx tsx src/scripts/migrate-quiz-plugin-to-native.ts --batch-size=10
 *   npx tsx src/scripts/migrate-quiz-plugin-to-native.ts --snapshot-dir=./snapshots
 *
 * Exit codes: 0 = clean, 1 = completed but something needs human review,
 * 2 = fatal error.
 */

import './load-env.js'; // MUST be first: lib/env.js validates env at import time
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as Y from 'yjs';
import {
  sanitizeFieldGrading,
  sanitizeQuizSettings,
  type FieldGrading,
  type QuizSettings,
} from '@dculus/types';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getFormSchemaFromHocuspocus, buildGradingYMap } from '../services/hocuspocus.js';
import { collaborativeDocumentRepository } from '../repositories/index.js';
import {
  QUIZ_GRADING_PLUGIN_TYPE,
  type QuizFieldConfig,
  type QuizGradingPluginConfig,
} from '../plugins/quiz/types.js';

// ---------------------------------------------------------------------------
// Field matching
// ---------------------------------------------------------------------------

export interface FieldMatch {
  fieldId: string;
  grading: FieldGrading;
}

export interface StaleOptionField {
  fieldId: string;
  correctAnswer: string;
}

export interface MatchResult {
  matched: FieldMatch[];
  unmatchedFieldIds: string[];
  staleOptionFields: StaleOptionField[];
}

// Non-fillable fields (currently only rich_text_field) have no `grading` slot
// at all — see FillableFormField in @dculus/types. Anything else with a
// `type` is treated as gradable; this mirrors the old plugin, which never
// restricted which field types could be keyed.
const NON_GRADABLE_FIELD_TYPES = new Set(['rich_text_field']);

/**
 * Matches a plugin's `quizFields[]` against the form's live schema. Never
 * guesses: a field that's gone, deleted, non-gradable, or whose correctAnswer
 * fell out of its current options is reported and left alone.
 */
export const matchQuizFields = (quizFields: QuizFieldConfig[], schema: any): MatchResult => {
  const fieldsById = new Map<string, any>();
  for (const page of schema?.pages ?? []) {
    for (const field of page?.fields ?? []) {
      if (field?.id) fieldsById.set(field.id, field);
    }
  }

  const matched: FieldMatch[] = [];
  const unmatchedFieldIds: string[] = [];
  const staleOptionFields: StaleOptionField[] = [];

  for (const quizField of quizFields) {
    const field = fieldsById.get(quizField.fieldId);

    if (!field || field.deleted === true || NON_GRADABLE_FIELD_TYPES.has(field.type)) {
      unmatchedFieldIds.push(quizField.fieldId);
      continue;
    }

    if (
      Array.isArray(field.options) &&
      field.options.length > 0 &&
      !field.options.includes(quizField.correctAnswer)
    ) {
      staleOptionFields.push({ fieldId: quizField.fieldId, correctAnswer: quizField.correctAnswer });
      continue;
    }

    const grading = sanitizeFieldGrading({
      mode: 'exact',
      pointValue: quizField.marks,
      acceptedAnswers: [quizField.correctAnswer],
    });

    if (!grading) {
      // Malformed legacy config (e.g. non-numeric marks) — report, don't guess.
      unmatchedFieldIds.push(quizField.fieldId);
      continue;
    }

    matched.push({ fieldId: quizField.fieldId, grading });
  }

  return { matched, unmatchedFieldIds, staleOptionFields };
};

// ---------------------------------------------------------------------------
// Y.doc + plain-schema writers
// ---------------------------------------------------------------------------

const findFieldYMap = (doc: Y.Doc, fieldId: string): Y.Map<any> | undefined => {
  const formSchemaMap = doc.getMap('formSchema');
  const pages = formSchemaMap.get('pages');
  if (!(pages instanceof Y.Array)) return undefined;

  for (let i = 0; i < pages.length; i++) {
    const pageMap = pages.get(i);
    if (!(pageMap instanceof Y.Map)) continue;
    const fields = pageMap.get('fields');
    if (!(fields instanceof Y.Array)) continue;

    for (let j = 0; j < fields.length; j++) {
      const fieldMap = fields.get(j);
      if (fieldMap instanceof Y.Map && fieldMap.get('id') === fieldId && fieldMap.get('deleted') !== true) {
        return fieldMap;
      }
    }
  }
  return undefined;
};

/** Sets `grading` on every matched field inside a decoded Y.doc, returns the re-encoded update bytes. */
export const applyGradingToYDoc = (state: Uint8Array, matched: FieldMatch[]): Uint8Array => {
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, state);
    doc.transact(() => {
      for (const { fieldId, grading } of matched) {
        const fieldMap = findFieldYMap(doc, fieldId);
        if (!fieldMap) {
          // Shouldn't happen: `matched` was derived from this same document's
          // reconstructed schema. Surface it loudly rather than silently drop it.
          logger.warn(`[migrate-quiz-plugin] Field ${fieldId} vanished from the Y.doc between read and write`);
          continue;
        }
        fieldMap.set('grading', buildGradingYMap(grading));
      }
    });
    return Y.encodeStateAsUpdate(doc);
  } finally {
    doc.destroy();
  }
};

/** Sets `grading` on every matched field inside a plain (DB-column) formSchema JSON object. */
export const applyGradingToPlainSchema = (schema: any, matched: FieldMatch[]): any => {
  const gradingByFieldId = new Map(matched.map((m) => [m.fieldId, m.grading]));
  const clone = JSON.parse(JSON.stringify(schema ?? {}));
  for (const page of clone.pages ?? []) {
    for (const field of page.fields ?? []) {
      const grading = gradingByFieldId.get(field.id);
      if (grading) field.grading = grading;
    }
  }
  return clone;
};

// ---------------------------------------------------------------------------
// Per-form processing
// ---------------------------------------------------------------------------

type FormRow = { id: string; title: string; formSchema: any; settings: any };
type FormPluginRow = Awaited<ReturnType<typeof prisma.formPlugin.findMany>>[number];

export interface FormMigrationReport {
  formId: string;
  formTitle: string;
  status:
    | 'migrated'
    | 'already-migrated'
    | 'no-enabled-instance'
    | 'no-fields-matched'
    | 'not-found'
    | 'error';
  primaryPluginId?: string;
  matchedFieldIds: string[];
  unmatchedFieldIds: string[];
  staleOptionFields: StaleOptionField[];
  extraInstancePluginIds: string[];
  needsReview: boolean;
  snapshotPath?: string;
  error?: string;
}

const isMigrated = (plugin: FormPluginRow): boolean =>
  Boolean((plugin.config as Record<string, unknown> | null)?.migratedToNativeAt);

const buildQuizSettings = (config: QuizGradingPluginConfig): QuizSettings | undefined =>
  sanitizeQuizSettings({
    enabled: true,
    passThresholdPercent: config.passThreshold,
    gradeRelease: 'never',
    // Moot while gradeRelease is 'never' (nothing is ever shown), but the
    // shape is required — kept maximally conservative for when an owner
    // later opts into a release policy from the report's guidance.
    respondentVisibility: {
      totalScore: false,
      perQuestionCorrectness: false,
      correctAnswers: false,
      pointValues: false,
      feedback: false,
      passFailBadge: false,
    },
  });

const snapshotForm = async (
  formId: string,
  form: FormRow,
  quizPlugins: FormPluginRow[],
  snapshotDir: string
): Promise<string> => {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const collabDoc = await collaborativeDocumentRepository.fetchDocumentWithState(formId);

  const snapshot = {
    formId,
    snapshottedAt: new Date().toISOString(),
    formSchema: form.formSchema,
    settings: form.settings,
    quizPlugins: quizPlugins.map((p) => ({ id: p.id, enabled: p.enabled, config: p.config })),
    collaborativeDocumentState: collabDoc?.state
      ? Buffer.from(collabDoc.state).toString('base64')
      : null,
  };

  const filePath = path.join(snapshotDir, `${formId}-${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return filePath;
};

const applyMigration = async (
  formId: string,
  form: FormRow,
  primary: FormPluginRow,
  config: QuizGradingPluginConfig,
  matched: FieldMatch[]
): Promise<void> => {
  const quizSettings = buildQuizSettings(config);
  if (!quizSettings) {
    throw new Error(`Computed quiz settings failed validation for form ${formId} — refusing to write`);
  }

  const formUpdateData: Record<string, unknown> = {
    settings: { ...((form.settings as Record<string, unknown>) ?? {}), quiz: quizSettings },
  };

  // The hard part: if a CollaborativeDocument row already exists, the Y.doc —
  // not Form.formSchema — is what every reader (including the builder) sees.
  // Writing the DB column alone here would be silently overwritten the next
  // time anyone opens this form. See the header comment and the issue #304
  // spike writeup for the full reasoning.
  const collabDoc = await collaborativeDocumentRepository.fetchDocumentWithState(formId);
  if (collabDoc?.state) {
    const updatedState = applyGradingToYDoc(new Uint8Array(collabDoc.state), matched);
    await collaborativeDocumentRepository.saveDocumentState(
      formId,
      Buffer.from(updatedState),
      (name) => `collab-${name}`
    );
  } else {
    formUpdateData.formSchema = applyGradingToPlainSchema(form.formSchema, matched);
  }

  // Settings (and formSchema, when there was no live Y.doc) first...
  await prisma.form.update({ where: { id: formId }, data: formUpdateData });

  // ...the idempotency marker last, only once the data it describes is
  // actually durable. A crash between these two steps just means the next
  // run recomputes and re-applies the (already-correct, idempotent) writes
  // above before finally reaching this stamp.
  await prisma.formPlugin.update({
    where: { id: primary.id },
    data: {
      enabled: false,
      config: { ...(config as Record<string, unknown>), migratedToNativeAt: new Date().toISOString() },
    },
  });
};

export const processForm = async (
  formId: string,
  opts: { apply: boolean; snapshotDir: string }
): Promise<FormMigrationReport> => {
  const form = await prisma.form.findUnique({
    where: { id: formId },
    select: { id: true, title: true, formSchema: true, settings: true },
  });

  if (!form) {
    return {
      formId,
      formTitle: '(form not found)',
      status: 'not-found',
      matchedFieldIds: [],
      unmatchedFieldIds: [],
      staleOptionFields: [],
      extraInstancePluginIds: [],
      needsReview: true,
      error: `Form ${formId} not found (deleted?)`,
    };
  }

  const quizPlugins = await prisma.formPlugin.findMany({
    where: { formId, type: QUIZ_GRADING_PLUGIN_TYPE },
    orderBy: { createdAt: 'asc' },
  });

  const alreadyMigrated = quizPlugins.find(isMigrated);
  if (alreadyMigrated) {
    return {
      formId,
      formTitle: form.title,
      status: 'already-migrated',
      primaryPluginId: alreadyMigrated.id,
      matchedFieldIds: [],
      unmatchedFieldIds: [],
      staleOptionFields: [],
      extraInstancePluginIds: quizPlugins.filter((p) => p.id !== alreadyMigrated.id).map((p) => p.id),
      // Still flagged if a sibling instance was never resolved by a human.
      needsReview: quizPlugins.length > 1,
    };
  }

  const primary = quizPlugins.find((p) => p.enabled);
  if (!primary) {
    return {
      formId,
      formTitle: form.title,
      status: 'no-enabled-instance',
      matchedFieldIds: [],
      unmatchedFieldIds: [],
      staleOptionFields: [],
      extraInstancePluginIds: quizPlugins.map((p) => p.id),
      needsReview: true,
    };
  }

  const config = primary.config as unknown as QuizGradingPluginConfig;
  const quizFields = Array.isArray(config?.quizFields) ? config.quizFields : [];

  // Exactly submitResponse's schema resolution (resolvers/responses.ts).
  const liveSchema = (await getFormSchemaFromHocuspocus(formId)) ?? form.formSchema;
  const { matched, unmatchedFieldIds, staleOptionFields } = matchQuizFields(quizFields, liveSchema);
  const extraInstancePluginIds = quizPlugins.filter((p) => p.id !== primary.id).map((p) => p.id);

  const report: FormMigrationReport = {
    formId,
    formTitle: form.title,
    status: matched.length > 0 ? 'migrated' : 'no-fields-matched',
    primaryPluginId: primary.id,
    matchedFieldIds: matched.map((m) => m.fieldId),
    unmatchedFieldIds,
    staleOptionFields,
    extraInstancePluginIds,
    needsReview:
      matched.length === 0 ||
      unmatchedFieldIds.length > 0 ||
      staleOptionFields.length > 0 ||
      extraInstancePluginIds.length > 0,
  };

  // Nothing gradable was found — leave the plugin alone entirely rather than
  // flip settings.quiz.enabled on for a form with zero keyed fields.
  if (matched.length === 0) {
    return report;
  }

  if (opts.apply) {
    report.snapshotPath = await snapshotForm(formId, form, quizPlugins, opts.snapshotDir);
    await applyMigration(formId, form, primary, config, matched);
  }

  return report;
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const getArgValue = (flag: string): string | undefined => {
  const prefix = `${flag}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
};

const logReport = (report: FormMigrationReport): void => {
  const parts = [`form=${report.formId}`, `title="${report.formTitle}"`, `status=${report.status}`];
  if (report.matchedFieldIds.length) parts.push(`matched=[${report.matchedFieldIds.join(',')}]`);
  if (report.unmatchedFieldIds.length) parts.push(`unmatched=[${report.unmatchedFieldIds.join(',')}]`);
  if (report.staleOptionFields.length) {
    parts.push(
      `staleOptions=[${report.staleOptionFields.map((s) => `${s.fieldId}:"${s.correctAnswer}"`).join(',')}]`
    );
  }
  if (report.extraInstancePluginIds.length) {
    parts.push(`extraInstances=[${report.extraInstancePluginIds.join(',')}]`);
  }
  if (report.snapshotPath) parts.push(`snapshot=${report.snapshotPath}`);
  if (report.error) parts.push(`error="${report.error}"`);

  const line = `[migrate-quiz-plugin] ${parts.join(' ')}`;
  if (report.needsReview) {
    logger.warn(line);
  } else {
    logger.info(line);
  }
};

const summarize = (reports: FormMigrationReport[]) => {
  const byStatus: Record<string, number> = {};
  for (const r of reports) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    totalForms: reports.length,
    needsReviewCount: reports.filter((r) => r.needsReview).length,
    byStatus,
  };
};

export const main = async (): Promise<number> => {
  const apply = process.argv.includes('--apply');
  const formIdFilter = getArgValue('--form-id');
  const batchSize = Number(getArgValue('--batch-size') ?? '20') || 20;
  const snapshotDir = path.resolve(process.cwd(), getArgValue('--snapshot-dir') ?? 'quiz-migration-snapshots');

  logger.info(`[migrate-quiz-plugin] Starting (${apply ? 'APPLY' : 'DRY RUN'})...`);
  if (!apply) {
    logger.info('[migrate-quiz-plugin] Dry run — no changes will be written. Pass --apply to write.');
  } else {
    logger.info(`[migrate-quiz-plugin] Snapshots will be written to: ${snapshotDir}`);
  }

  const formIds = formIdFilter
    ? [formIdFilter]
    : (
        await prisma.formPlugin.findMany({
          where: { type: QUIZ_GRADING_PLUGIN_TYPE },
          select: { formId: true },
          distinct: ['formId'],
          orderBy: { formId: 'asc' },
        })
      ).map((p) => p.formId);

  logger.info(`[migrate-quiz-plugin] Found ${formIds.length} form(s) with a quiz-grading plugin instance`);

  const reports: FormMigrationReport[] = [];
  for (let i = 0; i < formIds.length; i += batchSize) {
    const batch = formIds.slice(i, i + batchSize);
    logger.info(
      `[migrate-quiz-plugin] Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(formIds.length / batchSize)} (${batch.length} form(s))`
    );

    for (const formId of batch) {
      try {
        const report = await processForm(formId, { apply, snapshotDir });
        reports.push(report);
        logReport(report);
      } catch (error) {
        const report: FormMigrationReport = {
          formId,
          formTitle: '(error)',
          status: 'error',
          matchedFieldIds: [],
          unmatchedFieldIds: [],
          staleOptionFields: [],
          extraInstancePluginIds: [],
          needsReview: true,
          error: error instanceof Error ? error.message : String(error),
        };
        reports.push(report);
        logger.error(`[migrate-quiz-plugin] Fatal error processing form ${formId}:`, error);
      }
    }
  }

  const summary = summarize(reports);
  logger.info(`[migrate-quiz-plugin] Summary: ${JSON.stringify(summary)}`);
  logger.info(`[migrate-quiz-plugin] Full report:\n${JSON.stringify(reports, null, 2)}`);

  if (!apply) {
    logger.info('[migrate-quiz-plugin] Dry run complete. Re-run with --apply to write these changes.');
  } else {
    logger.info('[migrate-quiz-plugin] Done.');
  }

  return summary.needsReviewCount > 0 ? 1 : 0;
};

const isMainModule = (): boolean => {
  try {
    return process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
};

if (isMainModule()) {
  main()
    .then(async (exitCode) => {
      await prisma.$disconnect();
      process.exit(exitCode);
    })
    .catch(async (error) => {
      logger.error('[migrate-quiz-plugin] Fatal error:', error);
      await prisma.$disconnect();
      process.exit(2);
    });
}
