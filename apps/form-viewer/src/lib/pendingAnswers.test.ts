import { describe, it, expect, beforeEach, vi } from 'vitest';

// @dculus/ui pulls in a dependency that reads window.matchMedia on import.
vi.hoisted(() => {
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

import { useFormResponseStore } from '@dculus/ui';
import {
  clearPendingAnswers,
  readCurrentAnswers,
  readCurrentFileAnswers,
  stashPendingAnswers,
  takePendingAnswers,
} from './pendingAnswers';

beforeEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
  useFormResponseStore.getState().clearAllResponses();
});

const type = (pageId: string, fieldId: string, value: unknown) =>
  useFormResponseStore.getState().setFieldValue(pageId, fieldId, value);

describe('readCurrentAnswers', () => {
  it('flattens answers across pages and drops empty seeds', () => {
    type('p1', 'name', 'Ada');
    type('p1', 'blank', '');
    type('p2', 'age', 36);
    expect(readCurrentAnswers()).toEqual({ name: 'Ada', age: 36 });
  });
});

describe('readCurrentFileAnswers', () => {
  it('returns only the picked files, by page', () => {
    const file = new File(['x'], 'cv.pdf');
    type('p1', 'name', 'Ada');
    type('p2', 'cv', [file]);
    expect(readCurrentFileAnswers()).toEqual({ p2: { cv: [file] } });
  });
});

describe('pending answers', () => {
  it('survives a page reload once, then is gone', () => {
    type('p1', 'name', 'Ada');
    stashPendingAnswers('form-1');

    expect(takePendingAnswers('form-1')).toEqual({ name: 'Ada' });
    expect(takePendingAnswers('form-1')).toEqual({});
  });

  it('is scoped to the form', () => {
    type('p1', 'name', 'Ada');
    stashPendingAnswers('form-1');
    expect(takePendingAnswers('form-2')).toEqual({});
  });

  it('stores nothing for an untouched form', () => {
    stashPendingAnswers('form-1');
    expect(sessionStorage.length).toBe(0);
  });

  it('can be dropped once the answers were submitted', () => {
    type('p1', 'name', 'Ada');
    stashPendingAnswers('form-1');
    clearPendingAnswers('form-1');
    expect(takePendingAnswers('form-1')).toEqual({});
  });

  it('ignores a stash from an abandoned sign-in', () => {
    vi.useFakeTimers();
    type('p1', 'name', 'Ada');
    stashPendingAnswers('form-1');
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(takePendingAnswers('form-1')).toEqual({});
  });

  it('ignores a corrupted stash', () => {
    sessionStorage.setItem('dculus_pending_answers:form-1', '{not json');
    expect(takePendingAnswers('form-1')).toEqual({});
    sessionStorage.setItem('dculus_pending_answers:form-1', '["a"]');
    expect(takePendingAnswers('form-1')).toEqual({});
    sessionStorage.setItem('dculus_pending_answers:form-1', '{"name":"Ada"}');
    expect(takePendingAnswers('form-1')).toEqual({});
  });
});
