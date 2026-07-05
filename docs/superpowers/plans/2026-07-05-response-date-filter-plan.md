# Response Table Submitted-Date Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the responses table's plain date-range picker with a preset dropdown (All time / Last 24 hours / Last 7 days / Last 30 days / Custom range with time-of-day), and make Excel/CSV export honor the same filters (date range + tags + field filters) the table view uses.

**Architecture:** A new `DateTimeRangePicker` component in `@dculus/ui` (composed from existing `Popover`/`Calendar`/`Button` plus a newly-added shadcn `input-group` primitive) replaces `DateRangePicker` in the toolbar. Presets map to the backend's existing `DATE_LAST_N_DAYS` operator (no backend change — it's already a rolling window computed server-side); custom range maps to the existing `DATE_BETWEEN` operator with a browser-local date+time combined into a UTC ISO string. Export is fixed by sending the same `graphqlFilters` array already built for the table's list query, instead of the current export-only conversion that silently drops the date and tag filters.

**Tech Stack:** React 18, TypeScript, Radix UI (`@radix-ui/react-popover`), `react-day-picker` (via existing `Calendar`), `date-fns`, Jest + `ts-jest` (form-app unit tests), pnpm workspaces.

## Global Constraints

- No backend/GraphQL schema changes — confirmed the `DATE_LAST_N_DAYS` and `DATE_BETWEEN` operators on the `__submittedAt` scope filter already do everything needed (`apps/backend/src/services/responseFilterService.ts:114-118`, `apps/backend/src/services/responseQueryBuilder.ts:105-108`).
- `form-app` requires i18n for all user-facing strings in **both** `en` and `ta` (`apps/form-app/src/locales/{en,ta}/responses.json`) — per `CLAUDE.md`.
- `packages/ui` has no test runner (only `tsc` build + Storybook, no unit tests exist for any component including the current `date-picker.tsx`) — new UI-layer code is verified by type-check + manual browser check, not Jest.
- `form-app` uses Jest (`ts-jest`, jsdom) via `apps/form-app/jest.config.js`; `@dculus/ui` is globally mocked in `apps/form-app/src/setupTests.ts:42-58` with only a few components — full RTL rendering of Radix-Popover-based components is not the established pattern here, so new pure logic is unit-tested directly (no rendering), and the wired-up UI is checked manually in a browser per task 7.
- `apps/form-app`'s Jest `moduleNameMapper` resolves `@dculus/*` imports to each package's **built** `dist/` output (`apps/form-app/jest.config.js:19`) — after editing `packages/ui/src`, you must run `pnpm --filter @dculus/ui build` before form-app Jest tests or the dev server will see the new exports.

---

### Task 1: Add the `input-group` primitive to `@dculus/ui`

**Files:**
- Create: `packages/ui/src/input-group.tsx`
- Modify: `packages/ui/src/index.ts` (add export line after line 69)

**Interfaces:**
- Produces: `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`, `InputGroupInput`, `InputGroupTextarea` — all exported from `@dculus/ui`. Task 2 consumes `InputGroup`, `InputGroupAddon`, `InputGroupInput`.

This is the shadcn `input-group` registry component (fetched live via the shadcn MCP `get_add_command_for_items`/`view_items_in_registries` tools during design — no official shadcn "time picker" exists, so this primitive plus a native `<input type="time">` is the standard hand-composed approach shadcn itself uses), adapted to this repo's import conventions (`@dculus/utils` for `cn`, relative imports for `./button`, `./input`, `./textarea`).

- [ ] **Step 1: Create the input-group primitive**

Create `packages/ui/src/input-group.tsx`:

```tsx
"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@dculus/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Textarea } from "./textarea"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(
        "group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30",
        "h-9 min-w-0 has-[>textarea]:h-auto",
        "has-[>[data-align=inline-start]]:[&>input]:pl-2",
        "has-[>[data-align=inline-end]]:[&>input]:pr-2",
        "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
        "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
        "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
        "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start":
          "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end":
          "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
      },
    },
    defaultVariants: {
      align: "inline-start",
    },
  }
)

function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) {
          return
        }
        e.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
        "icon-xs":
          "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
        "icon-sm": "size-8 p-0 has-[>svg]:p-0",
      },
    },
    defaultVariants: {
      size: "xs",
    },
  }
)

function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size"> &
  VariantProps<typeof inputGroupButtonVariants>) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
```

