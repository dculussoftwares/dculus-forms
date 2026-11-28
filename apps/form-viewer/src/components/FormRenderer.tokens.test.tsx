/**
 * Design tokens (docs/design-tokens-plan.md): a form without `layout.tokens` must render
 * exactly as before, and a form with tokens must expose the `--df-*` theme.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// jsdom lacks these; @dculus/ui reads matchMedia at import time and Radix needs ResizeObserver.
import { vi } from 'vitest';
vi.hoisted(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

import { render } from '@testing-library/react';
import {
  type FormLayout,
  type FormPage,
  TextInputField,
  TextFieldValidation,
} from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FormRenderer, useFormResponseStore } from '@dculus/ui';

const pages: FormPage[] = [
  {
    id: 'p1',
    title: 'Page',
    order: 0,
    fields: [new TextInputField('f-text', 'Name', '', '', '', '', new TextFieldValidation(false))],
  },
];

const baseLayout = { theme: 'light', spacing: 'normal', code: 'L4' } as unknown as FormLayout;

const renderForm = (layout: FormLayout) =>
  render(
    <FormRenderer
      formSchema={{ pages, layout, isShuffleEnabled: false }}
      formId="f1"
      mode={RendererMode.SUBMISSION}
      screenOverride="pages"
    />
  );

describe('FormRenderer design tokens', () => {
  beforeEach(() => {
    useFormResponseStore.getState().clearAllResponses();
  });

  it('renders no token markup without layout.tokens', () => {
    const { container } = renderForm(baseLayout);
    expect(container.innerHTML).not.toContain('--df-');
    expect(container.innerHTML).not.toContain('data-df-branded');
    expect(container.innerHTML).not.toContain('var(--df');
  });

  it('is identical for an empty token object', () => {
    const legacy = renderForm(baseLayout).container.innerHTML;
    const empty = renderForm({ ...baseLayout, tokens: { version: 1 } }).container.innerHTML;
    expect(empty).toBe(legacy);
  });

  it('exposes the theme variables and themed controls when tokens are set', () => {
    const { container } = renderForm({
      ...baseLayout,
      tokens: { version: 1, primaryColor: '#1d4ed8', radius: 'lg', inputStyle: 'filled' },
    });
    const root = container.querySelector('[data-df-branded]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--df-primary')).toBe('#1d4ed8');
    expect(root.style.getPropertyValue('--df-radius')).not.toBe('');

    const next = container.querySelector('[data-testid="viewer-submit-button"]');
    expect(next?.className).toContain('bg-[var(--df-primary)]');
    const input = container.querySelector('input');
    expect(input?.className).toContain('rounded-[min(var(--df-radius),1.5rem)]');
  });
});
