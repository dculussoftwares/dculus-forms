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
  const React = require('react');

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

  return {
    __esModule: true,
    Button,
    Input,
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
    toast: toastMock,
  };
});

afterEach(() => {
  toastMock.mockClear();
});
