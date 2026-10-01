import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import mockEnGridLayout from '../../../../locales/en/gridLayout.json';

jest.unmock('@dculus/types');

const mockSetGridColumnWidths = jest.fn();
const mockDuplicateGrid = jest.fn(() => 'grid-copy');
const mockUngroupGrid = jest.fn();
const mockRemoveGrid = jest.fn(() => ({ gridId: 'g1', fieldIds: ['g1', 'a'] }));
const mockRestoreGrid = jest.fn(() => true);
const mockSetSelectedField = jest.fn();
const mockToast = jest.fn();
let mockIsConnected = true;

jest.mock('@/store/useFormBuilderStore', () => {
  const storeInstance = {
    get isConnected() {
      return mockIsConnected;
    },
    pages: [{ id: 'page-1', title: 'Page 1', fields: [{ id: 'g1', type: 'grid_field' }] }],
    setGridColumnWidths: mockSetGridColumnWidths,
    duplicateGrid: mockDuplicateGrid,
    ungroupGrid: mockUngroupGrid,
    removeGrid: mockRemoveGrid,
    restoreGrid: mockRestoreGrid,
    setSelectedField: mockSetSelectedField,
  };
  const useFormBuilderStore: any = () => storeInstance;
  useFormBuilderStore.getState = () => storeInstance;
  return { useFormBuilderStore };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { values?: Record<string, unknown> }) => {
      let node: unknown = mockEnGridLayout;
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      if (typeof node !== 'string') return key;
      return Object.entries(options?.values ?? {}).reduce(
        (acc, [token, value]) => acc.replace(`{{${token}}}`, String(value)),
        node
      );
    },
  }),
}));

jest.mock('../../field-settings', () => ({
  FieldSettingsHeader: () => <div data-testid="field-settings-header" />,
}));

jest.mock('@dculus/ui', () => {
  const omit = (obj: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
  return {
    Button: ({ children, ...props }: any) =>
      React.createElement('button', omit(props, ['variant', 'size']), children),
    Input: (props: any) => React.createElement('input', props),
    Label: ({ children, ...props }: any) => React.createElement('label', props, children),
    toast: (...args: unknown[]) => mockToast(...args),
  };
});

import { GridField } from '@dculus/types';
import { GridSettings } from '../GridSettings';

const renderSettings = (widths: number[], props: Partial<React.ComponentProps<typeof GridSettings>> = {}) =>
  render(<GridSettings field={new GridField('g1', widths)} isConnected {...props} />);

describe('GridSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsConnected = true;
  });

  it('shows the current column count and widths', () => {
    renderSettings([60, 40]);
    expect(screen.getByTestId('grid-column-count-2')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('grid-width-input-0')).toHaveValue(60);
    expect(screen.getByTestId('grid-width-input-1')).toHaveValue(40);
  });

  it('growing the column count equalizes widths with no merge toast', () => {
    renderSettings([60, 40]);
    fireEvent.click(screen.getByTestId('grid-column-count-3'));
    expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [34, 33, 33]);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shrinking the column count tells the user where fields went', () => {
    renderSettings([34, 33, 33]);
    fireEvent.click(screen.getByTestId('grid-column-count-2'));
    expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [50, 50]);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Questions from removed columns moved to column 2',
    });
  });

  it('applies valid widths once and blocks widths that do not sum to 100', () => {
    renderSettings([50, 50]);
    const apply = screen.getByTestId('grid-apply-widths');
    expect(apply).toBeDisabled();

    fireEvent.change(screen.getByTestId('grid-width-input-0'), { target: { value: '70' } });
    expect(apply).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('must add up to 100%');

    fireEvent.change(screen.getByTestId('grid-width-input-1'), { target: { value: '30' } });
    expect(apply).not.toBeDisabled();
    fireEvent.click(apply);
    expect(mockSetGridColumnWidths).toHaveBeenCalledTimes(1);
    expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [70, 30]);
  });

  it('rejects a column narrower than the minimum', () => {
    renderSettings([50, 50]);
    fireEvent.change(screen.getByTestId('grid-width-input-0'), { target: { value: '95' } });
    fireEvent.change(screen.getByTestId('grid-width-input-1'), { target: { value: '5' } });
    expect(screen.getByTestId('grid-apply-widths')).toBeDisabled();
  });

  it('distributes widths equally', () => {
    renderSettings([70, 30]);
    fireEvent.click(screen.getByTestId('grid-distribute-equally'));
    expect(mockSetGridColumnWidths).toHaveBeenCalledWith('page-1', 'g1', [50, 50]);
  });

  it('duplicates and selects the copy', () => {
    renderSettings([50, 50]);
    fireEvent.click(screen.getByTestId('grid-settings-duplicate'));
    expect(mockDuplicateGrid).toHaveBeenCalledWith('page-1', 'g1');
    expect(mockSetSelectedField).toHaveBeenCalledWith('grid-copy');
  });

  it('ungroups and clears the selection', () => {
    renderSettings([50, 50]);
    fireEvent.click(screen.getByTestId('grid-settings-ungroup'));
    expect(mockUngroupGrid).toHaveBeenCalledWith('page-1', 'g1');
    expect(mockSetSelectedField).toHaveBeenCalledWith(null);
  });

  it('deletes the grid with its fields and offers undo through restoreGrid', () => {
    renderSettings([50, 50]);
    fireEvent.click(screen.getByTestId('grid-settings-delete'));
    expect(mockRemoveGrid).toHaveBeenCalledWith('page-1', 'g1', { deleteChildren: true });
    const { action } = mockToast.mock.calls[0][0];
    action.onClick();
    expect(mockRestoreGrid).toHaveBeenCalledWith('page-1', { gridId: 'g1', fieldIds: ['g1', 'a'] });
    expect(mockSetSelectedField).toHaveBeenLastCalledWith('g1');
  });

  it('undo does nothing once the editor has gone offline', () => {
    renderSettings([50, 50]);
    fireEvent.click(screen.getByTestId('grid-settings-delete'));
    mockIsConnected = false;
    mockToast.mock.calls[0][0].action.onClick();
    expect(mockRestoreGrid).not.toHaveBeenCalled();
  });

  it('undo does nothing when editing was revoked after the delete', () => {
    const { rerender } = renderSettings([50, 50]);
    fireEvent.click(screen.getByTestId('grid-settings-delete'));
    rerender(<GridSettings field={new GridField('g1', [50, 50])} isConnected isReadOnly />);
    mockToast.mock.calls[0][0].action.onClick();
    expect(mockRestoreGrid).not.toHaveBeenCalled();
  });

  it('read-only: no writes and no actions', () => {
    renderSettings([50, 50], { isReadOnly: true });
    fireEvent.click(screen.getByTestId('grid-column-count-3'));
    expect(mockSetGridColumnWidths).not.toHaveBeenCalled();
    expect(screen.queryByTestId('grid-settings-delete')).not.toBeInTheDocument();
  });
});
