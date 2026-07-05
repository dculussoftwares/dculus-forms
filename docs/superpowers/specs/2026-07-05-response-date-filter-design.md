# Response Table — Submitted Date Filter (Presets + Custom Range)

## Goal

Replace the plain date-only range calendar currently in the responses table toolbar with a single dropdown control offering quick presets ("All time", "Last 24 hours", "Last 7 days", "Last 30 days") plus a "Custom range" option with date **and** time-of-day inputs. The filter must be trivially removable (one click back to "All time") and must behave correctly regardless of the browser's local timezone vs. the UTC timestamps stored in Postgres.

## Current state (confirmed by reading the code)

- `Response.submittedAt` (`apps/backend/prisma/schema.prisma:179-197`) is a `DateTime` column, indexed as `@@index([formId, submittedAt])`.
- The toolbar (`apps/form-app/src/components/Responses/ResponsesToolbar.tsx:185-196`) already renders `<DateRangePicker>` bound to `submittedAtRange`/`onSubmittedAtRangeChange` — date-only, no presets, no time-of-day.
- `useResponsesState.ts:169-175` holds `submittedAtRange: { from?: Date; to?: Date } | null`, and `graphqlFilters` (`useResponsesState.ts:253-278`) converts it into a synthetic filter: `{ fieldId: '__submittedAt', operator: 'DATE_BETWEEN', dateRange: { from: from.toISOString(), to: to.toISOString() } }`.
- The backend already fully supports this: `responseQueryBuilder.ts` casts `dateRange.from/to` straight to `::timestamptz` in raw SQL, and also already implements a **`DATE_LAST_N_DAYS`** operator for `__submittedAt` in both the in-memory path (`responseFilterService.ts:114-118`, `cutoff = Date.now() - n*86_400_000`) and the raw-SQL path (`responseQueryBuilder.ts:105-108`, `NOW() - (n || ' days')::interval`). Both are **rolling windows ending "now"**, computed server-side against the DB/Node clock — not calendar-midnight-anchored, and not subject to browser timezone at all.
- **Conclusion: zero backend changes are required.** The three rolling presets map directly onto the existing `DATE_LAST_N_DAYS` operator (`value: '1' | '7' | '30'`); "Custom range" maps onto the existing `DATE_BETWEEN` operator; "All time" maps onto no filter at all (current default when `submittedAtRange` is `null`).
- `@dculus/ui` (`packages/ui/src/date-picker.tsx`) already has `DatePicker` and `DateRangePicker`, both composed by hand from `Calendar` + `Popover` + `Button` (all already present in `packages/ui/src`). There is no time-of-day input anywhere in the design system yet.
- Checked the shadcn registry live via the shadcn MCP tools: there is no official "date time picker" or "time picker" component to install — shadcn's own docs hand-compose date+time UIs from `Calendar` + `Popover` + `Select` + a plain input, exactly the pattern `date-picker.tsx` already follows. The one relevant primitive **not** yet in `packages/ui` is `input-group` (a labeled input wrapper with icon/addon support), which is a good fit for a clean time-of-day field. Plan: pull `input-group` into `packages/ui` via the shadcn MCP `get_add_command_for_items` and hand-build the composite picker on top of it, matching the existing `date-picker.tsx` style.

## UI / UX design

**Trigger button** (replaces the current `DateRangePicker` in the toolbar, same slot at `ResponsesToolbar.tsx:185-196`):
- Label reflects current state: `All time` (default) / `Last 24 hours` / `Last 7 days` / `Last 30 days` / `Jan 3, 2:00 PM – Jan 10, 5:30 PM` (custom).
- When a filter is active (anything but "All time"), the button shows an inline **×** that resets straight to "All time" in one click — no popover needed to clear.

**Popover content**, opened by clicking the button body (not the ×):
- A vertical list of preset options: `All time`, `Last 24 hours`, `Last 7 days`, `Last 30 days`, `Custom range`.
- Selecting any non-custom preset applies immediately and closes the popover (matches how tag filters in the same toolbar apply instantly).
- Selecting `Custom range` expands the popover in place to show: a 2-month range `Calendar` (reusing the existing range-select behavior from `DateRangePicker`), plus two time-of-day inputs labeled "From time" / "To time" (new — built on the `input-group` primitive), plus `Apply` and `Cancel` buttons. Custom range requires explicit Apply since 4 sub-fields (from date, from time, to date, to time) must be set together before it's meaningful.

