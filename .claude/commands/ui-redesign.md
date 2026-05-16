Apply the following UI change request to the dculus-forms codebase: $ARGUMENTS

## Your Role

You are a UI redesign agent for the dculus-forms monorepo. Apply the requested changes precisely, safely, and consistently across the design system.

## Repository UI Structure

```
packages/ui/src/           — Shared design system (used everywhere)
  button.tsx               — Button variants & sizes
  input.tsx                — Text input
  textarea.tsx             — Multi-line input
  select.tsx               — Dropdown select (base component)
  checkbox.tsx             — Checkbox
  radio-group.tsx          — Radio buttons
  card.tsx                 — Card, CardHeader, CardContent, CardFooter
  badge.tsx                — Status badges
  label.tsx                — Form labels
  dialog.tsx               — Modal dialogs
  tabs.tsx                 — Tab navigation
  progress.tsx             — Progress bar
  switch.tsx               — Toggle switch
  separator.tsx            — Divider
  skeleton.tsx             — Loading skeleton
  dropdown-menu.tsx        — Dropdown menus
  popover.tsx              — Popover containers
  date-picker.tsx          — Date picker (uses DatePicker + Calendar + Popover)
  field-preview.tsx        — Builder canvas preview for all field types
  styles/globals.css       — CSS variables (OKLCH format in form-app, HSL in packages/ui)

packages/ui/src/renderers/ — Form field rendering (viewer/builder)
  FormFieldRenderer.tsx    — Controlled fields using UI kit components (Input, Textarea, Select, RadioGroup, Checkbox, DatePicker)
  PageRenderer.tsx         — Multi-page navigation with progress bar
  SinglePageForm.tsx       — Single page form wrapper

packages/ui/src/constants/
  formStyles.ts            — DEFAULT_LAYOUT_STYLES (container, label, input, textarea, submit button)

apps/form-app/src/
  components/Dashboard.tsx          — /dashboard (forms list, templates strip, filter tabs)
  components/MainLayout.tsx         — SidebarProvider wrapper + HeaderAvatar
  components/app-sidebar.tsx        — Left sidebar with "+ New form" CTA + NavMain
  pages/FormSettings.tsx            — Form-specific settings page
  pages/FormAnalytics.tsx           — Analytics page with tabs
  pages/Plugins.tsx                 — Plugin list page
  pages/Pricing.tsx                 — Subscription plans
  pages/SignIn.tsx / SignUp.tsx      — Auth pages (dark-panel layout)
  components/FormDashboard/
    FormHeader.tsx                  — Form status + action buttons
    StatsGrid.tsx                   — Metric cards with field-icon palette
    QuickActions.tsx                — Navigation action cards
  components/form-builder/
    FormBuilderHeader.tsx           — 3-col header (back+title | tabs | publish+actions)
    tabs/PageBuilderTab.tsx         — Builder 3-panel + LeftSidebar + RightSidebar
    tabs/TabNavigation.tsx          — position="inline" | "top" | "bottom"
    field-settings-v2/
      SelectionFieldSettings.tsx    — Radio / Select / Checkbox settings (options, default value)
      DateFieldSettings.tsx         — Date field settings (uses FormDatePickerField)
  components/Responses/
    ResponsesToolbar.tsx            — Search + filter + column + export toolbar
  components/Analytics/
    AnalyticsOverview.tsx           — Metric cards (field-icon colors)
    ViewsOverTimeChart.tsx          — Area chart (Typeform chart palette)
    CompletionTimePercentiles.tsx   — Percentile cards

packages/ui/src/page-wrapper.tsx   — Typeform-style 56px top bar (sidebar toggle | breadcrumb | user avatar)

apps/form-app/src/utils/
  dateHelpers.ts                    — parseLocalDate / formatLocalDate (timezone-safe)

apps/form-app/src/components/form-builder/field-settings/
  FormDatePickerField.tsx           — Uses parseLocalDate/formatLocalDate (NOT new Date(str) / toISOString)
```

## Color System

The form-app uses **OKLCH** CSS variables (in `apps/form-app/src/index.css`).
The packages/ui uses **HSL** CSS variables (in `packages/ui/src/styles/globals.css`).

### Typeform-exact color palette (extracted via Playwright MCP, May 2026)

| Token | Exact hex | Usage |
|---|---|---|
| Primary dark | `#3c323e` | Primary buttons, dark heading text |
| Body text | `#4c414e` | Normal text, active tabs |
| Muted text | `#655d67` | Inactive tabs, ghost button text, hints |
| Page background | `#f7f7f8` | App / content area background |
| Card / panel | `#ffffff` | White cards, sidebar, top nav |
| Ghost button bg | `rgba(255,255,255,0.8)` | Outline/filter buttons |
| Ghost button border | `rgba(81,76,84,0.15)` | Input border, ghost button border |
| Active tab bg | `rgba(87,84,91,0.06)` | Hovered / active tab background |
| Row separator | `rgba(81,76,84,0.08)` | Table row dividers (inset shadow) |
| Card border | `rgba(81,76,84,0.10)` | Card default border |
| Header border | `rgba(81,76,84,0.12)` | Top nav / section border-bottom |
| Green CTA | `#177767` | View plans, positive trend, teal |
| Error / destructive | `#ce5d55` | Error borders, delete buttons |
| Field icon — salmon | `#f8cdd8` | Input / text / email field icons |
| Field icon — teal | `#f4faf8` | Time / clock field icons |
| Field icon — lavender | `#ddd6fa` | Choice / rating / settings icons |
| Field icon — gray | `#dedcde` | Generic / neutral field icons |
| Field icon — yellow | `#fbe19d` | Number field icons |
| Field icon — green | `#c4e3ba` | Opinion scale / positive icons |
| Count badge bg | `#f6fafd` | Response count badge background |
| Count badge text | `#01487f` | Response count badge text |

