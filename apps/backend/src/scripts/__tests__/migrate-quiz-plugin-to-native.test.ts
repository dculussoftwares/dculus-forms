import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    form: { findUnique: vi.fn(), update: vi.fn() },
    formPlugin: { findMany: vi.fn(), update: vi.fn() },
    $disconnect: vi.fn(),
  },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../repositories/index.js', () => ({
  collaborativeDocumentRepository: {
    fetchDocumentWithState: vi.fn(),
    saveDocumentState: vi.fn(),
  },
}));
vi.mock('../../lib/better-auth.js');
vi.mock('../../graphql/resolvers/formSharing.js');
vi.mock('../../services/formMetadataService.js');

// The mocked module (see vi.mock above) is a plain object of vi.fn()s, but
// the real `prisma` export carries Prisma's branded PrismaPromise return
// types — cast once here so mockResolvedValue/mockImplementation calls below
// don't have to fight that typing.
import { prisma as typedPrisma } from '../../lib/prisma.js';
const prisma = typedPrisma as unknown as {
  form: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  formPlugin: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};
import { collaborativeDocumentRepository } from '../../repositories/index.js';
import { getFormSchemaFromHocuspocus } from '../../services/hocuspocus.js';
import {
  processForm,
  matchQuizFields,
  applyGradingToPlainSchema,
} from '../migrate-quiz-plugin-to-native.js';
import { QUIZ_GRADING_PLUGIN_TYPE } from '../../plugins/quiz/types.js';

// ---------------------------------------------------------------------------
// Y.doc fixture builder — mirrors initializeHocuspocusDocument's shape closely
// enough for getFormSchemaFromHocuspocus / applyGradingToYDoc to round-trip.
// ---------------------------------------------------------------------------

interface FixtureField {
  id: string;
  type: string;
  label: string;
  options?: string[];
  deleted?: boolean;
}

function buildYDocState(fields: FixtureField[]): Uint8Array {
  const doc = new Y.Doc();
  const formSchemaMap = doc.getMap('formSchema');
  const pagesArray = new Y.Array<Y.Map<any>>();
  const pageMap = new Y.Map();
  pageMap.set('id', 'page-1');
  pageMap.set('title', 'Page 1');
  pageMap.set('order', 0);
  pageMap.set('showPageName', true);

  const fieldsArray = new Y.Array<Y.Map<any>>();
  for (const f of fields) {
    const fieldMap = new Y.Map();
    fieldMap.set('id', f.id);
    fieldMap.set('type', f.type);
    fieldMap.set('label', f.label);
    fieldMap.set('defaultValue', '');
    fieldMap.set('prefix', '');
    fieldMap.set('hint', '');
    const validationMap = new Y.Map();
    validationMap.set('required', false);
    validationMap.set('type', f.type);
    fieldMap.set('validation', validationMap);
    if (f.options) {
      const optionsArray = new Y.Array<string>();
      f.options.forEach((o) => optionsArray.push([o]));
      fieldMap.set('options', optionsArray);
    }
    if (f.deleted) fieldMap.set('deleted', true);
    fieldsArray.push([fieldMap]);
  }
  pageMap.set('fields', fieldsArray);
  pagesArray.push([pageMap]);

  formSchemaMap.set('pages', pagesArray);
  formSchemaMap.set('layout', new Y.Map());
  formSchemaMap.set('isShuffleEnabled', false);

  const state = Y.encodeStateAsUpdate(doc);
  doc.destroy();
  return state;
}

const quizFieldConfig = (fieldId: string, correctAnswer: string, marks = 10) => ({
  fieldId,
  fieldLabel: `Field ${fieldId}`,
  correctAnswer,
  marks,
});

