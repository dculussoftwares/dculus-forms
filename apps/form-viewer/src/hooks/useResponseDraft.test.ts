import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const { mutate, client } = vi.hoisted(() => {
  const mutate = vi.fn();
  return { mutate, client: { mutate } };
});
vi.mock('@apollo/client/react', () => ({ useApolloClient: () => client }));

import { act, renderHook } from '@testing-library/react';
import { useFormResponseStore } from '@dculus/ui';
import { AUTOSAVE_DEBOUNCE_MS, useResponseDraft, type ResponseDraft } from './useResponseDraft';

const draft = (version: number, data: Record<string, unknown> = {}): ResponseDraft => ({
  data,
  currentPageId: 'p1',
  version,
  startedAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
});

const saved = (version: number, data: Record<string, unknown> = {}) => ({
  data: { saveResponseDraft: { conflict: false, draft: draft(version, data) } },
});

const setup = (applyDraft = vi.fn()) =>
  renderHook(() => useResponseDraft({ formId: 'form-1', enabled: true, applyDraft }));

const type = (fieldId: string, value: unknown) =>
  act(() => {
    useFormResponseStore.getState().setFieldValue('p1', fieldId, value);
  });

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
  });

const lastInput = () => mutate.mock.calls.at(-1)![0].variables.input;

beforeEach(() => {
  vi.useFakeTimers();
  mutate.mockReset();
  useFormResponseStore.getState().clearAllResponses();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useResponseDraft', () => {
  it('does not create a draft for the renderer empty seeds', async () => {
    setup();
    type('name', '');
    await flush();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('debounces a save and carries the returned version into the next one', async () => {
    mutate.mockResolvedValueOnce(saved(1, { name: 'A' })).mockResolvedValueOnce(saved(2, { name: 'Ada' }));
    const { result } = setup();

    type('name', 'A');
    await flush();
    expect(lastInput()).toEqual({ formId: 'form-1', data: { name: 'A' }, currentPageId: null, baseVersion: null });
    expect(result.current.status).toBe('saved');

    type('name', 'Ada');
    await flush();
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(lastInput().baseVersion).toBe(1);
  });

  it('surfaces a conflict, stops saving, and resumes from the other version on "keep mine"', async () => {
    mutate.mockResolvedValueOnce({ data: { saveResponseDraft: { conflict: true, draft: draft(7, { name: 'Other' }) } } });
    const { result } = setup();

    type('name', 'Mine');
    await flush();
    expect(result.current.conflict?.version).toBe(7);

    type('name', 'Mine 2');
    await flush();
    expect(mutate).toHaveBeenCalledTimes(1);

    mutate.mockResolvedValueOnce(saved(8, { name: 'Mine 2' }));
    await act(async () => {
      result.current.keepMine();
      await vi.runOnlyPendingTimersAsync();
    });
    expect(lastInput()).toMatchObject({ data: { name: 'Mine 2' }, baseVersion: 7 });
    expect(result.current.conflict).toBeNull();
  });

  it('hands the other copy to the caller on "use those"', async () => {
    const applyDraft = vi.fn();
    mutate.mockResolvedValueOnce({ data: { saveResponseDraft: { conflict: true, draft: draft(3, { name: 'Other' }) } } });
    const { result } = setup(applyDraft);

    type('name', 'Mine');
    await flush();
    act(() => result.current.acceptOther());

    expect(applyDraft).toHaveBeenCalledWith(draft(3, { name: 'Other' }));
    expect(result.current.conflict).toBeNull();
  });

  it('saves a page move only once a draft exists', async () => {
    const { result } = setup();
    await act(async () => {
      result.current.setCurrentPage('p2');
      await vi.runOnlyPendingTimersAsync();
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => result.current.seed(draft(4, {})));
    mutate.mockResolvedValueOnce(saved(5));
    await act(async () => {
      result.current.setCurrentPage('p3');
      await vi.runOnlyPendingTimersAsync();
    });
    expect(lastInput()).toMatchObject({ currentPageId: 'p3', baseVersion: 4 });
  });

  it('reports an error and retries a failed save', async () => {
    mutate.mockResolvedValueOnce({ error: new Error('offline') }).mockResolvedValueOnce(saved(1, { name: 'A' }));
    const { result } = setup();

    type('name', 'A');
    await flush();
    expect(result.current.status).toBe('error');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('settle() cancels a pending save and waits for one on the wire', async () => {
    let resolveSave!: (value: unknown) => void;
    mutate.mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)));
    const { result } = setup();

    type('name', 'A');
    await flush();
    type('name', 'Ab');

    let settled = false;
    const settling = act(async () => {
      await result.current.settle();
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveSave(saved(1, { name: 'A' }));
    await settling;
    expect(settled).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS);
    });
    // The queued follow-up save was cancelled; only the settled one went out
    // before the store changed again.
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
