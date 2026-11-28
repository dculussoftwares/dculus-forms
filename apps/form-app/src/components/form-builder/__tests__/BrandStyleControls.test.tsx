import { render, screen, fireEvent } from '@testing-library/react';
import type { FormLayout } from '@dculus/types';
import { act } from 'react';
import { useBrandPreviewStore } from '../../../store/useBrandPreviewStore';
import { BrandStyleControls, darkenToContrast } from '../design/BrandStyleControls';
import { contrastRatio } from '@dculus/utils';
import en from '../../../locales/en/designDrawer.json';

// The global @dculus/ui mock has no Select; Radix Select is not usable in jsdom, so stub it.
jest.mock('@dculus/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const passthrough = (tag: string) => ({ children, ...props }: any) => {
    const rest = { ...props };
    delete rest.onValueChange;
    return React.createElement(tag, rest, children);
  };
  return {
    Button: passthrough('button'),
    Input: (props: any) => React.createElement('input', props),
    Label: passthrough('label'),
    Select: passthrough('div'),
    SelectContent: passthrough('div'),
    SelectItem: passthrough('div'),
    SelectTrigger: passthrough('div'),
    SelectValue: () => null,
  };
});

// zustand is globally stubbed in setupTests; use the real one so the transient preview store works.
jest.mock('zustand', () => jest.requireActual('zustand'));

// The preview card renders real field classes from @dculus/types (globally mocked in jest).
jest.mock('../design/BrandPreviewCard', () => ({ BrandPreviewCard: () => null }));

const t = (key: string, options?: { values?: Record<string, string | number> }) => {
  let node: unknown = en;
  for (const segment of key.split('.')) {
    node = node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{\{(\w+)\}\}/g, (_, k) => String(options?.values?.[k] ?? ''));
};

const baseLayout = { theme: 'light', textColor: '#000000', spacing: 'normal', code: 'L1' } as unknown as FormLayout;

const setup = (layout: FormLayout = baseLayout, canEditLayout = true) => {
  const onLayoutUpdate = jest.fn();
  const onReset = jest.fn();
  render(
    <BrandStyleControls
      layout={layout}
      canEditLayout={canEditLayout}
      onLayoutUpdate={onLayoutUpdate}
      onReset={onReset}
      t={t}
    />
  );
  return { onLayoutUpdate, onReset };
};

