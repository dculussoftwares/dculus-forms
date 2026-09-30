/**
 * Phase 0c golden baseline (docs/grid-layout-strategy.md §15.5): the Y.Doc
 * JSON after every structural store action, on a grid-less form. Later grid
 * phases must leave these snapshots byte-identical (R2/R4). Do not edit the
 * assertions or update the snapshots in a grid PR.
 */
jest.unmock('@dculus/types');
jest.unmock('zustand');
jest.mock('../../../lib/config', () => ({ getWebSocketUrl: () => '' }));
jest.mock('../../../lib/auth-client', () => ({ getBearerToken: () => '' }));

// Ids are random in production; a counter keeps the snapshots stable.
jest.mock('@dculus/utils', () => {
  let counter = 0;
  return {
    ...jest.requireActual('@dculus/utils'),
    generateRandomString: (length: number) => String(++counter).padStart(length, '0'),
  };
});

import * as Y from 'yjs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
import { FieldType, TextInputField, TextFieldValidation } from '@dculus/types';
import { createYJSFieldMap } from '../../helpers/fieldHelpers';
import type { FieldData } from '../../collaboration/CollaborationManager';
import { createFieldsSlice } from '../fieldsSlice';
import { createPagesSlice } from '../pagesSlice';

const field = (overrides: Partial<FieldData>): FieldData => ({
  id: 'f',
  type: FieldType.TEXT_INPUT_FIELD,
  label: 'Question',
  required: false,
  placeholder: '',
  defaultValue: '',
  prefix: '',
  hint: '',
  ...overrides,
});

const page = (id: string, title: string, order: number, fields: FieldData[], deletedIds: string[] = []) => {
  const pageMap = new Y.Map();
  pageMap.set('id', id);
  pageMap.set('title', title);
  pageMap.set('order', order);
  const fieldsArray = new Y.Array<Y.Map<any>>();
  fields.forEach((data) => {
    const map = createYJSFieldMap(data);
    if (deletedIds.includes(data.id)) map.set('deleted', true);
    fieldsArray.push([map]);
  });
  pageMap.set('fields', fieldsArray);
  return pageMap;
};

const ydoc = new Y.Doc();
const formSchema = ydoc.getMap('formSchema');
const pagesArray = new Y.Array<Y.Map<any>>();
formSchema.set('pages', pagesArray);
pagesArray.push([
  page(
    'p1',
    'Page One',
    0,
    [
      field({ id: 'fA', label: 'Name' }),
      field({ id: 'fB', type: FieldType.EMAIL_FIELD, label: 'Email', required: true }),
      field({ id: 'fC', type: FieldType.NUMBER_FIELD, label: 'Removed earlier' }),
      field({ id: 'fD', type: FieldType.NUMBER_FIELD, label: 'Age', min: 1, max: 99 }),
      field({ id: 'fE', type: FieldType.RICH_TEXT_FIELD, label: '', content: '<p>Intro</p>' } as any),
    ],
    ['fC']
  ),
  page('p2', 'Page Two', 1, [
    field({ id: 'fF', type: FieldType.CHECKBOX_FIELD, label: 'Colours', options: ['Red', 'Blue'] }),
    field({ id: 'fG', type: FieldType.RADIO_FIELD, label: 'Size', options: ['S', 'M', 'L'] }),
    field({ id: 'fH', type: FieldType.DATE_FIELD, label: 'When' }),
  ]),
]);

const store = create<any>()((set, get) => ({
  _getYDoc: () => ydoc,
  _isYJSReady: () => true,
  selectedPageId: null,
  setSelectedPage: () => undefined,
  ...createFieldsSlice(set, get),
  ...createPagesSlice(set, get),
  // After the spreads: the pages slice initialises `pages: []`. removePage refuses to run with < 2 pages.
  pages: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
}));
const act = () => store.getState();
const snap = () => formSchema.toJSON();
const visibleIds = (pageId: string) =>
  (pagesArray.toArray().find((p) => p.get('id') === pageId)!.get('fields') as Y.Array<Y.Map<any>>)
    .toArray()
    .filter((f) => f.get('deleted') !== true)
    .map((f) => f.get('id'));

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

// One scenario: every step runs on the document left by the previous one, so it must run as a
// unit. Each step gets a named snapshot; splitting it into separate tests would make `-t` runs
// snapshot the wrong document.
test('structural store actions on a grid-less form (golden)', () => {
  const step = (name: string, run: () => void = () => undefined) => {
    run();
    expect(snap()).toMatchSnapshot(name);
  };

  step('0. seed document');

  step('addField appends', () => {
    act().addField('p1', FieldType.TEXT_AREA_FIELD, { label: 'Comments' });
  });

  step('addField appends rich text with its content', () => {
    act().addField('p1', FieldType.RICH_TEXT_FIELD, { content: '<p>Hello</p>' } as any);
  });

  step('addFieldAtIndex lands in the visual slot when a soft-deleted field precedes it', () => {
    // Visible order is A, B, D, ...; slot 2 is between B and D, after the soft-deleted fC.
    act().addFieldAtIndex('p1', FieldType.SELECT_FIELD, { label: 'Inserted', options: ['x'] }, 2);
    expect(visibleIds('p1').slice(0, 4)).toEqual(['fA', 'fB', expect.any(String), 'fD']);
  });

  step('reorderFields', () => act().reorderFields('p1', 0, 2));
  step('duplicateField', () => act().duplicateField('p1', 'fB'));
  step('convertFieldType', () => act().convertFieldType('p1', 'fA', FieldType.TEXT_AREA_FIELD));
  step('removeField soft-deletes', () => act().removeField('p1', 'fD'));

  step('restoreField flips the deleted flag back', () => {
    const restored = new TextInputField('fD', 'Age', '', '', '', '', new TextFieldValidation(false));
    act().restoreField('p1', restored, 1);
  });

  step('moveFieldBetweenPages', () => act().moveFieldBetweenPages('p1', 'p2', 'fA', 1));
  step('copyFieldToPage', () => act().copyFieldToPage('p2', 'p1', 'fG'));
  step('addEmptyPage', () => act().addEmptyPage());
  step('addPageAtPosition', () => act().addPageAtPosition('Inserted Page', 'p1', 'p9'));
  step('duplicatePage', () => act().duplicatePage('p2'));

  step('updatePageTitle / updatePageShowName', () => {
    act().updatePageTitle('p1', 'Renamed');
    act().updatePageShowName('p1', false);
  });

  step('reorderPages', () => act().reorderPages(0, 2));
  step('removePage', () => act().removePage('p9'));
});
