import * as React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import mockEnGridLayout from '../../../../locales/en/gridLayout.json';

jest.unmock('@dculus/types');

const mockSetGridColumnWidths = jest.fn();
const mockDuplicateGrid = jest.fn(() => 'grid-copy');
const mockRemoveGrid = jest.fn(() => ({ gridId: 'g1', fieldIds: ['g1', 'a', 'b'] }));
const mockRestoreGrid = jest.fn(() => true);
const mockSetSelectedField = jest.fn();
const mockToast = jest.fn();
let mockCanEdit = true;

jest.mock('@/store/useFormBuilderStore', () => {
  const storeInstance = {
    selectedFieldId: null,
    setSelectedField: mockSetSelectedField,
    setGridColumnWidths: mockSetGridColumnWidths,
    duplicateGrid: mockDuplicateGrid,
    removeGrid: mockRemoveGrid,
    restoreGrid: mockRestoreGrid,
  };
  const useFormBuilderStore: any = () => storeInstance;
  useFormBuilderStore.getState = () => storeInstance;
  return { useFormBuilderStore };
});

jest.mock('@/hooks/useFormPermissions', () => ({
  useFormPermissions: () => ({
    canEditFields: () => mockCanEdit,
    canReorderFields: () => mockCanEdit,
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { values?: Record<string, unknown>; defaultValue?: string }) => {
      let node: unknown = mockEnGridLayout;
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      if (typeof node !== 'string') return options?.defaultValue ?? key;
      return Object.entries(options?.values ?? {}).reduce(
        (acc, [token, value]) => acc.replace(`{{${token}}}`, String(value)),
        node
      );
    },
  }),
}));

// The real card pulls in the router, quiz context and condition counts; the block only decides what it gets
jest.mock('../PageBuilderFieldCard', () => ({
  DraggableFieldCard: ({ field, index, density }: any) => (
    <div data-testid={`field-content-${index + 1}`} data-field-id={field.id} data-density={density} />
  ),
}));

jest.mock('../../field-library/FieldPickerPopover', () => ({
  FieldPickerPopover: ({ children }: any) => children,
}));

