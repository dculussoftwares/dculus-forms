# Mobile Layout Spacing Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove excess mobile spacing from all 9 form layouts and PageRenderer so content is prominent on 390 px screens without breaking desktop layout.

**Architecture:** Direct Tailwind responsive class swaps only — replace hardcoded `p-8`, `p-6`, `space-y-6`, `h-48`, `mb-8`, `mt-10` and an inline `style={{ padding: '5% 10%' }}` with `mobile-value sm:desktop-value` pairs. No new files, no new components.

**Tech Stack:** Tailwind CSS v3 responsive prefixes (`sm:` = ≥640 px breakpoint), React TSX, packages/ui

---

## Files modified

| File | Changes |
|---|---|
| `packages/ui/src/layouts/L1ClassicLayout.tsx` | line 106 (outer padding), line 130 (white paper) |
| `packages/ui/src/layouts/L2ModernLayout.tsx` | line 105 (outer padding), line 124 (white paper) |
| `packages/ui/src/layouts/L3CardLayout.tsx` | line 122 (white paper only) |
| `packages/ui/src/layouts/L4MinimalLayout.tsx` | line 105 (outer padding), line 130 (white paper) |
| `packages/ui/src/layouts/L5SplitLayout.tsx` | line 105 (outer padding), line 116 (white paper) |
| `packages/ui/src/layouts/L6WizardLayout.tsx` | line 102 (space-y-6), line 105 (h-48), line 117 (p-6) |
| `packages/ui/src/layouts/L7SingleLayout.tsx` | line 105 (outer padding), line 116 (white paper) |
| `packages/ui/src/layouts/L8ImageLayout.tsx` | line 71 (outer padding only — image-only intro) |
| `packages/ui/src/renderers/PageRenderer.tsx` | line 214 (mb-8 progress), line 232 (mb-8 title), line 288 (mt-10 footer) |

---

## Task 1 — L1 ClassicLayout (2 changes)

**Files:** `packages/ui/src/layouts/L1ClassicLayout.tsx`

- [ ] **Step 1: Fix outer container padding (line 106)**

Replace the inline style with Tailwind responsive classes:

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Fix white paper internal padding (line 130)**

```diff
- className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto"
+ className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-4 sm:p-8 overflow-y-auto"
```

- [ ] **Step 3: Type-check passes**

```bash
pnpm type-check
```

Expected: no errors in L1ClassicLayout.tsx

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/layouts/L1ClassicLayout.tsx
git commit -m "fix: tighten L1 intro padding on mobile (px-2 py-2, p-4 sm:p-8)"
```

---

## Task 2 — L2 ModernLayout (2 changes)

**Files:** `packages/ui/src/layouts/L2ModernLayout.tsx`

- [ ] **Step 1: Fix outer container padding (line 105)**

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Fix white paper internal padding (line 124)**

```diff
- className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto"
+ className="absolute bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-4 sm:p-8 overflow-y-auto"
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/layouts/L2ModernLayout.tsx
git commit -m "fix: tighten L2 intro padding on mobile (px-2 py-2, p-4 sm:p-8)"
```

---

## Task 3 — L3 CardLayout (white paper only)

**Files:** `packages/ui/src/layouts/L3CardLayout.tsx`

Note: L3 already has `px-3 py-4 sm:px-[10%] sm:py-[5%]` on its outer container — no outer padding change needed. Only the white paper needs fixing.

- [ ] **Step 1: Fix white paper internal padding (line 122)**

```diff
- className="bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-8 overflow-y-auto max-w-md w-full"
+ className="bg-white bg-opacity-95 backdrop-blur-sm flex flex-col rounded-sm p-4 sm:p-8 overflow-y-auto max-w-md w-full"
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/layouts/L3CardLayout.tsx
git commit -m "fix: tighten L3 intro white paper padding on mobile (p-4 sm:p-8)"
```

---

## Task 4 — L4 MinimalLayout (2 changes)

**Files:** `packages/ui/src/layouts/L4MinimalLayout.tsx`

Note: L4's white paper uses `bg-opacity-98 shadow-inner inset-0` — slightly different class list from L1/L2, but the `p-8` fix is the same.

- [ ] **Step 1: Fix outer container padding (line 105)**

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Fix white paper internal padding (line 130)**

```diff
- className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-8 overflow-y-auto shadow-inner inset-0"
+ className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-4 sm:p-8 overflow-y-auto shadow-inner inset-0"
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/layouts/L4MinimalLayout.tsx
git commit -m "fix: tighten L4 intro padding on mobile (px-2 py-2, p-4 sm:p-8)"
```

---

## Task 5 — L5 SplitLayout (2 changes)

**Files:** `packages/ui/src/layouts/L5SplitLayout.tsx`

Note: Same `bg-opacity-98 shadow-inner inset-0` pattern as L4.

- [ ] **Step 1: Fix outer container padding (line 105)**

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Fix white paper internal padding (line 116)**

```diff
- className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-8 overflow-y-auto shadow-inner inset-0"
+ className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-4 sm:p-8 overflow-y-auto shadow-inner inset-0"
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/layouts/L5SplitLayout.tsx
git commit -m "fix: tighten L5 intro padding on mobile (px-2 py-2, p-4 sm:p-8)"
```

---

## Task 6 — L6 WizardLayout (3 changes)

**Files:** `packages/ui/src/layouts/L6WizardLayout.tsx`

L6 has no split intro — it stacks an image banner, a text card, and a fields card vertically. All three need tightening on mobile.

- [ ] **Step 1: Reduce section stack gap (line 102)**

```diff
- <div className="w-full max-w-4xl mx-auto flex flex-col space-y-6 min-h-full">
+ <div className="w-full max-w-4xl mx-auto flex flex-col space-y-3 sm:space-y-6 min-h-full">
```

- [ ] **Step 2: Reduce image banner height (line 105)**

```diff
- <div className="w-full h-48 relative rounded-lg overflow-hidden shadow-lg">
+ <div className="w-full h-32 sm:h-48 relative rounded-lg overflow-hidden shadow-lg">
```

- [ ] **Step 3: Reduce intro text card padding (line 117)**

```diff
- <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-6 shadow-lg">
+ <div className="bg-white bg-opacity-95 backdrop-blur-sm rounded-lg p-4 sm:p-6 shadow-lg">
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/layouts/L6WizardLayout.tsx
git commit -m "fix: tighten L6 wizard spacing on mobile (space-y-3, h-32, p-4)"
```

---

## Task 7 — L7 SingleLayout (2 changes)

**Files:** `packages/ui/src/layouts/L7SingleLayout.tsx`

Same `bg-opacity-98 shadow-inner inset-0` white paper pattern as L4/L5.

- [ ] **Step 1: Fix outer container padding (line 105)**

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Fix white paper internal padding (line 116)**

```diff
- className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-8 overflow-y-auto shadow-inner inset-0"
+ className="absolute bg-white bg-opacity-98 backdrop-blur-sm flex flex-col p-4 sm:p-8 overflow-y-auto shadow-inner inset-0"
```

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/layouts/L7SingleLayout.tsx
git commit -m "fix: tighten L7 intro padding on mobile (px-2 py-2, p-4 sm:p-8)"
```

