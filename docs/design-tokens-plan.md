# Design Tokens Foundation — Implementation Plan

> Status: **Proposed** · Scope: form **builder** (form-app) + form **viewer** (form-viewer) + shared renderer (`@dculus/ui`) + published `@dculus/form-renderer`
> Follow-up (not in this plan): Brand Kit from URL/logo, theme presets, AI "make it beautiful" — all of them only *write* tokens defined here.

## 1. Goal

Let a form owner set a small, structured set of **design tokens** (brand color, surface color, fonts, corner radius, input style, button style) once in the builder's 🎨 Design drawer, and have every layout (L1–L9), every screen (intro, pages, thank-you, quiz result) and every field render with them in:

- the **builder** (intro / thank-you canvas, Preview tab, device preview, and a brand tint on the field canvas)
- the **viewer** (`/f/:shortUrl`, embed mode)
- the **published renderer** (`@dculus/form-renderer` template previews)

### Non-negotiable: zero regression

Forms without `layout.tokens` (every existing form and template) must render **pixel-identical** to today. Every token-driven style is applied **only when a token is set**. Unset means the current hardcoded class or color is used as-is.

## 2. Key findings from the codebase (read before coding)

| # | Finding | Consequence |
|---|---|---|
| F1 | A new `FormLayout` key needs the same touchpoints as `backgroundDominantColor` (commit `2a380632`): `packages/types/src/index.ts`, `validation.ts`, `apps/form-app/src/store/helpers/defaultLayout.ts`, `CollaborationManager.ts` (Y.js → store read), `apps/backend/src/services/hocuspocus.ts` (**Y.js → DB read `getFormSchemaFromHocuspocus`** and **DB → Y.js init `initializeHocuspocusDocument`**), `formService.ts` `createForm`. | Missing the hocuspocus read means the key is **silently dropped** when the doc is persisted, so the viewer never sees it. That's the #1 failure mode. |
| F2 | `--primary` is stored in **different formats per app**: form-app uses OKLCH triplets with `withOpacity()`, form-viewer and `packages/ui` use HSL triplets with `hsl(var(--primary))`. | **Do not override `--primary`/`--radius`** on the form wrapper. Use new namespaced vars holding full CSS colors: `--df-*`. |
| F3 | Layouts style fields with per-layout Tailwind class bundles (`fieldStyles` in `L1ClassicLayout.tsx` … `L9`) and already transform them with `withSpacing(styles, spacing)` in `layouts/shared/theme.ts`. | Add a sibling `withTokens(styles, theme)` transform. Same pattern, single choke point. |
| F4 | `LayoutRenderer.tsx` is the one wrapper around every layout and already sets `--form-fg` + the `dark` class. | Set the `--df-*` vars and a `data-df-branded` attribute **here**, and provide a React context. |
| F5 | `FormFieldRenderer.tsx` hardcodes colors inline: label `#4c414e`, error `#ce5d55`, hint/counter `#655d67`, success `#177767`. `radio-group.tsx`, `checkbox`, `rating-input.tsx`, `button.tsx`, `progress.tsx`, `date-picker.tsx`, `calendar.tsx`, `switch.tsx` use `primary` classes. | Change these to `var(--df-x, <current literal>)` only where a token maps; keep error red as is (semantic). |
| F6 | Radix popups (`SelectContent`, the date-picker calendar) render in a **Portal outside the wrapper**, so CSS vars don't inherit. `@dculus/form-renderer` already special-cases poppers (`[data-radix-popper-content-wrapper]:has(> [data-dculus-ui])`). | Re-apply the `--df-*` vars as inline style on portal content via context (`useFormTheme().cssVars`). |
| F7 | Builder **field-page canvas is `FormArea`** (builder cards), *not* the renderer. Only the intro/thank-you canvas uses `FormRenderer` with `RendererMode.BUILDER` (`PageBuilderTab.tsx`). Preview tab uses `FormRenderer`. | Full fidelity lives in renderer surfaces. `FormArea` gets a **lightweight tint** (font + primary accent) in Phase 5, not full restyling. |
| F8 | `textColor` is honored in light mode only (`textColorStyle`). | Same rule for `surfaceColor`. `primaryColor` applies in both schemes. |
| F9 | Layout updates go through `layoutSlice.updateLayout`, which does `layoutMap.set(key, value)` per changed key. | Store `tokens` as **one plain object value** under `layout.tokens`. No slice change needed. Trade-off: concurrent edits to *different* tokens are last-writer-wins on the whole object (acceptable; the same holds for most of the layout today). |
| F10 | `formLayoutValidationSchema` currently has **no runtime caller**. `formSchema` is JSON in Prisma/GraphQL. | **No Prisma migration and no GraphQL schema change.** Still add zod validation and use it to *sanitize* tokens at read time. |
| F11 | Google Fonts are already loaded via `<link>` in `apps/*/index.html` (Inter). App supports **Tamil**. | The font list must include Tamil-capable families; load on demand with a deduped `<link>`. |
| F12 | Templates copy `layout` wholesale (`SaveAsTemplateDialog`, `templateService`, public seed JSON). | Tokens travel with templates automatically. Seed JSON needs no change (optional field). |
| F13 | `hocuspocusGolden.test.ts` has snapshots of the layout map. | Expect a snapshot update; review it, don't blindly `-u`. |

