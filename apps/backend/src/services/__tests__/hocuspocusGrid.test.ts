/**
 * Grid Layout Phase 1b: grid layout survives Hocuspocus (JSON -> Y.Doc -> reconstructed schema)
 * and comes back canonical. Read side never writes back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { buildPageTree, deserializeFormSchema, isLayoutField, type GridField } from '@dculus/types';
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

const validation = (type: string, required = false) => ({ required, type });
const text = (id: string, extra: object = {}) => ({
  id,
  type: 'text_input_field',
  label: id,
  validation: validation('text_input_field'),
  ...extra,
});

const schemaOf = (fields: unknown[]) => ({
  pages: [{ id: 'page-1', title: 'P', order: 0, showPageName: true, fields }],
  layout: { theme: 'light' },
  isShuffleEnabled: false,
});

let savedState: Buffer;

const seed = async (schema: object) => {
  vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockImplementation(
    async (_name: string, state: Buffer) => {
      savedState = state;
      return undefined as never;
    }
  );
  await initializeHocuspocusDocument('form-grid', schema);
  vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
    state: savedState,
  } as never);
};

const docJson = () => {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(savedState));
  return doc.getMap('formSchema').toJSON().pages[0].fields as ({ id: string } & Record<string, any>)[];
};
const ids = (fields: { id: string }[]) => fields.map((f) => f.id);

beforeEach(() => vi.clearAllMocks());

describe('initializeHocuspocusDocument with a grid', () => {
  const fields = [
    text('cText', { gridId: 'g1', gridColumn: 1 }),
    { id: 'g1', type: 'grid_field', columnWidths: [30, 70], gridId: 'ignored', gridColumn: 3 },
    { id: 'cRich', type: 'rich_text_field', content: '<p>x</p>', gridId: 'g1', gridColumn: 0 },
    {
      id: 'cFile',
      type: 'file_upload_field',
      label: 'File',
      validation: validation('file_upload_field'),
      gridId: 'g1',
      gridColumn: 0,
    },
    text('top'),
    { id: 'gDeleted', type: 'grid_field', columnWidths: [50, 50], deleted: true },
  ];

  it('stores a grid as a plain widths array with no validation map, and ignores gridId on it', async () => {
    await seed(schemaOf(fields));
    const grid = docJson().find((f) => f.id === 'g1')!;
    expect(grid.columnWidths).toEqual([30, 70]);
    expect(grid.validation).toBeUndefined();
    expect(grid.gridId).toBeUndefined();
    expect(grid.gridColumn).toBeUndefined();
  });

  it('writes the pointers on every kind of child', async () => {
    await seed(schemaOf(fields));
    const stored = docJson();
    for (const id of ['cText', 'cRich', 'cFile']) {
      const f = stored.find((x) => x.id === id)!;
      expect(f.gridId).toBe('g1');
      expect(typeof f.gridColumn).toBe('number');
    }
  });

  it('keeps the deleted flag on a grid', async () => {
    await seed(schemaOf(fields));
    expect(docJson().find((f) => f.id === 'gDeleted')!.deleted).toBe(true);
  });

  it('writes no layout keys on a field without a grid (R2)', async () => {
    await seed(schemaOf(fields));
    const top = docJson().find((f) => f.id === 'top')!;
    expect(Object.keys(top)).not.toContain('gridId');
    expect(Object.keys(top)).not.toContain('gridColumn');
  });

  it('repairs invalid widths when seeding', async () => {
    await seed(schemaOf([{ id: 'g', type: 'grid_field', columnWidths: [90, 90] }]));
    expect(docJson()[0].columnWidths).toEqual([50, 50]);
  });
});

describe('getFormSchemaFromHocuspocus with a grid', () => {
  it('returns the grid and pointers, in canonical order (I5)', async () => {
    await seed(
      schemaOf([
        text('cText', { gridId: 'g1', gridColumn: 1 }),
        { id: 'g1', type: 'grid_field', columnWidths: [30, 70] },
        { id: 'cRich', type: 'rich_text_field', content: '<p>x</p>', gridId: 'g1', gridColumn: 0 },
        text('cB', { gridId: 'g1', gridColumn: 0 }),
        text('top'),
      ])
    );
    const schema = await getFormSchemaFromHocuspocus('form-grid');
    const fields = schema.pages[0].fields;
    expect(ids(fields)).toEqual(['g1', 'cRich', 'cB', 'cText', 'top']);
    expect(fields[0]).toMatchObject({ type: 'grid_field', columnWidths: [30, 70] });
    expect(fields[1]).toMatchObject({ gridId: 'g1', gridColumn: 0 });
    expect(fields[3]).toMatchObject({ gridId: 'g1', gridColumn: 1 });
    expect(Object.keys(fields[4])).not.toContain('gridId');
  });

  it('is read-only: the stored document keeps its original order', async () => {
    await seed(
      schemaOf([text('c', { gridId: 'g1', gridColumn: 0 }), { id: 'g1', type: 'grid_field', columnWidths: [50, 50] }])
    );
    await getFormSchemaFromHocuspocus('form-grid');
    expect(ids(docJson())).toEqual(['c', 'g1']);
  });

  it('keeps a soft-deleted grid flagged and leaves its children where they are (I2)', async () => {
    await seed(
      schemaOf([
        { id: 'gd', type: 'grid_field', columnWidths: [50, 50], deleted: true },
        text('c', { gridId: 'gd', gridColumn: 0 }),
      ])
    );
    const fields = (await getFormSchemaFromHocuspocus('form-grid')).pages[0].fields;
    expect(ids(fields)).toEqual(['gd', 'c']);
    expect(fields[0].deleted).toBe(true);
  });

  it('accepts widths stored as a Y.Array by an older writer', async () => {
    const doc = new Y.Doc();
    const formSchema = doc.getMap('formSchema');
    const pages = new Y.Array<Y.Map<any>>();
    formSchema.set('pages', pages);
    const page = new Y.Map();
    page.set('id', 'page-1');
    page.set('title', 'P');
    page.set('order', 0);
    const fieldsArray = new Y.Array<Y.Map<any>>();
    const grid = new Y.Map();
    grid.set('id', 'g');
    grid.set('type', 'grid_field');
    const widths = new Y.Array<number>();
    grid.set('columnWidths', widths);
    widths.push([25, 75]);
    fieldsArray.push([grid]);
    page.set('fields', fieldsArray);
    pages.push([page]);
    vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
      state: Buffer.from(Y.encodeStateAsUpdate(doc)),
    } as never);

    const schema = await getFormSchemaFromHocuspocus('form-grid');
    expect(schema.pages[0].fields[0].columnWidths).toEqual([25, 75]);
  });
});

describe('round trip: JSON -> Y.Doc -> reconstruct -> deserialize', () => {
  const children: Record<string, object> = {
    text_input_field: { validation: validation('text_input_field') },
    text_area_field: { validation: validation('text_area_field') },
    email_field: { validation: validation('email_field') },
    number_field: { validation: validation('number_field'), min: 1, max: 9 },
    date_field: { validation: validation('date_field') },
    select_field: { options: ['a', 'b'], validation: validation('select_field') },
    radio_field: { options: ['a', 'b'], validation: validation('radio_field') },
    checkbox_field: { options: ['a', 'b'], validation: validation('checkbox_field') },
    file_upload_field: { validation: validation('file_upload_field') },
    phone_number_field: { validation: validation('phone_number_field') },
    rich_text_field: { content: '<p>x</p>' },
  };

  it('keeps a grid with every field type as a child', async () => {
    const fields: unknown[] = [{ id: 'g', type: 'grid_field', columnWidths: [40, 60] }];
    Object.entries(children).forEach(([type, extra], i) => {
      fields.push({ id: `c-${type}`, type, label: type, ...extra, gridId: 'g', gridColumn: i % 2 });
    });
    await seed(schemaOf(fields));

    const reconstructed = await getFormSchemaFromHocuspocus('form-grid');
    const schema = deserializeFormSchema(reconstructed);
    const page = schema.pages[0].fields;

    expect(page).toHaveLength(fields.length);
    const grid = page[0] as GridField;
    expect(isLayoutField(grid)).toBe(true);
    expect(grid.columnWidths).toEqual([40, 60]);

    const tree = buildPageTree(page);
    expect(tree).toHaveLength(1);
    const node = tree[0];
    if (node.kind !== 'grid') throw new Error('expected a grid node');
    expect(node.columns.map((c) => c.widthPercent)).toEqual([40, 60]);
    expect(node.columns.flatMap((c) => c.fields.map((f) => f.type)).sort()).toEqual(Object.keys(children).sort());
  });
});