describe('migrate-quiz-plugin-to-native', () => {
  // In-memory "CollaborativeDocument" row, mutated by saveDocumentState so
  // apply -> re-read round-trips can be verified against the real
  // getFormSchemaFromHocuspocus reconstruction path.
  let collabState: Uint8Array | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    collabState = null;

    vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockImplementation(async () =>
      collabState ? ({ state: Buffer.from(collabState) } as any) : null
    );
    vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockImplementation(
      async (_name: string, state: Buffer) => {
        collabState = new Uint8Array(state);
        return {} as any;
      }
    );
  });

  describe('matchQuizFields (pure)', () => {
    const schema = {
      pages: [
        {
          fields: [
            { id: 'f1', type: 'radio_field', options: ['A', 'B', 'C'] },
            { id: 'f2', type: 'radio_field', options: ['X', 'Y'], deleted: true },
            { id: 'f3', type: 'text_input_field' },
          ],
        },
      ],
    };

    it('matches a clean field and builds exact-mode grading', () => {
      const result = matchQuizFields([quizFieldConfig('f1', 'B', 5)], schema);
      expect(result.matched).toEqual([
        { fieldId: 'f1', grading: { mode: 'exact', pointValue: 5, acceptedAnswers: ['B'] } },
      ]);
      expect(result.unmatchedFieldIds).toEqual([]);
      expect(result.staleOptionFields).toEqual([]);
    });

    it('reports a deleted field as unmatched, never guessing', () => {
      const result = matchQuizFields([quizFieldConfig('f2', 'X')], schema);
      expect(result.matched).toEqual([]);
      expect(result.unmatchedFieldIds).toEqual(['f2']);
    });

    it('reports a missing field as unmatched', () => {
      const result = matchQuizFields([quizFieldConfig('ghost', 'A')], schema);
      expect(result.unmatchedFieldIds).toEqual(['ghost']);
    });

    it('reports a renamed option as stale rather than matching', () => {
      const result = matchQuizFields([quizFieldConfig('f1', 'NoLongerAnOption')], schema);
      expect(result.matched).toEqual([]);
      expect(result.staleOptionFields).toEqual([{ fieldId: 'f1', correctAnswer: 'NoLongerAnOption' }]);
    });

    it('matches option-less fields (text/number) without an options check', () => {
      const result = matchQuizFields([quizFieldConfig('f3', 'hello')], schema);
      expect(result.matched).toEqual([
        { fieldId: 'f3', grading: { mode: 'exact', pointValue: 10, acceptedAnswers: ['hello'] } },
      ]);
    });
  });

  describe('processForm — clean form (Y.doc present)', () => {
    it('dry-run matches the field and writes nothing', async () => {
      collabState = buildYDocState([{ id: 'f1', type: 'radio_field', label: 'Q1', options: ['A', 'B'] }]);

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-1',
        title: 'Clean Quiz',
        formSchema: { pages: [] },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-1',
          formId: 'form-1',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f1', 'A')], passThreshold: 60 },
          createdAt: new Date('2024-01-01'),
        } as any,
      ]);

      const report = await processForm('form-1', { apply: false, snapshotDir: '/tmp/x' });

      expect(report.status).toBe('migrated');
      expect(report.matchedFieldIds).toEqual(['f1']);
      expect(report.needsReview).toBe(false);
      expect(prisma.form.update).not.toHaveBeenCalled();
      expect(prisma.formPlugin.update).not.toHaveBeenCalled();
      expect(collaborativeDocumentRepository.saveDocumentState).not.toHaveBeenCalled();
    });

    it('--apply writes grading into the Y.doc such that the builder read path sees it, disables the plugin, and is idempotent on re-run', async () => {
      collabState = buildYDocState([{ id: 'f1', type: 'radio_field', label: 'Q1', options: ['A', 'B'] }]);

      const pluginConfig = {
        type: 'quiz-grading',
        quizFields: [quizFieldConfig('f1', 'A', 7)],
        passThreshold: 75,
      };
      let storedPluginRow: any = {
        id: 'plugin-1',
        formId: 'form-1',
        type: QUIZ_GRADING_PLUGIN_TYPE,
        enabled: true,
        config: pluginConfig,
        createdAt: new Date('2024-01-01'),
      };

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-1',
        title: 'Clean Quiz',
        formSchema: { pages: [] },
        settings: { collectRespondentEmail: true },
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockImplementation(async () => [storedPluginRow]);
      vi.mocked(prisma.form.update).mockImplementation(async ({ data }: any) => {
        // no-op DB row; only settings matter for these assertions
        return { id: 'form-1', ...data } as any;
      });
      vi.mocked(prisma.formPlugin.update).mockImplementation(async ({ data }: any) => {
        storedPluginRow = { ...storedPluginRow, ...data, config: { ...storedPluginRow.config, ...data.config } };
        return storedPluginRow;
      });

      const report = await processForm('form-1', { apply: true, snapshotDir: '/tmp/quiz-migration-test' });

      expect(report.status).toBe('migrated');
      expect(report.snapshotPath).toBeTruthy();

      // Form.settings gets settings.quiz, preserving unrelated existing keys.
      const formUpdateCall = vi.mocked(prisma.form.update).mock.calls[0][0] as any;
      expect(formUpdateCall.data.settings).toEqual({
        collectRespondentEmail: true,
        quiz: {
          enabled: true,
          passThresholdPercent: 75,
          gradeRelease: 'never',
          respondentVisibility: {
            totalScore: false,
            perQuestionCorrectness: false,
            correctAnswers: false,
            pointValues: false,
            feedback: false,
            passFailBadge: false,
          },
        },
      });
      // No live Y.doc write should also touch the formSchema column.
      expect(formUpdateCall.data.formSchema).toBeUndefined();

      // Plugin instance disabled + stamped, never deleted.
      const pluginUpdateCall = vi.mocked(prisma.formPlugin.update).mock.calls[0][0] as any;
      expect(pluginUpdateCall.data.enabled).toBe(false);
      expect(pluginUpdateCall.data.config.migratedToNativeAt).toEqual(expect.any(String));
      expect(pluginUpdateCall.data.config.quizFields).toEqual(pluginConfig.quizFields);

      // THE acceptance test: read the schema back through the exact same
      // function the builder's GraphQL resolver calls, and confirm the
      // answer key is there — proving the Y.doc, not just a DB column, moved.
      const rebuilt = await getFormSchemaFromHocuspocus('form-1');
      const field = rebuilt.pages[0].fields.find((f: any) => f.id === 'f1');
      expect(field.grading).toEqual({ mode: 'exact', pointValue: 7, acceptedAnswers: ['A'] });

      // Re-run: must be a no-op (idempotent).
      vi.mocked(prisma.form.update).mockClear();
      vi.mocked(prisma.formPlugin.update).mockClear();
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockClear();

      const secondReport = await processForm('form-1', { apply: true, snapshotDir: '/tmp/quiz-migration-test' });
      expect(secondReport.status).toBe('already-migrated');
      expect(secondReport.needsReview).toBe(false);
      expect(prisma.form.update).not.toHaveBeenCalled();
      expect(prisma.formPlugin.update).not.toHaveBeenCalled();
      expect(collaborativeDocumentRepository.saveDocumentState).not.toHaveBeenCalled();
    });
  });

  describe('processForm — form with a deleted keyed field', () => {
    it('migrates the still-live field and reports the deleted one, without guessing', async () => {
      collabState = buildYDocState([
        { id: 'f1', type: 'radio_field', label: 'Q1', options: ['A', 'B'] },
        { id: 'f2', type: 'radio_field', label: 'Q2 (deleted)', options: ['A', 'B'], deleted: true },
      ]);

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-2',
        title: 'Quiz With Deleted Field',
        formSchema: { pages: [] },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-2',
          formId: 'form-2',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          config: {
            type: 'quiz-grading',
            quizFields: [quizFieldConfig('f1', 'A'), quizFieldConfig('f2', 'B')],
            passThreshold: 60,
          },
          createdAt: new Date('2024-01-01'),
        } as any,
      ]);

      const report = await processForm('form-2', { apply: false, snapshotDir: '/tmp/x' });

      expect(report.matchedFieldIds).toEqual(['f1']);
      expect(report.unmatchedFieldIds).toEqual(['f2']);
      expect(report.needsReview).toBe(true);
    });
  });

  describe('processForm — form with a renamed option', () => {
    it('flags the field as a stale option instead of matching or dropping silently', async () => {
      collabState = buildYDocState([{ id: 'f1', type: 'radio_field', label: 'Q1', options: ['Paris', 'London'] }]);

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-3',
        title: 'Quiz With Renamed Option',
        formSchema: { pages: [] },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-3',
          formId: 'form-3',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          // Original correct answer "Berlin" was renamed to something else.
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f1', 'Berlin')], passThreshold: 60 },
          createdAt: new Date('2024-01-01'),
        } as any,
      ]);

      const report = await processForm('form-3', { apply: false, snapshotDir: '/tmp/x' });

      expect(report.matchedFieldIds).toEqual([]);
      expect(report.staleOptionFields).toEqual([{ fieldId: 'f1', correctAnswer: 'Berlin' }]);
      expect(report.status).toBe('no-fields-matched');
      expect(report.needsReview).toBe(true);
    });
  });

  describe('processForm — form with two quiz plugin instances', () => {
    it('migrates only the first enabled instance and flags the other for manual review', async () => {
      collabState = buildYDocState([
        { id: 'f1', type: 'radio_field', label: 'Q1', options: ['A', 'B'] },
        { id: 'f2', type: 'radio_field', label: 'Q2', options: ['A', 'B'] },
      ]);

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-4',
        title: 'Quiz With Two Instances',
        formSchema: { pages: [] },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-4a',
          formId: 'form-4',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f1', 'A')], passThreshold: 60 },
          createdAt: new Date('2024-01-01'),
        } as any,
        {
          id: 'plugin-4b',
          formId: 'form-4',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f2', 'B')], passThreshold: 80 },
          createdAt: new Date('2024-02-01'),
        } as any,
      ]);

      const report = await processForm('form-4', { apply: false, snapshotDir: '/tmp/x' });

      expect(report.primaryPluginId).toBe('plugin-4a');
      expect(report.matchedFieldIds).toEqual(['f1']);
      expect(report.extraInstancePluginIds).toEqual(['plugin-4b']);
      expect(report.needsReview).toBe(true);

      // The second instance must be left completely untouched.
      expect(prisma.formPlugin.update).not.toHaveBeenCalled();
    });
  });

  describe('processForm — no CollaborativeDocument row (DB column only)', () => {
    it('writes grading into Form.formSchema directly, since no live Y.doc can clobber it', async () => {
      collabState = null; // never materialized in the builder

      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-5',
        title: 'Never Opened In Builder',
        formSchema: {
          pages: [{ fields: [{ id: 'f1', type: 'radio_field', options: ['A', 'B'] }] }],
        },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-5',
          formId: 'form-5',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: true,
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f1', 'A')], passThreshold: 60 },
          createdAt: new Date('2024-01-01'),
        } as any,
      ]);
      vi.mocked(prisma.form.update).mockResolvedValue({} as any);
      vi.mocked(prisma.formPlugin.update).mockResolvedValue({} as any);

      await processForm('form-5', { apply: true, snapshotDir: '/tmp/quiz-migration-test' });

      const formUpdateCall = vi.mocked(prisma.form.update).mock.calls[0][0] as any;
      expect(formUpdateCall.data.formSchema.pages[0].fields[0].grading).toEqual({
        mode: 'exact',
        pointValue: 10,
        acceptedAnswers: ['A'],
      });
      expect(collaborativeDocumentRepository.saveDocumentState).not.toHaveBeenCalled();
    });
  });

  describe('processForm — form with no enabled quiz plugin instance', () => {
    it('reports no-enabled-instance and touches nothing', async () => {
      collabState = null;
      vi.mocked(prisma.form.findUnique).mockResolvedValue({
        id: 'form-6',
        title: 'All Disabled',
        formSchema: { pages: [] },
        settings: null,
      } as any);
      vi.mocked(prisma.formPlugin.findMany).mockResolvedValue([
        {
          id: 'plugin-6',
          formId: 'form-6',
          type: QUIZ_GRADING_PLUGIN_TYPE,
          enabled: false,
          config: { type: 'quiz-grading', quizFields: [quizFieldConfig('f1', 'A')], passThreshold: 60 },
          createdAt: new Date('2024-01-01'),
        } as any,
      ]);

      const report = await processForm('form-6', { apply: true, snapshotDir: '/tmp/x' });

      expect(report.status).toBe('no-enabled-instance');
      expect(report.needsReview).toBe(true);
      expect(prisma.form.update).not.toHaveBeenCalled();
      expect(prisma.formPlugin.update).not.toHaveBeenCalled();
    });
  });

  describe('applyGradingToPlainSchema (pure)', () => {
    it('only mutates matched fields and clones rather than mutating the input', () => {
      const original = { pages: [{ fields: [{ id: 'f1', type: 'radio_field' }, { id: 'f2', type: 'radio_field' }] }] };
      const result = applyGradingToPlainSchema(original, [
        { fieldId: 'f1', grading: { mode: 'exact', pointValue: 1, acceptedAnswers: ['A'] } },
      ]);

      expect(result.pages[0].fields[0].grading).toEqual({ mode: 'exact', pointValue: 1, acceptedAnswers: ['A'] });
      expect(result.pages[0].fields[1].grading).toBeUndefined();
      expect((original.pages[0].fields[0] as any).grading).toBeUndefined();
    });
  });
});
