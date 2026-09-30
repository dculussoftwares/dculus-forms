/**
 * Phase 0c golden baseline (docs/grid-layout-strategy.md §15.4/§15.5): a
 * grid-less form seeded through initializeHocuspocusDocument, read back through
 * getFormSchemaFromHocuspocus, and counted by formMetadataService. Later grid
 * phases must leave these snapshots byte-identical (R2/R4); do not update them
 * in a grid PR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import {
  getFormSchemaFromHocuspocus,
  initializeHocuspocusDocument,
} from '../hocuspocus.js';
import { extractFormStatsFromYDoc } from '../formMetadataService.js';
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

const validation = (type: string, required = false, extra: object = {}) => ({
  required,
  type,
  ...extra,
});

// One grid-less form: every field type, two pages, a soft-deleted field, layout, conditions.
const gridlessForm = {
  pages: [
    {
      id: 'page-1',
      title: 'About you',
      order: 0,
      showPageName: true,
      fields: [
        {
          id: 'f-text',
          type: 'text_input_field',
          label: 'Name',
          hint: 'Full name',
          prefix: 'Mr',
          placeholder: 'Jane',
          defaultValue: '',
          validation: validation('text_input_field', true, { minLength: 2, maxLength: 40 }),
        },
        {
          id: 'f-area',
          type: 'text_area_field',
          label: 'Bio',
          validation: validation('text_area_field', false, { maxLength: 500 }),
        },
        {
          id: 'f-email',
          type: 'email_field',
          label: 'Email',
          validation: validation('email_field', true),
        },
        {
          id: 'f-number',
          type: 'number_field',
          label: 'Age',
          min: 1,
          max: 120,
          validation: validation('number_field'),
        },
        {
          id: 'f-date',
          type: 'date_field',
          label: 'Birthday',
          minDate: '1900-01-01',
          maxDate: '2100-01-01',
          validation: validation('date_field'),
        },
        {
          id: 'f-gone',
          type: 'text_input_field',
          label: 'Removed',
          deleted: true,
          validation: validation('text_input_field'),
        },
        { id: 'f-rich', type: 'rich_text_field', content: '<p>Welcome</p>' },
      ],
    },
    {
      id: 'page-2',
      title: 'Preferences',
      order: 1,
      showPageName: false,
      fields: [
        {
          id: 'f-select',
          type: 'select_field',
          label: 'Country',
          options: ['IN', 'US'],
          multiple: true,
          validation: validation('select_field', true),
        },
        {
          id: 'f-radio',
          type: 'radio_field',
          label: 'Size',
          options: ['S', 'M'],
          validation: validation('radio_field'),
        },
        {
          id: 'f-check',
          type: 'checkbox_field',
          label: 'Colours',
          options: ['Red', 'Blue'],
          defaultValues: ['Red'],
          validation: validation('checkbox_field', false, { minSelections: 1, maxSelections: 2 }),
        },
        {
          id: 'f-file',
          type: 'file_upload_field',
          label: 'Resume',
          hint: 'PDF only',
          validation: validation('file_upload_field'),
        },
      ],
    },
  ],
  layout: {
    theme: 'light',
    textColor: '#111111',
    spacing: 'normal',
    code: 'L1',
    content: '<p>Hi</p>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: 'bg/key.png',
    pageMode: 'multipage',
  },
  isShuffleEnabled: false,
};

let savedState: Buffer;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(collaborativeDocumentRepository.saveDocumentState).mockImplementation(
    async (_name: string, state: Buffer) => {
      savedState = state;
      return undefined as never;
    }
  );
  await initializeHocuspocusDocument('form-golden', gridlessForm);
  vi.mocked(collaborativeDocumentRepository.fetchDocumentWithState).mockResolvedValue({
    state: savedState,
  } as never);
});

describe('hocuspocus grid-less round trip (golden)', () => {
  it('seeds this Y.Doc JSON from a grid-less form', () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(savedState));
    expect(doc.getMap('formSchema').toJSON()).toMatchSnapshot();
  });

  it('reconstructs this schema for readers (soft-deleted fields stay flagged)', async () => {
    const schema = await getFormSchemaFromHocuspocus('form-golden');
    expect(schema).toMatchSnapshot();
  });

  it('counts pages and non-deleted fields for FormMetadata', () => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(savedState));
    expect(extractFormStatsFromYDoc(doc)).toMatchSnapshot();
  });
});
