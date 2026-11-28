/**
 * Design tokens survive Hocuspocus (JSON -> Y.Doc -> reconstructed schema).
 * Dropping layout.tokens on the Y.js -> DB read would silently strip it from the viewer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { getFormSchemaFromHocuspocus, initializeHocuspocusDocument } from '../hocuspocus.js';
import { collaborativeDocumentRepository } from '../../repositories/index.js';

vi.mock('../../repositories/index.js');
vi.mock('../../lib/better-auth.js', () => ({ auth: { api: {} } }));
vi.mock('../../graphql/resolvers/formSharing.js', () => ({
  checkFormAccess: vi.fn(),
  PermissionLevel: { VIEWER: 'VIEWER', EDITOR: 'EDITOR' },
}));
vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

let savedState: Buffer;

const seed = async (layout: object) => {
  vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockImplementation(
    async (_name: string, state: Buffer) => {
      savedState = state;
      return undefined as never;
    }
  );
  await initializeHocuspocusDocument('form-tokens', { pages: [], layout, isShuffleEnabled: false });
  vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
    state: savedState,
  } as never);
};

const layoutKeys = () => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(savedState));
  return Object.keys(doc.getMap('formSchema').toJSON().layout);
};

beforeEach(() => vi.clearAllMocks());

describe('layout.tokens persistence', () => {
  const tokens = { version: 1, primaryColor: '#2563eb', radius: 'lg', buttonStyle: 'soft' };

  it('round-trips tokens through the Y.Doc', async () => {
    await seed({ theme: 'light', tokens });
    const schema = await getFormSchemaFromHocuspocus('form-tokens');
    expect(schema.layout.tokens).toEqual(tokens);
  });

  it('leaves the key absent for legacy forms', async () => {
    await seed({ theme: 'light' });
    expect(layoutKeys()).not.toContain('tokens');
    const schema = await getFormSchemaFromHocuspocus('form-tokens');
    expect(Object.keys(schema.layout)).not.toContain('tokens');
  });

  it('drops invalid tokens on write and on read', async () => {
    await seed({ theme: 'light', tokens: { version: 1, primaryColor: 'blue', radius: 'huge' } });
    expect(layoutKeys()).not.toContain('tokens');

    await seed({ theme: 'light', tokens });
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(savedState));
    (doc.getMap('formSchema').get('layout') as Y.Map<unknown>).set('tokens', {
      version: 1,
      primaryColor: '#12',
      inputStyle: 'underline',
    });
    savedState = Buffer.from(Y.encodeStateAsUpdate(doc));
    vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
      state: savedState,
    } as never);
    const schema = await getFormSchemaFromHocuspocus('form-tokens');
    expect(schema.layout.tokens).toEqual({ version: 1, inputStyle: 'underline' });
  });
});
