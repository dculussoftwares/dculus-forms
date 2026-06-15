# Preview Mobile/Desktop Toggle — Design

**Goal:** Add a mobile/desktop viewport toggle to the form builder's Preview tab so users can see how their form looks on phone vs desktop without leaving the builder.

**Approach:** Option A — toggle inside `PreviewTab.tsx` only. Local state, one file, zero store changes.

---

## Toggle Bar

- Positioned at the top of the PreviewTab, centered above the form preview
- Two icon buttons: `Monitor` (desktop) and `Smartphone` (mobile) from lucide-react
- Rendered as a pill-segmented control (rounded border, active button highlighted)
- Local `useState<'desktop' | 'mobile'>('desktop')` — defaults to desktop

## Desktop Mode

Unchanged from current behavior: `FormRenderer` fills `h-full` directly.

## Mobile Phone Frame

In mobile mode the FormRenderer is wrapped in a CSS phone shell:

- **Outer frame**: `w-[390px] rounded-[44px] border-[10px] border-gray-800 shadow-2xl overflow-hidden mx-auto`
- **Notch bar**: `w-20 h-5 bg-gray-800 rounded-b-2xl mx-auto` centered at top of screen area
- **Inner screen**: `overflow-y-auto bg-white` — scrollable white area, FormRenderer inside
- **Vertical centering**: outer panel uses `flex flex-col items-center justify-start overflow-y-auto py-8 bg-[var(--tf-faint)]`
- **Max height**: `max-h-[780px]` so the frame fits inside the builder panel

## File Changes

| File | Change |
|------|--------|
| `apps/form-app/src/components/form-builder/tabs/PreviewTab.tsx` | Add toggle state + toggle bar UI + conditional phone frame wrapper |

No store changes. No new component files. No i18n strings (icons only).
