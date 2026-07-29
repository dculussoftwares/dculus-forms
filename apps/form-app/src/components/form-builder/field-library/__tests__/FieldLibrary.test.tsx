import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldType } from '@dculus/types';
import mockEnFieldLibrary from '../../../../locales/en/fieldLibrary.json';
import mockEnFieldTypesPanel from '../../../../locales/en/fieldTypesPanel.json';

// Mirrors the dynamic-import pattern used by field-settings-v2's integration test:
// jest.mock() factories here are plain statements (ts-jest doesn't hoist them above
// compiled `require`s the way babel-jest does), so the component under test must be
// imported lazily, after the mocks below have registered.
let FieldLibrary: typeof import('../FieldLibrary').default;

const mockAddField = jest.fn();
let mockSelectedPageId: string | null = 'page-1';
let mockCanAddFields = true;

jest.mock('@/store/useFormBuilderStore', () => ({
  useFormBuilderStore: () => ({
    selectedPageId: mockSelectedPageId,
    addField: mockAddField,
  }),
}));

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

// The default @dculus/ui mock in setupTests.ts doesn't cover Popover/ScrollArea —
// this test only exercises FieldLibrary's own logic (permissions, search/filter,
// add/pin/unpin wiring), so a minimal open/onOpenChange-driven stand-in (not real
// Radix) is enough, but it DOES need to actually gate PopoverContent on `open` and
// wire the trigger's click to onOpenChange — FieldLibrary's own isOpen handling
// (e.g. closing the popover when pinning) is worth covering here, not left
// entirely to Radix + E2E.
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
  };
});

beforeAll(async () => {
  ({ default: FieldLibrary } = await import('../FieldLibrary'));
});

beforeEach(() => {
  localStorage.clear();
  mockAddField.mockClear();
  mockSelectedPageId = 'page-1';
  mockCanAddFields = true;
});

describe('FieldLibrary', () => {
  describe('VIEWER permissions', () => {
    it('renders nothing in trigger mode', () => {
      mockCanAddFields = false;
      const { container } = render(<FieldLibrary mode="trigger" />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing in docked mode, even if pinned', () => {
      localStorage.setItem('dculus.fieldLibrary.pinned', 'true');
      mockCanAddFields = false;
      const { container } = render(<FieldLibrary mode="docked" />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('trigger mode (mega-panel)', () => {
    const openLibrary = () => fireEvent.click(screen.getByTestId('rail-add-content-button'));

    it('renders the add-content button, closed by default', () => {
      render(<FieldLibrary mode="trigger" />);
      expect(screen.getByTestId('rail-add-content-button')).toBeInTheDocument();
      expect(screen.queryByTestId('field-library-search')).not.toBeInTheDocument();
    });

    it('opening it shows every field type as a stable-testid tile', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();

      expect(screen.getByTestId('field-type-short-text')).toBeInTheDocument();
      expect(screen.getByTestId('field-type-email')).toBeInTheDocument();
      expect(screen.getByTestId('field-type-file-upload')).toBeInTheDocument();
    });

    it('clicking a tile appends the field to the selected page and records recent usage', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      fireEvent.click(screen.getByTestId('field-type-email'));

      expect(mockAddField).toHaveBeenCalledTimes(1);
      expect(mockAddField.mock.calls[0][0]).toBe('page-1');
      expect(mockAddField.mock.calls[0][1]).toBe(FieldType.EMAIL_FIELD);
      expect(JSON.parse(localStorage.getItem('dculus.fieldLibrary.recent') || '[]')).toEqual([
        FieldType.EMAIL_FIELD,
      ]);
    });

    it('does nothing when no page is selected', () => {
      mockSelectedPageId = null;
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      fireEvent.click(screen.getByTestId('field-type-email'));
      expect(mockAddField).not.toHaveBeenCalled();
    });

    it('filters tiles by the search query, case-insensitively', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      fireEvent.change(screen.getByTestId('field-library-search'), {
        target: { value: 'EMA' },
      });

      expect(screen.getByTestId('field-type-email')).toBeInTheDocument();
      expect(screen.queryByTestId('field-type-short-text')).not.toBeInTheDocument();
    });

    it('Enter adds the first search match', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      const search = screen.getByTestId('field-library-search');
      fireEvent.change(search, { target: { value: 'ema' } });
      fireEvent.keyDown(search, { key: 'Enter' });

      expect(mockAddField).toHaveBeenCalledTimes(1);
      expect(mockAddField.mock.calls[0][1]).toBe(FieldType.EMAIL_FIELD);
    });

    it('Escape clears the search text without adding anything', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      const search = screen.getByTestId('field-library-search') as HTMLInputElement;
      fireEvent.change(search, { target: { value: 'ema' } });
      fireEvent.keyDown(search, { key: 'Escape' });

      expect(search.value).toBe('');
      expect(mockAddField).not.toHaveBeenCalled();
    });

    it('pinning persists to localStorage and closes the popover', () => {
      render(<FieldLibrary mode="trigger" />);
      openLibrary();
      fireEvent.click(screen.getByTestId('field-library-pin-button'));

      expect(localStorage.getItem('dculus.fieldLibrary.pinned')).toBe('true');
      // Otherwise the popover's tiles and the docked column's tiles (mounted
      // separately in PageBuilderTab) would both be in the DOM at once, sharing
      // dnd-kit ids.
      expect(screen.queryByTestId('field-library-search')).not.toBeInTheDocument();
    });

    it('clicking the trigger while pinned unpins instead of opening a redundant popover', () => {
      localStorage.setItem('dculus.fieldLibrary.pinned', 'true');
      render(<FieldLibrary mode="trigger" />);
      openLibrary();

      expect(localStorage.getItem('dculus.fieldLibrary.pinned')).toBe('false');
      expect(screen.queryByTestId('field-library-search')).not.toBeInTheDocument();
    });
  });

  describe('docked mode', () => {
    it('renders nothing when not pinned', () => {
      const { container } = render(<FieldLibrary mode="docked" />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders the compact panel when pinned, and Unpin removes it', () => {
      localStorage.setItem('dculus.fieldLibrary.pinned', 'true');
      render(<FieldLibrary mode="docked" />);

      expect(screen.getByTestId('field-library-docked')).toBeInTheDocument();
      expect(screen.getByTestId('field-type-short-text')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('field-library-unpin-button'));

      expect(localStorage.getItem('dculus.fieldLibrary.pinned')).toBe('false');
      expect(screen.queryByTestId('field-library-docked')).not.toBeInTheDocument();
    });

    it('clicking a tile adds the field', () => {
      localStorage.setItem('dculus.fieldLibrary.pinned', 'true');
      render(<FieldLibrary mode="docked" />);

      fireEvent.click(screen.getByTestId('field-type-short-text'));

      expect(mockAddField).toHaveBeenCalledTimes(1);
      expect(mockAddField.mock.calls[0][1]).toBe(FieldType.TEXT_INPUT_FIELD);
    });
  });
});