**Preset semantics**: "Last 24 hours" / "Last 7 days" / "Last 30 days" are rolling windows ending "now" (not calendar-day-anchored) — this matches the existing, already-implemented `DATE_LAST_N_DAYS` backend behavior exactly, so no client-side date math is needed for presets at all: the frontend just sends the operator + a value of `'1'`, `'7'`, or `'30'`.

## Data flow / state changes

`useResponsesState.ts`:
- Replace `submittedAtRange: { from?: Date; to?: Date } | null` with:
  ```ts
  type SubmittedAtFilter =
    | { preset: 'last1d' | 'last7d' | 'last30d' }
    | { preset: 'custom'; from: Date; to: Date };
  const [submittedAtFilter, setSubmittedAtFilter] = useState<SubmittedAtFilter | null>(null);
  // null === "All time"
  ```
- In the `graphqlFilters` memo (`useResponsesState.ts:253-278`), branch on `submittedAtFilter`:
  - `null` → push nothing (current "All time" behavior, unchanged).
  - `{ preset: 'last1d' | 'last7d' | 'last30d' }` → push `{ fieldId: '__submittedAt', operator: 'DATE_LAST_N_DAYS', value: '1' | '7' | '30' }` (no `dateRange` needed).
  - `{ preset: 'custom', from, to }` → push `{ fieldId: '__submittedAt', operator: 'DATE_BETWEEN', dateRange: { from: from.toISOString(), to: to.toISOString() } }` (unchanged from today's behavior, just now carrying a time-of-day component the user picked).
- `convertFiltersForExport` (`useResponsesState.ts:294-316`) only reads `filters` (per-field filters), not `submittedAtRange`/`submittedAtFilter` — confirmed by reading `handleExport` (`useResponsesState.ts:330-359`), which calls `convertFiltersForExport()` directly with no reference to the date range at all. This means **exports today already ignore the submission-date filter** — a pre-existing gap, not something this feature introduces. Out of scope: this spec only changes the on-screen table filter, not export behavior.

## Timezone / UTC handling

- Rolling presets never touch the browser's clock or timezone at all — they're resolved entirely server-side (`NOW() - N days`), so they're correct by construction regardless of where the user is.
- Custom range: the user picks a date and a time-of-day, both interpreted as browser-local (what they see on their screen is what they mean, e.g. "9:00 AM" means 9 AM in their own timezone). Combine date + time into a single local `Date` object, then call `.toISOString()` before sending — this is the exact convention already used in `useResponsesState.ts:273-274` and already correctly handled server-side via `::timestamptz` casts in `responseQueryBuilder.ts`. No manual UTC offset math anywhere in the frontend.

## New component: `packages/ui/src/date-time-range-picker.tsx`

- Exports `DateTimeRangePicker`, following the same prop-shape conventions as `DateRangePicker` in `date-picker.tsx` (controlled `value`/`onChange`, `placeholder`, `disabled`, `className`, `error`).
- Internally composed from `Popover`, `Calendar` (range mode), a new small `TimeInput` built on the shadcn `input-group` primitive (pulled in via shadcn MCP), and plain buttons for the preset list — no new external dependencies beyond what shadcn's `input-group` needs (already compatible with existing `date-fns`/`lucide-react` deps).
- Exported from `packages/ui/src/index.ts` alongside the existing `DatePicker`/`DateRangePicker` exports.

## i18n

`toolbar.dateRange.*` keys already exist in `apps/form-app/src/locales/{en,ta}/responses.json`. Add new keys for preset labels (`allTime`, `last24Hours`, `last7Days`, `last30Days`, `customRange`, `applyLabel`, `cancelLabel`, `fromTimeLabel`, `toTimeLabel`) in both `en` and `ta`, per the mandatory i18n rule in `CLAUDE.md`.

## Out of scope

- No backend/GraphQL schema changes (confirmed the existing `DATE_LAST_N_DAYS` and `DATE_BETWEEN` operators on `__submittedAt` already do everything needed).
- No changes to the per-field `DATE_FIELD` filter row in the Filter Modal (`FilterRow.tsx`) — that already has its own presets/operators and is a separate, pre-existing UI surface. This spec only touches the toolbar's submission-date scope filter.
- Not adding a generic reusable "datetime picker" to the design system beyond what this feature needs — scoped to `DateTimeRangePicker` for this use case.
- Not fixing the pre-existing gap where Excel/CSV export ignores the submission-date filter — that predates this feature and is a separate concern.
