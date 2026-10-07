/**
 * Grid Phase 2b (docs/grid-layout-strategy.md §9.3 acceptance): a grid form submits answers for
 * its children and never a key for the grid, and validation errors surface inside columns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { act, render, screen, within } from '@testing-library/react';
import {
  type FormField,
  type FormPage,
  EmailField,
  FillableFormFieldValidation,
  GridField,
  RichTextFormField,
  TextInputField,
} from '@dculus/types';
import { SinglePageForm, useFormResponseStore } from '@dculus/ui';

type FormHandle = NonNullable<NonNullable<React.ComponentProps<typeof SinglePageForm>['formRef']>['current']>;

const inGrid = <T extends FormField>(field: T, gridColumn: number): T =>
  Object.assign(field, { gridId: 'g1', gridColumn });

const gridPage = (nameDefault = '', emailDefault = ''): FormPage => ({
  id: 'page-grid',
  title: 'Grid page',
  order: 0,
  fields: [
    new GridField('g1', [50, 50]),
    inGrid(new TextInputField('name', 'Name', nameDefault, '', '', '', new FillableFormFieldValidation(true)), 0),
    inGrid(new EmailField('email', 'Email', emailDefault, '', '', '', new FillableFormFieldValidation(true)), 1),
    inGrid(new RichTextFormField('note', '<p>Note</p>'), 1),
    new TextInputField('after', 'After', 'x', '', '', '', new FillableFormFieldValidation(false)),
  ],
});

const submit = async (page: FormPage) => {
  const onSubmit = vi.fn();
  const formRef = React.createRef<FormHandle>();
  render(<SinglePageForm page={page} onSubmit={onSubmit} formRef={formRef} />);
  let result: unknown;
  await act(async () => {
    result = await formRef.current!.submit();
  });
  return { onSubmit, result };
};

describe('grid form submission', () => {
  beforeEach(() => {
    useFormResponseStore.getState().clearAllResponses();
  });

  it('submits every child answer and no key for the grid', async () => {
    const { onSubmit } = await submit(gridPage('Jane', 'jane@example.com'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [pageId, data] = onSubmit.mock.calls[0];
    expect(pageId).toBe('page-grid');
    expect(data).toEqual({ name: 'Jane', email: 'jane@example.com', note: '', after: 'x' });
    expect(data).not.toHaveProperty('g1');
    expect(useFormResponseStore.getState().getPageResponses('page-grid')).not.toHaveProperty('g1');
  });

  it('blocks submission on empty required children, reporting errors in field order', async () => {
    const { onSubmit, result } = await submit(gridPage());

    expect(onSubmit).not.toHaveBeenCalled();
    const errors = (result as { validationErrors: { field: string }[] }).validationErrors;
    expect([...new Set(errors.map((e) => e.field))]).toEqual(['name', 'email']);
    expect(errors.some((e) => e.field === 'g1')).toBe(false);
  });

  it('shows a validation error inside the grid column that holds the field', async () => {
    const formRef = React.createRef<FormHandle>();
    render(<SinglePageForm page={gridPage()} onSubmit={vi.fn()} formRef={formRef} />);

    await act(async () => {
      await formRef.current!.showAllValidationErrors();
    });

    const column0 = screen.getByTestId('viewer-grid-column-g1-0');
    expect(within(column0).getByText(/Name is required/i)).toBeTruthy();
  });
});
