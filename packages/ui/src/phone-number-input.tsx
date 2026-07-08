import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@dculus/utils';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';

export type { CountryCode };

/* ── Country data (zero new dependency: Intl.DisplayNames for names, code-point
   trick for flags — both native) ── */

export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

const countryNameFormatter =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

/** ISO 3166-1 alpha-2 → emoji flag, via regional indicator symbol code points. */
export const getCountryFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export const getCountryDisplayName = (countryCode: CountryCode): string =>
  countryNameFormatter?.of(countryCode) ?? countryCode;

let cachedCountryList: CountryOption[] | null = null;

/** Full country list (name, dial code, flag), sorted alphabetically by name. */
export const getCountryList = (): CountryOption[] => {
  if (cachedCountryList) return cachedCountryList;
  cachedCountryList = getCountries()
    .map((code) => ({
      code,
      name: getCountryDisplayName(code),
      dialCode: `+${getCountryCallingCode(code)}`,
      flag: getCountryFlagEmoji(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cachedCountryList;
};

/**
 * Best-effort guess of the respondent's country from the browser's own locale
 * (e.g. "en-US" -> "US"), for pre-selecting `PhoneNumberInput`'s country when no
 * `defaultCountry` is configured on the field. This is a UI-only initial-state
 * nicety — it is never persisted and never overrides an explicit `defaultCountry`.
 * Returns undefined (no guess) when the locale carries no region subtag (e.g. a
 * bare "en") rather than guessing — ambiguous locale→country mapping is a known
 * hard problem and a wrong guess is worse than no guess.
 */
export const guessCountryFromBrowserLocale = (): CountryCode | undefined => {
  if (typeof navigator === 'undefined') return undefined;
  const candidates = [navigator.language, ...(navigator.languages ?? [])].filter(
    Boolean
  );
  const known = new Set<string>(getCountries());
  for (const tag of candidates) {
    // BCP-47: language[-script]-REGION — region subtag is a 2-letter code.
    const match = tag.match(/-([A-Za-z]{2})(?:-|$)/);
    const region = match?.[1]?.toUpperCase();
    if (region && known.has(region)) {
      return region as CountryCode;
    }
  }
  return undefined;
};

/* ── CountrySelect — standalone searchable combobox ── */

export interface CountrySelectProps {
  value?: CountryCode;
  onChange: (value: CountryCode) => void;
  disabled?: boolean;
  className?: string;
  /** Compact mode shows flag + dial code only (used inside PhoneNumberInput); full mode shows flag + name + dial code (used standalone, e.g. the "Default Country" setting). */
  compact?: boolean;
  placeholder?: string;
  'aria-label'?: string;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  disabled,
  className,
  compact = false,
  placeholder = 'Select country',
  'aria-label': ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const countries = useMemo(() => getCountryList(), []);
  const selected = value ? countries.find((c) => c.code === value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? 'Select country'}
          disabled={disabled}
          className={cn(
            'justify-between font-normal',
            compact ? 'w-[92px] shrink-0 px-2' : 'w-full',
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true">{selected?.flag ?? '🏳️'}</span>
            {compact ? (
              <span className="text-sm">{selected?.dialCode ?? ''}</span>
            ) : (
              <span className="truncate text-sm">
                {selected ? `${selected.name} (${selected.dialCode})` : placeholder}
              </span>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search country..." />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((country) => (
                <CommandItem
                  key={country.code}
                  value={`${country.name} ${country.dialCode} ${country.code}`}
                  onSelect={() => {
                    onChange(country.code);
                    setOpen(false);
                  }}
                >
                  <span className="mr-2" aria-hidden="true">
                    {country.flag}
                  </span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {country.dialCode}
                  </span>
                  <Check
                    className={cn(
                      'ml-2 h-4 w-4',
                      country.code === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/* ── PhoneNumberInput — CountrySelect + number input, value in/out is a plain
   E.164 string (or '' when empty) ── */

export interface PhoneNumberInputProps {
  /** E.164 string (e.g. "+14155552671"), or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** ISO 3166-1 alpha-2 hint for pre-selecting the country when value is empty. */
  defaultCountry?: CountryCode;
  /** Best-effort browser-locale country guess when both value and defaultCountry are empty. See guessCountryFromBrowserLocale(). */
  browserLocaleFallback?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  error?: boolean;
  id?: string;
  name?: string;
}

/** Reformats raw/pasted input text under the given country, returning the
 * live-formatted display text plus both a best-effort E.164 reconstruction of
 * whatever was typed (`attempted` — non-empty as soon as any digit exists,
 * valid or not) and whether that reconstruction is actually a valid number.
 * Callers decide when it's appropriate to commit an invalid `attempted` value
 * (so it surfaces as a real validation error) vs. treating input as not-yet-
 * committed while the user is still composing a number. */
const formatInput = (text: string, country: CountryCode | undefined) => {
  const formatter = new AsYouType(country);
  const formatted = formatter.input(text);
  const parsed = formatter.getNumber();
  return {
    formatted,
    attempted: parsed?.number ?? '',
    isValid: !!parsed?.isValid(),
  };
};

export const PhoneNumberInput = React.forwardRef<
  HTMLInputElement,
  PhoneNumberInputProps
>(
  (
    {
      value,
      onChange,
      onBlur,
      defaultCountry,
      browserLocaleFallback = false,
      disabled,
      placeholder,
      className,
      error,
      id,
      name,
    },
    ref
  ) => {
    const parsedFromValue = useMemo(
      () => (value ? parsePhoneNumberFromString(value) : undefined),
      [value]
    );

    // Country pre-selection the user can make before typing any digits — only
    // relevant while `value` is empty; once a value exists its own country wins.
    const [pendingCountry, setPendingCountry] = useState<
      CountryCode | undefined
    >(
      () =>
        defaultCountry ??
        (browserLocaleFallback ? guessCountryFromBrowserLocale() : undefined)
    );
    // While the field is still empty, keep the pre-selected country in sync
    // with an externally-changing `defaultCountry` (e.g. the builder editing
    // the "Default Country" setting above this "Default Value" input) so the
    // user doesn't have to re-pick the country a second time. A non-empty
    // value's own embedded country always takes precedence over this.
    useEffect(() => {
      if (!value && defaultCountry) {
        setPendingCountry(defaultCountry);
      }
    }, [defaultCountry]);
    const country = parsedFromValue?.country ?? pendingCountry;

    // Locally-displayed text for the number input. Re-derived from the external
    // `value` whenever it changes externally (e.g. loading a different response,
    // or a builder "default value" set elsewhere) so the display never drifts
    // from the actual committed value.
    const [displayText, setDisplayText] = useState(() =>
      value ? formatInput(value, country).formatted : ''
    );
    // Local edits (typing, country switch) commit their own displayText
    // immediately and set this flag so the effect below — which fires right
    // after, once `onChange` propagates the new `value` back down — doesn't
    // clobber it. Without this, typing past the valid length for the current
    // country makes the number momentarily invalid, `onChange('')` fires, and
    // this effect would resync `displayText` from that now-empty `value`,
    // wiping everything the user just typed.
    const skipNextValueSyncRef = React.useRef(false);
    useEffect(() => {
      if (skipNextValueSyncRef.current) {
        skipNextValueSyncRef.current = false;
        return;
      }
      setDisplayText(value ? formatInput(value, country).formatted : '');
      // Only resync from the external value — re-running on every local keystroke
      // (which also changes `country` transiently) would fight the user's typing.
    }, [value]);

    const handleTextChange = (text: string) => {
      const { formatted, attempted, isValid } = formatInput(text, country);
      skipNextValueSyncRef.current = true;
      setDisplayText(formatted);
      if (isValid) {
        onChange(attempted);
      } else if (value) {
        // Was previously a valid, committed number — this edit broke it (e.g.
        // typed past the valid length for this country). Report the invalid
        // attempt immediately instead of silently reverting to "no default
        // value", which would let the broken edit slip through unnoticed
        // (wrong content, but reads as "nothing changed").
        onChange(attempted);
      } else if (!text) {
        onChange('');
      }
      // else: still composing a number that's never been valid this session —
      // don't commit yet, so a half-typed number doesn't flash a validation
      // error on every keystroke. It's captured on blur instead (see onBlur).
    };

    const handleCountryChange = (nextCountry: CountryCode) => {
      setPendingCountry(nextCountry);
      if (displayText.trim()) {
        const { formatted, attempted, isValid } = formatInput(
          displayText,
          nextCountry
        );
        skipNextValueSyncRef.current = true;
        setDisplayText(formatted);
        if (isValid) {
          onChange(attempted);
        } else if (value) {
          onChange(attempted);
        }
      }
    };

    const handleBlur = () => {
      // Leaving the field with unfinished, never-committed input (e.g. too
      // few digits, or a paste that's invalid under the current country) —
      // commit the best-effort attempt now so it surfaces as a real
      // validation error instead of silently disappearing as "no default
      // value" the moment the user tabs away.
      if (!value && displayText.trim()) {
        const { attempted, isValid } = formatInput(displayText, country);
        if (!isValid && attempted) {
          skipNextValueSyncRef.current = true;
          onChange(attempted);
        }
      }
      onBlur?.();
    };

    return (
      <div className={cn('flex gap-1.5', className)}>
        <CountrySelect
          compact
          value={country}
          onChange={handleCountryChange}
          disabled={disabled}
          aria-label="Country code"
        />
        <Input
          ref={ref}
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={displayText}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || 'Phone number'}
          disabled={disabled}
          className={cn(
            'flex-1',
            error && 'border-[#ce5d55] focus-visible:border-[#ce5d55]'
          )}
        />
      </div>
    );
  }
);
PhoneNumberInput.displayName = 'PhoneNumberInput';
