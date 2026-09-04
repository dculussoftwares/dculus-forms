import React, { useEffect, useRef, useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import { Loader2 } from 'lucide-react';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  Input,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@dculus/ui';
import { GET_DISTINCT_RESPONSE_FIELD_VALUES } from '../../graphql/queries';

const DEBOUNCE_MS = 300;

interface AsyncValueComboboxProps {
  formId: string;
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noMatchesLabel: string;
  className?: string;
}

/**
 * Dropdown-plus-free-text value input for a text-kind meta filter whose real values are
 * worth suggesting (browser, OS, country, editor/respondent email — see
 * MetaFilterField.supportsSuggestions). The text input IS the value — every keystroke
 * calls `onChange` directly, exactly like a plain Input — so typing an arbitrary value
 * (one not yet seen, or a CONTAINS/STARTS_WITH fragment) always works even if the
 * suggestions list is empty, still loading, or the query fails. Suggestions are pure
 * convenience: click one to autofill, or ignore the popover entirely.
 *
 * Uses PopoverAnchor rather than PopoverTrigger so the input's own focus/typing drives
 * `open` — a PopoverTrigger's built-in click-toggle would otherwise fight with that.
 */
export const AsyncValueCombobox: React.FC<AsyncValueComboboxProps> = ({
  formId,
  fieldId,
  value,
  onChange,
  placeholder,
  noMatchesLabel,
  className,
}) => {
  const [open, setOpen] = useState(false);
  // True from the moment a fetch is scheduled until it settles — spans BOTH the debounce
  // wait and the network request, so the popover shows a single continuous loading state
  // instead of flashing "no matches" while the debounce timer hasn't fired yet.
  const [waiting, setWaiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  // Tracks whether we've already fetched once for the current "open" session, so the very
  // first fetch (right when the popover opens) runs immediately — nothing to debounce yet,
  // the user hasn't typed anything since opening — while every subsequent fetch (typing)
  // still waits out DEBOUNCE_MS. Reset whenever the popover closes.
  const openedRef = useRef(false);
  // Bumped on every scheduled fetch; a settling request only clears `waiting` if it's still
  // the latest one. Without this, an older request that happens to settle AFTER a newer one
  // was scheduled (e.g. a slow first load overtaken by a fast debounced keystroke fetch)
  // would clear `waiting` while the newer, still-pending request is what the popover should
  // actually be waiting on — flashing the wrong state for a moment.
  const requestIdRef = useRef(0);

  const [fetchValues, { data, error }] = useLazyQuery(GET_DISTINCT_RESPONSE_FIELD_VALUES, {
    fetchPolicy: 'cache-first',
  });

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    const delay = openedRef.current ? DEBOUNCE_MS : 0;
    openedRef.current = true;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setWaiting(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(() => {
      fetchValues({ variables: { formId, fieldId, search: value || undefined, limit: 20 } }).finally(() => {
        if (requestIdRef.current === requestId) setWaiting(false);
      });
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, value, formId, fieldId, fetchValues]);

  const suggestions: string[] = !error && Array.isArray(data?.distinctResponseFieldValues)
    ? data.distinctResponseFieldValues
    : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={containerRef} className={className}>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            // Also reopen on click even when already focused — otherwise a second click
            // on an input that never blurred (e.g. right after picking a suggestion, or
            // pressing Escape) wouldn't fire another focus event and the popover would
            // stay stuck closed.
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder={placeholder}
            className="h-9"
            data-testid="meta-filter-combobox-input"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        // Keep keyboard focus on the text input, not the popover — this is a
        // suggestions list, not a modal picker; typing must keep working uninterrupted.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList className="max-h-52">
            {waiting ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">{noMatchesLabel}</div>
            ) : (
              <CommandGroup>
                {suggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => {
                      onChange(suggestion);
                      setOpen(false);
                    }}
                    className="text-sm"
                  >
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
