/**
 * Unit tests for the generalized builder selection added for #228 (journey rail):
 * selection.kind ('intro' | 'page' | 'field' | 'thankYou') plus the compatible
 * selectedPageId/selectedFieldId derived state existing consumers (FormArea,
 * RightSidebar, FieldSettingsV2, drag handlers) still read directly.
 *
 * src/setupTests.ts globally mocks 'zustand' for component tests that stub the
 * whole store — opt back into the real implementation here, same pattern as
 * automationBuilderSlice.test.ts.
 *
 * This builds a minimal store (bare `pages` state + selectionSlice only) instead
 * of importing the real useFormBuilderStore or pagesSlice — both transitively
 * pull in `import.meta.env` (Vite-only, via lib/config.ts) which ts-jest can't
 * parse. Pages are seeded directly via `setState` rather than pagesSlice's
 * YJS-backed actions, which this suite doesn't need.
 */
jest.unmock('zustand');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { create } = require('zustand') as typeof import('zustand');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSelectionSlice } = require('../selectionSlice') as typeof import('../selectionSlice');

const useFormBuilderStore = create<any>()((set, get) => ({
  pages: [],
  ...createSelectionSlice(set, get),
  resetBuilder: () =>
    set({ selection: { kind: 'page' }, selectedPageId: null, selectedFieldId: null }),
}));

const page1Field1 = { id: 'field-1', type: 'text_input_field', label: 'Name' };
const page1Field2 = { id: 'field-2', type: 'email_field', label: 'Email' };
const page2Field1 = { id: 'field-3', type: 'number_field', label: 'Age' };

const seedPages = () => {
  useFormBuilderStore.setState({
    pages: [
      { id: 'page-1', title: 'Page 1', order: 0, fields: [page1Field1, page1Field2] },
      { id: 'page-2', title: 'Page 2', order: 1, fields: [page2Field1] },
    ] as any,
  });
};

beforeEach(() => {
  useFormBuilderStore.getState().resetBuilder();
  useFormBuilderStore.setState({ pages: [] as any });
});

describe('selectionSlice — setSelection (master API)', () => {
  test('intro/thankYou kinds clear the derived page/field ids', () => {
    seedPages();
    useFormBuilderStore.getState().setSelection({ kind: 'intro' });
    expect(useFormBuilderStore.getState().selectedPageId).toBeNull();
    expect(useFormBuilderStore.getState().selectedFieldId).toBeNull();

    useFormBuilderStore.getState().setSelection({ kind: 'thankYou' });
    expect(useFormBuilderStore.getState().selectedPageId).toBeNull();
    expect(useFormBuilderStore.getState().selectedFieldId).toBeNull();
  });

  test('page kind derives selectedPageId and clears selectedFieldId', () => {
    seedPages();
    useFormBuilderStore.getState().setSelection({ kind: 'page', pageId: 'page-2' });
    expect(useFormBuilderStore.getState().selectedPageId).toBe('page-2');
    expect(useFormBuilderStore.getState().selectedFieldId).toBeNull();
  });

  test('field kind derives both selectedPageId and selectedFieldId', () => {
    seedPages();
    useFormBuilderStore
      .getState()
      .setSelection({ kind: 'field', pageId: 'page-1', fieldId: 'field-2' });
    expect(useFormBuilderStore.getState().selectedPageId).toBe('page-1');
    expect(useFormBuilderStore.getState().selectedFieldId).toBe('field-2');
  });
});

describe('selectionSlice — setSelectedPage (compatible/derived API)', () => {
  test('plain page selection resets kind to page and drops any field selection', () => {
    seedPages();
    useFormBuilderStore.getState().setSelectedField('field-1'); // kind becomes 'field'
    useFormBuilderStore.getState().setSelectedPage('page-2');

    const state = useFormBuilderStore.getState();
    expect(state.selection).toEqual({ kind: 'page', pageId: 'page-2' });
    expect(state.selectedFieldId).toBeNull();
  });

  test('cross-page field move follows the field via setSelection, not setSelectedPage', () => {
    // fieldsSlice.moveFieldBetweenPages calls setSelection({kind:'field', ...}) itself
    // (rather than the plain setSelectedPage) specifically so a field being dragged to
    // another page stays selected instead of bouncing to a page-level selection.
    seedPages();
    useFormBuilderStore.getState().setSelectedField('field-1'); // selection: field-1 on page-1
    useFormBuilderStore.getState().setSelection({ kind: 'field', fieldId: 'field-1', pageId: 'page-2' });

    const state = useFormBuilderStore.getState();
    expect(state.selection).toEqual({ kind: 'field', fieldId: 'field-1', pageId: 'page-2' });
    expect(state.selectedFieldId).toBe('field-1');
    expect(state.selectedPageId).toBe('page-2');
  });
});

describe('selectionSlice — setSelectedField (compatible/derived API)', () => {
  test('selecting a field resolves its owning page into selection.pageId', () => {
    seedPages();
    useFormBuilderStore.getState().setSelectedField('field-3');

    const state = useFormBuilderStore.getState();
    expect(state.selection).toEqual({ kind: 'field', fieldId: 'field-3', pageId: 'page-2' });
    expect(state.selectedPageId).toBe('page-2');
  });

  test('deselecting (null) falls back to a page-level selection, keeping page context', () => {
    seedPages();
    useFormBuilderStore.getState().setSelectedField('field-2'); // owning page: page-1
    useFormBuilderStore.getState().setSelectedField(null);

    const state = useFormBuilderStore.getState();
    expect(state.selection).toEqual({ kind: 'page', pageId: 'page-1' });
    expect(state.selectedFieldId).toBeNull();
    expect(state.selectedPageId).toBe('page-1');
  });
});

describe('selectionSlice — resetBuilder', () => {
  test('resets selection back to the default page-level state', () => {
    seedPages();
    useFormBuilderStore.getState().setSelection({ kind: 'thankYou' });
    useFormBuilderStore.getState().resetBuilder();

    expect(useFormBuilderStore.getState().selection).toEqual({ kind: 'page' });
    expect(useFormBuilderStore.getState().selectedPageId).toBeNull();
    expect(useFormBuilderStore.getState().selectedFieldId).toBeNull();
  });
});
