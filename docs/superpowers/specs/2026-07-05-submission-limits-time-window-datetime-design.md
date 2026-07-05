# Submission Limits: Add Time-of-Day to Time Window

## Problem

The "Time Window" section of Submission Limits (`SubmissionLimitsSettings.tsx`) only lets a form owner pick a **date** for the start/end of the window. The form always opens at 00:00 and closes at 23:59:59 on those dates. Form owners need to open/close a form at a precise time (e.g. "Mar 5 at 2:30 PM"), not just at day boundaries.

## Current State

- `TimeWindowSettings { enabled: boolean; startDate?: string; endDate?: string }` (`packages/types/src/index.ts:47-61`), mirrored in GraphQL (`schema.ts:97-111,329-336`) as plain `String`. Stored inside the opaque `Form.settings` JSON column — no DB migration required for this change.
- UI: two `DatePicker` (calendar-only) components in `SubmissionLimitsSettings.tsx:209-227`.
- Backend enforcement (`apps/backend/src/graphql/resolvers/responses.ts:233-263`): validates `^\d{4}-\d{2}-\d{2}$`, appends `T00:00:00`/`T23:59:59`, parses with server-local `new Date(...)`, compares to `now`.
- An equivalent, already-shipped pattern exists for the response submission-time filter: `packages/ui/src/date-time-range-picker.tsx` combines a calendar date with a native `<input type="time">` in **browser-local time** (`formatTimeForInput`/`combineDateAndTime`, lines ~41-59), and the consuming layer (`apps/form-app/src/lib/submittedAtFilter.ts:29`) converts to UTC via `.toISOString()` right before sending the GraphQL request. The backend (`responseQueryBuilder.ts`, `responseFilterService.ts`) then treats the ISO string as an already-absolute UTC instant with no further timezone math, while legacy bare `YYYY-MM-DD` values are still anchored to a day boundary for backward compatibility.

This feature reproduces that exact, already-validated pattern for Submission Limits instead of inventing a new one.

## Design

### 1. Storage format

No renames of `startDate`/`endDate`, no GraphQL schema changes (still `String`). The string may now be either:
- Legacy: `YYYY-MM-DD` (date-only, produced by forms saved before this feature)
- New: a full ISO 8601 datetime with `Z` (e.g. `2026-07-05T09:00:00.000Z`) — an absolute UTC instant produced by `.toISOString()` in the browser.

Old forms are untouched until a user re-saves Submission Limits, at which point the new format is written.

### 2. Shared helpers — move into `@dculus/utils`

`formatTimeForInput` and `combineDateAndTime` currently live as unexported module-local functions in `packages/ui/src/date-time-range-picker.tsx`. Move them (unchanged logic — plain `Date.getHours`/`setHours`, no UTC math) into `packages/utils/src/index.ts`, export them, and update `date-time-range-picker.tsx` to import from `@dculus/utils`. `SubmissionLimitsSettings.tsx` imports the same two functions — one implementation, two call sites, matching the existing `@dculus/utils` import convention (`parseLocalDate`/`formatLocalDate` already live there for the same reason).

### 3. UI changes (`SubmissionLimitsSettings.tsx`)

For each of Start/End:
- Keep the existing `DatePicker` (calendar) unchanged.
- Add `@dculus/ui`'s `Input` with `type="time"` next to it (1-minute granularity, no `step` restriction), styled by the existing design system like any other `Input` usage in this file.
- On any date or time change, combine the current date value and the time-input string via `combineDateAndTime` to get a single browser-local `Date`.
- A small helper text ("Times are in your local timezone") is shown once above the Start/End row to avoid ambiguity for anyone reviewing settings from a different timezone later.

Toggling Time Window on keeps today's default window (start = today, end = today+30 days) but now with explicit default times: start defaults to `00:00`, end defaults to `23:59` — preserving current whole-day behavior for anyone who doesn't touch the time inputs.

### 4. UTC conversion at the boundary

Mirroring `buildSubmittedAtGraphqlFilter`: the picker/state inside `SubmissionLimitsSettings.tsx` stays in local time. Conversion to UTC (`.toISOString()`) happens once, in the `onUpdateTimeWindow` call site (in `useFormSettings.ts` or immediately before it), not inside any picker component.

### 5. Backend enforcement (`responses.ts`)

Replace the single-format regex check with a small local helper that mirrors `responseFilterService.ts`'s existing `parseDate` convention:
- If the string matches `^\d{4}-\d{2}-\d{2}$` (legacy): keep exactly the current behavior — append `T00:00:00` for start / `T23:59:59` for end, parsed in server-local time. **Unchanged for old forms.**
- Otherwise: parse directly with `new Date(str)` as an already-absolute UTC instant. No padding, no timezone math. `isNaN` check still throws `BAD_USER_INPUT`.
- Comparison against `now` (`<`/`>` against `FORM_NOT_YET_OPEN`/`FORM_CLOSED`) is unchanged.

### 6. Status badges (`SubmissionLimitsSettings.tsx`)

`isBeforeStart`/`isAfterEnd` (used for the "not started / active / ended" summary) get the same dual-format-aware parsing so both legacy and new data render the correct status live in the UI, not just at submission time on the backend.

## Out of scope

- No explicit timezone selector (browser-local time only, per decision).
- No change to how legacy `YYYY-MM-DD`-only values are interpreted (still server-local day boundaries) — pre-existing behavior, not introduced by this feature.
- No new reusable "DateTimePicker" component in `@dculus/ui` — composition of existing `DatePicker` + `Input type="time"` lives locally in `SubmissionLimitsSettings.tsx`, matching how the response filter also composes primitives rather than exporting a new one.

## Testing

- Unit tests for the new backend dual-format parse helper in `responses.ts` (legacy date-only, new full ISO, invalid string).
- Unit tests for `formatTimeForInput`/`combineDateAndTime` after the move to `@dculus/utils` (if not already covered).
- Manual verification: create a time window with a specific start/end time in the form builder, confirm the stored value round-trips correctly, and confirm submission is correctly blocked/allowed right at the boundary.
