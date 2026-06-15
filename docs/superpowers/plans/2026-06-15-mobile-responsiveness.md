# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all form-app and form-viewer pages comfortable on mobile screens (≥320px) without breaking any desktop layouts.

**Architecture:** Targeted Tailwind responsive class additions (Option A). The shadcn sidebar already handles mobile via a Sheet drawer — no sidebar changes needed. The form-viewer layout files all share the same pattern: an intro splash screen with a horizontal two-chunk split (breaks on mobile) and a pages-section card with `p-8` padding (too tight on mobile). Fixes apply Tailwind breakpoints inline, stacking horizontal splits vertically on mobile and tightening padding.

**Tech Stack:** Tailwind CSS responsive prefixes (`sm:`, `md:`), React, shadcn/ui. No backend changes. No new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `packages/ui/src/page-wrapper.tsx` | Body padding `p-6` → `p-4 sm:p-6`; breadcrumbs drop `flex-nowrap` |
| `apps/form-app/src/components/settings/SettingsNav.tsx` | Add mobile horizontal tab bar (hidden on `sm+`) alongside existing 220px sidebar (shown only on `sm+`) |
| `apps/form-app/src/pages/Settings.tsx` | Parent layout: `flex` → `flex flex-col sm:flex-row` |
| `apps/form-app/src/pages/FormAnalytics.tsx` | Toolbar row: `flex items-center justify-between` → `flex flex-col sm:flex-row sm:items-center sm:justify-between`; tab container gets `overflow-x-auto` |
| `apps/form-app/src/components/Dashboard.tsx` | Page-size selector: `hidden sm:flex`; search row wrap fix |
| `apps/form-app/src/pages/Responses.tsx` | `BulkActionBar`: `flex items-center gap-3` → `flex flex-wrap items-center gap-2` |
| `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` | Add `md:hidden` full-screen overlay with "best on desktop" message |
| `apps/form-viewer/src/pages/FormViewer.tsx` | Error states: `p-8` → `p-4 sm:p-8`; submission error banner: `m-4` → `mx-3 mt-3` |
| `apps/form-viewer/src/components/ThankYouDisplay.tsx` | `p-8` → `p-4 sm:p-8` |
| `packages/ui/src/renderers/PageRenderer.tsx` | Hide "press Enter ↵" hint on mobile; navigation footer padding tightened |
| `packages/ui/src/layouts/L1ClassicLayout.tsx` | Intro: stack chunks vertically on mobile; pages section: `p-8` → `p-3 sm:p-8` on outer, `p-8` → `p-4 sm:p-8` on inner card |
| `packages/ui/src/layouts/L2ModernLayout.tsx` | Same as L1 |
| `packages/ui/src/layouts/L3CardLayout.tsx` | Intro: remove decorative image chunk on mobile; pages section padding fix |
| `packages/ui/src/layouts/L4MinimalLayout.tsx` | Same as L1 |
| `packages/ui/src/layouts/L5SplitLayout.tsx` | Intro: hide image chunk on mobile (only show content); pages section padding fix |
| `packages/ui/src/layouts/L6WizardLayout.tsx` | Intro: inline padding → Tailwind responsive; pages section padding fix |
| `packages/ui/src/layouts/L7SingleLayout.tsx` | Same pattern as L1 |
| `packages/ui/src/layouts/L8ImageLayout.tsx` | Same pattern as L1 |
| `packages/ui/src/layouts/L9PagesLayout.tsx` | Pages section: `p-8` → `p-3 sm:p-8` outer, `p-8` → `p-4 sm:p-8` inner card |

---

## Task 1: PageWrapper — global body padding + breadcrumbs

**Files:**
- Modify: `packages/ui/src/page-wrapper.tsx`

- [ ] **Step 1: Tighten page body padding on mobile**

In `page-wrapper.tsx` line 112, change:
```tsx
// Before
<div className={`flex flex-1 flex-col gap-4 p-6 overflow-y-auto bg-background dark:bg-background ${className}`}>

// After
<div className={`flex flex-1 flex-col gap-4 p-4 sm:p-6 overflow-y-auto bg-background dark:bg-background ${className}`}>
```

- [ ] **Step 2: Allow breadcrumbs to wrap on narrow screens**

In `page-wrapper.tsx` line 47, change:
```tsx
// Before
<BreadcrumbList className="flex-nowrap">

// After
<BreadcrumbList>
```

