/**
 * Phase 0c golden baseline (docs/grid-layout-strategy.md §9, §15.2, §15.5): the
 * SinglePageForm DOM for a grid-less page, plus the payload it submits. Grid
 * phases must leave these snapshots byte-identical (R2/R4); do not update them
 * in a grid PR.
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
import { render, act } from '@testing-library/react';
import {
  type FormPage,
  TextInputField,
  TextAreaField,
  EmailField,
  NumberField,
  DateField,
  SelectField,
  RadioField,
  CheckboxField,
  RichTextFormField,
  TextFieldValidation,
  CheckboxFieldValidation,
  FillableFormFieldValidation,
} from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { SinglePageForm, useFormResponseStore } from '@dculus/ui';

const req = (required: boolean) => new FillableFormFieldValidation(required);

const gridlessPage: FormPage = {
  id: 'page-golden',
  title: 'Golden page',
  order: 0,
  fields: [
    new TextInputField('f-text', 'Name', '', '', 'Full name', 'Jane', new TextFieldValidation(true, 2, 40)),
    new TextAreaField('f-area', 'Bio', '', '', '', '', new TextFieldValidation(false)),
    new EmailField('f-email', 'Email', '', '', '', '', req(true)),
    new NumberField('f-number', 'Age', '7', '', '', '', req(false), 1, 120),
    new DateField('f-date', 'Birthday', '', '', '', '', req(false)),
    new RichTextFormField('f-rich', '<p>Read this first</p>'),
    new SelectField('f-select', 'Country', '', '', '', req(true), ['IN', 'US']),
    new RadioField('f-radio', 'Size', 'M', '', '', req(false), ['S', 'M', 'L']),
    new CheckboxField('f-check', 'Colours', ['Red'], '', '', '', new CheckboxFieldValidation(false, 1, 2), ['Red', 'Blue']),
  ],
};

describe('SinglePageForm on a grid-less page (golden)', () => {
  // The response store is a module singleton; without a reset, values typed by one test seed the next.
  beforeEach(() => {
    useFormResponseStore.getState().clearAllResponses();
  });

  it.each([RendererMode.PREVIEW, RendererMode.SUBMISSION])('DOM in %s mode', (mode) => {
    const { container } = render(
      <SinglePageForm page={gridlessPage} mode={mode} onSubmit={vi.fn()} showSubmitButton />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('empty page DOM', () => {
    const { container } = render(
      <SinglePageForm page={{ ...gridlessPage, fields: [] }} onSubmit={vi.fn()} />
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('wraps fields in form.space-y-4 > div.space-y-4, one child per field, in order', () => {
    const { container } = render(<SinglePageForm page={gridlessPage} onSubmit={vi.fn()} />);
    const wrapper = container.querySelector('form.space-y-4 > div.space-y-4');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.children).toHaveLength(gridlessPage.fields.length);
  });

  it('blocks submit while required fields are empty', async () => {
    const onSubmit = vi.fn();
    const formRef = React.createRef<any>();
    render(<SinglePageForm page={gridlessPage} onSubmit={onSubmit} formRef={formRef} />);

    let result: unknown;
    await act(async () => {
      result = await formRef.current.submit();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(result).toMatchSnapshot();
  });

  it('submits this payload for a valid page (rich text included, §3.7)', async () => {
    const page: FormPage = {
      ...gridlessPage,
      fields: gridlessPage.fields.map((field) => {
        const defaults: Record<string, string> = {
          'f-text': 'Jane',
          'f-email': 'jane@example.com',
          'f-select': 'IN',
        };
        // Clone so the shared fixture (used by the DOM snapshots) stays untouched.
        return field.id in defaults
          ? Object.assign(Object.create(Object.getPrototypeOf(field)), field, { defaultValue: defaults[field.id] })
          : field;
      }),
    };
    const onSubmit = vi.fn();
    const formRef = React.createRef<any>();
    render(<SinglePageForm page={page} onSubmit={onSubmit} formRef={formRef} />);

    await act(async () => {
      await formRef.current.submit();
    });

    expect(onSubmit.mock.calls).toMatchSnapshot();
  });
});
