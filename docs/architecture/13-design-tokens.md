# Per-Form Design Tokens

A form owner can brand a form (colour, fonts, corner radius, input and button
style) without picking a different layout. The choices are a small, validated
object at `layout.tokens`, and every renderer reads it the same way.

The rule that keeps this safe: **tokens are additive and branded-only.** A form
with no tokens (or an empty `{ version: 1 }`) renders byte-for-byte as it did
before the feature existed.

## At a glance

| | |
|---|---|
| **Stored at** | `formSchema.layout.tokens` (JSON, alongside `theme`, `spacing`, …) |
| **Types / validation** | `packages/types/src/index.ts` (`DesignTokens`), `validation.ts` (`sanitizeDesignTokens`) |
| **Contrast + font catalog** | `packages/utils/src/index.ts`, `packages/utils/src/fonts.ts` |
| **Theming engine** | `packages/ui/src/layouts/shared/tokens.ts` (`resolveFormTheme`, `useFormTheme`, `useFormFonts`, `withTokens`) |
| **Builder UI** | `apps/form-app/src/components/form-builder/design/BrandStyleControls.tsx` |
| **Persistence** | Y.js layout map → `hocuspocus.ts` → `CollaborativeDocument` / `Form.formSchema` |

## The flow

1. The Design drawer edits `layout.tokens` through the layout slice
   (`updateLayout` / `clearLayoutKey('tokens')`), which syncs to the Y.js layout map.
2. Hocuspocus and `CollaborationManager` copy `tokens` through the read, init and
   update paths. Anything that is not whitelisted here silently disappears on reload.
3. On the server the object is passed through `sanitizeDesignTokens`: unknown keys,
   malformed colours and fonts outside the catalog are dropped.
4. `LayoutRenderer` calls `resolveFormTheme(tokens, scheme)` and puts the result on
   its wrapper as `--df-*` CSS variables plus `data-df-branded`. Fonts are loaded
   through one deduped `<link data-df-fonts>` to Google Fonts (skipped for `system`).
5. Fields, buttons and layouts use Tailwind arbitrary classes that reference the
   variables, e.g. `bg-[var(--df-primary)]`, `rounded-[var(--df-radius)]`.

## The `--df-*` contract

| Variable | Meaning |
|---|---|
| `--df-primary` / `--df-on-primary` | Brand colour and an auto-picked readable foreground |
| `--df-surface` | Page card background (light scheme only) |
| `--df-font-heading` / `--df-font-body` | Font stacks |
| `--df-radius` | Corner radius for controls |

Rules that must hold:

- **Never override `--primary` or `--radius`.** The shadcn variables belong to the
  host app. Branding lives only in `--df-*`, scoped to the renderer wrapper.
- **Branded-only classes.** Token classes are emitted only when the form is branded,
  so unbranded forms keep their exact legacy class strings.
- **Radix portals** render outside the wrapper, so popups apply `theme.portalStyle`
  inline instead of inheriting the variables.
- **Tailwind classes must be literal strings** so the scanner emits them; both the
  viewer and `packages/form-renderer` scan `packages/ui/src`.
- **Dark mode**: the brand colour is used in both schemes, `surfaceColor` only in light.

## Contrast

`BrandStyleControls` warns when the brand colour fails WCAG AA against white or
the auto foreground and offers a "Darken" fix (`darkenToContrast`). It is advisory;
it does not block saving.

## Where it is consumed

- **Builder canvas**: `PageBuilderFormArea` applies the variables, surface, body and
  heading fonts and wraps the page in `FormThemeContext`, so `FieldPreview` renders
  inputs, choices and ratings with the same token classes as the viewer. Layouts
  themselves are not re-themed in the builder.

## Builder UX

- The Design drawer is non-modal with no overlay (`Sheet modal={false}` +
  `SheetContent hideOverlay`), so the canvas stays visible and updates live. Outside
  clicks do not close it; Escape and the close button do.
- `BrandPreviewCard` (top of Brand & style) renders a sample form with the current
  tokens; `brandPresets.ts` holds one-click token sets (active preset = exact match).
- **Transient previews** (`store/useBrandPreviewStore.ts`) never write to Y.js. The canvas
  (`PageBuilderFormArea`, intro/thank-you via `PageBuilderTab`) reads
  `useEffectiveTokens(layout.tokens)`, which returns the preview while active:
  hovering/focusing a preset, dragging the native colour picker (saved on release or
  blur; hex text and swatches save immediately), and the **Preview without brand style**
  before/after toggle. The store is cleared on commit and when the drawer unmounts.
- Entry points: toolbar **Design** and **Brand** buttons, and a "Brand & style"
  shortcut on the Welcome panel. **Brand** opens the drawer scrolled to the
  section (`focusSection="brand"`).
- **Viewer / embed**: `LayoutRenderer` via form-viewer, no extra wiring.
- **Published renderer**: `@dculus/form-renderer` (README documents the CSP needs).
- **OG share images** (`services/og`): `describe.ts` reads a valid `tokens.primaryColor`
  into `SchemaSummary.brand`; `designs.ts` uses it for the form-share CTA, an accent bar
  and (without a photo) the gradient. Unbranded images are unchanged.

## Failure modes

| Symptom | Likely cause |
|---|---|
| Tokens vanish after reload | A new persistence path did not copy `layout.tokens` |
| Brand colour ignored on one control | The control's class string is not using the token helper |
| Popover/date picker unbranded | Missing `portalStyle` on the portal content |
| Backend rejects/drops a value | `sanitizeDesignTokens` (rebuild `@dculus/types` for the backend) |
