import { render, screen, fireEvent } from '@testing-library/react';
import type { FormLayout } from '@dculus/types';
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
