import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';

jest.unmock('@dculus/types');

jest.mock('react-router', () => ({ useNavigate: () => jest.fn(), useParams: () => ({}) }));

let mockSelectedFieldId: string | null = null;

jest.mock('@/store/useFormBuilderStore', () => {
  const state = () => ({
    selectedFieldId: mockSelectedFieldId,
    conditions: [],
    setSelection: jest.fn(),
    removePage: jest.fn(),
    duplicatePage: jest.fn(),
    updatePageTitle: jest.fn(),
  });
  const useFormBuilderStore: any = (selector?: (s: unknown) => unknown) =>
    selector ? selector(state()) : state();
  useFormBuilderStore.getState = state;
  return { useFormBuilderStore };
});

jest.mock('@/hooks/useFormPermissions', () => ({
  useFormPermissions: () => ({
    canEditFields: () => true,
    canReorderFields: () => true,
    canReorderPages: () => true,
    canAddPages: () => true,
    canDeletePages: () => true,
    isReadOnly: false,
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  GridField,
  TextInputField,
  FillableFormFieldValidation,
  type FormField,
  type FormPage,
} from '@dculus/types';
import { RailPageGroup } from '../RailPageGroup';

const text = (id: string, gridId?: string, gridColumn?: number): FormField =>
  Object.assign(new TextInputField(id, `Q ${id}`, '', '', '', '', new FillableFormFieldValidation(false)), {
    gridId,
    gridColumn,
  });

const renderGroup = (fields: FormField[], startNumber = 1) => {
  const page: FormPage = { id: 'p1', title: 'Page 1', order: 0, fields };
  return render(
    <DndContext>
      <RailPageGroup page={page} index={0} startNumber={startNumber} isSelected={false} isConnected />
    </DndContext>
  );
};

const chipNumber = (id: string) =>
  within(screen.getByTestId(`rail-field-${id}`)).queryByText(/^\d+$/)?.textContent ?? null;

describe('RailPageGroup on a grid page', () => {
  beforeEach(() => {
    mockSelectedFieldId = null;
  });

  // Storage order is not canonical; the rail follows the layout tree
  const gridPage = () => [
    text('top'),
    new GridField('g', [50, 50]),
    text('b1', 'g', 1),
    text('a1', 'g', 0),
    text('bottom'),
  ];

  it('lists the grid as a parent chip with its questions under it, numbering questions only', () => {
    renderGroup(gridPage(), 5);

    const chipIds = screen
      .getAllByTestId(/^rail-field-/)
      .map((el) => el.getAttribute('data-testid')!.replace('rail-field-', ''))
      .filter((id) => !id.startsWith('logic-badge'));
    expect(chipIds).toEqual(['top', 'g', 'a1', 'b1', 'bottom']);
    expect([chipNumber('top'), chipNumber('g'), chipNumber('a1'), chipNumber('b1'), chipNumber('bottom')]).toEqual([
      '5',
      null,
      '6',
      '7',
      '8',
    ]);
  });

  it('collapses and expands the grid’s questions, keeping later numbers', () => {
    renderGroup(gridPage());

    fireEvent.click(screen.getByTestId('rail-grid-toggle-g'));
    expect(screen.queryByTestId('rail-field-a1')).toBeNull();
    expect(screen.getByTestId('rail-grid-toggle-g')).toHaveAttribute('aria-expanded', 'false');
    expect(chipNumber('bottom')).toBe('4');

    fireEvent.click(screen.getByTestId('rail-grid-toggle-g'));
    expect(screen.getByTestId('rail-field-a1')).toBeInTheDocument();
  });

  it('keeps a grid expanded while one of its questions is selected', () => {
    mockSelectedFieldId = 'b1';
    renderGroup(gridPage());

    fireEvent.click(screen.getByTestId('rail-grid-toggle-g'));
    expect(screen.getByTestId('rail-field-b1')).toBeInTheDocument();
  });

  it('keeps flat numbering and chips on a grid-less page', () => {
    renderGroup([text('x'), text('y')], 3);
    expect(screen.queryByTestId(/^rail-grid-toggle-/)).toBeNull();
    expect([chipNumber('x'), chipNumber('y')]).toEqual(['3', '4']);
  });
});
