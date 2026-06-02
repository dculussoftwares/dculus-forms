# AI Chat Panel Redesign — Design Spec

**Date:** 2026-06-02  
**Status:** Approved  
**Scope:** `apps/form-app/src/components/form-builder/` — AIEditDrawer, AITokenMeter, tool-parts, AIFormBar

---

## Decisions

| Decision | Choice |
|---|---|
| Layout | Polished Side Panel (380px, same structure) |
| Animation library | Framer Motion (`framer-motion`) |
| Animation personality | Subtle & Smooth (ease-out curves, no spring overshoot) |
| Header style | Clean White (refined current style) |

---

## Animation System

All motion uses a shared set of Framer Motion variants defined in a new file:
`apps/form-app/src/components/form-builder/aiChatMotion.ts`

```ts
// Panel slide-in (AnimatePresence wraps the whole drawer)
panelVariants: { hidden: { x: 18, opacity: 0 }, visible: { x: 0, opacity: 1 } }
transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }

// Message bubble entry
msgVariants: { hidden: { y: 6, opacity: 0 }, visible: { y: 0, opacity: 1 } }
transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }

// Chip stagger container
chipsContainer: staggerChildren: 0.05s, delayChildren: 0.05s
chipVariants: { hidden: { y: 4, opacity: 0 }, visible: { y: 0, opacity: 1 } }
transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }

// Token meter fill
Animate width from 0 → pct% on mount via Framer motion.div
transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }
```

---

## Component Changes

### `AIEditDrawer.tsx`

**Panel entry:** Wrap with `AnimatePresence` at the call-site in the parent. The drawer itself becomes a `motion.div` with `panelVariants`.

**Message list:** Each `UserBubble` and `AssistantMessage` wraps its outermost element in `motion.div` with `msgVariants`. Use `layoutId`-free approach (no shared layout needed). Add a `key` on the `motion.div` matching the message key so Framer re-animates on new messages only.

**Streaming cursor:** In `TextBubble`, when `isStreaming` is true render an inline `<span>` with class `animate-[blink_0.85s_step-end_infinite]` (Tailwind arbitrary animation) instead of the current `animate-pulse` block. The cursor is a 1.5px × 13px vertical bar.

**Typing dots:** Replace the current CSS `animate-bounce` dots in `StatusIndicator` with a Framer `motion.div` stagger — three `motion.span` elements each with `animate={{ y: [0, -4, 0] }}` repeating, staggered 150ms. Keeps the existing visual but is driven by Framer for consistency.

**Send ↔ Cancel swap:** Wrap both buttons in `AnimatePresence mode="wait"`. Each button is a `motion.button` with `initial={{ opacity:0, scale:0.8 }}` / `animate={{ opacity:1, scale:1 }}` / `exit={{ opacity:0, scale:0.8 }}`, duration 0.15s.

**Chips:** Wrap the chips container in `motion.div` with `variants={chipsContainer}` + `initial="hidden"` / `animate="visible"`. Each chip is a `motion.button` with `variants={chipVariants}`.

**Empty state:** Replace the plain `<p>` with a richer empty state: icon (Sparkles in a `border border-border rounded-lg bg-muted p-2` box) + title `text-sm font-semibold` + body `text-xs text-muted-foreground`. Animate in with `msgVariants`.

### `AITokenMeter.tsx`

Replace the static `<div style={{ width: \`${pct}%\` }}>` fill with a `motion.div` that animates from `width: "0%"` to `width: \`${pct}%\`` on mount. Transition: 0.5s ease-out, 0.1s delay.

### Tool parts (`tool-parts/*.tsx`)

Each tool part card (`ChangeSummaryCard`, `DestructiveActionCard`, `ValidationSuggestionCard`, `MutationToolPart`) wraps its root in `motion.div` with `msgVariants` so cards animate in identically to message bubbles.

### Visual refinements (no animation)

| Element | Current | New |
|---|---|---|
| AI avatar | `rounded-full` 6×6 | `rounded-[6px]` 22×22, `border border-border bg-muted` |
| Header icon | `rounded-full bg-primary/10` | `rounded-[7px] border border-border bg-muted` 26×26 |
| User bubble corners | `rounded-2xl rounded-tr-sm` | `rounded-[14px_14px_3px_14px]` |
| AI bubble corners | `rounded-2xl rounded-tl-sm` | `rounded-[3px_14px_14px_14px]` |
| Send button | `rounded-lg h-7 w-7` | `rounded-[7px] h-[26px] w-[26px]` |
| Input box focus | `ring-2 ring-primary/20` | `ring-2 ring-primary/10 border-primary/50 bg-background` |
| Undo button in header | plain text link | `border border-border bg-muted rounded-md px-2 py-1 text-xs` pill |
| Conversation dropdown trigger | plain ghost button | `border border-border bg-muted rounded-md px-2 py-1 text-xs` pill |

### `AIFormBar.tsx`

Minor: add `focus-within` ring animation consistent with drawer input box. No Framer Motion needed here.

---

## Install

```bash
pnpm --filter form-app add framer-motion
```

Framer Motion v11 — compatible with React 18, tree-shakeable, no peer conflicts with existing deps.

---

## File Plan

| File | Action |
|---|---|
| `apps/form-app/src/components/form-builder/aiChatMotion.ts` | **Create** — shared variants + transitions |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | **Edit** — AnimatePresence, motion.div on messages, cursor, dots, chips, empty state |
| `apps/form-app/src/components/form-builder/AITokenMeter.tsx` | **Edit** — animated fill bar |
| `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx` | **Edit** — wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/DestructiveActionCard.tsx` | **Edit** — wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx` | **Edit** — wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx` | **Edit** — wrap root in motion.div |
| `apps/form-app/src/components/form-builder/AIFormBar.tsx` | **Edit** — minor focus ring refinement |
| `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` (or parent) | **Edit** — wrap `<AIEditDrawer>` in `AnimatePresence` |

---

## Out of Scope

- No changes to the conversation switching logic or data model
- No changes to backend resolvers or hooks
- No changes to `AIFormBar` beyond minor focus ring
- No new features (new tool types, new GraphQL operations)
- No changes to the admin app, form-viewer, or backend
