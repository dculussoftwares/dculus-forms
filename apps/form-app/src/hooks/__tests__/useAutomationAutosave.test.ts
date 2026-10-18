/**
 * Autosave behaviour of the automation builder: debounce + max-wait, single-flight coalescing,
 * ack bookkeeping (edits made mid-request stay pending), conflict pause, offline/retry backoff,
 * and flush. The real store is used (see automationBuilderSlice.test.ts for why zustand is
 * unmocked and the store is pulled in with require).
 */
jest.unmock('zustand');

if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

const saveMock = jest.fn();

jest.mock('@apollo/client/react', () => ({
  useMutation: () => [saveMock],
}));

class FakeCombinedGraphQLErrors extends Error {
  errors: { extensions?: Record<string, unknown> }[];
  constructor(errors: { extensions?: Record<string, unknown> }[]) {
    super('graphql error');
    this.errors = errors;
  }
  static is(error: unknown) {
    return error instanceof FakeCombinedGraphQLErrors;
  }
}
jest.mock('@apollo/client', () => ({ CombinedGraphQLErrors: FakeCombinedGraphQLErrors }));

jest.mock('../../graphql/automations', () => ({ SAVE_AUTOMATION_DRAFT: 'SAVE_AUTOMATION_DRAFT' }));

import { act, renderHook } from '@testing-library/react';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAutomationBuilderStore } = require('../../store/useAutomationBuilderStore') as typeof import('../../store/useAutomationBuilderStore');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAutomationAutosave, AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS, AUTOSAVE_RETRY_DELAYS_MS } = require('../useAutomationAutosave') as typeof import('../useAutomationAutosave');

const store = () => useAutomationBuilderStore.getState();

const savedResponse = (draftRevision: number) => ({
  data: {
    saveAutomationDraft: {
      automation: { id: 'automation-1', draftRevision, hasUnpublishedChanges: true },
      validationErrors: [],
    },
  },
});

const loadBuilder = (draftRevision = 0) =>
  store().loadGraph({
    automationId: 'automation-1',
    formTitle: 'Form',
    triggerType: 'form.submitted',
    graph: {
      nodes: [
        { id: 'trigger', type: 'trigger', data: { triggerType: 'form.submitted' } },
        { id: 'delay', type: 'delay', data: { amount: 1, unit: 'hours' } },
        { id: 'end', type: 'end' },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'delay' },
        { id: 'e2', source: 'delay', target: 'end' },
      ],
    },
    isReadOnly: false,
    draftRevision,
  });

