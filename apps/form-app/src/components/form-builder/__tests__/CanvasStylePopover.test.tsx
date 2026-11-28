import { render, screen, fireEvent, act } from '@testing-library/react';
import { CanvasStylePopover } from '../design/CanvasStylePopover';
import { useCanvasStyleStore } from '../../../store/useCanvasStyleStore';

let canEditLayout = true;

jest.mock('zustand', () => jest.requireActual('zustand'));
jest.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('../../../hooks/useFormPermissions', () => ({
  useFormPermissions: () => ({ canEditLayout: () => canEditLayout }),
}));
jest.mock('../../../store/useFormBuilderStore', () => ({
  useFormBuilderStore: () => ({ layout: { code: 'L1' }, updateLayout: jest.fn(), clearLayoutKey: jest.fn() }),
}));
jest.mock('../design/BrandStyleControls', () => ({
  BrandStyleControls: ({ sections }: { sections: string[] }) => <div data-testid="sections">{sections.join(',')}</div>,
}));
// The global @dculus/ui mock has no Popover; render content only while open.
jest.mock('@dculus/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const OpenContext = React.createContext(false);
  return {
    Popover: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      React.createElement(OpenContext.Provider, { value: open }, children),
    PopoverAnchor: ({ children }: { children: React.ReactNode }) => children,
    PopoverContent: ({ children }: { children: React.ReactNode }) =>
      React.useContext(OpenContext) ? React.createElement('div', { 'data-testid': 'content' }, children) : null,
  };
});

const Canvas = ({ target }: { target: 'title' | 'input' | 'surface' }) => (
  <CanvasStylePopover target={target}>
    <button onClick={() => useCanvasStyleStore.getState().toggle(target)}>anchor</button>
  </CanvasStylePopover>
);

describe('CanvasStylePopover', () => {
  beforeEach(() => {
    canEditLayout = true;
    act(() => useCanvasStyleStore.getState().close());
  });

  it.each([
    ['title', 'headingFont,brandColor,contrast'],
    ['input', 'inputStyle,corners,brandColor,contrast'],
    ['surface', 'surfaceColor,bodyFont,corners,contrast'],
  ] as const)('shows only the %s controls', (target, sections) => {
    render(<Canvas target={target} />);
    expect(screen.getByRole('button')).toHaveAttribute('data-canvas-style-anchor', target);
    expect(screen.queryByTestId('sections')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(useCanvasStyleStore.getState().target).toBe(target);
    expect(screen.getByTestId('sections')).toHaveTextContent(sections);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('sections')).toBeNull();
  });

  it('opens one popover at a time and toggles closed on a second click', () => {
    const toggle = useCanvasStyleStore.getState().toggle;
    act(() => toggle('title'));
    act(() => toggle('input'));
    expect(useCanvasStyleStore.getState().target).toBe('input');
    act(() => toggle('input'));
    expect(useCanvasStyleStore.getState().target).toBeNull();
  });

  it('renders the bare element for read-only viewers', () => {
    canEditLayout = false;
    render(<Canvas target="title" />);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-canvas-style-anchor');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByTestId('sections')).toBeNull();
  });
});
