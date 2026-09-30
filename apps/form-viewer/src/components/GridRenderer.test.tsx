/**
 * Grid Phase 2a viewer rendering (docs/grid-layout-strategy.md §9.1, §9.2, §15.2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom lacks these; @dculus/ui reads matchMedia at import time and Radix needs ResizeObserver.
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

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import {
  type FormField,
  type FormPage,
  GridField,
  TextInputField,
  EmailField,
  FillableFormFieldValidation,
} from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import {
  FormFieldRenderer,
  FormResponseContext,
  SinglePageForm,
  useFormResponseStore,
  type FormResponseContextValue,
} from '@dculus/ui';

const text = (id: string, label = id) =>
  new TextInputField(id, label, '', '', '', '', new FillableFormFieldValidation(false));

const inGrid = <T extends FormField>(field: T, gridId: string, gridColumn: number): T =>
  Object.assign(field, { gridId, gridColumn });

const page = (fields: FormField[]): FormPage => ({ id: 'page-grid', title: 'Grid page', order: 0, fields });

const inputNames = (element: HTMLElement) =>
  Array.from(element.querySelectorAll('input[name]')).map((input) => input.getAttribute('name'));

const twoColumnPage = () =>
  page([
    new GridField('g1', [50, 50]),
    inGrid(text('a'), 'g1', 0),
    inGrid(text('b'), 'g1', 1),
    inGrid(text('c'), 'g1', 0),
    inGrid(new EmailField('d', 'Email', '', '', '', '', new FillableFormFieldValidation(false)), 'g1', 1),
    text('e'),
  ]);

const threeColumnPage = () =>
  page([
    new GridField('g3', [36, 30, 34]),
    inGrid(text('x'), 'g3', 0),
    inGrid(text('y'), 'g3', 1),
    inGrid(text('z'), 'g3', 2),
  ]);

const withHidden = (hidden: string[]): FormResponseContextValue => {
  const hiddenFieldIds = new Set(hidden);
  const requiredOverrides = new Map<string, boolean>();
  return {
    mode: RendererMode.PREVIEW,
    hiddenFieldIds,
    hiddenPageIds: new Set(),
    getHiddenFieldIds: () => hiddenFieldIds,
    requiredOverrides,
    getRequiredOverrides: () => requiredOverrides,
  };
};

const renderPage = (formPage: FormPage, hidden?: string[]) =>
  render(
    hidden ? (
      <FormResponseContext.Provider value={withHidden(hidden)}>
        <SinglePageForm page={formPage} onSubmit={vi.fn()} />
      </FormResponseContext.Provider>
    ) : (
      <SinglePageForm page={formPage} onSubmit={vi.fn()} />
    )
  );

const gridTemplate = (gridId: string) =>
  (screen.getByTestId(`viewer-grid-${gridId}`).firstElementChild as HTMLElement).style.getPropertyValue('--gc');

describe('SinglePageForm grid rendering', () => {
  beforeEach(() => {
    useFormResponseStore.getState().clearAllResponses();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a 2-column grid side by side, children in their columns in column-major order', () => {
    const { container } = renderPage(twoColumnPage());

    const wrapper = screen.getByTestId('viewer-grid-g1');
    expect(wrapper.className).toBe('@container w-full');
    expect(wrapper.parentElement).toBe(container.querySelector('form.space-y-4 > div.space-y-4'));

    const grid = wrapper.firstElementChild as HTMLElement;
    expect(grid.className).toBe('grid grid-cols-1 gap-4 @md:[grid-template-columns:var(--gc)]');
    expect(grid.style.getPropertyValue('--gc')).toBe('minmax(0, 50fr) minmax(0, 50fr)');

    expect(grid.children).toHaveLength(2);
    expect(inputNames(screen.getByTestId('viewer-grid-column-g1-0'))).toEqual(['a', 'c']);
    expect(inputNames(screen.getByTestId('viewer-grid-column-g1-1'))).toEqual(['b', 'd']);
    expect(inputNames(wrapper)).toEqual(['a', 'c', 'b', 'd']);

    // The top-level field after the grid stays outside it
    expect(inputNames(container.querySelector('form') as HTMLElement)).toEqual(['a', 'c', 'b', 'd', 'e']);
  });

  it('uses the uneven widths of a 3-column grid as fr tracks', () => {
    renderPage(threeColumnPage());

    expect(gridTemplate('g3')).toBe('minmax(0, 36fr) minmax(0, 30fr) minmax(0, 34fr)');
    expect((screen.getByTestId('viewer-grid-g3').firstElementChild as HTMLElement).className).toBe(
      'grid grid-cols-1 gap-4 @lg:[grid-template-columns:var(--gc)]'
    );
    expect(inputNames(screen.getByTestId('viewer-grid-column-g3-2'))).toEqual(['z']);
  });

  it('places children stored before their grid into the grid, at the grid position', () => {
    const { container } = renderPage(
      page([text('top'), inGrid(text('a'), 'g1', 1), inGrid(text('b'), 'g1', 0), new GridField('g1'), text('after')])
    );

    expect(inputNames(screen.getByTestId('viewer-grid-column-g1-0'))).toEqual(['b']);
    expect(inputNames(screen.getByTestId('viewer-grid-column-g1-1'))).toEqual(['a']);
    expect(inputNames(container.querySelector('form') as HTMLElement)).toEqual(['top', 'b', 'a', 'after']);
  });

  it('drops hidden children and collapses an emptied column, renormalizing the widths', () => {
    renderPage(threeColumnPage(), ['y']);

    expect(screen.queryByTestId('viewer-grid-column-g3-2')).toBeNull();
    expect(inputNames(screen.getByTestId('viewer-grid-column-g3-0'))).toEqual(['x']);
    expect(inputNames(screen.getByTestId('viewer-grid-column-g3-1'))).toEqual(['z']);
    expect(gridTemplate('g3')).toBe('minmax(0, 51fr) minmax(0, 49fr)');
    expect((screen.getByTestId('viewer-grid-g3').firstElementChild as HTMLElement).className).toBe(
      'grid grid-cols-1 gap-4 @md:[grid-template-columns:var(--gc)]'
    );
  });

  it('renders a single plain column when only one column has visible children', () => {
    renderPage(twoColumnPage(), ['b', 'd']);

    const grid = screen.getByTestId('viewer-grid-g1').firstElementChild as HTMLElement;
    expect(grid.className).toBe('grid grid-cols-1');
    expect(grid.children).toHaveLength(1);
    expect(inputNames(grid)).toEqual(['a', 'c']);
  });

  it('renders nothing for a grid whose children are all hidden', () => {
    const { container } = renderPage(twoColumnPage(), ['a', 'b', 'c', 'd']);

    expect(screen.queryByTestId('viewer-grid-g1')).toBeNull();
    expect(container.innerHTML).not.toContain('@container');
    expect(inputNames(container.querySelector('form') as HTMLElement)).toEqual(['e']);
  });

  it('adds no grid markup to a grid-less page', () => {
    const { container } = renderPage(page([text('a'), text('b')]));

    expect(container.querySelector('[data-testid^="viewer-grid"]')).toBeNull();
    expect(container.innerHTML).not.toContain('@container');
    expect(container.querySelector('form.space-y-4 > div.space-y-4')!.children).toHaveLength(2);
  });

  it('stacks every grid into one column when VITE_GRID_RENDER=stack', () => {
    vi.stubEnv('VITE_GRID_RENDER', 'stack');
    const { container } = renderPage(twoColumnPage());

    const wrapper = screen.getByTestId('viewer-grid-g1');
    expect(container.innerHTML).not.toContain('@container');
    expect(container.innerHTML).not.toContain('@md:');
    expect(container.innerHTML).not.toContain('--gc');
    expect(screen.queryByTestId('viewer-grid-column-g1-1')).toBeNull();
    expect(inputNames(within(wrapper).getByTestId('viewer-grid-column-g1-0'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('shows the empty-page message for a page holding only a grid', () => {
    renderPage(page([new GridField('lonely', [50, 50])]));

    expect(screen.getByText('No fields in this page yet.')).toBeTruthy();
    expect(screen.queryByTestId('viewer-grid-lonely')).toBeNull();
  });
});

describe('FormFieldRenderer with a layout field', () => {
  // Never read: the layout check returns before the control is touched
  const control = {} as React.ComponentProps<typeof FormFieldRenderer>['control'];

  it('renders nothing for a GridField', () => {
    const { container } = render(
      <FormFieldRenderer field={new GridField('g1', [50, 50])} control={control} mode={RendererMode.SUBMISSION} />
    );
    expect(container.innerHTML).toBe('');
  });
});
