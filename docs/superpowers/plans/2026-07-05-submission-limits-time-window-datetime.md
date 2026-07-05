# Submission Limits: Time-of-Day on Time Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a form owner pick a precise start/end time (not just a date) for the Submission Limits "Time Window", captured in the browser's local time and enforced by the backend as an absolute UTC instant.

**Architecture:** Widen the existing `startDate`/`endDate` strings (already stored as opaque JSON inside `Form.settings`) to optionally hold a full ISO 8601 datetime instead of just `YYYY-MM-DD`. The frontend composes the existing `DatePicker` with a native `type="time"` `Input`, combines them into a local `Date`, and converts to UTC (`.toISOString()`) right before handing the value to the save callback. The backend and frontend status logic both branch on format: legacy `YYYY-MM-DD` keeps its exact current day-boundary behavior; a full ISO string is parsed as an already-absolute instant with no extra timezone math. This mirrors the pattern already shipped for the response submission-time filter (`date-time-range-picker.tsx` + `submittedAtFilter.ts`).

**Tech Stack:** React (form-app), TypeScript, native `Date`, `date-fns` (unrelated, untouched), vitest (backend), jest (form-app).

**Spec:** `docs/superpowers/specs/2026-07-05-submission-limits-time-window-datetime-design.md`

## Global Constraints

- No explicit timezone selector — capture browser-local time, store an absolute UTC instant (`.toISOString()`).
- No DB/GraphQL schema changes — `startDate`/`endDate` remain `String`; only the string's *format* is widened.
- Legacy `YYYY-MM-DD`-only values must keep their exact current interpretation (unchanged for old forms) — do not "fix" the pre-existing server-local-day-boundary behavior for those.
- No new reusable `DateTimePicker` component in `@dculus/ui` — compose the existing `DatePicker` + `Input type="time"` locally, matching how the response filter also composes primitives.
- All new user-facing strings must be added to **both** `apps/form-app/src/locales/en/submissionLimitsSettings.json` and `.../ta/submissionLimitsSettings.json` (i18n is mandatory per project convention).
- `dculus-forms` is a public repo — no secrets in any commit (not directly relevant here, but standing rule).

---

### Task 1: Move `formatTimeForInput`/`combineDateAndTime` into `@dculus/utils`

**Files:**
- Modify: `packages/utils/src/index.ts`
- Modify: `packages/ui/src/date-time-range-picker.tsx:1-59`

**Interfaces:**
- Produces: `formatTimeForInput(date: Date): string` — returns `"HH:MM"` in the date's local hours/minutes. `combineDateAndTime(date: Date, time: string): Date` — returns a new `Date` with `date`'s day and `time`'s (`"HH:MM"`) hours/minutes, seconds/ms zeroed. Both exported from `@dculus/utils`. Tasks 2 and 4 import these.

This is a pure move (identical logic, no behavior change) — there's no existing test harness for `packages/ui` or `packages/utils` (checked: no `*.test.ts` files in either package, and root `pnpm test:unit` only runs the backend suite), so this task is verified by a type-check build rather than a new test file, consistent with existing project coverage for this code.

- [ ] **Step 1: Add the two functions to `@dculus/utils`**

In `packages/utils/src/index.ts`, add the following immediately after the existing `isDateExpired` function (currently ends at line 68, right before `export function slugify`):

```typescript
/**
 * Format a Date's local hours/minutes as "HH:MM" for a native `<input type="time">`.
 */
export const formatTimeForInput = (date: Date): string => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

/**
 * Combine a calendar Date with a "HH:MM" time-of-day string (both interpreted
 * in the browser's local timezone) into a single local Date.
 */
export const combineDateAndTime = (date: Date, time: string): Date => {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  const combined = new Date(date);
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return combined;
};
```

- [ ] **Step 2: Update `date-time-range-picker.tsx` to import instead of defining locally**

In `packages/ui/src/date-time-range-picker.tsx`, change line 7 from:

```typescript
import { cn } from "@dculus/utils"
```

to:

```typescript
import { cn, formatTimeForInput, combineDateAndTime } from "@dculus/utils"
```

Then delete the now-duplicate local definitions at lines 41-59 (the `function formatTimeForInput(...)` and `function combineDateAndTime(...)` blocks) entirely. Nothing else in the file changes — all existing call sites (`formatTimeForInput(value.from)`, `combineDateAndTime(draftRange.from, draftFromTime)`, etc.) keep working unchanged since the imported functions have identical signatures and behavior.

