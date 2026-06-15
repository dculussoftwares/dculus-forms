# Mobile Layout Spacing Fix

**Date:** 2026-06-15  
**Status:** Approved

## Problem

All 9 form layouts have excess spacing on mobile (390 × 780, iPhone 14) that pushes content down and makes the intro/fields sections feel empty. The same issue appears in both contexts:

1. **Real mobile devices** using the form-viewer app
2. **Form-builder mobile preview** (PreviewTab phone frame)

Two independent problem zones were identified.

---

## Zone 1 — Intro screen white paper (L1–L5, L7, L8)

The intro container uses `style={{ padding: '5% 10%' }}` (inline style, not Tailwind) and the inner white paper has a hardcoded `p-8` (32 px) with no `sm:` responsive variant.

On a 390 px screen this chains:
- Outer: `10% × 2 = 78 px` consumed
- Inner absolute `5%` inset: `~31 px` more
- Paper `p-8`: `64 px` (32 each side)

**Effective content width: ~217 px out of 390 px — 44% wasted on padding.**

## Zone 2 — Fields section internal gaps (all layouts via PageRenderer)

`PageRenderer.tsx` uses `mb-8` (32 px) below the progress bar and `mb-8` (32 px) below the page title, plus `mt-10` (40 px) above the sticky nav footer — all with no responsive variant. On mobile this stacks 64–104 px of dead space before the first field, leaving only one field visible.

The pages-section outer wrapper (`p-3 sm:p-8`) and white card (`p-4 sm:p-8`) are **already responsive and do not need changes**.

---

## Approach

**Direct Tailwind responsive classes.** Replace each hardcoded value with a responsive pair (`mobile-value sm:desktop-value`). No new abstractions, no new components.

The existing `MOBILE_PREVIEW_CSS` in `PreviewTab.tsx` already overrides `sm:p-8 → p-3` for the form-builder preview — these fixes compose with it automatically.

---

## Changes

### L1, L2, L4, L5, L7, L8 — intro outer container

Replace inline `style` with Tailwind responsive classes. (L3 already uses `px-3 py-4 sm:px-[10%] sm:py-[5%]` — skip. L8 has no white paper but still benefits from the tighter outer gap.)

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

### L1, L2, L3, L4, L5, L7 — white paper panel

L8 is image-only (no white paper). L3 uses a slightly different class list.

```diff
# L1, L2, L4, L5, L7
- className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto"
+ className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-4 sm:p-8 overflow-y-auto"

# L3
- className="bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto max-w-md w-full"
+ className="bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-4 sm:p-8 overflow-y-auto max-w-md w-full"
```

### L6WizardLayout — three changes

```diff
# section stack gap
- <div className="w-full max-w-4xl mx-auto flex flex-col space-y-6 min-h-full">
+ <div className="w-full max-w-4xl mx-auto flex flex-col space-y-3 sm:space-y-6 min-h-full">

# image banner height
- <div className="w-full h-48 relative rounded-lg overflow-hidden shadow-lg">
+ <div className="w-full h-32 sm:h-48 relative rounded-lg overflow-hidden shadow-lg">

# intro text card padding
- <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-6 shadow-lg">
+ <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-4 sm:p-6 shadow-lg">
```

### PageRenderer.tsx — three changes

```diff
# progress bar bottom gap
- <div className="flex items-center gap-3 mb-8">
+ <div className="flex items-center gap-3 mb-4 sm:mb-8">

# page title bottom gap
- <div className="mb-8">
+ <div className="mb-4 sm:mb-8">

# sticky footer top gap
- <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 mt-10 z-10">
+ <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 mt-4 sm:mt-10 z-10">
```

---

## Files touched

| File | Changes |
|------|---------|
| `packages/ui/src/layouts/L1ClassicLayout.tsx` | 2 (outer padding + white paper) |
| `packages/ui/src/layouts/L2ModernLayout.tsx` | 2 (outer padding + white paper) |
| `packages/ui/src/layouts/L3CardLayout.tsx` | 1 (white paper only — outer already responsive) |
| `packages/ui/src/layouts/L4MinimalLayout.tsx` | 2 (outer padding + white paper) |
| `packages/ui/src/layouts/L5SplitLayout.tsx` | 2 (outer padding + white paper) |
| `packages/ui/src/layouts/L6WizardLayout.tsx` | 3 (space-y, p-6, h-48) |
| `packages/ui/src/layouts/L7SingleLayout.tsx` | 2 (outer padding + white paper) |
| `packages/ui/src/layouts/L8ImageLayout.tsx` | 1 (outer padding only — image-only intro, no white paper) |
| `packages/ui/src/renderers/PageRenderer.tsx` | 3 (mb-8×2 + mt-10) |

**Not touched:** `L9PagesLayout.tsx` (pages-only, no intro section), `PreviewTab.tsx` (MOBILE_PREVIEW_CSS already handles `sm:` overrides), `FormViewer.tsx` (h-screen wrapper is correct).

---

## Desktop behaviour

All changes use `sm:` suffix to restore original desktop values. Desktop layout is unchanged.

---

## Success criteria

- On 390 px mobile, the intro white paper content width increases from ~217 px to ~280 px
- At least 2 form fields visible above the fold on the fields section (was 1)
- Desktop preview at ≥640 px is visually identical to today
- Form-builder mobile preview phone frame and real form-viewer both benefit from the same code change