const edit = (amount: number) => act(() => store().updateNodeData('delay', { amount }));
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear();
  saveMock.mockReset();
  saveMock.mockResolvedValue(savedResponse(1));
  loadBuilder();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAutomationAutosave', () => {
  test('saves once after the debounce, sending the graph and the base revision', async () => {
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    expect(store().saveState).toBe('pending');
    await advance(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(saveMock).not.toHaveBeenCalled();

    await advance(1);
    expect(saveMock).toHaveBeenCalledTimes(1);
    const { variables } = saveMock.mock.calls[0][0];
    expect(variables.id).toBe('automation-1');
    expect(variables.baseRevision).toBe(0);
    expect(variables.graph.nodes.find((n: any) => n.id === 'delay').data.amount).toBe(2);
    expect(variables.triggerConfig).toBeUndefined();

    expect(store().saveState).toBe('saved');
    expect(store().isDirty).toBe(false);
    expect(store().serverDraftRevision).toBe(1);
  });

  test('coalesces a burst of edits into one request', async () => {
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(300);
    edit(3);
    await advance(300);
    edit(4);
    await advance(AUTOSAVE_DEBOUNCE_MS);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0].variables.graph.nodes.find((n: any) => n.id === 'delay').data.amount).toBe(4);
  });

  test('continuous typing cannot postpone saving past the max wait', async () => {
    renderHook(() => useAutomationAutosave({ enabled: true }));

    for (let elapsed = 0; elapsed < AUTOSAVE_MAX_WAIT_MS; elapsed += 500) {
      edit(elapsed / 500 + 2);
      await advance(500);
    }

    expect(saveMock).toHaveBeenCalled();
  });

  test('an edit made while a request is in flight stays pending and is saved next', async () => {
    let release!: (value: unknown) => void;
    saveMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    saveMock.mockResolvedValueOnce(savedResponse(2));
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);
    expect(store().saveState).toBe('saving');

    edit(5);
    expect(store().saveState).toBe('saving');

    await act(async () => { release(savedResponse(1)); });
    expect(store().isDirty).toBe(true);
    expect(store().saveState).toBe('pending');
    expect(store().serverDraftRevision).toBe(1);

    await advance(AUTOSAVE_DEBOUNCE_MS);
    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(saveMock.mock.calls[1][0].variables.baseRevision).toBe(1);
    expect(saveMock.mock.calls[1][0].variables.graph.nodes.find((n: any) => n.id === 'delay').data.amount).toBe(5);
    expect(store().isDirty).toBe(false);
  });

  test('a revision conflict pauses autosave and records who saved last', async () => {
    saveMock.mockRejectedValue(
      new FakeCombinedGraphQLErrors([
        { extensions: { code: 'AUTOMATION_DRAFT_CONFLICT', draftRevision: 7, draftUpdatedAt: '2026-10-18T06:00:00.000Z', draftUpdatedById: 'someone' } },
      ])
    );
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);

    expect(store().saveState).toBe('conflict');
    expect(store().conflict).toEqual({ draftRevision: 7, draftUpdatedAt: '2026-10-18T06:00:00.000Z', draftUpdatedById: 'someone' });

    edit(3);
    await advance(AUTOSAVE_MAX_WAIT_MS * 2);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(store().saveState).toBe('conflict');
  });

  test('overwriteWithMine re-sends the edits with force and resumes', async () => {
    saveMock.mockRejectedValueOnce(
      new FakeCombinedGraphQLErrors([{ extensions: { code: 'AUTOMATION_DRAFT_CONFLICT', draftRevision: 7 } }])
    );
    saveMock.mockResolvedValueOnce(savedResponse(8));
    const { result } = renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);
    expect(store().saveState).toBe('conflict');

    let ok = false;
    await act(async () => { ok = await result.current.overwriteWithMine(); });

    expect(ok).toBe(true);
    expect(saveMock.mock.calls[1][0].variables.force).toBe(true);
    expect(store().saveState).toBe('saved');
    expect(store().conflict).toBeNull();
  });

  test('network failures retry with backoff, then surface as an error that retry() recovers from', async () => {
    saveMock.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(store().saveState).toBe('pending');

    for (const delay of AUTOSAVE_RETRY_DELAYS_MS) {
      await advance(delay);
    }
    expect(saveMock).toHaveBeenCalledTimes(1 + AUTOSAVE_RETRY_DELAYS_MS.length);
    expect(store().saveState).toBe('error');
    expect(store().isDirty).toBe(true);

    saveMock.mockResolvedValue(savedResponse(1));
    await act(async () => { await result.current.retry(); });
    expect(store().saveState).toBe('saved');
  });

  test('reports offline instead of retrying when the browser has no connection', async () => {
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    saveMock.mockRejectedValue(new Error('Failed to fetch'));
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);

    expect(store().saveState).toBe('offline');
    await advance(AUTOSAVE_RETRY_DELAYS_MS[0] * 2);
    expect(saveMock).toHaveBeenCalledTimes(1);

    onLine.mockReturnValue(true);
    saveMock.mockResolvedValue(savedResponse(1));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(store().saveState).toBe('saved');
    onLine.mockRestore();
  });

  test('does not retry GraphQL errors that retrying cannot fix', async () => {
    saveMock.mockRejectedValue(new FakeCombinedGraphQLErrors([{ extensions: { code: 'NO_ACCESS' } }]));
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);
    await advance(AUTOSAVE_RETRY_DELAYS_MS[0] * 3);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(store().saveState).toBe('error');
  });

  test('flush saves immediately without waiting for the debounce', async () => {
    const { result } = renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    let ok = false;
    await act(async () => { ok = await result.current.flush(); });

    expect(ok).toBe(true);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(store().saveState).toBe('saved');

    await advance(AUTOSAVE_DEBOUNCE_MS * 2);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  test('flush resolves true straight away when there is nothing to save', async () => {
    const { result } = renderHook(() => useAutomationAutosave({ enabled: true }));
    let ok = false;
    await act(async () => { ok = await result.current.flush(); });
    expect(ok).toBe(true);
    expect(saveMock).not.toHaveBeenCalled();
  });

  test('never saves when disabled (read-only viewers)', async () => {
    renderHook(() => useAutomationAutosave({ enabled: false }));

    edit(2);
    await advance(AUTOSAVE_MAX_WAIT_MS * 2);

    expect(saveMock).not.toHaveBeenCalled();
  });

  test('a restored local draft is sent on mount', async () => {
    store().updateNodeData('delay', { amount: 9 }); // mirrors to sessionStorage with baseRevision 0
    loadBuilder(0); // simulates a reload: restores the mirror
    expect(store().isDirty).toBe(true);

    renderHook(() => useAutomationAutosave({ enabled: true }));
    await advance(AUTOSAVE_DEBOUNCE_MS);

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock.mock.calls[0][0].variables.graph.nodes.find((n: any) => n.id === 'delay').data.amount).toBe(9);
  });

  test('a stale response after the builder was reloaded is ignored', async () => {
    let release!: (value: unknown) => void;
    saveMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    renderHook(() => useAutomationAutosave({ enabled: true }));

    edit(2);
    await advance(AUTOSAVE_DEBOUNCE_MS);
    act(() => loadBuilder(5)); // e.g. "Load latest"
    await act(async () => { release(savedResponse(99)); });

    expect(store().serverDraftRevision).toBe(5);
  });
});