- [ ] **Step 3: Type-check both packages**

Run: `pnpm --filter @dculus/utils build && pnpm --filter @dculus/ui build`
Expected: both builds succeed with no TypeScript errors (confirms `date-time-range-picker.tsx` resolves the two functions from `@dculus/utils` correctly, and there's no leftover reference to the deleted local functions).

- [ ] **Step 4: Commit**

```bash
git add packages/utils/src/index.ts packages/ui/src/date-time-range-picker.tsx
git commit -m "$(cat <<'EOF'
refactor(utils): move date/time combine helpers from ui into shared utils

formatTimeForInput/combineDateAndTime were duplicated informally inside
date-time-range-picker.tsx. Moving them to @dculus/utils lets the
Submission Limits time window UI reuse the exact same local-time
combining logic instead of a second hand-rolled copy.
EOF
)"
```

---

### Task 2: Frontend dual-format instant parser

**Files:**
- Create: `apps/form-app/src/lib/timeWindowDateTime.ts`
- Test: `apps/form-app/src/lib/__tests__/timeWindowDateTime.test.ts`
- Modify: `packages/types/src/index.ts:52-56`

**Interfaces:**
- Produces: `parseTimeWindowInstant(value: string): Date` — if `value` matches `YYYY-MM-DD`, parses it as local midnight (same logic as `@dculus/utils`'s `parseLocalDate`/`parseCalendarDate` — exactly today's existing legacy behavior); otherwise returns `new Date(value)` (treats `value` as an already-absolute ISO instant). Task 4 imports this.

**Important — do not import from `@dculus/utils` in this file or its test.** `apps/form-app/jest.config.js` maps `@dculus/*` imports to each package's compiled `dist/index.js` (ESM `import` syntax), which Jest's `ts-jest`-only `transform` config cannot execute — confirmed pre-existing on `main` (no current form-app test imports `@dculus/utils`; the two already-failing suites in the baseline, the `BaseChartComponents`-related ones, hit this exact wall). Attempting to fix it by pointing the mapper at `packages/utils/src/index.ts` instead just moves the failure into `nanoid` (also ESM-only) — that's a separate, unrelated infrastructure problem, out of scope here. The local-midnight parsing is 3 lines; duplicate it directly in this file instead of importing `parseLocalDate`, so the new pure function is actually testable without touching Jest config.

- [ ] **Step 1: Write the failing test**

Create `apps/form-app/src/lib/__tests__/timeWindowDateTime.test.ts`:

```typescript
import { parseTimeWindowInstant } from '../timeWindowDateTime';

describe('parseTimeWindowInstant', () => {
  test('parses a legacy YYYY-MM-DD value as local midnight', () => {
    expect(parseTimeWindowInstant('2026-07-05').getTime()).toEqual(
      new Date(2026, 6, 5).getTime()
    );
  });

  test('parses a full ISO datetime as an absolute instant', () => {
    const iso = '2026-07-05T09:30:00.000Z';
    expect(parseTimeWindowInstant(iso).getTime()).toEqual(new Date(iso).getTime());
  });

  test('a full ISO instant with a time component differs from the legacy midnight for the same day', () => {
    const legacy = parseTimeWindowInstant('2026-07-05');
    const withTime = parseTimeWindowInstant('2026-07-05T09:30:00.000Z');
    expect(withTime.getTime()).not.toEqual(legacy.getTime());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter form-app test -- timeWindowDateTime`
Expected: FAIL — `Cannot find module '../timeWindowDateTime'`

- [ ] **Step 3: Write the implementation**

Create `apps/form-app/src/lib/timeWindowDateTime.ts`:

```typescript
const LEGACY_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a Submission Limits time-window boundary value into a Date.
 *
 * `startDate`/`endDate` may be either a legacy "YYYY-MM-DD" string (forms
 * saved before time-of-day support was added — interpreted as local
 * midnight, matching the pre-existing behavior of @dculus/utils's
 * parseLocalDate/parseCalendarDate, duplicated here rather than imported —
 * see the note above this step) or a full ISO 8601 datetime string (an
 * already-absolute UTC instant, produced by `.toISOString()` when the user
 * picks a specific time).
 */
export function parseTimeWindowInstant(value: string): Date {
  if (LEGACY_DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter form-app test -- timeWindowDateTime`
Expected: PASS (3 tests)

- [ ] **Step 5: Update the type comment documenting the widened format**

In `packages/types/src/index.ts`, change:

```typescript
export interface TimeWindowSettings {
  enabled: boolean;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}
```

to:

```typescript
export interface TimeWindowSettings {
  enabled: boolean;
  // Either a legacy "YYYY-MM-DD" date (whole-day window, pre-existing forms)
  // or a full ISO 8601 datetime string (absolute UTC instant, precise
  // start/end time) — see apps/form-app/src/lib/timeWindowDateTime.ts and
  // apps/backend/src/graphql/resolvers/responses.ts for the parsing logic.
  startDate?: string;
  endDate?: string;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/lib/timeWindowDateTime.ts apps/form-app/src/lib/__tests__/timeWindowDateTime.test.ts packages/types/src/index.ts
git commit -m "$(cat <<'EOF'
feat(form-app): add dual-format parser for time window boundary values

Submission Limits' startDate/endDate can now be either a legacy
YYYY-MM-DD date or a full ISO datetime. parseTimeWindowInstant picks the
right interpretation so the UI's status logic stays correct for both.
EOF
)"
```

---

### Task 3: Backend enforcement — dual-format parsing

**Files:**
- Modify: `apps/backend/src/graphql/resolvers/responses.ts:233-263`
- Test: `apps/backend/src/graphql/resolvers/__tests__/responses.test.ts`

**Interfaces:**
- No new exports — this is a change inside the existing `submitResponse` mutation resolver's time-window enforcement block, same throw behavior/error codes (`BAD_USER_INPUT`, `FORM_NOT_YET_OPEN`, `FORM_CLOSED`) as before.

- [ ] **Step 1: Write the failing tests**

In `apps/backend/src/graphql/resolvers/__tests__/responses.test.ts`, add these tests immediately after the existing `'should allow submission within time window'` test (after the closing `});` that currently ends around line 623), inside the same `describe` block:

```typescript
    it('should enforce time window start date-time with hour precision', async () => {
      const twoHoursFromNow = new Date();
      twoHoursFromNow.setHours(twoHoursFromNow.getHours() + 2);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: twoHoursFromNow.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form is not yet open for submissions');
    });

    it('should enforce time window end date-time with hour precision', async () => {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              endDate: twoHoursAgo.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form submission period has ended');
    });

    it('should allow submission within a precise start/end date-time window', async () => {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      const oneHourFromNow = new Date();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: oneHourAgo.toISOString(),
              endDate: oneHourFromNow.toISOString(),
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      const result = await responsesResolvers.Mutation.submitResponse(
        {},
        { input: mockInput },
        mockContext
      );

      expect(result).toBeDefined();
    });

    it('should throw BAD_USER_INPUT for a malformed time window start value', async () => {
      const formWithTimeWindow = {
        ...mockForm,
        settings: {
          submissionLimits: {
            timeWindow: {
              enabled: true,
              startDate: 'not-a-date',
            },
          },
        },
      };
      vi.mocked(formService.getFormById).mockResolvedValue(formWithTimeWindow as any);

      await expect(
        responsesResolvers.Mutation.submitResponse({}, { input: mockInput }, mockContext)
      ).rejects.toThrow('Form has an invalid start date configured');
    });
```

- [ ] **Step 2: Run tests to verify the new precision tests fail**

Run: `pnpm --filter backend test -- src/graphql/resolvers/__tests__/responses.test.ts`
Expected: the 3 new "precision"/"within a precise window" tests FAIL — the current code's `ISO_DATE_RE` regex only accepts `YYYY-MM-DD` and throws `'Form has an invalid start date configured'`/`'...end date...'` for any full ISO datetime string, so none of them reach the `FORM_NOT_YET_OPEN`/`FORM_CLOSED`/success assertions. The `'malformed time window start value'` test PASSES already (both old and new code reject `'not-a-date'` the same way) — that's expected, it's a regression-safety addition, not a behavior change.

- [ ] **Step 3: Implement dual-format parsing**

In `apps/backend/src/graphql/resolvers/responses.ts`, replace the block at lines 233-263 (from `// Check time window limits` through the closing `}` of the `if (limits.timeWindow?.enabled)` block) with:

```typescript
        // Check time window limits
        if (limits.timeWindow?.enabled) {
          const now = new Date();
          const LEGACY_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

          // startDate/endDate are either a legacy "YYYY-MM-DD" value (padded
          // to the server's local day boundary, unchanged behavior for forms
          // saved before time-of-day support existed) or a full ISO 8601
          // datetime string (already an absolute UTC instant — no padding
          // or timezone math needed).
          const parseTimeWindowBoundary = (value: string, boundary: 'start' | 'end'): Date => {
            if (LEGACY_DATE_ONLY_RE.test(value)) {
              return new Date(value + (boundary === 'start' ? 'T00:00:00' : 'T23:59:59'));
            }
            return new Date(value);
          };

          if (limits.timeWindow.startDate) {
            const startDate = parseTimeWindowBoundary(limits.timeWindow.startDate, 'start');
            if (isNaN(startDate.getTime())) {
              throw createGraphQLError('Form has an invalid start date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            if (now < startDate) {
              throw createGraphQLError('Form is not yet open for submissions', GRAPHQL_ERROR_CODES.FORM_NOT_YET_OPEN);
            }
          }

          if (limits.timeWindow.endDate) {
            const endDate = parseTimeWindowBoundary(limits.timeWindow.endDate, 'end');
            if (isNaN(endDate.getTime())) {
              throw createGraphQLError('Form has an invalid end date configured', GRAPHQL_ERROR_CODES.BAD_USER_INPUT);
            }
            if (now > endDate) {
              throw createGraphQLError('Form submission period has ended', GRAPHQL_ERROR_CODES.FORM_CLOSED);
            }
          }
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter backend test -- src/graphql/resolvers/__tests__/responses.test.ts`
Expected: PASS — all tests in the file, including the 3 legacy `YYYY-MM-DD` tests (unchanged behavior) and the 4 new tests.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/graphql/resolvers/responses.ts apps/backend/src/graphql/resolvers/__tests__/responses.test.ts
git commit -m "$(cat <<'EOF'
feat(backend): enforce submission time window with hour/minute precision

startDate/endDate may now be a full ISO datetime (absolute UTC instant)
in addition to the legacy YYYY-MM-DD whole-day value. Legacy values keep
their exact current server-local day-boundary behavior.
EOF
)"
```

---

### Task 4: Submission Limits UI — date + time inputs

**Files:**
- Modify: `apps/form-app/src/components/form-settings/SubmissionLimitsSettings.tsx` (full file)

**Interfaces:**
- Consumes: `formatTimeForInput`, `combineDateAndTime` from `@dculus/utils` (Task 1); `parseTimeWindowInstant` from `../../lib/timeWindowDateTime` (Task 2). `onUpdateTimeWindow(enabled: boolean, startDate?: string, endDate?: string) => void` prop is unchanged — `FormSettingsContainer.tsx:55` needs no changes since it just forwards whatever strings this component computes.

There is no existing automated test for this component (no `SubmissionLimitsSettings.test.tsx` in the repo) — verification is manual (Task 6) plus the type-check in Step 2 below.

- [ ] **Step 1: Replace the full file contents**

Replace `apps/form-app/src/components/form-settings/SubmissionLimitsSettings.tsx` with:

```tsx
import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Checkbox,
  Input,
  DatePicker,
  toastError,
} from '@dculus/ui';
import { Shield, Save, Calendar, Users } from 'lucide-react';
import { formatTimeForInput, combineDateAndTime } from '@dculus/utils';
import type { SubmissionLimitsSettings as SubmissionLimitsSettingsType } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import { parseTimeWindowInstant } from '../../lib/timeWindowDateTime';