describe('BrandStyleControls', () => {
  afterEach(() => act(() => useBrandPreviewStore.getState().clearPreview()));

  it('previews a preset on hover without saving, and clears on leave', () => {
    const { onLayoutUpdate } = setup();
    fireEvent.pointerEnter(screen.getByTestId('brand-preset-ocean'));
    expect(useBrandPreviewStore.getState()).toMatchObject({
      active: true,
      tokens: expect.objectContaining({ primaryColor: '#2563eb' }),
    });
    fireEvent.pointerLeave(screen.getByTestId('brand-preset-ocean'));
    expect(useBrandPreviewStore.getState().active).toBe(false);
    expect(onLayoutUpdate).not.toHaveBeenCalled();
  });

  it('previews the colour picker locally and saves only on release', () => {
    const { onLayoutUpdate } = setup();
    const picker = screen.getByLabelText(en.brandStyle.brandColor.label, { selector: 'input[type="color"]' });
    fireEvent.change(picker, { target: { value: '#ff0000' } });
    expect(onLayoutUpdate).not.toHaveBeenCalled();
    expect(useBrandPreviewStore.getState().tokens).toMatchObject({ primaryColor: '#ff0000' });
    fireEvent.blur(picker);
    expect(onLayoutUpdate).toHaveBeenCalledWith({ tokens: { version: 1, primaryColor: '#ff0000' } });
    expect(useBrandPreviewStore.getState().active).toBe(false);
  });

  it('toggles an unbranded before/after view only when tokens exist', () => {
    const { unmount } = render(
      <BrandStyleControls layout={baseLayout} canEditLayout onLayoutUpdate={jest.fn()} onReset={jest.fn()} t={t} />
    );
    expect(screen.queryByTestId('brand-compare-toggle')).toBeNull();
    unmount();
    setup({ ...baseLayout, tokens: { version: 1, primaryColor: '#2563eb' } } as FormLayout);
    fireEvent.click(screen.getByTestId('brand-compare-toggle'));
    expect(useBrandPreviewStore.getState()).toMatchObject({ active: true, tokens: undefined });
    fireEvent.click(screen.getByTestId('brand-compare-toggle'));
    expect(useBrandPreviewStore.getState().active).toBe(false);
  });

  it('merges a quick swatch into layout.tokens', () => {
    const { onLayoutUpdate } = setup();
    fireEvent.click(screen.getByLabelText('#2563eb'));
    expect(onLayoutUpdate).toHaveBeenCalledWith({ tokens: { version: 1, primaryColor: '#2563eb' } });
  });

  it('keeps existing tokens when changing another one', () => {
    const layout = { ...baseLayout, tokens: { version: 1, primaryColor: '#2563eb' } } as FormLayout;
    const { onLayoutUpdate } = setup(layout);
    fireEvent.click(screen.getByRole('button', { name: en.brandStyle.corners.lg }));
    expect(onLayoutUpdate).toHaveBeenCalledWith({
      tokens: { version: 1, primaryColor: '#2563eb', radius: 'lg' },
    });
  });

  it('applies a preset as a full token set and marks it active', () => {
    const { onLayoutUpdate } = setup();
    fireEvent.click(screen.getByTestId('brand-preset-ocean'));
    expect(onLayoutUpdate).toHaveBeenCalledWith({
      tokens: expect.objectContaining({ version: 1, primaryColor: '#2563eb', radius: 'md' }),
    });
  });

  it('flags the preset that matches the current tokens', () => {
    const layout = {
      ...baseLayout,
      tokens: { version: 1, primaryColor: '#2563eb', headingFont: 'dm-sans', bodyFont: 'dm-sans', radius: 'md', inputStyle: 'outlined', buttonStyle: 'solid' },
    } as FormLayout;
    setup(layout);
    expect(screen.getByTestId('brand-preset-ocean')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('brand-preset-sunset')).toHaveAttribute('aria-pressed', 'false');
  });

  it('ignores incomplete hex input', () => {
    const { onLayoutUpdate } = setup();
    fireEvent.change(screen.getByPlaceholderText(en.brandStyle.brandColor.placeholder), {
      target: { value: '#12' },
    });
    expect(onLayoutUpdate).not.toHaveBeenCalled();
  });

  it('resets when the last token is cleared and via the reset button', () => {
    const layout = { ...baseLayout, tokens: { version: 1, primaryColor: '#1e3a8a' } } as FormLayout;
    const { onLayoutUpdate, onReset } = setup(layout);
    fireEvent.click(screen.getAllByRole('button', { name: en.brandStyle.clear })[0]);
    expect(onLayoutUpdate).not.toHaveBeenCalled();
    expect(onReset).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: en.brandStyle.reset }));
    expect(onReset).toHaveBeenCalledTimes(2);
  });

  it('warns about low contrast and offers a darken fix', () => {
    const layout = { ...baseLayout, tokens: { version: 1, primaryColor: '#787878' } } as FormLayout;
    const { onLayoutUpdate } = setup(layout);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.brandStyle.contrast.darken }));
    const { tokens } = onLayoutUpdate.mock.calls[0][0];
    expect(contrastRatio(tokens.primaryColor, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('shows no warning for an accessible color', () => {
    setup({ ...baseLayout, tokens: { version: 1, primaryColor: '#1e3a8a' } } as FormLayout);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables every control when read-only', () => {
    const { onLayoutUpdate } = setup(baseLayout, false);
    const swatch = screen.getByLabelText('#2563eb');
    expect(swatch).toBeDisabled();
    fireEvent.click(swatch);
    expect(onLayoutUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: en.brandStyle.reset })).toBeDisabled();
  });
});

describe('darkenToContrast', () => {
  it('returns invalid input unchanged and reaches the target ratio', () => {
    expect(darkenToContrast('nope', '#ffffff')).toBe('nope');
    expect(contrastRatio(darkenToContrast('#ffcc00', '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});