jest.mock('@dculus/ui', () => {
  const omit = (obj: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
  return {
    Button: ({ children, ...props }: any) =>
      React.createElement('button', omit(props, ['variant', 'size']), children),
    toast: (...args: unknown[]) => mockToast(...args),
  };
});

import {
  GridField,
  TextFieldValidation,
  TextInputField,
  buildPageTree,
  type FormField,
  type PageNode,
} from '@dculus/types';
import { GridBlock } from '../PageBuilderGridBlock';

const textField = (id: string): TextInputField =>
  new TextInputField(id, id.toUpperCase(), '', '', '', '', new TextFieldValidation(false));

const child = (id: string, column: number): FormField => {
  const field = textField(id);
  field.gridId = 'g1';
  field.gridColumn = column;
  return field;
};

/** Page: [x, g1, a(col 0), b(col 0)] — column 1 empty. */
const pageFields = (widths: number[] = [50, 50]): FormField[] => [
  textField('x'),
  new GridField('g1', widths),
  child('a', 0),
  child('b', 0),
];

const renderBlock = (widths?: number[]) => {
  const fields = pageFields(widths);
  const node = buildPageTree(fields).find((n): n is Extract<PageNode, { kind: 'grid' }> => n.kind === 'grid')!;
  return render(
    <DndContext>
      <GridBlock grid={node.grid} columns={node.columns} pageId="page-1" pageFields={fields} />
    </DndContext>
  );
};

describe('GridBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanEdit = true;
  });

  it('renders the block, its columns, compact children and an empty-column placeholder', () => {
    renderBlock();
    const block = screen.getByTestId('grid-block-g1');
    expect(block).toHaveAttribute('aria-label', '2-column layout');

    const column0 = screen.getByTestId('grid-column-g1-0');
    const cards = within(column0).getAllByTestId(/^field-content-/);
    // Page-level numbering: x is 1, the grid is 2, so its children are 3 and 4
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['field-content-3', 'field-content-4']);
    expect(cards.every((c) => c.getAttribute('data-density') === 'compact')).toBe(true);

    const column1 = screen.getByTestId('grid-column-g1-1');
    expect(within(column1).getByText('Drag and drop fields here')).toBeInTheDocument();
    expect(screen.getByTestId('grid-widths-g1')).toHaveTextContent('50% · 50%');
  });

  it('selects the grid on click', () => {
    renderBlock();
    fireEvent.click(screen.getByTestId('grid-block-g1'));
    expect(mockSetSelectedField).toHaveBeenCalledWith('g1');
  });

  it('exposes an accessible separator per divider', () => {
    renderBlock([30, 70]);
    const divider = screen.getByRole('separator');
    expect(divider).toHaveAttribute('aria-valuenow', '30');
    expect(divider).toHaveAttribute('aria-valuemin', '10');
    expect(divider).toHaveAttribute('aria-valuemax', '90');
    expect(divider).toHaveAttribute('aria-label', 'Resize columns 1 and 2');
  });

  it.each([
    [{ key: 'ArrowRight' }, [51, 49]],
    [{ key: 'ArrowLeft' }, [49, 51]],
    [{ key: 'ArrowRight', shiftKey: true }, [55, 45]],
    [{ key: 'ArrowLeft', shiftKey: true }, [45, 55]],
    [{ key: 'Home' }, [10, 90]],
    [{ key: 'End' }, [90, 10]],
  ])('keyboard resize %o commits %o', (keyEvent, expected) => {
    renderBlock();
    fireEvent.keyDown(screen.getByTestId('grid-divider-g1-0'), keyEvent);
    expect(mockSetGridColumnWidths).toHaveBeenCalledTimes(1);
    expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', expected);
  });

  it('does not commit a keyboard resize that is already at the limit', () => {
    renderBlock([10, 90]);
    fireEvent.keyDown(screen.getByTestId('grid-divider-g1-0'), { key: 'ArrowLeft' });
    expect(mockSetGridColumnWidths).not.toHaveBeenCalled();
  });

  describe('pointer resize', () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
    beforeAll(() => {
      // jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX/shiftKey
      if (!('PointerEvent' in window)) {
        class PointerEventPolyfill extends MouseEvent {
          pointerId: number;
          constructor(type: string, init: PointerEventInit = {}) {
            super(type, init);
            this.pointerId = init.pointerId ?? 0;
          }
        }
        (window as any).PointerEvent = PointerEventPolyfill;
      }
      // 612px wide minus one 12px gap = 600px of column width, so 6px = 1%
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 612 });
      Object.assign(HTMLElement.prototype, {
        setPointerCapture: jest.fn(),
        releasePointerCapture: jest.fn(),
        hasPointerCapture: jest.fn(() => true),
      });
    });
    afterAll(() => {
      if (originalClientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    });

    it('previews locally in 5% steps and commits once on release', () => {
      renderBlock();
      const divider = screen.getByTestId('grid-divider-g1-0');
      fireEvent.pointerDown(divider, { button: 0, clientX: 300, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 314, pointerId: 1 }); // +2.33% → snaps to 0
      expect(screen.getByTestId('grid-widths-g1')).toHaveTextContent('50% · 50%');
      fireEvent.pointerMove(divider, { clientX: 340, pointerId: 1 }); // +6.67% → 5
      fireEvent.pointerMove(divider, { clientX: 362, pointerId: 1 }); // +10.33% → 10
      expect(screen.getByTestId('grid-widths-g1')).toHaveTextContent('60% · 40%');
      expect(mockSetGridColumnWidths).not.toHaveBeenCalled();

      fireEvent.pointerUp(divider, { clientX: 362, pointerId: 1 });
      expect(mockSetGridColumnWidths).toHaveBeenCalledTimes(1);
      expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [60, 40]);
    });

    it('snaps to 1% with Shift and clamps to the minimum width', () => {
      renderBlock();
      const divider = screen.getByTestId('grid-divider-g1-0');
      fireEvent.pointerDown(divider, { button: 0, clientX: 300, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 314, shiftKey: true, pointerId: 1 }); // +2.33% → 2
      expect(screen.getByTestId('grid-widths-g1')).toHaveTextContent('52% · 48%');
      fireEvent.pointerMove(divider, { clientX: 900, pointerId: 1 }); // far right → clamped
      expect(screen.getByTestId('grid-widths-g1')).toHaveTextContent('90% · 10%');
      fireEvent.pointerUp(divider, { pointerId: 1 });
      expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [90, 10]);
    });

    it('does not commit when the widths did not change', () => {
      renderBlock();
      const divider = screen.getByTestId('grid-divider-g1-0');
      fireEvent.pointerDown(divider, { button: 0, clientX: 300, pointerId: 1 });
      fireEvent.pointerMove(divider, { clientX: 305, pointerId: 1 });
      fireEvent.pointerUp(divider, { pointerId: 1 });
      expect(mockSetGridColumnWidths).not.toHaveBeenCalled();
    });
  });

  it('deletes the grid with its fields and restores them on undo', () => {
    renderBlock();
    fireEvent.click(screen.getByTestId('grid-delete-button-g1'));
    expect(mockRemoveGrid).toHaveBeenCalledWith('page-1', 'g1', { deleteChildren: true });
    expect(mockSetSelectedField).not.toHaveBeenCalledWith('g1'); // the click did not bubble into a select
    mockToast.mock.calls[0][0].action.onClick();
    expect(mockRestoreGrid).toHaveBeenCalledWith('page-1', { gridId: 'g1', fieldIds: ['g1', 'a', 'b'] });
  });

  it('duplicates the grid and selects the copy', () => {
    renderBlock();
    fireEvent.click(screen.getByTestId('grid-duplicate-button-g1'));
    expect(mockDuplicateGrid).toHaveBeenCalledWith('page-1', 'g1');
    expect(mockSetSelectedField).toHaveBeenCalledWith('grid-copy');
  });

  it('read-only: no dividers, no duplicate or delete, no drag handle', () => {
    mockCanEdit = false;
    renderBlock();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-delete-button-g1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-duplicate-button-g1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('grid-drag-handle-g1')).not.toBeInTheDocument();
  });
});
