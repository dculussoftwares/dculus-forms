import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import mockEnFieldLibrary from '../../../../locales/en/fieldLibrary.json';
import mockEnFieldTypesPanel from '../../../../locales/en/fieldTypesPanel.json';

let FieldPickerPopover: typeof import('../FieldPickerPopover').FieldPickerPopover;

const mockAddField = jest.fn();
const mockAddFieldAtIndex = jest.fn();
const mockSetSelectedField = jest.fn();
let mockCanAddFields = true;

jest.mock('@/store/useFormBuilderStore', () => {
  const storeInstance = {
    pages: [{ id: 'page-1', title: 'Page 1', fields: [] }],
    selectedPageId: 'page-1',
    addField: mockAddField,
    addFieldAtIndex: mockAddFieldAtIndex,
    setSelectedField: mockSetSelectedField,
  };
  const useFormBuilderStore: any = () => storeInstance;
  useFormBuilderStore.getState = () => storeInstance;
  return { useFormBuilderStore };
});

jest.mock('@/hooks/useFormPermissions', () => ({
  useFormPermissions: () => ({
    canAddFields: () => mockCanAddFields,
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: (namespace: string) => ({
    t: (key: string, options?: { values?: Record<string, unknown> }) => {
      const messages: Record<string, unknown> = {
        fieldLibrary: mockEnFieldLibrary,
        fieldTypesPanel: mockEnFieldTypesPanel,
      };
      let node: unknown = messages[namespace];
      for (const segment of key.split('.')) {
        node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
      }
      if (typeof node !== 'string') return key;
      if (!options?.values) return node;
      return Object.entries(options.values).reduce(
        (acc, [token, value]) => acc.replace(new RegExp(`{{\\s*${token}\\s*}}`, 'g'), String(value)),
        node
      );
    },
  }),
}));

jest.mock('@dculus/ui', () => {
  const ReactLib = React;
  const omit = <T extends Record<string, unknown>>(obj: T, keys: string[]) =>
    Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));

  const PopoverContext = ReactLib.createContext<{ onOpenChange?: (open: boolean) => void }>({});

  const PopoverContent = ({ children, ...props }: any) =>
    ReactLib.createElement(
      'div',
      omit(props, ['align', 'side', 'sideOffset', 'onOpenAutoFocus']),
      children
    );

  const PopoverTrigger = ({ children }: any) => {
    const { onOpenChange } = ReactLib.useContext(PopoverContext);
    const child = ReactLib.Children.only(children);
    return ReactLib.cloneElement(child, {
      onClick: (...args: unknown[]) => {
        (child.props as any).onClick?.(...args);
        onOpenChange?.(true);
      },
    });
  };

  const Popover = ({ children, open, onOpenChange }: any) =>
    ReactLib.createElement(
      PopoverContext.Provider,
      { value: { onOpenChange } },
      ...ReactLib.Children.toArray(children).filter(
        (child: any) => !(ReactLib.isValidElement(child) && child.type === PopoverContent) || open
      )
    );

  return {
    Button: ({ children, ...props }: any) =>
      ReactLib.createElement('button', omit(props, ['variant']), children),
    Input: ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement('input', { ref, ...props })
    ),
    Card: ({ children, ...props }: any) => ReactLib.createElement('div', props, children),
    ScrollArea: ({ children, ...props }: any) => ReactLib.createElement('div', props, children),
    Popover,
    PopoverTrigger,
    PopoverContent,
    toast: jest.fn(),
  };
});

describe('FieldPickerPopover', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockCanAddFields = true;
    const mod = await import('../FieldPickerPopover');
    FieldPickerPopover = mod.FieldPickerPopover;
  });

  it('renders trigger and opens popover on click', () => {
    render(
      <FieldPickerPopover pageId="page-1">
        <button data-testid="test-trigger">Add Question</button>
      </FieldPickerPopover>
    );

    const trigger = screen.getByTestId('test-trigger');
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId('picker-search')).toBeInTheDocument();
  });

  it('filters field types when searching', () => {
    render(
      <FieldPickerPopover pageId="page-1">
        <button data-testid="test-trigger">Add Question</button>
      </FieldPickerPopover>
    );

    fireEvent.click(screen.getByTestId('test-trigger'));
    const searchInput = screen.getByTestId('picker-search');

    fireEvent.change(searchInput, { target: { value: 'email' } });
    expect(screen.getByTestId('field-type-picker-email')).toBeInTheDocument();
  });

  it('calls addFieldAtIndex when insertIndex is provided', () => {
    render(
      <FieldPickerPopover pageId="page-1" insertIndex={2}>
        <button data-testid="test-trigger">Insert Here</button>
      </FieldPickerPopover>
    );

    fireEvent.click(screen.getByTestId('test-trigger'));
    const emailField = screen.getByTestId('field-type-picker-email');
    fireEvent.click(emailField);

    expect(mockAddFieldAtIndex).toHaveBeenCalledWith(
      'page-1',
      expect.anything(),
      expect.anything(),
      2
    );
  });
});
