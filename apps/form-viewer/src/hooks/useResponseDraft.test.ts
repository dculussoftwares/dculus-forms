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
import { CombinedGraphQLErrors } from '@apollo/client';
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
    expect(result.current.conflict).toEqual({ kind: 'newer', draft: draft(7, { name: 'Other' }) });

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

  it('pauses on a draft submitted or cleared elsewhere until the respondent keeps saving', async () => {
    mutate.mockResolvedValueOnce({ data: { saveResponseDraft: { conflict: true, draft: null } } });
    const { result } = setup();
    act(() => result.current.seed(draft(4, {})));

    type('name', 'Mine');
    await flush();
    expect(result.current.conflict).toEqual({ kind: 'gone' });

    type('name', 'Mine 2');
    await flush();
    expect(mutate).toHaveBeenCalledTimes(1);

    mutate.mockResolvedValueOnce(saved(1, { name: 'Mine 2' }));
    await act(async () => {
      result.current.keepMine();
      await vi.runOnlyPendingTimersAsync();
    });
    // A brand-new draft: no base version to compare against.
    expect(lastInput()).toMatchObject({ data: { name: 'Mine 2' }, baseVersion: null });
    expect(result.current.conflict).toBeNull();
  });

  it('stops autosave on a rejection a retry cannot fix', async () => {
    mutate.mockResolvedValueOnce({
      error: new CombinedGraphQLErrors({ errors: [{ message: 'closed', extensions: { code: 'FORM_CLOSED' } }] }),
    });
    const { result } = setup();

    type('name', 'A');
    await flush();
    expect(result.current.status).toBe('stopped');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    type('name', 'Ab');
    await flush();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('backs off between retries of a failing save', async () => {
    mutate.mockResolvedValue({ error: new Error('offline') });
    setup();

    type('name', 'A');
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mutate).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mutate).toHaveBeenCalledTimes(3);
  });

  it('sends the hidden-tab save with keepalive and tracks its version', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => saved(1, { name: 'A' }) });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = setup();

    type('name', 'A');
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('pagehide'));
      await vi.runOnlyPendingTimersAsync();
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.unstubAllGlobals();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ keepalive: true });
    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');

    mutate.mockResolvedValueOnce(saved(2, { name: 'Ab' }));
    type('name', 'Ab');
    await flush();
    expect(lastInput().baseVersion).toBe(1);
  });

  it('start over pauses saves while it clears the answers and the server copy', async () => {
    mutate.mockResolvedValueOnce(saved(1, { name: 'A' }));
    const { result } = setup();
    type('name', 'A');
    await flush();

    type('name', 'Ab');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    mutate.mockResolvedValueOnce({ data: { discardResponseDraft: true } });
    await act(async () => {
      await result.current.discard(() => {
        // A hidden-tab save attempted mid-reset must not resend the old answers.
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
        useFormResponseStore.getState().clearAllResponses();
      });
      await vi.runOnlyPendingTimersAsync();
    });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    vi.unstubAllGlobals();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[1][0].variables).toEqual({ formId: 'form-1' });
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

  it('flush() saves a pending change at once, after one already on the wire', async () => {
    let resolveSave!: (value: unknown) => void;
    mutate
      .mockReturnValueOnce(new Promise((resolve) => (resolveSave = resolve)))
      .mockResolvedValueOnce(saved(2, { name: 'Ab' }));
    const { result } = setup();

    type('name', 'A');
    await flush();
    type('name', 'Ab');

    const flushing = act(() => result.current.flush());
    resolveSave(saved(1, { name: 'A' }));
    await flushing;

    expect(mutate).toHaveBeenCalledTimes(2);
    expect(lastInput()).toMatchObject({ data: { name: 'Ab' }, baseVersion: 1 });
  });
});
