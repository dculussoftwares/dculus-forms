import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// Polyfill TextEncoder/TextDecoder for react-router
if (typeof global.TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Provide a minimal ResizeObserver implementation for jsdom
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Attach the stub to the global scope if not present
if (typeof global.ResizeObserver === 'undefined') {
  // @ts-ignore
  global.ResizeObserver = ResizeObserverStub;
}

// Mock matchMedia to avoid crashes in components relying on it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const toastMock = jest.fn();

// Mock @dculus/ui-v2 primitives used across tests with lightweight HTML elements
jest.mock('@dculus/ui-v2', () => {
  const React = require('react') as typeof import('react');

  const createElement =
    (tag: string) =>
    ({ children, ...props }: any) =>
      React.createElement(tag, props, children);

  const Button = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLButtonElement>) =>
      React.createElement('button', { ...props, ref }, children)
  );
  Button.displayName = 'ButtonMock';

  const Input = React.forwardRef(
    (props: any, ref: React.Ref<HTMLInputElement>) =>
      React.createElement('input', { ...props, ref })
  );
  Input.displayName = 'InputMock';

  const Anchor = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLAnchorElement>) =>
      React.createElement('a', { ...props, ref }, children)
  );
  Anchor.displayName = 'AnchorMock';

  const SidebarProvider = ({
    children,
    defaultOpen: _defaultOpen,
    ...props
  }: any) =>
    React.createElement(
      'div',
      { ...props, 'data-testid': 'sidebar-provider' },
      children
    );

  const SidebarInset = ({ children, ...props }: any) =>
    React.createElement('div', props, children);

  const SidebarTrigger = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLButtonElement>) =>
      React.createElement('button', { ...props, ref }, children ?? 'toggle sidebar')
  );
  SidebarTrigger.displayName = 'SidebarTriggerMock';

  const Pagination = ({ children, ...props }: any) =>
    React.createElement('nav', props, children);
  const PaginationContent = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const PaginationItem = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const PaginationLink = ({ children, isActive, ...props }: any) =>
    React.createElement(
      'a',
      { ...props, 'data-active': isActive ? 'true' : 'false' },
      children
    );
  const PaginationPrevious = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLAnchorElement>) =>
      React.createElement('a', { ...props, ref }, children ?? 'Prev')
  );
  PaginationPrevious.displayName = 'PaginationPreviousMock';
  const PaginationNext = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLAnchorElement>) =>
      React.createElement('a', { ...props, ref }, children ?? 'Next')
  );
  PaginationNext.displayName = 'PaginationNextMock';
  const PaginationEllipsis = (props: any) =>
    React.createElement('span', { ...props }, '…');

  const Breadcrumb = ({ children, ...props }: any) =>
    React.createElement('nav', props, children);
  const BreadcrumbList = ({ children, ...props }: any) =>
    React.createElement('ol', props, children);
  const BreadcrumbItem = ({ children, ...props }: any) =>
    React.createElement('li', props, children);
  const BreadcrumbLink = ({ children, ...props }: any) =>
    React.createElement('a', props, children);
  const BreadcrumbPage = ({ children, ...props }: any) =>
    React.createElement('span', props, children);
  const BreadcrumbSeparator = ({ children, ...props }: any) =>
    React.createElement('span', props, children ?? '/');

  const Skeleton = ({ children, ...props }: any) =>
    React.createElement('div', { ...props, 'data-testid': 'skeleton' }, children);

  const cn = (...values: any[]) =>
    values.filter(Boolean).join(' ');

  const SelectContext = React.createContext<{
    onValueChange?: (value: string) => void;
  } | null>(null);

  const Select = ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
  }) =>
    React.createElement(
      SelectContext.Provider,
      { value: { onValueChange } },
      children,
    );

  const SelectTrigger = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLButtonElement>) =>
      React.createElement(
        'button',
        { type: 'button', ...props, ref },
        children,
      ),
  );
  SelectTrigger.displayName = 'SelectTriggerMock';

  const SelectContent = ({ children, ...props }: any) =>
    React.createElement('div', { ...props, 'data-testid': 'select-content' }, children);

  const SelectItem = ({
    children,
    value,
    onSelect,
    ...props
  }: {
    children: React.ReactNode;
    value: string;
    onSelect?: (value: string) => void;
  }) => {
    const ctx = React.useContext(SelectContext);
    const handleClick = () => {
      ctx?.onValueChange?.(value);
      onSelect?.(value);
    };
    return React.createElement(
      'button',
      { type: 'button', ...props, onClick: handleClick },
      children,
    );
  };

  const SelectValue = ({ children, ...props }: any) =>
    React.createElement('span', props, children);

  const Dialog = ({ open, children, onOpenChange: _onOpenChange, ...props }: any) =>
    open ? React.createElement('div', props, children) : null;
  const DialogContent = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const DialogHeader = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const DialogTitle = ({ children, ...props }: any) =>
    React.createElement('h3', props, children);
  const DialogDescription = ({ children, ...props }: any) =>
    React.createElement('p', props, children);
  const DialogFooter = ({ children, ...props }: any) =>
    React.createElement('div', props, children);

  const AlertDialog = ({ open, children, onOpenChange: _onOpenChange }: any) =>
    open ? React.createElement(React.Fragment, null, children) : null;
  const AlertDialogContent = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const AlertDialogHeader = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const AlertDialogTitle = ({ children, ...props }: any) =>
    React.createElement('h3', props, children);
  const AlertDialogDescription = ({ children, ...props }: any) =>
    React.createElement('p', props, children);
  const AlertDialogFooter = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const AlertDialogCancel = Button;
  const AlertDialogAction = Button;

  const DropdownMenu = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const DropdownMenuTrigger = ({ children }: any) =>
    React.createElement(React.Fragment, null, children);
  const DropdownMenuContent = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const DropdownMenuItem = React.forwardRef(
    ({ children, ...props }: any, ref: React.Ref<HTMLButtonElement>) =>
      React.createElement('button', { type: 'button', ...props, ref }, children),
  );
  DropdownMenuItem.displayName = 'DropdownMenuItemMock';

  const ScrollArea = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const Avatar = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const AvatarImage = (props: any) =>
    React.createElement('img', { alt: '', ...props });
  const AvatarFallback = ({ children, ...props }: any) =>
    React.createElement('div', props, children);
  const Label = ({ children, ...props }: any) =>
    React.createElement('label', props, children);
  const Badge = ({ children, ...props }: any) =>
    React.createElement('span', props, children);

  return {
    __esModule: true,
    Button,
    Input,
    Anchor,
    SidebarProvider,
    SidebarInset,
    SidebarTrigger,
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationPrevious,
    PaginationNext,
    PaginationEllipsis,
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
    Skeleton,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
    ScrollArea,
    Avatar,
    AvatarImage,
    AvatarFallback,
    Badge,
    Label,
    Card: createElement('div'),
    CardHeader: createElement('div'),
    CardTitle: createElement('h3'),
    CardDescription: createElement('p'),
    CardContent: createElement('div'),
    Separator: createElement('hr'),
    Field: createElement('div'),
    FieldLabel: createElement('label'),
    FieldError: ({ errors = [], ...props }: any) =>
      React.createElement(
        'div',
        props,
        errors.map((error: any) => error?.message).join(', ')
      ),
    Spinner: createElement('div'),
    cn,
    toast: toastMock,
  };
});

// Suppress console warnings from Apollo MockedProvider for unmocked queries in tests
const originalConsoleWarn = console.warn;
beforeEach(() => {
  console.warn = jest.fn((message: string, ...args: unknown[]) => {
    // Suppress Apollo MockedProvider warnings about missing mocks
    if (typeof message === 'string' && message.includes('No more mocked responses')) {
      return;
    }
    originalConsoleWarn(message, ...args);
  });
});

afterEach(() => {
  toastMock.mockClear();
  console.warn = originalConsoleWarn;
});