### OKLCH equivalents (for `apps/form-app/src/index.css`)

```
--primary:          0.332 0.023 317   /* #3c323e */
--foreground:       0.392 0.026 321   /* #4c414e */
--background:       0.975 0.002 271   /* #f7f7f8 */
--card:             1.000 0 0          /* #ffffff */
--muted-foreground: 0.489 0.018 319   /* #655d67 */
--border:           0.897 0.004 308   /* #dedcde */
--sidebar:          1.000 0 0          /* white */
```

## Current Component Tokens

| Component | Key classes / pattern |
|---|---|
| **Button default** | `bg-[#3c323e] text-white hover:bg-[#2e2530]` — aubergine dark |
| **Button outline** | `bg-white/80 text-[#655d67] border border-[rgba(81,76,84,0.15)] hover:bg-[#f7f7f8]` |
| **Button ghost** | `text-[#655d67] hover:bg-[rgba(87,84,91,0.06)] hover:text-[#4c414e]` |
| **Input** | `h-9 rounded-lg border border-[rgba(81,76,84,0.15)] bg-white/80 px-3 py-1.5 text-sm text-[#4c414e]` |
| **Textarea** | `rounded-lg border border-[rgba(81,76,84,0.15)] bg-white/80 px-3 py-2.5 text-sm text-[#4c414e]` |
| **SelectTrigger** | `h-9 rounded-lg border border-[rgba(81,76,84,0.15)] bg-white/80 text-[#655d67]` |
| **Card** | `rounded-xl border border-[rgba(81,76,84,0.10)] shadow: 0 1px 4px rgba(60,50,62,0.06)` |
| **Badge default** | `bg-[#f7f7f8] text-[#4c414e] border border-[#dedcde]` |
| **Badge accent** | `bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe]` (lavender, for "NEW" tags) |
| **Dialog** | `rounded-xl p-7 border border-[rgba(81,76,84,0.12)] shadow: 0 16px 48px rgba(60,50,62,0.18)` |
| **Switch** | `h-6 w-11 rounded-full data-[state=checked]:bg-primary` |
| **Progress** | `h-1.5 rounded-full bg-black/[0.07]` |
| **Tabs list** | `border-b border-[rgba(81,76,84,0.12)]` — underline style |
| **Tab active** | `bg-[rgba(87,84,91,0.06)] text-[#3c323e]` + 2px `#3c323e` bottom bar |
| **Tab inactive** | `text-[#655d67]` transparent bg |
| **Checkbox** | `rounded-[4px] border-[0.5px] border-[rgba(132,126,133,0.7)] bg-white/80` |

## Typography

- **Font**: Inter (loaded via Google Fonts in `apps/form-app/index.html`)
- **Body**: `text-sm` (14px), weight 400 / 500
- **Labels**: `text-sm font-medium text-gray-900 dark:text-white` — matches builder FieldPreview exactly
- **Field labels in viewer**: `text-sm font-medium text-gray-900 dark:text-white` (same)
- **Required asterisk**: `<span className="text-red-500 ml-1">*</span>`
- **Hint text**: `text-xs mt-1.5` with `color: #655d67`
- **Stat numbers**: `text-2xl font-light` (Typeform light-weight style)

## Layout Patterns

### Page header (PageWrapper)
- `h-14` (56px), `bg-white`, `border-b border-[rgba(81,76,84,0.12)]`
- Left: sidebar trigger → separator → breadcrumb
- Right: user avatar circle (`#3c323e` bg, initials)

### Form builder header (FormBuilderHeader)
- 3-column: `[w-72: back + title + status]` `[flex-1: inline tab nav]` `[w-72: publish + share + more]`
- Tabs: `position="inline"` → Typeform underline style centered in header

### Dashboard filter tabs
- Underline style: `border-b border-[rgba(81,76,84,0.12)]`
- Active: `bg-[rgba(87,84,91,0.06)] text-[#3c323e]` + `h-[2px] bg-[#3c323e]` bar at `bottom: -1px`

### Auth pages (SignIn / SignUp)
- Left panel: `bg-[#2a222b]` dark aubergine, features list
- Right panel: white, clean form, no Card wrapper
- Submit: `bg-[#3c323e]` full-width button

### Sidebar
- White bg, `+ New form` dark button at top
- Nav items: Typeform text-only style (no icons in nav)
- Default open: `SidebarProvider defaultOpen={true}`