- [ ] **Step 3: Commit**
```bash
git add packages/ui/src/page-wrapper.tsx
git commit -m "fix: tighten PageWrapper padding on mobile, allow breadcrumb wrap"
```

---

## Task 2: SettingsNav — mobile horizontal tab bar

**Files:**
- Modify: `apps/form-app/src/components/settings/SettingsNav.tsx`

- [ ] **Step 1: Add mobile horizontal tab bar alongside existing desktop sidebar**

Replace the entire contents of `SettingsNav.tsx` with:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';

const REDIRECT_MAP: Record<string, string> = {
  account: 'profile',
  team: 'members',
  subscription: 'billing',
};

export function SettingsNav() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('settings');

  const resolvedSection = section ? (REDIRECT_MAP[section] ?? section) : 'profile';

  const navItems = [
    { to: 'profile', label: t('nav.profile') },
    { to: 'members', label: t('nav.members') },
    { to: 'billing', label: t('nav.billing') },
  ];

  return (
    <>
      {/* Mobile: horizontal scrollable tab bar */}
      <nav className="sm:hidden flex overflow-x-auto border-b border-[rgba(81,76,84,0.08)] mb-4 -mx-4 px-4 shrink-0">
        {navItems.map(({ to, label }) => {
          const isActive = resolvedSection === to;
          return (
            <button
              key={to}
              onClick={() => navigate(`/settings/${to}`)}
              className={cn(
                'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium shrink-0 transition-colors',
                isActive
                  ? 'text-[#3c323e]'
                  : 'text-[#655d67] hover:text-[#4c414e]'
              )}
            >
              {label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3c323e] rounded-t-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden sm:block w-[220px] shrink-0 px-4 py-6">
        <p className="mb-1 px-3 text-sm font-medium text-[#3c323e]">
          {t('nav.sectionAccount')}
        </p>
        <NavItem to="profile" label={t('nav.profile')} resolvedSection={resolvedSection} navigate={navigate} />

        <div className="my-4 border-t border-[rgba(81,76,84,0.08)]" />

        <p className="mb-1 px-3 text-sm font-medium text-[#3c323e]">
          {t('nav.sectionOrganization')}
        </p>
        <NavItem to="members" label={t('nav.members')} resolvedSection={resolvedSection} navigate={navigate} />
        <NavItem to="billing" label={t('nav.billing')} resolvedSection={resolvedSection} navigate={navigate} />
      </nav>
    </>
  );
}

function NavItem({
  to,
  label,
  resolvedSection,
  navigate,
}: {
  to: string;
  label: string;
  resolvedSection: string;
  navigate: (path: string) => void;
}) {
  const isActive = resolvedSection === to;
  return (
    <button
      onClick={() => navigate(`/settings/${to}`)}
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors text-left',
        isActive
          ? 'bg-[rgba(87,84,91,0.06)] text-[#3c323e]'
          : 'text-[#655d67] hover:bg-[rgba(87,84,91,0.04)] hover:text-[#4c414e]'
      )}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Update Settings.tsx parent layout to stack on mobile**

In `apps/form-app/src/pages/Settings.tsx` line 40, change:
```tsx
// Before
<div className="flex min-h-0 flex-1 -mx-4 sm:-mx-6">
  <SettingsNav />
  <div className="flex-1 overflow-y-auto py-1 pr-4 sm:pr-6">

// After
<div className="flex flex-col sm:flex-row min-h-0 flex-1 -mx-4 sm:-mx-6">
  <SettingsNav />
  <div className="flex-1 overflow-y-auto py-1 px-4 sm:pr-6 sm:pl-0">
```

- [ ] **Step 3: Commit**
```bash
git add apps/form-app/src/components/settings/SettingsNav.tsx apps/form-app/src/pages/Settings.tsx
git commit -m "fix: SettingsNav mobile horizontal tab bar, stack layout on small screens"
```

---

## Task 3: FormAnalytics — toolbar wraps on mobile

**Files:**
- Modify: `apps/form-app/src/pages/FormAnalytics.tsx`

- [ ] **Step 1: Stack toolbar row on mobile**

In `FormAnalytics.tsx` around line 100, change:
```tsx
// Before
<div className="flex items-center justify-between gap-4">
  {/* Typeform underline tabs */}
  <div className="flex items-center" style={{ borderBottom: '1px solid var(--tf-border)' }}>

// After
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
  {/* Typeform underline tabs */}
  <div className="flex items-center overflow-x-auto" style={{ borderBottom: '1px solid var(--tf-border)' }}>
```

Also change the right-actions container around line 123:
```tsx
// Before
<div className="flex items-center gap-2">

// After
<div className="flex items-center gap-2 sm:shrink-0">
```

- [ ] **Step 2: Commit**
```bash
git add apps/form-app/src/pages/FormAnalytics.tsx
git commit -m "fix: FormAnalytics toolbar stacks on mobile"
```

---

## Task 4: Dashboard — page-size hide + search wrap

**Files:**
- Modify: `apps/form-app/src/components/Dashboard.tsx`

- [ ] **Step 1: Hide page-size selector on mobile, wrap search row**

In `Dashboard.tsx`, around line 209 find the search row:
```tsx
// Before
<div className="flex items-center gap-2 mb-4">
  <div className="relative flex-1 max-w-xs">

// After
<div className="flex flex-wrap items-center gap-2 mb-4">
  <div className="relative flex-1 min-w-[160px] max-w-xs">
```

Around line 272, hide the page-size selector on mobile:
```tsx
// Before
<div className="flex items-center gap-2 pb-1">
  <span className="text-xs text-muted-foreground">{t('pageSize.label')}</span>

// After
<div className="hidden sm:flex items-center gap-2 pb-1">
  <span className="text-xs text-muted-foreground">{t('pageSize.label')}</span>
```

- [ ] **Step 2: Commit**
```bash
git add apps/form-app/src/components/Dashboard.tsx
git commit -m "fix: Dashboard page-size hidden on mobile, search row wraps"
```

---

## Task 5: BulkActionBar — wraps on mobile

**Files:**
- Modify: `apps/form-app/src/pages/Responses.tsx`

- [ ] **Step 1: Make BulkActionBar wrap on narrow screens**

In `Responses.tsx` around line 55–62, change `BulkActionBar`:
```tsx
// Before
<div
  className="flex items-center gap-3 px-4 py-2 text-sm font-medium"
  style={{ background: '#f0f7ff', borderBottom: '1px solid rgb(189,221,249)' }}
>
  <span className="text-xs font-semibold" style={{ color: '#01487f' }}>
    {t('toolbar.bulkActions.selected', { values: { count: selectedCount } })}
  </span>
  <div className="flex items-center gap-1.5">

// After
<div
  className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium"
  style={{ background: '#f0f7ff', borderBottom: '1px solid rgb(189,221,249)' }}
>
  <span className="text-xs font-semibold shrink-0" style={{ color: '#01487f' }}>
    {t('toolbar.bulkActions.selected', { values: { count: selectedCount } })}
  </span>
  <div className="flex flex-wrap items-center gap-1.5">
```

- [ ] **Step 2: Commit**
```bash
git add apps/form-app/src/pages/Responses.tsx
git commit -m "fix: BulkActionBar action buttons wrap on mobile"
```

---

## Task 6: CollaborativeFormBuilder — desktop-only notice

**Files:**
- Modify: `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`

- [ ] **Step 1: Add mobile overlay before the main builder render**

In `CollaborativeFormBuilder.tsx`, find the outer return statement (around line 432 where `min-h-screen` is). Wrap the entire existing return with a fragment and add the mobile overlay as the first child:

```tsx
// Find the return statement that renders the builder (contains min-h-screen)
// and add this immediately INSIDE the outermost div, as first child:

{/* Mobile — show friendly notice instead of broken canvas */}
<div className="md:hidden fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-8 text-center">
  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-muted">
    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  </div>
  <h2 className="text-lg font-semibold text-primary mb-2">Best on a larger screen</h2>
  <p className="text-sm text-muted-foreground mb-6 max-w-xs">
    The form builder uses drag-and-drop and works best on a desktop or tablet.
  </p>
  <button
    onClick={() => navigate('/dashboard')}
    className="h-9 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
  >
    Go to Dashboard
  </button>
</div>
```

Note: `navigate` is already imported and used in `CollaborativeFormBuilder.tsx`. The overlay uses `fixed inset-0 z-50` so it covers the entire screen on mobile. On `md+` it has `md:hidden` so it disappears entirely — the builder renders normally.

- [ ] **Step 2: Commit**
```bash
git add apps/form-app/src/pages/CollaborativeFormBuilder.tsx
git commit -m "fix: show desktop-recommended notice in form builder on mobile"
```

---

## Task 7: FormViewer — error states + submission overlay

**Files:**
- Modify: `apps/form-viewer/src/pages/FormViewer.tsx`
- Modify: `apps/form-viewer/src/components/ThankYouDisplay.tsx`

- [ ] **Step 1: Fix error state padding in FormViewer**

In `FormViewer.tsx`, there are 5 error/info states that all use `<div className="text-center p-8">`. Change all of them to `p-4 sm:p-8`:

```tsx
// All occurrences of:
<div className="text-center p-8">
// Change to:
<div className="text-center p-4 sm:p-8">
```

There are exactly 5 instances (loading-error, not-found, form-not-ready, not-yet-open, submissions-closed). Use replace-all.

- [ ] **Step 2: Fix ThankYouDisplay padding**

In `ThankYouDisplay.tsx` line 18:
```tsx
// Before
<div className="text-center p-8 max-w-2xl mx-auto" data-testid="thank-you-display">

// After
<div className="text-center p-4 sm:p-8 max-w-2xl mx-auto" data-testid="thank-you-display">
```

Line 50:
```tsx
// Before
<div className="text-center p-8 max-w-md mx-auto" data-testid="thank-you-display">

// After
<div className="text-center p-4 sm:p-8 max-w-md mx-auto" data-testid="thank-you-display">
```

- [ ] **Step 3: Commit**
```bash
git add apps/form-viewer/src/pages/FormViewer.tsx apps/form-viewer/src/components/ThankYouDisplay.tsx
git commit -m "fix: form-viewer error states and thank-you screen padding on mobile"
```

---

## Task 8: PageRenderer — mobile navigation improvements

**Files:**
- Modify: `packages/ui/src/renderers/PageRenderer.tsx`

- [ ] **Step 1: Hide "press Enter" keyboard hint on mobile**

In `PageRenderer.tsx` around line 331:
```tsx
// Before
<span className="text-xs text-gray-400 mr-1">press Enter ↵</span>

// After
<span className="hidden sm:inline text-xs text-gray-400 mr-1">press Enter ↵</span>
```

- [ ] **Step 2: Tighten navigation footer on mobile**

Around line 288–290, the navigation footer uses `max-w-4xl mx-auto px-4 py-4`. That's already fine. The button `px-8 py-3.5` pill is large enough for touch. No change needed here.

- [ ] **Step 3: Commit**
```bash
git add packages/ui/src/renderers/PageRenderer.tsx
git commit -m "fix: hide keyboard Enter hint on mobile in PageRenderer"
```

---

## Task 9: Layout files — pages section padding (L1–L9)

All layouts that have a pages-section form fill area use this identical pattern:
```tsx
// Outer wrapper
<div className="h-full relative z-10 p-8 overflow-y-auto">
  // Inner card
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
```

Fix both `p-8` values to be responsive.

**Files:**
- Modify: `packages/ui/src/layouts/L1ClassicLayout.tsx`
- Modify: `packages/ui/src/layouts/L2ModernLayout.tsx`
- Modify: `packages/ui/src/layouts/L3CardLayout.tsx`
- Modify: `packages/ui/src/layouts/L4MinimalLayout.tsx`
- Modify: `packages/ui/src/layouts/L5SplitLayout.tsx`
- Modify: `packages/ui/src/layouts/L6WizardLayout.tsx`
- Modify: `packages/ui/src/layouts/L7SingleLayout.tsx`
- Modify: `packages/ui/src/layouts/L8ImageLayout.tsx`
- Modify: `packages/ui/src/layouts/L9PagesLayout.tsx`

- [ ] **Step 1: Fix L9PagesLayout (simplest — pages only)**

In `L9PagesLayout.tsx` line 70–71:
```tsx
// Before
<div className="h-full relative z-10 p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">

// After
<div className="h-full relative z-10 p-3 sm:p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
```

- [ ] **Step 2: Fix L6WizardLayout pages section**

In `L6WizardLayout.tsx` — find the pages section (the `showPages` branch or the wizard content area). Change `p-8` → `p-3 sm:p-8` on the outer wrapper and `p-8` → `p-4 sm:p-8` on the inner card.

Also fix the wizard intro section `style={{ padding: '5% 10%' }}`:
```tsx
// Before
<div className="h-full relative z-10 overflow-y-auto" style={{ padding: '5% 10%' }}>

// After
<div className="h-full relative z-10 overflow-y-auto px-4 py-4 sm:px-[10%] sm:py-[5%]">
```

- [ ] **Step 3: Fix L1, L2, L4, L7, L8 — pages section + intro screen**

These five layouts share the same structure. In each file:

**Pages section** (inside the `showPages` branch):
```tsx
// Before
<div className="h-full relative z-10 p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">

// After
<div className="h-full relative z-10 p-3 sm:p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
```

**Intro screen — two-chunk container** (the horizontal split):
```tsx
// Before
<div className="relative z-10 h-full flex">
  {/* First chunk - background image display area */}
  <div className="flex-1 flex items-center justify-center">
  ...
  {/* Second chunk - white paper content */}
  <div className="flex-1 relative">

// After
<div className="relative z-10 h-full flex flex-col sm:flex-row">
  {/* First chunk - decorative background, hidden on mobile */}
  <div className="hidden sm:flex flex-1 items-center justify-center">
  ...
  {/* Second chunk - white paper content, full width on mobile */}
  <div className="w-full sm:flex-1 relative">
```

Apply to: `L1ClassicLayout.tsx`, `L2ModernLayout.tsx`, `L4MinimalLayout.tsx`, `L7SingleLayout.tsx`, `L8ImageLayout.tsx`

- [ ] **Step 4: Fix L5SplitLayout — pages section + intro screen (intentional split)**

L5 has content on left, image on right. On mobile: hide image, show content full-width.

**Pages section** (same fix as above):
```tsx
// Before
<div className="h-full relative z-10 p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">

// After
<div className="h-full relative z-10 p-3 sm:p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
```

**Intro screen — split container** (line ~113):
```tsx
// Before
<div className="relative z-10 h-full flex">
  {/* First chunk - WHITE PAPER CHUNK - Content area (50%) */}
  <div className="flex-1 relative">
  ...
  {/* Second chunk - IMAGE CHUNK - Background image display area (50%) */}
  <div className="flex-1 flex items-center justify-center relative">

// After
<div className="relative z-10 h-full flex flex-col sm:flex-row">
  {/* First chunk - Content, full width on mobile */}
  <div className="w-full sm:flex-1 relative">
  ...
  {/* Second chunk - Image, hidden on mobile */}
  <div className="hidden sm:flex flex-1 items-center justify-center relative">
```

- [ ] **Step 5: Fix L3CardLayout — pages section + intro screen (card centered)**

L3 has a centered card in the middle of the screen. The two-chunk layout is decorative background vs card.

**Pages section** (same fix):
```tsx
// Before
<div className="h-full relative z-10 p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">

// After
<div className="h-full relative z-10 p-3 sm:p-8 overflow-y-auto">
  <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
```

**Intro screen** — L3 has a card inside the two-chunk area. Check exact structure in `L3CardLayout.tsx` and find the card `max-w-md w-full` container. Add `mx-3 sm:mx-0` to give it breathing room on mobile and ensure the outer padding is responsive:
```tsx
// Find the outer padding div and change inline style to Tailwind:
// Before: style={{ padding: '5% 10%' }} 
// After: className="... px-3 py-3 sm:px-[10%] sm:py-[5%]"
```

- [ ] **Step 6: Commit all layout changes**
```bash
git add packages/ui/src/layouts/
git commit -m "fix: all form layouts responsive on mobile — stack intro splits, tighten pages-section padding"
```

---

## Task 10: Verification

- [ ] **Step 1: Type check**
```bash
pnpm type-check
```
Expected: no new errors.

- [ ] **Step 2: Lint**
```bash
pnpm lint
```
Expected: no new errors.

- [ ] **Step 3: Build**
```bash
pnpm build
```
Expected: all packages build successfully.

- [ ] **Step 4: Manual mobile check (Chrome DevTools)**

Open each app in Chrome DevTools at 375px width (iPhone SE) and verify:
- `form-app` `/dashboard` — sidebar opens as sheet, forms grid is 1 column, page-size hidden
- `form-app` `/settings/profile` — horizontal tab bar visible, content fills full width
- `form-app` `/dashboard/form/:id/analytics` — tabs + time range stack vertically
- `form-app` `/dashboard/form/:id/responses` — bulk action bar wraps
- `form-app` `/dashboard/form/:id` (builder) — desktop notice shown, "Go to Dashboard" works
- `form-viewer` `/f/:shortUrl` — form fills screen, navigation buttons are touch-friendly, no horizontal scroll
- `form-viewer` `/f/invalid` — error state has comfortable padding
- All layout intro screens (L1–L8) — content panel is full-width, no horizontal overflow