- [ ] **Step 2: Export it from the package index**

In `packages/ui/src/index.ts`, immediately after line 69 (`export { DatePicker, DateRangePicker } from "./date-picker"`), add:

```ts
export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
} from "./input-group"
```

- [ ] **Step 3: Verify the package builds**

Run: `pnpm --filter @dculus/ui build`
Expected: exits 0, no TypeScript errors. This runs `tsc` per `packages/ui/package.json`'s `build` script and regenerates `packages/ui/dist/` (which is what `apps/form-app`'s Jest tests and dev server resolve `@dculus/ui` imports to).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/input-group.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add input-group primitive from shadcn"
```

---

### Task 2: Build the `DateTimeRangePicker` component

**Files:**
- Create: `packages/ui/src/date-time-range-picker.tsx`
- Modify: `packages/ui/src/index.ts` (add export after the input-group export block added in Task 1)

**Interfaces:**
- Consumes: `InputGroup`, `InputGroupAddon`, `InputGroupInput` (Task 1); `Popover`/`PopoverTrigger`/`PopoverContent` (`./popover`), `Calendar` (`./calendar`), `Button` (`./button`) — all pre-existing.
- Produces:
  - `type SubmittedAtPreset = "last1d" | "last7d" | "last30d"`
  - `type DateTimeRangeValue = { preset: SubmittedAtPreset } | { preset: "custom"; from: Date; to: Date }`
  - `interface DateTimeRangePickerLabels { allTime: string; last24Hours: string; last7Days: string; last30Days: string; customRange: string; apply: string; cancel: string; fromTime: string; toTime: string }`
  - `function DateTimeRangePicker(props: { value: DateTimeRangeValue | null; onChange: (value: DateTimeRangeValue | null) => void; labels: DateTimeRangePickerLabels; disabled?: boolean; className?: string }): JSX.Element`
  - These three types plus the component are what Task 3 (form-app helper) and Task 6 (`ResponsesToolbar.tsx`) import from `@dculus/ui`.

- [ ] **Step 1: Create the component**

Create `packages/ui/src/date-time-range-picker.tsx`:

```tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock, X, Check } from "lucide-react"

import { cn } from "@dculus/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"

export type SubmittedAtPreset = "last1d" | "last7d" | "last30d"

export type DateTimeRangeValue =
  | { preset: SubmittedAtPreset }
  | { preset: "custom"; from: Date; to: Date }

export interface DateTimeRangePickerLabels {
  allTime: string
  last24Hours: string
  last7Days: string
  last30Days: string
  customRange: string
  apply: string
  cancel: string
  fromTime: string
  toTime: string
}

interface DateTimeRangePickerProps {
  value: DateTimeRangeValue | null
  onChange: (value: DateTimeRangeValue | null) => void
  labels: DateTimeRangePickerLabels
  disabled?: boolean
  className?: string
}

const PRESET_ORDER: SubmittedAtPreset[] = ["last1d", "last7d", "last30d"]

function formatTimeForInput(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0")
  const mm = String(date.getMinutes()).padStart(2, "0")
  return `${hh}:${mm}`
}

function combineDateAndTime(date: Date, time: string): Date {
  const [hoursStr, minutesStr] = time.split(":")
  const hours = Number(hoursStr)
  const minutes = Number(minutesStr)
  const combined = new Date(date)
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  )
  return combined
}

/**
 * DateTimeRangePicker
 *
 * Toolbar-style dropdown for the responses table's submission-date filter.
 * Rolling presets ("last1d"/"last7d"/"last30d") carry no from/to — the
 * backend resolves them against its own clock via DATE_LAST_N_DAYS, so
 * they're immune to browser timezone drift. Only "custom" carries explicit
 * from/to Date objects (already combined with the user's chosen time-of-day
 * in the browser's local timezone) for the backend's DATE_BETWEEN operator.
 *
 * @example
 * <DateTimeRangePicker
 *   value={submittedAtFilter}
 *   onChange={setSubmittedAtFilter}
 *   labels={{ allTime: 'All time', last24Hours: 'Last 24 hours', ... }}
 * />
 */