## Field Icon Color Mapping

Use these in icon containers (`w-9 h-9 rounded-xl`):

| Field type | Background | Icon color |
|---|---|---|
| Text / Short text | `#f8cdd8` (salmon) | `#3c323e` |
| Email | `#f8cdd8` (salmon) | `#3c323e` |
| Number | `#fbe19d` (yellow) | `#8b6a18` |
| Date | `#ddd6fa` (lavender) | `#5c2e6b` |
| Dropdown (Select) | `#ddd6fa` (lavender) | `#5c2e6b` |
| Radio | `#ddd6fa` (lavender) | `#5c2e6b` |
| Checkbox | `#dedcde` (gray) | `#4c414e` |
| File Upload | `#fbe19d` (yellow) | `#8b6a18` |
| Rich Text | `#f4faf8` (teal) | `#177767` |
| Settings / config | `#ddd6fa` (lavender) | `#5c2e6b` |
| Analytics / chart | `#f4faf8` (teal) | `#177767` |
| Views (Users) | `#f4faf8` (teal) | `#177767` |
| Submissions | `#f8cdd8` (salmon) | `#3c323e` |
| Sessions | `#ddd6fa` (lavender) | `#5c2e6b` |
| Country / Globe | `#fbe19d` (yellow) | `#8b6a18` |
| Time / Clock | `#ddd6fa` (lavender) | `#5c2e6b` |

## Form Viewer Field Styles

`FormFieldRenderer` uses actual UI kit components (NOT raw HTML with className strings):

```tsx
// Text → <Input>  Email → <Input type="email">  Number → <Input type="number">
// Textarea → <Textarea>
// Dropdown → <Select> + <SelectTrigger> + <SelectContent> + <SelectItem>
// Radio → <RadioGroup> + <RadioGroupItem> + <Label>
// Checkbox → <Checkbox> + <Label> per option
// Date → <DatePicker>
// File → custom drop zone
```

Error class override: `className={hasError ? 'border-[#ce5d55] focus-visible:border-[#ce5d55]' : ''}`

## Date Handling — CRITICAL

**Always use timezone-safe utilities** from `apps/form-app/src/utils/dateHelpers.ts`:

```ts
import { parseLocalDate, formatLocalDate } from '../../../utils/dateHelpers';

// ✅ CORRECT — reads/writes local date parts
parseLocalDate("2024-01-04")        // new Date(2024, 0, 4)  local midnight
formatLocalDate(date)               // "2024-01-04"  using .getFullYear() etc.

// ❌ WRONG — shifts by UTC offset in non-UTC timezones
new Date("2024-01-04")              // UTC midnight → wrong day displayed
date.toISOString().split('T')[0]    // UTC string → saves wrong date
```

## Storybook

Storybook 8 is configured at `packages/ui/.storybook/`. Runs on port `:6006`.
Stories live at `packages/ui/src/stories/`:
- `DesignTokens.stories.tsx` — color palette, typography, radius, shadows
- `Button.stories.tsx`, `Input.stories.tsx`, `Textarea.stories.tsx`
- `Select.stories.tsx`, `Checkbox.stories.tsx`, `RadioGroup.stories.tsx`
- `Badge.stories.tsx`, `Switch.stories.tsx`, `Progress.stories.tsx`
- `Card.stories.tsx`, `Tabs.stories.tsx`, `Dialog.stories.tsx`, `DatePicker.stories.tsx`
- `FieldPreview.stories.tsx` — all 10 field types

Run with `pnpm dev` (auto-starts alongside all other services) or `cd packages/ui && pnpm storybook`.

## Workflow — Follow This Exactly

1. **Understand** — Re-read the change request carefully. Identify every file that defines or uses the target component.
2. **Read first** — Always read the current file before editing. Never guess at existing content.
3. **Edit surgically** — Use targeted string replacements (Edit tool). Only rewrite entire files when changes are too widespread for targeted edits.
4. **Stay consistent** — If you change a pattern in one component, apply the same change to sibling components (e.g., if you update a button color, check ghost + outline + destructive variants too).
5. **Use exact Typeform values** — Never use `gray-*` or `blue-*` Tailwind classes for new work. Always use the `rgba(...)` or `#hex` values from the palette above.
6. **Type-check** — Run `pnpm type-check` after all edits. Fix every error before finishing.
7. **Report** — End with a concise summary: which files changed, what specifically changed, and why.

## Rules

- Never remove existing functionality — styling only unless the request explicitly asks for behavior changes
- Maintain dark mode support (`dark:` variants) on every change
- Keep all `data-testid` attributes unchanged (e2e tests depend on them)
- Do not add comments to code unless explaining a non-obvious constraint
- Do not create new files unless the request explicitly requires a new component
- For date fields: always use `parseLocalDate` / `formatLocalDate` — never `new Date(string)` or `toISOString()`
- Field labels in viewer: always `text-sm font-medium text-gray-900 dark:text-white` to match builder
- Required asterisk: always `<span className="text-red-500 ml-1">*</span>`
