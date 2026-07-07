# design-sync notes for @dculus/ui

## Fixes applied

- `storybookConfigDir` must point at `packages/ui/.storybook` itself, not its parent
  package dir — pointing it at the parent broke story↔module pairing entirely
  (0/0 stories paired) because `resolveStorySources` resolves each story's
  `importPath` relative to `dirname(storybookConfigDir)`.
- `titleMap`: `Tokens`, `L1ClassicLayout`, `L2ModernLayout`, `L3CardLayout` are
  excluded (`null`) — they're internal layout implementation components (used
  only inside `LayoutRenderer`), not public `@dculus/ui` exports, and `Tokens`
  is a documentation-only color-swatch story, not a component. `LayoutRenderer`
  itself (public export) already covers all L1-L9 layout variants.
- `titleMap.LexicalRichTextEditor` → `RichTextEditor` — the package exports it
  under a renamed alias (`export { LexicalRichTextEditor as RichTextEditor }`).
- `overrides.Tabs.cardMode: "column"` — the `WithIcons` story is wider than a
  grid cell ([GRID_OVERFLOW]).
- `overrides.LayoutRenderer.cardMode: "single"` — every individual story
  renders correctly and matches the real Storybook pixel-for-pixel (verified:
  L1Classic sheet). The multi-instance PRODUCT GRID CARD (all 6 sampled
  stories mounted together on one page) throws
  `useFormResponseContext must be used within a FormRenderer` — a collision
  from mounting several `LayoutRenderer` instances (each internally rendering
  `PageRenderer`) simultaneously on one page. Single-card mode avoids the
  multi-mount entirely; per-story grading still happens via `?story=`.
- `overrides.PageRenderer.skip` — **all 14** of its stories (the compare tool
  only samples/grades the first 6 by default — [STORY_CAP] — but
  `PageRenderer.stories.tsx` actually exports 14: `Default`, `SinglePageMode`,
  `MultipageMode`, `BuilderMode`, `SubmissionMode`, `PreviewMode`,
  `HiddenNavigation`, `SinglePageForm`, `EmptyForm`, `PagesWithNoFields`,
  `CustomLayoutStyles`, `ControlledForm`, `DarkTheme`, `ValidationTestForm`).
  Skipping only the sampled 6 left the other 8 live in the grid card, which
  still threw the same error (render-check still failed with `root empty`
  after the first partial skip — caught by re-checking `.cache/previews/
  PageRenderer.tsx`'s actual export list against the skip list). **Confirmed
  via compare as `sb-error`** on the sampled 6: these stories throw
  `useFormResponseContext must be used within a FormRenderer` in the REAL
  Storybook too — `PageRenderer.stories.tsx` and `.storybook/preview.ts` never
  wrap stories in `FormRenderer`'s context provider. This is a pre-existing
  gap in the DS's own stories, not a design-sync artifact. `PageRenderer`
  therefore has no working preview card from this sync — it needs its own
  stories fixed upstream (wrap in `FormRenderer`, or add a minimal
  context-provider decorator) before it can be synced with a real preview.

## Known, accepted gaps (render-check warnings, not blocking)

- `[TOKENS_MISSING]`: `--tracking-tight`, `--tracking-wide`, `--tracking-widest`,
  `--tw-shadow-color` are referenced by `packages/ui/tailwind.config.js`'s
  `letterSpacing`/shadow utilities but never defined in
  `packages/ui/src/styles/globals.css` (only `--tracking-normal` is defined
  there). This is a pre-existing gap in the actual product CSS, not introduced
  by the sync — `Card`/`Dialog` titles use `tracking-tight` and fall back to
  the browser default (`letter-spacing: normal`) instead of a slightly
  tightened value. Effect is visually negligible. Not patched here per
  "ship what the customer already built."
  - `--radix-accordion-content-height` is set by Radix's Accordion at runtime
    via inline style — expected absent from static CSS.
- `[FONT_MISSING]`: `"DM Sans"` / `"JetBrains Mono"` are referenced (and ARE
  defined as `--font-sans`/`--font-mono` CSS vars in `globals.css`) but no
  `@font-face` ships the actual `.woff2` files from this package — the DS
  pane will render with system-font substitutes. No `cfg.extraFonts` path
  found bundled in the repo at sync time.

## Re-sync risks

- If `PageRenderer.stories.tsx` is ever fixed upstream to wrap in
  `FormRenderer`, remove the `overrides.PageRenderer.skip` entries and
  re-sync — it should then get a normal working preview.
- `LayoutRenderer`'s per-story fidelity was graded from a sampled 6 of 17
  stories ([STORY_CAP]) — raise `--max-stories` if the L6-L9 layout variants
  need individual verification.
- `FormRenderer` was sampled 6 of 23 stories; `PageRenderer` 6 of 14 (all
  skipped, see above).