---

## Task 8 — L8 ImageLayout (outer padding only)

**Files:** `packages/ui/src/layouts/L8ImageLayout.tsx`

L8's intro is a pure full-bleed image — no white paper overlay. Only the outer gap around the image frame needs tightening.

- [ ] **Step 1: Fix outer container padding (line 71)**

```diff
- <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
+ <div className="h-full flex items-center justify-center relative z-10 px-2 py-2 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 2: Commit**

```bash
git add packages/ui/src/layouts/L8ImageLayout.tsx
git commit -m "fix: tighten L8 intro outer padding on mobile (px-2 py-2)"
```

---

## Task 9 — PageRenderer internal gaps (3 changes)

**Files:** `packages/ui/src/renderers/PageRenderer.tsx`

These three changes affect the fields section of ALL layouts. The `mb-8` on line 245 (validation error summary) is intentional contextual spacing — do NOT change it.

- [ ] **Step 1: Fix progress bar bottom gap (line 214)**

```diff
- <div className="flex items-center gap-3 mb-8">
+ <div className="flex items-center gap-3 mb-4 sm:mb-8">
```

- [ ] **Step 2: Fix page title bottom gap (line 232)**

```diff
- <div className="mb-8">
+ <div className="mb-4 sm:mb-8">
```

- [ ] **Step 3: Fix sticky footer top gap (line 288)**

```diff
- <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 mt-10 z-10">
+ <div className="sticky bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800 mt-4 sm:mt-10 z-10">
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/renderers/PageRenderer.tsx
git commit -m "fix: tighten PageRenderer mobile spacing (mb-4 sm:mb-8, mt-4 sm:mt-10)"
```

---

## Task 10 — Final verification

- [ ] **Step 1: Full type-check**

```bash
pnpm type-check
```

Expected: zero errors.

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: all packages build successfully.

- [ ] **Step 3: Visual check — form-builder mobile preview**

```bash
pnpm form-app:dev
```

Open the form builder, pick any layout (try L1, L6, L9), open the Preview tab, switch to mobile toggle. Verify:
- Intro screen: content fills the phone with a small gap around the image frame, CTA button visible
- Fields screen: at least 2 fields visible above the fold, progress bar and title are compact

- [ ] **Step 4: Visual check — real mobile breakpoint**

Resize browser to 390 px width (or use DevTools device emulation → iPhone 14). Open a form at `/f/:shortUrl`. Verify same improvements as step 3.

- [ ] **Step 5: Desktop regression check**

Resize browser back to ≥1280 px. Verify all layouts look identical to before — `sm:` values restore full desktop spacing.