export function DateTimeRangePicker({
  value,
  onChange,
  labels,
  disabled = false,
  className,
}: DateTimeRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [showCustom, setShowCustom] = React.useState(value?.preset === "custom")
  const [draftRange, setDraftRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>(
    value?.preset === "custom"
      ? { from: value.from, to: value.to }
      : { from: undefined, to: undefined }
  )
  const [draftFromTime, setDraftFromTime] = React.useState(
    value?.preset === "custom" ? formatTimeForInput(value.from) : "00:00"
  )
  const [draftToTime, setDraftToTime] = React.useState(
    value?.preset === "custom" ? formatTimeForInput(value.to) : "23:59"
  )

  const presetLabel: Record<SubmittedAtPreset, string> = {
    last1d: labels.last24Hours,
    last7d: labels.last7Days,
    last30d: labels.last30Days,
  }

  const triggerLabel = React.useMemo(() => {
    if (!value) return labels.allTime
    if (value.preset === "custom") {
      return `${format(value.from, "MMM d, h:mm a")} - ${format(value.to, "MMM d, h:mm a")}`
    }
    return presetLabel[value.preset]
  }, [value, labels])

  const resetDraftFromValue = React.useCallback(() => {
    setShowCustom(value?.preset === "custom")
    setDraftRange(
      value?.preset === "custom"
        ? { from: value.from, to: value.to }
        : { from: undefined, to: undefined }
    )
    setDraftFromTime(value?.preset === "custom" ? formatTimeForInput(value.from) : "00:00")
    setDraftToTime(value?.preset === "custom" ? formatTimeForInput(value.to) : "23:59")
  }, [value])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) resetDraftFromValue()
  }

  const handlePresetClick = (preset: SubmittedAtPreset) => {
    onChange({ preset })
    setOpen(false)
  }

  const handleAllTimeClick = () => {
    onChange(null)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const handleApplyCustom = () => {
    if (!draftRange.from || !draftRange.to) return
    onChange({
      preset: "custom",
      from: combineDateAndTime(draftRange.from, draftFromTime),
      to: combineDateAndTime(draftRange.to, draftToTime),
    })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className={cn("relative inline-flex", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn("h-8 justify-start gap-1.5 text-xs font-normal", value && "pr-7")}
          >
            <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate max-w-[220px]">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={labels.allTime}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-0">
        {!showCustom ? (
          <div className="flex flex-col p-1.5 min-w-[180px]">
            <button
              type="button"
              onClick={handleAllTimeClick}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              {labels.allTime}
              {!value && <Check className="h-3.5 w-3.5" />}
            </button>
            {PRESET_ORDER.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetClick(preset)}
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
              >
                {presetLabel[preset]}
                {value?.preset === preset && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-accent"
            >
              {labels.customRange}
              {value?.preset === "custom" && <Check className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <Calendar
              mode="range"
              selected={draftRange}
              onSelect={(range) => setDraftRange({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
              initialFocus
            />
            <div className="flex items-center gap-2 border-t p-3">
              <InputGroup className="h-8 w-28">
                <InputGroupAddon>
                  <Clock className="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="time"
                  aria-label={labels.fromTime}
                  value={draftFromTime}
                  onChange={(e) => setDraftFromTime(e.target.value)}
                />
              </InputGroup>
              <span className="text-muted-foreground text-xs">-</span>
              <InputGroup className="h-8 w-28">
                <InputGroupAddon>
                  <Clock className="h-3.5 w-3.5" />
                </InputGroupAddon>
                <InputGroupInput
                  type="time"
                  aria-label={labels.toTime}
                  value={draftToTime}
                  onChange={(e) => setDraftToTime(e.target.value)}
                />
              </InputGroup>
            </div>
            <div className="flex items-center justify-end gap-2 border-t p-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCustom(false)}>
                {labels.cancel}
              </Button>
              <Button
                size="sm"
                disabled={!draftRange.from || !draftRange.to}
                onClick={handleApplyCustom}
              >
                {labels.apply}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Export it from the package index**

In `packages/ui/src/index.ts`, after the `input-group` export block added in Task 1, add:

```ts
export {
  DateTimeRangePicker,
  type DateTimeRangeValue,
  type SubmittedAtPreset,
  type DateTimeRangePickerLabels,
} from "./date-time-range-picker"
```

- [ ] **Step 3: Verify the package builds**

Run: `pnpm --filter @dculus/ui build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/date-time-range-picker.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add DateTimeRangePicker with presets and custom time range"
```

---

### Task 3: Pure filter-mapping helper (TDD)

**Files:**
- Create: `apps/form-app/src/lib/submittedAtFilter.ts`
- Test: `apps/form-app/src/lib/__tests__/submittedAtFilter.test.ts`

**Interfaces:**
- Consumes: `DateTimeRangeValue` type from `@dculus/ui` (Task 2).
- Produces: `function buildSubmittedAtGraphqlFilter(filter: DateTimeRangeValue | null): { fieldId: '__submittedAt'; operator: 'DATE_LAST_N_DAYS' | 'DATE_BETWEEN'; value?: string; values?: string[]; dateRange?: { from?: string; to?: string }; numberRange?: undefined } | null` — consumed by Task 4 (`useResponsesState.ts`).

This is the one piece of new business logic with no rendering involved (by the time it runs, `from`/`to` on a custom value are already final `Date` objects — the UI component did the date+time combining). It is the correct TDD unit-test target in this codebase, matching the existing `FilterState`/`ResponseFilter` shape (`fieldId, operator, value, values, dateRange, numberRange` — see `apps/form-app/src/components/Filters/FilterPanel.tsx:8-16` and `apps/backend/src/services/responseFilterService.ts:1-8`).

- [ ] **Step 1: Write the failing tests**

Create `apps/form-app/src/lib/__tests__/submittedAtFilter.test.ts`:

```ts
import { buildSubmittedAtGraphqlFilter } from '../submittedAtFilter';

describe('buildSubmittedAtGraphqlFilter', () => {
  test('returns null for "All time" (null filter)', () => {
    expect(buildSubmittedAtGraphqlFilter(null)).toBeNull();
  });

  test('maps last1d preset to DATE_LAST_N_DAYS with value "1"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last1d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '1',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps last7d preset to DATE_LAST_N_DAYS with value "7"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last7d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '7',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps last30d preset to DATE_LAST_N_DAYS with value "30"', () => {
    expect(buildSubmittedAtGraphqlFilter({ preset: 'last30d' })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_LAST_N_DAYS',
      value: '30',
      values: undefined,
      dateRange: undefined,
      numberRange: undefined,
    });
  });

  test('maps custom range to DATE_BETWEEN with ISO dateRange', () => {
    const from = new Date('2026-01-03T09:00:00.000-05:00');
    const to = new Date('2026-01-10T17:30:00.000-05:00');
    expect(buildSubmittedAtGraphqlFilter({ preset: 'custom', from, to })).toEqual({
      fieldId: '__submittedAt',
      operator: 'DATE_BETWEEN',
      value: undefined,
      values: undefined,
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      numberRange: undefined,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter form-app test -- submittedAtFilter`
Expected: FAIL — `Cannot find module '../submittedAtFilter'`

- [ ] **Step 3: Implement the helper**

Create `apps/form-app/src/lib/submittedAtFilter.ts`:

```ts
import type { DateTimeRangeValue } from '@dculus/ui';

export interface SubmittedAtGraphqlFilter {
  fieldId: '__submittedAt';
  operator: 'DATE_LAST_N_DAYS' | 'DATE_BETWEEN';
  value: string | undefined;
  values: string[] | undefined;
  dateRange: { from?: string; to?: string } | undefined;
  numberRange: { min?: number; max?: number } | undefined;
}

const PRESET_DAYS: Record<'last1d' | 'last7d' | 'last30d', string> = {
  last1d: '1',
  last7d: '7',
  last30d: '30',
};

export function buildSubmittedAtGraphqlFilter(
  filter: DateTimeRangeValue | null
): SubmittedAtGraphqlFilter | null {
  if (!filter) return null;

  if (filter.preset === 'custom') {
    return {
      fieldId: '__submittedAt',
      operator: 'DATE_BETWEEN',
      value: undefined,
      values: undefined,
      dateRange: { from: filter.from.toISOString(), to: filter.to.toISOString() },
      numberRange: undefined,
    };
  }

  return {
    fieldId: '__submittedAt',
    operator: 'DATE_LAST_N_DAYS',
    value: PRESET_DAYS[filter.preset],
    values: undefined,
    dateRange: undefined,
    numberRange: undefined,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter form-app test -- submittedAtFilter`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/lib/submittedAtFilter.ts apps/form-app/src/lib/__tests__/submittedAtFilter.test.ts
git commit -m "feat(form-app): add pure submittedAt preset-to-GraphQL-filter mapper"
```

---

### Task 4: Wire the new filter into `useResponsesState.ts` and fix export

**Files:**
- Modify: `apps/form-app/src/hooks/useResponsesState.ts:14-17` (imports), `:85-91` (interface), `:169-175` (state), `:253-292` (graphqlFilters memo), `:294-359` (export helpers), `:428-430` (return statement)

**Interfaces:**
- Consumes: `DateTimeRangeValue` (from `@dculus/ui`, Task 2), `buildSubmittedAtGraphqlFilter` (Task 3).
- Produces: `UseResponsesStateReturn.submittedAtFilter: DateTimeRangeValue | null`, `UseResponsesStateReturn.setSubmittedAtFilter: (filter: DateTimeRangeValue | null) => void` — consumed by Task 6 (`ResponsesToolbar.tsx`) and Task 7 (`Responses.tsx` prop wiring).

This task does two things: (1) swaps the date-only `submittedAtRange` state for the new `submittedAtFilter`, and (2) fixes the pre-existing export bug where `handleExport` builds its own filter list via `convertFiltersForExport()` and silently omits the `__submittedAt` and `__tags` scope filters that the table's own list query already includes via `graphqlFilters`. The fix is to send `graphqlFilters` (and mirror its exact `filterLogic` gating) to the export mutation instead, matching the pattern already used for the main list query in `apps/form-app/src/pages/Responses.tsx:204-205`.

- [ ] **Step 1: Update the import and interface**

In `apps/form-app/src/hooks/useResponsesState.ts`, replace line 14-17:

```ts
import { FormResponse } from '@dculus/types';
import { FilterState } from '../components/Filters';
import { GENERATE_FORM_RESPONSE_REPORT } from '../graphql/queries';
import { DELETE_RESPONSES } from '../graphql/mutations';
```

with:

```ts
import { FormResponse } from '@dculus/types';
import type { DateTimeRangeValue } from '@dculus/ui';
import { FilterState } from '../components/Filters';
import { buildSubmittedAtGraphqlFilter } from '../lib/submittedAtFilter';
import { GENERATE_FORM_RESPONSE_REPORT } from '../graphql/queries';
import { DELETE_RESPONSES } from '../graphql/mutations';
```

Then replace the interface block at lines 85-87:

```ts
  // Submission date range filter
  submittedAtRange: { from?: Date; to?: Date } | null;
  setSubmittedAtRange: (range: { from?: Date; to?: Date } | null) => void;
```

with:

```ts
  // Submission date filter (presets or custom range)
  submittedAtFilter: DateTimeRangeValue | null;
  setSubmittedAtFilter: (filter: DateTimeRangeValue | null) => void;
```

- [ ] **Step 2: Update the state declaration**

Replace lines 169-175:

```ts
  // Submission date range filter
  const [submittedAtRangeState, setSubmittedAtRangeRaw] = useState<{ from?: Date; to?: Date } | null>(null);
  const submittedAtRange = submittedAtRangeState;
  const setSubmittedAtRange = (range: { from?: Date; to?: Date } | null) => {
    setSubmittedAtRangeRaw(range);
    setCurrentPage(1);
  };
```

with:

```ts
  // Submission date filter (presets or custom range)
  const [submittedAtFilter, setSubmittedAtFilterRaw] = useState<DateTimeRangeValue | null>(null);
  const setSubmittedAtFilter = (filter: DateTimeRangeValue | null) => {
    setSubmittedAtFilterRaw(filter);
    setCurrentPage(1);
  };
```

- [ ] **Step 3: Update the `graphqlFilters` memo**

Replace lines 266-278 (the `__submittedAt` block inside the `graphqlFilters` `useMemo`):

```ts
    if (submittedAtRange && (submittedAtRange.from || submittedAtRange.to)) {
      mapped.push({
        fieldId: '__submittedAt',
        operator: 'DATE_BETWEEN',
        value: undefined,
        values: undefined,
        dateRange: {
          from: submittedAtRange.from?.toISOString(),
          to: submittedAtRange.to?.toISOString(),
        },
        numberRange: undefined,
      });
    }
```

with:

```ts
    const submittedAtGraphqlFilter = buildSubmittedAtGraphqlFilter(submittedAtFilter);
    if (submittedAtGraphqlFilter) {
      mapped.push(submittedAtGraphqlFilter);
    }
```

And update the memo's dependency array at line 292 from `[filters, submittedAtRange, selectedTagIds]` to `[filters, submittedAtFilter, selectedTagIds]`.

- [ ] **Step 4: Fix export to use `graphqlFilters` and delete the dead helper**

Delete the `convertFiltersForExport` function entirely (lines 294-316):

```ts
  // Convert frontend filters to GraphQL export format
  const convertFiltersForExport = () => {
    return Object.values(filters)
      .filter((filter) => filter.active)
      .map((filter) => ({
        fieldId: filter.fieldId,
        operator: filter.operator,
        value: filter.value || undefined,
        values: filter.values || undefined,
        dateRange: filter.dateRange
          ? {
            from: filter.dateRange.from || undefined,
            to: filter.dateRange.to || undefined,
          }
          : undefined,
        numberRange: filter.numberRange
          ? {
            min: filter.numberRange.min || undefined,
            max: filter.numberRange.max || undefined,
          }
          : undefined,
      }));
  };
```

Then in `handleExport` (originally lines 331-349), replace:

```ts
    try {
      const activeFilters = convertFiltersForExport();
      const hasFilters = activeFilters.length > 0;

      console.log(
        `Generating ${format} report on backend${hasFilters ? ` with ${activeFilters.length} filters` : ' (all responses)'}...`
      );

      const { data } = await generateReport({
        variables: {
          formId,
          format,
          filters: hasFilters ? activeFilters : undefined,
          filterLogic: hasFilters && activeFilters.length > 1 ? filterLogic : undefined,
        },
      });
```

with:

```ts
    try {
      const hasFilters = !!graphqlFilters && graphqlFilters.length > 0;

      console.log(
        `Generating ${format} report on backend${hasFilters ? ` with ${graphqlFilters!.length} filters` : ' (all responses)'}...`
      );

      const { data } = await generateReport({
        variables: {
          formId,
          format,
          filters: hasFilters ? graphqlFilters : undefined,
          filterLogic: hasFilters && graphqlFilters!.length > 1 ? filterLogic : undefined,
        },
      });
```

This makes export respect every filter the table view respects: per-field filters, the `__submittedAt` date filter (preset or custom), and the `__tags` tag filter — matching exactly what `apps/form-app/src/pages/Responses.tsx:204-205` already sends for the paginated list query.

- [ ] **Step 5: Update the return statement**

Replace lines 428-430:

```ts
    // Submission date range
    submittedAtRange,
    setSubmittedAtRange,
```

with:

```ts
    // Submission date filter
    submittedAtFilter,
    setSubmittedAtFilter,
```

- [ ] **Step 6: Type-check**

Run: `pnpm --filter form-app type-check`
Expected: exits 0. (This will surface any remaining references to the old `submittedAtRange`/`setSubmittedAtRange` names — Task 6 fixes the one remaining call site in `ResponsesToolbar.tsx`, so some errors here are expected until Task 6 lands; if running tasks in strict order, note this and proceed — Task 6 completes the rename.)

- [ ] **Step 7: Commit**

```bash
git add apps/form-app/src/hooks/useResponsesState.ts
git commit -m "feat(form-app): wire submittedAtFilter presets + fix export to include date/tag filters"
```

---

### Task 5: Add i18n keys

**Files:**
- Modify: `apps/form-app/src/locales/en/responses.json:41-43`
- Modify: `apps/form-app/src/locales/ta/responses.json` (`toolbar.dateRange` block)

**Interfaces:**
- Produces: translation keys under `toolbar.dateRange.*` consumed by Task 6 (`ResponsesToolbar.tsx`) via `t('toolbar.dateRange.<key>')`.

- [ ] **Step 1: Update English translations**

In `apps/form-app/src/locales/en/responses.json`, replace:

```json
    "dateRange": {
      "placeholder": "All time"
    },
```

with:

```json
    "dateRange": {
      "placeholder": "All time",
      "allTime": "All time",
      "last24Hours": "Last 24 hours",
      "last7Days": "Last 7 days",
      "last30Days": "Last 30 days",
      "customRange": "Custom range",
      "apply": "Apply",
      "cancel": "Cancel",
      "fromTime": "From time",
      "toTime": "To time"
    },
```

- [ ] **Step 2: Update Tamil translations**

In `apps/form-app/src/locales/ta/responses.json`, replace:

```json
  "dateRange": {
    "placeholder": "எல்லா நேரமும்"
  },
```

with:

```json
  "dateRange": {
    "placeholder": "எல்லா நேரமும்",
    "allTime": "எல்லா நேரமும்",
    "last24Hours": "கடந்த 24 மணி நேரம்",
    "last7Days": "கடந்த 7 நாட்கள்",
    "last30Days": "கடந்த 30 நாட்கள்",
    "customRange": "தனிப்பயன் வரம்பு",
    "apply": "பயன்படுத்து",
    "cancel": "ரத்துசெய்",
    "fromTime": "தொடக்க நேரம்",
    "toTime": "முடிவு நேரம்"
  },
```

(Note: the Tamil JSON in this codebase uses 2-space indentation without the extra nesting level `en` has under `toolbar` — match whatever indentation already surrounds this block in the file; the JSON structure/keys matter, not whitespace.)

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/form-app/src/locales/en/responses.json'))" && node -e "JSON.parse(require('fs').readFileSync('apps/form-app/src/locales/ta/responses.json'))"`
Expected: no output, exit 0 (both files still parse as valid JSON).

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/locales/en/responses.json apps/form-app/src/locales/ta/responses.json
git commit -m "i18n: add submitted-date filter preset labels (en, ta)"
```

---

### Task 6: Swap the toolbar's date picker

**Files:**
- Modify: `apps/form-app/src/components/Responses/ResponsesToolbar.tsx:1-30` (imports), `:89-112` (props interface), `:115-137` (destructured props), `:185-196` (the picker itself)

**Interfaces:**
- Consumes: `DateTimeRangePicker`, `DateTimeRangeValue` (from `@dculus/ui`, Task 2); `submittedAtFilter`/`setSubmittedAtFilter` (from `useResponsesState`, Task 4); `t('toolbar.dateRange.*')` keys (Task 5).
- Produces: `ResponsesToolbarProps.submittedAtFilter: DateTimeRangeValue | null`, `ResponsesToolbarProps.onSubmittedAtFilterChange: (filter: DateTimeRangeValue | null) => void` — consumed by Task 7 (`Responses.tsx`).

- [ ] **Step 1: Update imports**

In `apps/form-app/src/components/Responses/ResponsesToolbar.tsx`, replace:

```ts
import {
  Button,
  Checkbox,
  DateRangePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@dculus/ui';
```

with:

```ts
import {
  Button,
  Checkbox,
  DateTimeRangePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  type DateTimeRangeValue,
} from '@dculus/ui';
```

- [ ] **Step 2: Update the props interface**

Replace:

```ts
  submittedAtRange: { from?: Date; to?: Date } | null;
  onSubmittedAtRangeChange: (range: { from?: Date; to?: Date } | null) => void;
```

with:

```ts
  submittedAtFilter: DateTimeRangeValue | null;
  onSubmittedAtFilterChange: (filter: DateTimeRangeValue | null) => void;
```

- [ ] **Step 3: Update the destructured props**

Replace:

```ts
  submittedAtRange,
  onSubmittedAtRangeChange,
```

with:

```ts
  submittedAtFilter,
  onSubmittedAtFilterChange,
```

- [ ] **Step 4: Replace the picker markup**

Replace lines 185-196:

```tsx
        {/* Date range quick filter — hidden on mobile */}
        <div className="hidden sm:block shrink-0">
          <DateRangePicker
            from={submittedAtRange?.from}
            to={submittedAtRange?.to}
            onDateRangeChange={(from, to) =>
              onSubmittedAtRangeChange(from || to ? { from, to } : null)
            }
            placeholder={t('toolbar.dateRange.placeholder')}
            className="h-8 text-xs"
          />
        </div>
```

with:

```tsx
        {/* Submitted-date quick filter — hidden on mobile */}
        <div className="hidden sm:block shrink-0">
          <DateTimeRangePicker
            value={submittedAtFilter}
            onChange={onSubmittedAtFilterChange}
            labels={{
              allTime: t('toolbar.dateRange.allTime'),
              last24Hours: t('toolbar.dateRange.last24Hours'),
              last7Days: t('toolbar.dateRange.last7Days'),
              last30Days: t('toolbar.dateRange.last30Days'),
              customRange: t('toolbar.dateRange.customRange'),
              apply: t('toolbar.dateRange.apply'),
              cancel: t('toolbar.dateRange.cancel'),
              fromTime: t('toolbar.dateRange.fromTime'),
              toTime: t('toolbar.dateRange.toTime'),
            }}
          />
        </div>
```

- [ ] **Step 5: Type-check**

Run: `pnpm --filter form-app type-check`
Expected: exits 0 (this is the point where the rename started in Task 4 becomes fully consistent — no remaining references to `submittedAtRange`/`onSubmittedAtRangeChange`/`DateRangePicker` in this file).

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/components/Responses/ResponsesToolbar.tsx
git commit -m "feat(form-app): replace toolbar date-range picker with preset DateTimeRangePicker"
```

---

### Task 7: Wire `Responses.tsx` and verify end-to-end in a browser

**Files:**
- Modify: `apps/form-app/src/pages/Responses.tsx` (the `<ResponsesToolbar>` invocation)

**Interfaces:**
- Consumes: `responsesState.submittedAtFilter`, `responsesState.setSubmittedAtFilter` (Task 4); `ResponsesToolbarProps.submittedAtFilter`/`onSubmittedAtFilterChange` (Task 6).

- [ ] **Step 1: Update the prop names passed to `ResponsesToolbar`**

In `apps/form-app/src/pages/Responses.tsx`, replace:

```tsx
                submittedAtRange={responsesState.submittedAtRange}
                onSubmittedAtRangeChange={responsesState.setSubmittedAtRange}
```

with:

```tsx
                submittedAtFilter={responsesState.submittedAtFilter}
                onSubmittedAtFilterChange={responsesState.setSubmittedAtFilter}
```

(No other changes needed in this file — the three `graphqlFilters`/`filterLogic` call sites at lines ~133-138, ~157-163, and ~204-205 already read from `responsesState.graphqlFilters`, which now includes the new filter automatically via Task 4's change to the memo.)

- [ ] **Step 2: Full workspace type-check**

Run: `pnpm type-check`
Expected: exits 0 across all workspaces — confirms no stray references to the old `submittedAtRange` API remain anywhere (e.g. in `apps/admin-app` or tests, if any exist).

- [ ] **Step 3: Start the dev servers**

Run (in background, or in a separate terminal): `pnpm backend:dev` and `pnpm form-app:dev`
Expected: backend on `:4000`, form-app on `:3000`, both start without errors.

- [ ] **Step 4: Manually verify in a browser**

Navigate to a form's Responses page (`http://localhost:3000/forms/<formId>/responses`) that has at least a few responses spread across different submission dates (seed with `pnpm db:seed` if needed, or submit a few test responses first). Verify:

1. The toolbar shows a button reading "All time" where the old date-range calendar used to be.
2. Clicking it opens a dropdown with All time / Last 24 hours / Last 7 days / Last 30 days / Custom range.
3. Selecting "Last 7 days" immediately applies and closes the dropdown; the button now reads "Last 7 days"; the table reloads to page 1 and shows only responses from the last 7 days (cross-check row count/dates against a response you know is older than 7 days — it should disappear).
4. Clicking the "×" on the button resets it to "All time" and the full response list returns, in one click, without opening the dropdown.
5. Selecting "Custom range" reveals the 2-month calendar plus two time inputs; pick a from-date/time and a to-date/time in different order, hit Apply — the button label reflects the chosen range and the table filters accordingly.
6. Set your system/browser to a non-UTC timezone (or just note your local offset) and confirm a custom range like "9:00 AM to 5:00 PM today" filters responses submitted in that literal local-time window, not shifted by your UTC offset — open browser DevTools → Network, find the `GetFormResponses` GraphQL request, inspect the `dateRange.from`/`dateRange.to` variables, and confirm they're UTC ISO strings that correctly correspond to your local 9 AM/5 PM when converted back.
7. With a date filter and a tag filter both active, click Export → Excel (or CSV), download the file, and confirm it contains only the responses matching both filters (compare its row count to the on-screen filtered table's response count) — this validates the Task 4 export fix.

Report the outcome of each check. If any step fails, stop and diagnose before proceeding — do not mark this task complete on a failing check.

- [ ] **Step 5: Commit**

```bash
git add apps/form-app/src/pages/Responses.tsx
git commit -m "feat(form-app): wire submittedAtFilter into Responses page"
```