## 3. Token model

`packages/types/src/index.ts`:

```ts
export type FormRadius = 'none' | 'sm' | 'md' | 'lg' | 'pill';
export type FormInputStyle = 'outlined' | 'filled' | 'underline';
export type FormButtonStyle = 'solid' | 'outline' | 'soft';
export type FormFontId =
  | 'inter' | 'roboto' | 'poppins' | 'lora' | 'playfair' | 'merriweather'
  | 'space-grotesk' | 'dm-sans' | 'noto-sans-tamil' | 'mukta-malar' | 'system';

/** All optional: an unset token means "use the layout's built-in look". */
export interface FormDesignTokens {
  version: 1;
  primaryColor?: string;   // #RRGGBB — buttons, CTA, checked states, focus ring, progress, links
  surfaceColor?: string;   // #RRGGBB — page/field card background (light scheme only)
  headingFont?: FormFontId;
  bodyFont?: FormFontId;
  radius?: FormRadius;
  inputStyle?: FormInputStyle;
  buttonStyle?: FormButtonStyle;
}

export interface FormLayout {
  // …existing keys…
  tokens?: FormDesignTokens; // Design tokens; absent = legacy look (zero regression)
}
```

Derived values, computed at render time and **never stored**:

| CSS var | Source |
|---|---|
| `--df-primary` | `primaryColor` |
| `--df-on-primary` | `#ffffff` or `#111111`, whichever has higher WCAG contrast against primary |
| `--df-primary-soft` | `mixWithWhite(primary, 0.88)` (soft button bg, hover, selected option bg) |
| `--df-ring` | `hexToRgba(primary, 0.35)` |
| `--df-surface` | `surfaceColor` (light only) |
| `--df-radius` | none `0` · sm `0.25rem` · md `0.5rem` · lg `0.875rem` · pill `9999px` (inputs use `min(var(--df-radius), 1.5rem)` for pill so textareas don't become capsules) |
| `--df-font-heading` / `--df-font-body` | `FONT_CATALOG[id].stack` |

Font catalog (`packages/utils/src/fonts.ts`, exported from `@dculus/utils`):
`{ id, label, stack, googleFamily?, supportsTamil }`. `system` and `inter` need no network load (Inter is already in every `index.html`).

## 4. Phases

Each phase is independently mergeable and leaves `main` green. Suggested PR per phase.

---

### Phase 1 — Types, validation, color/font utils (packages only)

**Files**
- `packages/types/src/index.ts`: types above, plus `tokens?` on `FormLayout`.
- `packages/types/src/validation.ts`: `formDesignTokensSchema` (hex regex for colors, enums, `version: z.literal(1)`), `tokens: formDesignTokensSchema.optional()` in `formLayoutValidationSchema`. Export `sanitizeDesignTokens(input: unknown): FormDesignTokens | undefined`, which drops invalid keys individually (never throws) and returns `undefined` if nothing valid remains. ⚠️ Respect the existing TDZ comment in that file: no top-level reads of `index.ts` consts.
- `packages/utils/src/index.ts` (next to `hexToRgba` / `mixWithWhite`): `relativeLuminance(hex)`, `contrastRatio(a, b)`, `readableOn(hex): '#ffffff' | '#111111'`.
- `packages/utils/src/fonts.ts`: `FONT_CATALOG`, `getFontStack(id)`, `getGoogleFontsHref(ids[])` (one combined URL, `display=swap`, weights 400;500;600;700).

**Tests**: `packages/types` vitest for `sanitizeDesignTokens` (valid, partial-invalid, garbage, missing version). Utils tests for `contrastRatio` and `readableOn` (known pairs: `#000/#fff = 21`).

**Done when**: `pnpm --filter @dculus/types build && pnpm --filter @dculus/utils build` and the package tests pass.

---

### Phase 2 — Persistence & sync plumbing (builder ⇄ Y.js ⇄ DB ⇄ viewer)

**Files**
- `apps/form-app/src/store/helpers/defaultLayout.ts`: leave `tokens` **undefined** in `DEFAULT_LAYOUT` (absent = legacy).
- `apps/form-app/src/store/collaboration/CollaborationManager.ts` (~line 617): `tokens: sanitizeDesignTokens(layoutMap.get('tokens'))`.
- `apps/backend/src/services/hocuspocus.ts`:
  - `getFormSchemaFromHocuspocus` (~line 696): `const tokens = sanitizeDesignTokens(layout.get('tokens')); if (tokens) convertedLayout.tokens = tokens;` (only set when present, which keeps golden output unchanged for legacy forms).
  - `initializeHocuspocusDocument` (~line 1025): `if (layout.tokens) layoutMap.set('tokens', layout.tokens);`
- `apps/backend/src/services/formService.ts` `createForm`: no change (no tokens by default). Verify duplicate/template-create paths copy `layout` wholesale; if any rebuild layout key-by-key, add `tokens`.
- Rebuild `@dculus/types` + `@dculus/utils` before backend work (backend reads `dist/`).

**Tests**
- `apps/backend/src/services/__tests__/hocuspocus.test.ts`: round-trip (init with tokens → read back equal), legacy (no tokens → key absent), invalid tokens dropped.
- Golden snapshot: legacy snapshot must **not** change. If it does, the "only set when present" rule was missed.
- form-app: a `CollaborationManager` or layout round-trip test next to `slices/__tests__/gridPersistence.test.ts` style.

**Done when**: backend `test:coverage` passes thresholds. Manual check: setting `tokens` via the devtools store → reload → `formSchema.layout.tokens` present in the DB (`pnpm db:studio`) and in the viewer's GraphQL response.

---

### Phase 3 — Renderer theming engine (`@dculus/ui`, used by builder and viewer)

**New** `packages/ui/src/layouts/shared/tokens.ts`:
```ts
export interface ResolvedFormTheme {
  branded: boolean;                 // any token set
  tokens: FormDesignTokens;
  cssVars: React.CSSProperties;     // only vars for tokens that are set
  scheme: 'light' | 'dark';
}
export function resolveFormTheme(tokens, scheme): ResolvedFormTheme;
export const FormThemeContext = React.createContext<ResolvedFormTheme>(UNBRANDED);
export const useFormTheme = () => React.useContext(FormThemeContext);
export function withTokens(styles: LayoutStyles, theme: ResolvedFormTheme): LayoutStyles;
export function useFormFonts(tokens?: FormDesignTokens): void; // injects one deduped <link id="df-fonts-…">
```

`withTokens` rules (run **after** `withSpacing`; it's a no-op when `!branded`):
- **radius**: strip standalone `rounded-*` tokens from `input/textarea/select/submitButton`, then add `rounded-[var(--df-radius)]`.
- **inputStyle**: `outlined` = layout default (no change) · `filled` = replace `bg-*`/`border` with `bg-[var(--df-primary-soft)] border-transparent` · `underline` = `border-0 border-b-2 rounded-none bg-transparent px-0`.
- **submitButton / buttonStyle**: `solid` = `bg-[var(--df-primary)] text-[var(--df-on-primary)]` · `outline` = `bg-transparent border-2 border-[var(--df-primary)] text-[var(--df-primary)]` · `soft` = `bg-[var(--df-primary-soft)] text-[var(--df-primary)]`. Only applied when `primaryColor` is set.
- Focus: append `focus-visible:ring-2 focus-visible:ring-[var(--df-ring)]` when primary is set.

Use a class-token filter like `withSpacing` does (`^rounded(-\w+)?$`, `^bg-`, …). Keep variant-prefixed classes (`dark:bg-…`) unless that same property is being replaced. Write tests for this function, since it's the riskiest logic.

**`LayoutRenderer.tsx`**: compute `theme = resolveFormTheme(layout?.tokens, scheme)`, merge `theme.cssVars` into `wrapperStyle`, add `data-df-branded` when branded, set `fontFamily: var(--df-font-body)` when `bodyFont` is set, wrap children in `<FormThemeContext.Provider>`, and call `useFormFonts(layout?.tokens)`.

**Tailwind**: arbitrary classes like `bg-[var(--df-primary)]` must be **literal strings in source** for JIT to emit them. Never build them with template interpolation. Confirm `packages/ui/src/**` is in the `content` globs of `apps/form-app`, `apps/form-viewer`, `packages/form-renderer` tailwind configs (it is for layouts today; double-check `layouts/shared/tokens.ts` is matched).

**Done when**: Storybook story `FormRenderer.stories.tsx` gains a "Branded" story per token. Legacy stories are unchanged.

---

### Phase 4 — Apply tokens across layouts, screens & fields

Rule for every edit: `branded ? tokenClass/style : currentClass/style`, or a CSS fallback `var(--df-x, <current literal>)`. Never change the unbranded output.

| Area | Files | Change |
|---|---|---|
| Layout field bundles | `L1…L9*.tsx` / `StandardIntroLayout.tsx` (wherever `withSpacing` is called) | Wrap with `withTokens(…, useFormTheme())` |
| CTA / submit / nav buttons | `introContent.tsx`, `IntroHero.tsx`, `PageRenderer.tsx` (next/prev/submit), `L6WizardLayout.tsx`, `L9PagesLayout.tsx`, `ThankYouScreen.tsx`, `QuizResultScreen.tsx`, `SinglePageForm.tsx` | Button style + radius from tokens |
| Headings | `introContent.tsx`, `ThankYouScreen.tsx`, rich-text containers | `font-family: var(--df-font-heading)` on `h1–h3` via `[&_h1]:font-[family-name:var(--df-font-heading)]`, only when `headingFont` is set |
| Surface | `layouts/shared/surface.tsx`, `ScreenShell.tsx` card | `background: var(--df-surface)` when set and scheme is light |
| Choice controls | `radio-group.tsx`, `checkbox.tsx`, `rating-input.tsx`, `switch.tsx`, `slider.tsx` | `data-[state=checked]` color: `var(--df-primary, <current>)`. Prefer a `branded` prop or context read inside `FormFieldRenderer` passing `className`, so admin and builder UIs using these primitives are untouched |
| Progress | `progress.tsx` (L6 wizard), page dots in `L9` | `var(--df-primary)` |
| Field renderer | `FormFieldRenderer.tsx` | Label color: `var(--form-fg, #4c414e)` (already intended). Hint/counter keep `#655d67`. Error `#ce5d55` **unchanged** (semantic). Success `#177767` → `var(--df-primary, #177767)` |
| Portals (F6) | `SelectContent` use in `FormFieldRenderer`, `date-picker.tsx` / `calendar.tsx` popover | Pass `style={theme.cssVars}` (and the font) to the portal content element |
| File upload | `FileUploadInput.tsx` | Dropzone border/hover → primary when branded |
| Dark scheme | all of the above | `primaryColor` applies; `surfaceColor` ignored; verify contrast of `--df-on-primary` |

**Tests**
- `@dculus/ui` unit tests: `withTokens` matrix; `resolveFormTheme` (no tokens → `branded:false`, `cssVars` `{}`).
- form-viewer `test:unit`: render a branded schema and assert the wrapper has `--df-primary` and the submit button has `bg-[var(--df-primary)]`; a legacy schema has neither.
- Visual pass in Storybook across L1–L9 × light/dark × each inputStyle and buttonStyle.

---

### Phase 5 — Builder UI (form-app)

**`DesignDrawer.tsx`**: new section **"Brand & style"** between *Layout family* and *Global background*. Extract it into `apps/form-app/src/components/form-builder/design/BrandStyleControls.tsx` (mirrors `BackgroundControls`).

Controls (all disabled when `!canEditLayout`; every change calls `onLayoutUpdate({ tokens: { version: 1, ...layout.tokens, [key]: value } })`):
1. **Brand color**: swatch `<input type="color">` + hex `Input` (same pattern as `BackgroundControls` line ~156) + 8 quick swatches + "clear".
2. **Surface color**: same, with helper text "Light theme only".
3. **Heading font / Body font**: `Select` with each option rendered in its own font (lazy-load the font list on drawer open), plus a 🌐 Tamil badge for `supportsTamil`.
4. **Corners**: segmented control none / sm / md / lg / pill with tiny preview squares.
5. **Input style**: 3 mini thumbnails (outlined / filled / underline).
6. **Button style**: 3 mini thumbnails (solid / outline / soft) drawn in the current brand color.
7. **Contrast check**: inline warning when `contrastRatio(primary, on-primary) < 4.5` or `contrastRatio(textColor, surface) < 4.5`. Show the ratio plus a one-click "Darken" fix (mix toward black until ≥ 4.5).
8. **Reset brand style**: sets `tokens: undefined`. ⚠️ `layoutSlice.updateLayout` skips `undefined` values when writing Y.js, so reset must call `layoutMap.delete('tokens')`. Add an explicit `clearLayoutKey('tokens')` action to `layoutSlice` (or treat `null` as delete) and cover it with a test.

**Live feedback in the builder**
- Intro / thank-you canvas and Preview tab update automatically (they use `FormRenderer`).
- **Field canvas `FormArea` (F7)**: wrap with the same `cssVars` and set `font-family: var(--df-font-body)`. Use `--df-primary` only for the field-card *selected* accent and preview inputs' focus ring. Don't restyle builder chrome.
- Optional: a small live "sample field + button" preview card at the top of the Brand & style section (renders a `FormFieldRenderer` in `PREVIEW` mode inside a `FormThemeContext`).

**i18n**: add keys to `apps/form-app/src/locales/en/designDrawer.json` **and** `ta/designDrawer.json` (`brandStyle.*`). The namespace already exists, so no `index.ts` registration is needed.

**Permissions**: VIEWER sees the controls read-only (existing `canEditLayout`). No backend auth change; layout writes already go through Hocuspocus permission checks.

**Tests**: form-app jest (`pnpm --filter form-app test`, not run in CI or hooks, so **run manually**): `BrandStyleControls` renders, dispatches the correct `tokens` merge, reset deletes the key, read-only disables inputs.

---

### Phase 6 — Viewer, embed & published renderer hardening

- **form-viewer** (`apps/form-viewer/src/pages/FormViewer.tsx`): nothing to wire, since it uses `FormRenderer` → `LayoutRenderer`. Verify:
  - fonts load on a cold `/f/:shortUrl` (no FOUT flash beyond `display=swap`)
  - **CSP**: if `apps/form-viewer/public/_headers` or `public/_worker.js` sets a CSP, allow `https://fonts.googleapis.com` (style) and `https://fonts.gstatic.com` (font). Keep `_worker.js` headers in sync with `_headers` (a test enforces this).
  - embed mode (`embedded` prop, `embedShell.ts`): the vars sit on the wrapper, so the host page is not affected.
  - draft-resume, multi-page, L6 wizard, quiz result screen all branded.
- **`@dculus/form-renderer`**: styles are scoped via `.dculus-form-renderer`. Ensure the new arbitrary classes are emitted (rebuild `dist/style.css`) and the font `<link>` injection is acceptable to consumers. Document it in `packages/form-renderer/README.md` (tokens honored; fonts fetched from Google Fonts unless `system`). Bump its version if it's published.
- **OG images** (`apps/backend/src/services/og/`): *optional/out of scope*. Note in a follow-up that `describe.ts` can read `tokens.primaryColor` for share cards.

---

### Phase 7 — E2E & docs

- `test/e2e/features/form-design-tokens.feature` (use the e2e-test-writer agent): set brand color + button style in the Design drawer → publish → open the viewer → assert the submit button's computed `background-color`. Reload the builder → controls retain their values (persistence through Hocuspocus).
- Integration test (optional): create a form via GraphQL with `layout.tokens` → fetch the public form → tokens returned.
- Docs: add a "Design tokens" section to `docs/architecture/` (or extend the field/rendering doc) describing the `--df-*` contract and the "branded-only" rule. Update `CLAUDE.md` FormLayout notes in one line.

## 5. Verification checklist (per PR)

- [ ] `pnpm lint && pnpm type-check`
- [ ] `pnpm --filter @dculus/types build && pnpm --filter @dculus/utils build` (before backend)
- [ ] `pnpm --filter backend test:coverage` (thresholds 80/78)
- [ ] `pnpm --filter @dculus/types test`, `pnpm --filter @dculus/ui test`
- [ ] `pnpm --filter form-viewer test:unit`
- [ ] `pnpm --filter form-app test` (**manual: not in CI**)
- [ ] Legacy form (no tokens) visually identical in builder + viewer, L1–L9, light + dark
- [ ] Two browser sessions on one form: token change syncs live
- [ ] Hocuspocus golden snapshot unchanged for legacy fixtures

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Token dropped on persist (F1) | Round-trip test in Phase 2 before any UI exists |
| Tailwind purges dynamic classes | Only literal class strings; Storybook check per app build |
| Unbranded regressions | `branded` gate everywhere; Storybook legacy stories as baseline; golden snapshot |
| Portal content unthemed (F6) | Explicit `cssVars` on portal content; test Select + date picker |
| Low-contrast brand colors | Computed `--df-on-primary` + drawer contrast warning + one-click fix |
| Font FOUT / Tamil glyph fallback | `display=swap`; Tamil-capable families flagged; `system` option |
| Reset not deleting Y.js key | Dedicated `clearLayoutKey` + test (Phase 5) |
| Shared primitives (radio, checkbox, button) used in admin/builder chrome | Apply token classes from `FormFieldRenderer`/layouts via props, not by editing primitive defaults |

## 7. Open decisions (defaults chosen; change before starting if needed)

1. **Font source**: Google Fonts CDN (default) vs self-hosted `@fontsource` (privacy, no third-party request in the viewer). The default matches what the apps already do.
2. **Field canvas fidelity** (F7): tint only (default) vs full token rendering in `FormArea`.
3. **Plan gating**: free for all (default) vs paid-plan feature via Chargebee entitlement (would add a `brand_kit` entitlement check in the drawer + viewer fallback).
4. **Accent color**: deliberately omitted in v1 (primary only) to keep the matrix small.

---

## 8. Sonnet prompts (one per phase)

Paste one at a time and review each PR before starting the next. Each prompt assumes the agent reads `AGENTS.md`, `CLAUDE.md` and this file first.

**Phase 1**
> Read `docs/design-tokens-plan.md` §2–§3 and implement **Phase 1 only**. Add `FormDesignTokens` and related types plus `tokens?` on `FormLayout` in `packages/types/src/index.ts`; add `formDesignTokensSchema`, `sanitizeDesignTokens` (never throws, drops invalid keys individually, returns undefined when empty) and the optional `tokens` key in `packages/types/src/validation.ts`, respecting the TDZ comment there; add `relativeLuminance`, `contrastRatio`, `readableOn` next to `hexToRgba` in `packages/utils/src/index.ts`; add `packages/utils/src/fonts.ts` with `FONT_CATALOG`, `getFontStack`, `getGoogleFontsHref` and export it. Add focused vitest tests. Build both packages and run their tests. Do not touch apps.

**Phase 2**
> Read `docs/design-tokens-plan.md` (findings F1, F9, F13) and implement **Phase 2 only**. Wire `layout.tokens` through `CollaborationManager.ts`, `hocuspocus.ts` (`getFormSchemaFromHocuspocus` and `initializeHocuspocusDocument`; set the key only when tokens are present, using `sanitizeDesignTokens`), and check every form duplicate/template path that rebuilds layout key-by-key. Use commit `2a380632` (`backgroundDominantColor`) as the reference for touchpoints. Rebuild `@dculus/types`/`@dculus/utils` first. Add round-trip, legacy and invalid-token tests in `hocuspocus.test.ts`. The legacy golden snapshot must not change. Run `pnpm --filter backend test:coverage`.

**Phase 3**
> Read `docs/design-tokens-plan.md` (F2–F4, F6) and implement **Phase 3 only** in `packages/ui`. Create `layouts/shared/tokens.ts` with `resolveFormTheme`, `FormThemeContext`, `useFormTheme`, `withTokens`, `useFormFonts`, and wire them into `renderers/LayoutRenderer.tsx`. Never override `--primary`/`--radius`; use `--df-*` vars. All Tailwind arbitrary classes must be literal strings. Everything is a no-op when no tokens are set. Add unit tests for `withTokens` and `resolveFormTheme` and Storybook "Branded" stories. Don't edit layouts or fields yet.

**Phase 4**
> Read `docs/design-tokens-plan.md` §4 Phase 4 and apply tokens across L1–L9, the shared screens (intro, pages, thank-you, quiz result), `FormFieldRenderer` and portal content, following the table exactly. Hard rule: output for forms without tokens must be identical; gate every change on `useFormTheme().branded` or use `var(--df-x, <current literal>)`. Don't change primitive defaults used by admin or builder chrome; pass classes from the renderer instead. Keep error red unchanged. Add form-viewer `test:unit` coverage for branded vs legacy rendering. Run `@dculus/ui` tests and the form-viewer tests.

**Phase 5**
> Read `docs/design-tokens-plan.md` §4 Phase 5 and build `BrandStyleControls.tsx` inside `DesignDrawer.tsx` (form-app) with the 8 controls listed. Every string goes through `useTranslation('designDrawer')` with en **and** ta keys. Add a `layoutSlice` way to delete the `tokens` key from Y.js for reset, with a test. Respect `canEditLayout`. Apply the lightweight tint to `FormArea`. Add jest tests and run `pnpm --filter form-app test` manually. Then verify in the browser at http://localhost:3000 with the E2E test account from `package.json` (`test:e2e` fallback values): change tokens, reload, open the viewer link.

**Phase 6–7**
> Read `docs/design-tokens-plan.md` Phases 6–7. Verify viewer, embed and the published `@dculus/form-renderer` with tokens (CSP for Google Fonts if a CSP exists, keeping `_worker.js` in sync with `_headers`), update the form-renderer README, then use the e2e-test-writer agent to add `form-design-tokens.feature`, and add the architecture doc section. Run the full verification checklist in §5.
