import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  getFormSchemaFromHocuspocus,
  initializeHocuspocusDocument,
} from '../hocuspocus.js';
import { collaborativeDocumentRepository } from '../../repositories/index.js';

vi.mock('../../repositories/index.js');
vi.mock('../../lib/better-auth.js', () => ({ auth: { api: {} } }));
vi.mock('../../graphql/resolvers/formSharing.js', () => ({
  checkFormAccess: vi.fn(),
  PermissionLevel: { VIEWER: 'VIEWER', EDITOR: 'EDITOR' },
}));
vi.mock('../formMetadataService.js', () => ({
  extractFormStatsFromYDoc: vi.fn(),
  updateFormMetadata: vi.fn(),
}));

const validRule = {
  id: 'rule-1',
  enabled: true,
  combinator: 'all' as const,
  terms: [{ fieldId: 'field-a', operator: 'equals' as const, value: 'Yes' }],
  actions: [{ type: 'hideField' as const, fieldIds: ['field-b'] }],
};

// Build a Y.Doc state the way the builder/init path stores a form schema
const buildDocState = (conditions?: unknown[]): Buffer => {
  const doc = new Y.Doc();
  const formSchemaMap = doc.getMap('formSchema');

  const pagesArray = new Y.Array();
  const pageMap = new Y.Map();
  pageMap.set('id', 'page-1');
  pageMap.set('title', 'Page 1');
  pageMap.set('order', 0);
  const fieldsArray = new Y.Array();
  const fieldMap = new Y.Map();
  fieldMap.set('id', 'field-a');
  fieldMap.set('type', 'text_input_field');
  fieldMap.set('label', 'Field A');
  fieldsArray.push([fieldMap]);
  pageMap.set('fields', fieldsArray);
  pagesArray.push([pageMap]);
  formSchemaMap.set('pages', pagesArray);

  formSchemaMap.set('layout', new Y.Map());
  formSchemaMap.set('isShuffleEnabled', false);

  if (conditions) {
    const conditionsArray = new Y.Array();
    conditionsArray.push(conditions as any[]);
    formSchemaMap.set('conditions', conditionsArray);
  }

  const state = Buffer.from(Y.encodeStateAsUpdate(doc));
  doc.destroy();
  return state;
};

describe('hocuspocus conditions sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFormSchemaFromHocuspocus', () => {
    it('includes valid conditions from the Y.Doc', async () => {
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        state: buildDocState([validRule]),
      } as any);

      const schema = await getFormSchemaFromHocuspocus('form-1');
      expect(schema.conditions).toEqual([validRule]);
      expect(schema.pages).toHaveLength(1);
    });

    it('omits conditions when the Y.Doc has none (back-compat)', async () => {
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        state: buildDocState(),
      } as any);

      const schema = await getFormSchemaFromHocuspocus('form-1');
      expect('conditions' in schema).toBe(false);
    });

    it('drops malformed rules and keeps valid ones', async () => {
      vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
        state: buildDocState([
          { id: 'broken', enabled: true },
          validRule,
        ]),
      } as any);

      const schema = await getFormSchemaFromHocuspocus('form-1');
      expect(schema.conditions).toEqual([validRule]);
    });
  });

  describe('initializeHocuspocusDocument', () => {
    it('writes conditions into the stored Y.Doc state', async () => {
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockResolvedValue(
        undefined as any
      );

      await initializeHocuspocusDocument('form-1', {
        pages: [{ id: 'page-1', title: 'Page 1', order: 0, fields: [] }],
        layout: {},
        isShuffleEnabled: false,
        conditions: [validRule],
      });

      const [, stateBuffer] = vi.mocked(
        collaborativeDocumentRepository.saveDocumentState
      ).mock.calls[0];
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(stateBuffer as Buffer));
      const conditions = doc.getMap('formSchema').get('conditions') as Y.Array<any>;
      expect(conditions.toJSON()).toEqual([validRule]);
      doc.destroy();
    });

    it('writes no conditions key when the schema has none', async () => {
      vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockResolvedValue(
        undefined as any
      );

      await initializeHocuspocusDocument('form-2', {
        pages: [],
        layout: {},
        isShuffleEnabled: false,
      });

      const [, stateBuffer] = vi.mocked(
        collaborativeDocumentRepository.saveDocumentState
      ).mock.calls[0];
      const doc = new Y.Doc();
      Y.applyUpdate(doc, new Uint8Array(stateBuffer as Buffer));
      expect(doc.getMap('formSchema').has('conditions')).toBe(false);
      doc.destroy();
    });
  });
});
