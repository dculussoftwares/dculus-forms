import { act, render, screen, fireEvent } from '@testing-library/react';
import { useLazyQuery } from '@apollo/client/react';
import { AsyncValueCombobox } from '../AsyncValueCombobox';

// This file's own mock replaces setupTests.ts's global one (jest.mock is per-test-file),
// so it must supply every @dculus/ui piece AsyncValueCombobox uses. Popover/Command
// primitives are stubbed as plain passthrough elements — this test targets the
// component's own request-sequencing logic, not Radix's real open/close behavior
// (already exercised live; see PR #347).
jest.mock('@dculus/ui', () => {
  // jest.requireActual, not a bare require: a mock factory is hoisted above the imports
  // so it cannot close over the file's React binding, and the repo's eslint config
  // forbids require() style imports (see EmbedTab.test.tsx for the same pattern).
  const ReactActual = jest.requireActual('react');
  return {
    Input: (props: any) => ReactActual.createElement('input', props),
    Popover: ({ children }: any) => ReactActual.createElement(ReactActual.Fragment, null, children),
    PopoverAnchor: ({ children }: any) => ReactActual.createElement(ReactActual.Fragment, null, children),
    PopoverContent: ({ children }: any) => ReactActual.createElement('div', null, children),
    Command: ({ children }: any) => ReactActual.createElement('div', null, children),
    CommandList: ({ children }: any) => ReactActual.createElement('div', null, children),
    CommandGroup: ({ children }: any) => ReactActual.createElement('div', null, children),
    CommandItem: ({ children, onSelect }: any) =>
      ReactActual.createElement('div', { role: 'option', onClick: onSelect }, children),
  };
});

jest.mock('@apollo/client/react', () => ({ useLazyQuery: jest.fn() }));

// The real graphql/queries.ts module calls gql`...` for every export at import time,
// which requires a working ApolloClient setup this test doesn't need — stub it with a
// placeholder document, since useLazyQuery itself is mocked and never actually executes it.
jest.mock('../../../graphql/queries', () => ({ GET_DISTINCT_RESPONSE_FIELD_VALUES: {} }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('AsyncValueCombobox — out-of-order request settling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('keeps showing the loading state until the LATEST request settles, even if an older one resolves later', async () => {
    // <void> — nothing reads the resolved value; only settle-order/timing is under test.
    const calls: ReturnType<typeof deferred<void>>[] = [];
    const fetchValues = jest.fn(() => {
      const d = deferred<void>();
      calls.push(d);
      return d.promise;
    });
    (useLazyQuery as jest.Mock).mockReturnValue([fetchValues, { data: undefined, error: undefined }]);

    const { rerender } = render(
      <AsyncValueCombobox
        formId="form-1"
        fieldId="__browser"
        value=""
        onChange={() => {}}
        noMatchesLabel="No matches"
      />
    );

    const input = screen.getByTestId('meta-filter-combobox-input');

    // Open the popover — schedules request #1 immediately (nothing to debounce on first open).
    act(() => {
      fireEvent.focus(input);
    });
    act(() => {
      jest.advanceTimersByTime(0);
    });
    expect(fetchValues).toHaveBeenCalledTimes(1);

    // Simulate the user typing before request #1 settles — schedules request #2 after the
    // debounce window. `value` is a controlled prop here, so re-rendering the SAME instance
    // with a new value stands in for the parent updating state from onChange, same as real
    // usage — a fresh render() call would remount the component and reset its refs instead.
    rerender(
      <AsyncValueCombobox
        formId="form-1"
        fieldId="__browser"
        value="ch"
        onChange={() => {}}
        noMatchesLabel="No matches"
      />
    );

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(fetchValues).toHaveBeenCalledTimes(2);

    // Both requests pending — still loading, not the empty state.
    expect(screen.queryByText('No matches')).not.toBeInTheDocument();

    // The OLDER request (#1) settles after the newer one was scheduled. This must NOT
    // clear the loading state — request #2 (the latest) is still pending.
    await act(async () => {
      calls[0].resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText('No matches')).not.toBeInTheDocument();

    // The LATEST request (#2) settles — only now should the loading state clear.
    await act(async () => {
      calls[1].resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });
});