interface SubmissionLimitsSettingsProps {
  settings: SubmissionLimitsSettingsType;
  isSaving: boolean;
  currentResponseCount?: number; // Current number of responses for display
  onUpdateMaxResponses: (enabled: boolean, limit?: number) => void;
  onUpdateTimeWindow: (enabled: boolean, startDate?: string, endDate?: string) => void;
  onSave: () => void;
}

const SubmissionLimitsSettings: React.FC<SubmissionLimitsSettingsProps> = ({
  settings,
  isSaving,
  currentResponseCount = 0,
  onUpdateMaxResponses,
  onUpdateTimeWindow,
  onSave,
}) => {
  const { t } = useTranslation('submissionLimitsSettings');

  const handleMaxResponsesToggle = (enabled: boolean) => {
    if (enabled) {
      onUpdateMaxResponses(true, settings.maxResponses?.limit || 100);
    } else {
      onUpdateMaxResponses(false);
    }
  };

  const handleMaxResponsesLimitChange = (value: string) => {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit < 1) {
      toastError(t('validation.invalidLimit'), t('validation.limitMustBePositive'));
      return;
    }
    if (limit > 10000) {
      toastError(t('validation.invalidLimit'), t('validation.limitExceeded'));
      return;
    }
    onUpdateMaxResponses(true, limit);
  };

  const handleTimeWindowToggle = (enabled: boolean) => {
    if (enabled) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      end.setHours(23, 59, 0, 0);
      onUpdateTimeWindow(true, start.toISOString(), end.toISOString());
    } else {
      onUpdateTimeWindow(false);
    }
  };

  // Parsed instants for the currently-saved start/end values (handles both
  // legacy YYYY-MM-DD and full ISO datetime formats).
  const startInstant = settings.timeWindow?.startDate
    ? parseTimeWindowInstant(settings.timeWindow.startDate)
    : undefined;
  const endInstant = settings.timeWindow?.endDate
    ? parseTimeWindowInstant(settings.timeWindow.endDate)
    : undefined;
  const startTimeValue = startInstant ? formatTimeForInput(startInstant) : '00:00';
  const endTimeValue = endInstant ? formatTimeForInput(endInstant) : '23:59';

  const handleStartDateChange = (date: Date | undefined) => {
    const combined = date ? combineDateAndTime(date, startTimeValue) : undefined;
    if (combined && endInstant && combined > endInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, combined ? combined.toISOString() : '', settings.timeWindow?.endDate);
  };

  const handleStartTimeChange = (time: string) => {
    if (!startInstant) return;
    const combined = combineDateAndTime(startInstant, time);
    if (endInstant && combined > endInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, combined.toISOString(), settings.timeWindow?.endDate);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    const combined = date ? combineDateAndTime(date, endTimeValue) : undefined;
    if (combined && startInstant && combined < startInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, settings.timeWindow?.startDate, combined ? combined.toISOString() : '');
  };

  const handleEndTimeChange = (time: string) => {
    if (!endInstant) return;
    const combined = combineDateAndTime(endInstant, time);
    if (startInstant && combined < startInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, settings.timeWindow?.startDate, combined.toISOString());
  };

  // Helper to check if max responses limit is reached
  const isMaxResponsesReached = settings.maxResponses?.enabled &&
    settings.maxResponses?.limit &&
    currentResponseCount >= settings.maxResponses.limit;

  // Helper to check if form is within time window
  const now = new Date();
  const isBeforeStart = !!(settings.timeWindow?.enabled && startInstant && startInstant > now);
  const isAfterEnd = !!(settings.timeWindow?.enabled && endInstant && endInstant < now);
  const isOutsideTimeWindow = isBeforeStart || isAfterEnd;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Maximum Responses Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="max-responses-enabled"
              data-testid="max-responses-enabled-checkbox"
              checked={settings.maxResponses?.enabled || false}
              onCheckedChange={handleMaxResponsesToggle}
            />
            <div className="space-y-1">
              <Label
                htmlFor="max-responses-enabled"
                className="text-sm font-medium cursor-pointer flex items-center"
              >
                <Users className="mr-1 h-4 w-4" />
                {t('maxResponses.title')}
              </Label>
              <p className="text-sm text-foreground">
                {t('maxResponses.description')}
              </p>
            </div>
          </div>

          {settings.maxResponses?.enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center space-x-2">
                <Label htmlFor="max-responses-limit" className="text-sm">
                  {t('maxResponses.label')}
                </Label>
                <Input
                  id="max-responses-limit"
                  data-testid="max-responses-limit-input"
                  type="number"
                  min="1"
                  max="10000"
                  value={settings.maxResponses?.limit || 100}
                  onChange={(e) => handleMaxResponsesLimitChange(e.target.value)}
                  className="w-24"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                {t('maxResponses.responses', {
                  values: {
                    current: currentResponseCount,
                    limit: settings.maxResponses?.limit || 100
                  }
                })}
                {isMaxResponsesReached && (
                  <span className="ml-2 text-destructive font-medium">
                    ⚠️ {t('maxResponses.reached')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Time Window Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="time-window-enabled"
              data-testid="time-window-enabled-checkbox"
              checked={settings.timeWindow?.enabled || false}
              onCheckedChange={handleTimeWindowToggle}
            />
            <div className="space-y-1">
              <Label
                htmlFor="time-window-enabled"
                className="text-sm font-medium cursor-pointer flex items-center"
              >
                <Calendar className="mr-1 h-4 w-4" />
                {t('timeWindow.title')}
              </Label>
              <p className="text-sm text-foreground">
                {t('timeWindow.description')}
              </p>
            </div>
          </div>

          {settings.timeWindow?.enabled && (
            <div className="ml-6 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('timeWindow.localTimeHint')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-sm">
                    {t('timeWindow.startDate')}
                  </Label>
                  <div className="flex gap-2">
                    <DatePicker
                      id="time-window-start-date"
                      name="time-window-start-date"
                      date={startInstant}
                      onDateChange={handleStartDateChange}
                      placeholder="Select start date"
                    />
                    <Input
                      type="time"
                      data-testid="time-window-start-time-input"
                      value={startTimeValue}
                      disabled={!startInstant}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-sm">
                    {t('timeWindow.endDate')}
                  </Label>
                  <div className="flex gap-2">
                    <DatePicker
                      id="time-window-end-date"
                      name="time-window-end-date"
                      date={endInstant}
                      onDateChange={handleEndDateChange}
                      placeholder="Select end date"
                    />
                    <Input
                      type="time"
                      data-testid="time-window-end-time-input"
                      value={endTimeValue}
                      disabled={!endInstant}
                      onChange={(e) => handleEndTimeChange(e.target.value)}
                      className="w-28"
                    />
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {isOutsideTimeWindow && (
                  <span className="text-destructive font-medium">
                    ⚠️ {isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended')}
                  </span>
                )}
                {!isOutsideTimeWindow && settings.timeWindow?.startDate && settings.timeWindow?.endDate && (
                  <span className="text-primary font-medium">
                    ✓ {t('timeWindow.active')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Summary */}
        {(settings.maxResponses?.enabled || settings.timeWindow?.enabled) && (
          <div className="mt-6 p-4 bg-background rounded-lg">
            <h4 className="text-sm font-medium mb-2">{t('maxResponses.currentStatus')}</h4>
            <div className="space-y-1 text-sm">
              {settings.maxResponses?.enabled && (
                <div className={isMaxResponsesReached ? 'text-destructive' : 'text-primary'}>
                  • {t('maxResponses.responses', {
                      values: {
                        current: currentResponseCount,
                        limit: settings.maxResponses?.limit || 100
                      }
                    })}
                  {isMaxResponsesReached ? ` (${t('maxResponses.reached')})` : ` (${t('maxResponses.active')})`}
                </div>
              )}
              {settings.timeWindow?.enabled && (
                <div className={isOutsideTimeWindow ? 'text-destructive' : 'text-primary'}>
                  • {t('timeWindow.title')}: {isOutsideTimeWindow
                    ? (isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended'))
                    : t('timeWindow.active')}
                  {startInstant && endInstant && (
                    <span className="text-muted-foreground ml-1">
                      ({startInstant.toLocaleString()} to {endInstant.toLocaleString()})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            data-testid="save-submission-limits-button"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubmissionLimitsSettings;
```

- [ ] **Step 2: Type-check the form-app**

Run: `pnpm --filter form-app exec tsc --noEmit`
Expected: no errors (confirms `parseLocalDate`/`formatLocalDate` removal didn't leave dangling references, and the new imports resolve).

- [ ] **Step 3: Commit**

```bash
git add apps/form-app/src/components/form-settings/SubmissionLimitsSettings.tsx
git commit -m "$(cat <<'EOF'
feat(form-app): add time-of-day inputs to submission limits time window

Each of Start/End now pairs the existing DatePicker with a native
type="time" input. The two combine into a single local Date and convert
to UTC (.toISOString()) right before being handed to onUpdateTimeWindow,
mirroring the pattern already used for the response submission-time
filter.
EOF
)"
```

---

### Task 5: Local-timezone hint translation strings

**Files:**
- Modify: `apps/form-app/src/locales/en/submissionLimitsSettings.json`
- Modify: `apps/form-app/src/locales/ta/submissionLimitsSettings.json`

**Interfaces:**
- Produces: `timeWindow.localTimeHint` translation key, consumed by Task 4's `t('timeWindow.localTimeHint')` call.

- [ ] **Step 1: Add the English string**

In `apps/form-app/src/locales/en/submissionLimitsSettings.json`, inside the `"timeWindow"` object, add `"localTimeHint"` right after `"description"`:

```json
  "timeWindow": {
    "title": "Time Window",
    "description": "Limit form submissions to a specific date and time range",
    "localTimeHint": "Times are shown in your local timezone.",
    "enable": "Enable time window",
```

- [ ] **Step 2: Add the Tamil string**

In `apps/form-app/src/locales/ta/submissionLimitsSettings.json`, inside the `"timeWindow"` object, add `"localTimeHint"` right after `"description"`:

```json
  "timeWindow": {
    "title": "நேர சாளரம்",
    "description": "ஒரு குறிப்பிட்ட தேதி மற்றும் நேர வரம்பிற்கு படிவ சமர்ப்பிப்புகளை வரம்பிடவும்",
    "localTimeHint": "நேரங்கள் உங்கள் உள்ளூர் நேர மண்டலத்தில் காட்டப்படும்.",
    "enable": "நேர சாளரத்தை இயக்கு",
```

- [ ] **Step 3: Verify both locale files are still valid JSON**

Run: `node -e "require('./apps/form-app/src/locales/en/submissionLimitsSettings.json'); require('./apps/form-app/src/locales/ta/submissionLimitsSettings.json'); console.log('OK')"`
Expected: prints `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/locales/en/submissionLimitsSettings.json apps/form-app/src/locales/ta/submissionLimitsSettings.json
git commit -m "$(cat <<'EOF'
i18n(form-app): add local-timezone hint string for time window settings
EOF
)"
```

---

### Task 6: Manual verification

No files change in this task — it's a checklist to confirm the feature works end-to-end, since `SubmissionLimitsSettings.tsx` has no automated component test.

- [ ] **Step 1: Start the stack**

Run: `pnpm dev` (or `pnpm backend:dev` + `pnpm form-app:dev` in separate terminals)

- [ ] **Step 2: Exercise the new UI**

1. Open a form in the builder, go to Settings → Submission Limits.
2. Enable "Time Window". Confirm Start defaults to today at `00:00` and End defaults to +30 days at `23:59`, and the "Times are shown in your local timezone." hint is visible.
3. Change the Start time to a time a few minutes in the future. Save.
4. Reload the page — confirm the start date and the exact time you set are both still shown (round-trip through the backend and back).
5. Try setting an End time earlier than the Start time-of-day on the same day — confirm the "End date must be after start date" toast appears and the change is rejected.

- [ ] **Step 3: Exercise backend enforcement**

1. With the form published, set Start to ~2 minutes in the future and save.
2. Open the public form URL and attempt to submit before that time — confirm it's rejected as not yet open.
3. Wait until the start time passes, submit again — confirm it succeeds.
4. Set End to ~1 minute in the future, save, wait for it to pass, then attempt a submission — confirm it's rejected as closed.

- [ ] **Step 4: Confirm legacy forms are unaffected**

If a pre-existing form in your dev database has a `YYYY-MM-DD`-only time window (or seed one via `pnpm db:seed` / Prisma Studio by writing `{"submissionLimits":{"timeWindow":{"enabled":true,"startDate":"2020-01-01","endDate":"2099-01-01"}}}` into `Form.settings`), open its Submission Limits settings and confirm:
- Start/End dates display correctly with time defaulting to `00:00`/`23:59`.
- The status badge (Active/Not Started/Ended) still computes correctly.
- Submissions are still allowed/blocked the same way they were before this change.

---

## Self-Review Notes

- **Spec coverage:** storage-format widening (Tasks 2–4), shared-helper move (Task 1), UI date+time composition (Task 4), UTC-conversion-at-the-boundary (Task 4 handlers), backend dual-format enforcement (Task 3), status-badge dual-format parsing (Task 4), i18n hint string (Task 5) — all covered. No explicit timezone selector and no new `@dculus/ui` component, per the "Out of scope" section of the spec — confirmed neither was introduced.
- **Placeholder scan:** no TBD/TODO markers; every step has complete, runnable code.
- **Type consistency:** `parseTimeWindowInstant(value: string): Date` (Task 2) is the exact signature imported and used in Task 4. `formatTimeForInput`/`combineDateAndTime` signatures (Task 1) match their usage in Task 4 and their pre-existing usage in `date-time-range-picker.tsx`. `onUpdateTimeWindow(enabled: boolean, startDate?: string, endDate?: string)` is unchanged end-to-end (Task 4 component prop, `FormSettingsContainer.tsx:55` wiring, `useFormSettings.ts`'s `updateSubmissionLimits`) — no signature drift.
