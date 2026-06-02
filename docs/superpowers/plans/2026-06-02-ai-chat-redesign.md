# AI Chat Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing 380px AI chat side panel with Framer Motion animations — smooth panel entry, staggered message bubbles, streaming cursor, send/cancel swap, chip stagger, animated token meter, and refined visual details (bubble corners, avatar, header icon).

**Architecture:** Add a single shared `aiChatMotion.ts` file exporting all Framer Motion variants and transitions, then consume them in `AIEditDrawer.tsx`, `AITokenMeter.tsx`, and the five tool-parts components. No structural changes to hooks, store, or backend.

**Tech Stack:** React 18, Framer Motion v11, Tailwind CSS v3, existing dculus-forms design tokens

---

## File Map

| File | Action |
|---|---|
| `apps/form-app/package.json` | install `framer-motion` |
| `apps/form-app/tailwind.config.js` | add `cursor-blink` keyframe + animation |
| `apps/form-app/src/locales/en/aiEditDrawer.json` | add `emptyTitle` key |
| `apps/form-app/src/locales/ta/aiEditDrawer.json` | add `emptyTitle` key |
| `apps/form-app/src/components/form-builder/aiChatMotion.ts` | **create** — shared variants + transitions |
| `apps/form-app/src/components/form-builder/AIEditDrawer.tsx` | panel entry, bubble motion, cursor, chips, empty state, send/cancel swap, visual refinements |
| `apps/form-app/src/components/form-builder/AITokenMeter.tsx` | animated fill bar |
| `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx` | wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/DestructiveActionCard.tsx` | wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx` | wrap root in motion.div |
| `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx` | wrap spans in motion.span |
| `apps/form-app/src/components/form-builder/tool-parts/GetFieldToolPart.tsx` | wrap spans in motion.span |
| `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx` | wrap spans in motion.span |

---

## Task 1: Install Framer Motion + create shared motion variants

**Files:**
- Modify: `apps/form-app/package.json` (via pnpm)
- Create: `apps/form-app/src/components/form-builder/aiChatMotion.ts`

- [ ] **Step 1: Install the package**

```bash
cd /path/to/dculus-forms
pnpm --filter form-app add framer-motion
```

Expected: pnpm resolves and installs, no peer-dependency warnings.

- [ ] **Step 2: Create the shared motion variants file**

Create `apps/form-app/src/components/form-builder/aiChatMotion.ts` with this exact content:

```ts
import type { Variants, Transition } from 'framer-motion';

/** Shared ease-out transition for message bubbles, chips, and tool cards. */
export const easeOut: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Panel slide-in/out — used on the AnimatePresence wrapper in AIEditDrawer. */
export const panelTransition: Transition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

export const panelVariants: Variants = {
  hidden:  { x: 18, opacity: 0 },
  visible: { x: 0,  opacity: 1 },
  exit:    { x: 18, opacity: 0 },
};

/** Fade + slide-up for new message bubbles and tool-part cards. */
export const msgVariants: Variants = {
  hidden:  { y: 6, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/** Stagger container for the chips row. */
export const chipsContainerVariants: Variants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

/** Individual chip entry — used as children of chipsContainerVariants. */
export const chipVariants: Variants = {
  hidden:  { y: 4, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/** Send ↔ Cancel button AnimatePresence swap. */
export const buttonSwapVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 0.8 },
};

export const buttonSwapTransition: Transition = {
  duration: 0.15,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Token meter fill — animates width on mount. */
export const tokenMeterTransition: Transition = {
  duration: 0.5,
  ease: [0.25, 0.1, 0.25, 1],
  delay: 0.1,
};
```

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors. If framer-motion types are missing run `pnpm --filter form-app add -D @types/framer-motion` (usually not needed — framer-motion v11 ships its own types).

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/package.json pnpm-lock.yaml apps/form-app/src/components/form-builder/aiChatMotion.ts
git commit -m "feat(ai-chat): install framer-motion + add shared motion variants"
```

---

## Task 2: Add cursor-blink animation + translation keys

**Files:**
- Modify: `apps/form-app/tailwind.config.js`
- Modify: `apps/form-app/src/locales/en/aiEditDrawer.json`
- Modify: `apps/form-app/src/locales/ta/aiEditDrawer.json`

- [ ] **Step 1: Add cursor-blink to Tailwind keyframes**

In `apps/form-app/tailwind.config.js`, inside `theme.extend.keyframes`, add after the `accordion-up` entry:

```js
"cursor-blink": {
  "0%, 100%": { opacity: "1" },
  "50%":       { opacity: "0" },
},
```

And inside `theme.extend.animation`, add after the `accordion-up` entry:

```js
"cursor-blink": "cursor-blink 0.85s step-end infinite",
```

After the change the `keyframes` and `animation` blocks look like:

```js
keyframes: {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
  },
  "cursor-blink": {
    "0%, 100%": { opacity: "1" },
    "50%":       { opacity: "0" },
  },
},
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up":   "accordion-up 0.2s ease-out",
  "cursor-blink":   "cursor-blink 0.85s step-end infinite",
},
```

- [ ] **Step 2: Add emptyTitle to English locale**

In `apps/form-app/src/locales/en/aiEditDrawer.json`, add `"emptyTitle"` directly after the `"emptyState"` line:

```json
"emptyState": "Ask AI to help you edit, improve, or rewrite any part of your form.",
"emptyTitle": "Ask the AI anything",
```

- [ ] **Step 3: Add emptyTitle to Tamil locale**

In `apps/form-app/src/locales/ta/aiEditDrawer.json`, add `"emptyTitle"` directly after the `"emptyState"` line:

```json
"emptyState": "படிவத்தை திருத்த, மேம்படுத்த அல்லது மாற்ற AI-இடம் கேளுங்கள்.",
"emptyTitle": "AI-இடம் எதையும் கேளுங்கள்",
```

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/tailwind.config.js \
        apps/form-app/src/locales/en/aiEditDrawer.json \
        apps/form-app/src/locales/ta/aiEditDrawer.json
git commit -m "feat(ai-chat): add cursor-blink animation + emptyTitle i18n keys"
```

---

## Task 3: AIEditDrawer — panel AnimatePresence + header visual refinements

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Add Framer Motion imports to AIEditDrawer.tsx**

At the top of the file, after the existing imports, add:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
  panelVariants,
  panelTransition,
} from './aiChatMotion';
```

- [ ] **Step 2: Replace panel entry — remove early return, add AnimatePresence**

Remove the line:
```tsx
if (!isOpen) return null;
```

Move the two computed values that were after it to just before the `return` (they should already be there if removing the early return leaves them in place). The variables `typedMessages`, `lastMsg`, and `showStatusIndicator` should all be declared before the return statement.

Replace the `return (` block's outermost element so the full return becomes:

```tsx
return (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        key="ai-drawer"
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
        className="flex h-full w-[380px] shrink-0 flex-col border-l border-border bg-background"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          {/* --- icon: change from rounded-full bg-primary/10 to rounded-[7px] border border-border bg-muted --- */}
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] border border-border bg-muted">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="flex-1 text-sm font-semibold">{t('title')}</span>

          {canUndo && (
            <button
              onClick={undo}
              title={t('undoTitle')}
              className="flex h-7 items-center gap-1 rounded-md border border-border bg-muted px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" />
              {t('undo')}
            </button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 max-w-[140px] gap-1 border border-border bg-muted px-2 text-xs hover:bg-accent"
              >
                <span className="truncate">
                  {activeConversation?.title ?? t('newChat')}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                className="gap-2 text-xs"
                onClick={() => createConversation()}
              >
                <Plus className="h-3.5 w-3.5" />
                {t('newChat')}
              </DropdownMenuItem>
              {conversations.length > 0 && <DropdownMenuSeparator />}
              {conversations.map((conv: { id: string; title: string }) => (
                <DropdownMenuItem
                  key={conv.id}
                  className={cn(
                    'group text-xs',
                    conv.id === activeConversationId && 'bg-accent'
                  )}
                  onClick={() => selectConversation(conv.id)}
                >
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    className="ml-2 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={onClose}
            aria-label={t('closeAriaLabel')}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages — keep existing content unchanged for now */}
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {/* ... existing message rendering unchanged ... */}
        </div>

        <AITokenMeter organizationId={organizationId} />

        {/* Input — keep existing content unchanged for now */}
        <div className="border-t border-border p-3">
          {/* ... existing input unchanged ... */}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
```

> Note: The messages and input sections remain exactly as they were — you are only changing the outer wrapper and the header. Tasks 4 and 5 will update the inner content.

- [ ] **Step 3: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-chat): AnimatePresence panel entry + header visual refinements"
```

---

## Task 4: Message bubbles — motion + visual corner refinements + avatar

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Update UserBubble function**

Replace the entire `UserBubble` function (lines ~33–41) with:

```tsx
function UserBubble({ message }: { message: FormEditAgentUIMessage }) {
  const textPart = message.parts.find((p) => p.type === 'text') as { type: 'text'; text: string } | undefined;
  return (
    <motion.div
      className="flex justify-end"
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
    >
      <div className="max-w-[80%] rounded-tl-[14px] rounded-tr-[3px] rounded-br-[14px] rounded-bl-[14px] bg-primary px-3 py-2 text-sm text-primary-foreground">
        {textPart?.text ?? (message as any).content}
      </div>
    </motion.div>
  );
}
```

Add to the imports at the top of `AIEditDrawer.tsx`:

```tsx
import { easeOut, msgVariants } from './aiChatMotion';
```

(Add these alongside the `panelVariants` import added in Task 3.)

- [ ] **Step 2: Update TextBubble — refined corners + new streaming cursor**

Replace the entire `TextBubble` function (lines ~44–66) with:

```tsx
function TextBubble({ text, isStreaming }: { text: string; isStreaming?: boolean }) {
  if (!text) return null;
  return (
    <div className="rounded-tl-[3px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[14px] bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 my-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 my-1">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: ({ children }) => <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-[13px] w-[1.5px] align-middle bg-foreground/50 animate-cursor-blink" />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Update AssistantMessage — motion wrapper + refined avatar**

Replace the outer `<div className="flex justify-start">` wrapper and the avatar `<div>` inside `AssistantMessage`:

The function's return currently starts with:
```tsx
return (
  <div className="flex justify-start">
    <div className="flex max-w-[90%] items-start gap-2">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-3 w-3 text-primary" />
      </div>
```

Replace with:
```tsx
return (
  <motion.div
    className="flex justify-start"
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
  >
    <div className="flex max-w-[90%] items-start gap-2">
      <div className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted">
        <Sparkles className="h-3 w-3 text-muted-foreground" />
      </div>
```

Close the `motion.div` instead of the old `div` at the end of the function return.

- [ ] **Step 4: Update StatusIndicator — Framer Motion typing dots**

Add import at top of file:

```tsx
import { motion as framerMotion } from 'framer-motion';
```

> Note: alias as `framerMotion` to avoid collision with the `motion` already imported from framer-motion (they are the same — just use `motion` if you already have it imported).

Replace the three-dot spinner in `StatusIndicator` (inside the else branch of `text ? ... : ...`):

Current:
```tsx
<div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5">
  {[0, 1, 2].map((i) => (
    <span
      key={i}
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"
      style={{ animationDelay: `${i * 150}ms` }}
    />
  ))}
</div>
```

Replace with:
```tsx
<div className="flex gap-1 rounded-tl-[3px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[14px] bg-muted px-3 py-2.5">
  {[0, 1, 2].map((i) => (
    <motion.span
      key={i}
      className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
    />
  ))}
</div>
```

Also update the text bubble in StatusIndicator to use the refined corners:

```tsx
<div className="rounded-tl-[3px] rounded-tr-[14px] rounded-br-[14px] rounded-bl-[14px] bg-muted px-3 py-2 text-xs italic text-muted-foreground">
  {text}
</div>
```

- [ ] **Step 5: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-chat): animated message bubbles + cursor + refined corners + avatar"
```

---

## Task 5: Send/Cancel AnimatePresence swap + staggered chips + empty state

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AIEditDrawer.tsx`

- [ ] **Step 1: Add remaining motion imports**

Ensure these are all imported at the top of `AIEditDrawer.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
  easeOut,
  msgVariants,
  panelVariants,
  panelTransition,
  chipsContainerVariants,
  chipVariants,
  buttonSwapVariants,
  buttonSwapTransition,
} from './aiChatMotion';
```

- [ ] **Step 2: Replace Send/Cancel buttons with AnimatePresence swap**

Find the input section at the bottom of the component. Replace the two buttons with:

```tsx
<AnimatePresence mode="wait" initial={false}>
  {isStreaming ? (
    <motion.button
      key="cancel-btn"
      variants={buttonSwapVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={buttonSwapTransition}
      onClick={cancel}
      aria-label={t('cancel')}
      className="mb-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
    >
      <X className="h-3.5 w-3.5" />
    </motion.button>
  ) : (
    <motion.button
      key="send-btn"
      variants={buttonSwapVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={buttonSwapTransition}
      onClick={handleSend}
      disabled={!input.trim() || !activeConversationId}
      aria-label={t('send')}
      className={cn(
        'mb-0.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px]',
        'bg-primary text-primary-foreground',
        'transition-colors hover:bg-primary/90',
        'disabled:cursor-not-allowed disabled:opacity-40'
      )}
    >
      <Send className="h-3.5 w-3.5" />
    </motion.button>
  )}
</AnimatePresence>
```

- [ ] **Step 3: Replace chips with staggered motion chips**

Find the chips section:
```tsx
{!isStreaming && activeConversationId && chips.length > 0 && (
  <div className="mb-2 flex flex-wrap gap-1.5">
    {chips.map((chip) => (
      <button
        key={chip.key}
        onClick={...}
        className={cn(...)}
      >
        ...
      </button>
    ))}
  </div>
)}
```

Replace with:
```tsx
{!isStreaming && activeConversationId && chips.length > 0 && (
  <motion.div
    className="mb-2 flex flex-wrap gap-1.5"
    variants={chipsContainerVariants}
    initial="hidden"
    animate="visible"
  >
    {chips.map((chip) => (
      <motion.button
        key={chip.key}
        variants={chipVariants}
        transition={easeOut}
        onClick={() => {
          if (chip.key === 'remixForm') {
            setInput(chip.prompt);
          } else {
            sendMessage(chip.prompt);
          }
        }}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground',
          'transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground',
          'disabled:cursor-not-allowed disabled:opacity-40'
        )}
      >
        {['analyseForm', 'generateFields', 'suggestValidation', 'remixForm'].includes(chip.key) && (
          <Sparkles className="h-3 w-3" />
        )}
        {chip.label}
      </motion.button>
    ))}
  </motion.div>
)}
```

- [ ] **Step 4: Replace empty state with enriched animated version**

Find the empty state:
```tsx
{typedMessages.length === 0 && !isStreaming && !conversationsLoading && !activeConvLoading && (
  <p className="px-4 pt-8 text-center text-xs text-muted-foreground">
    {t('emptyState')}
  </p>
)}
```

Replace with:
```tsx
{typedMessages.length === 0 && !isStreaming && !conversationsLoading && !activeConvLoading && (
  <motion.div
    className="flex flex-col items-center gap-3 px-4 pt-8 text-center"
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted">
      <Sparkles className="h-5 w-5 text-muted-foreground" />
    </div>
    <div>
      <p className="text-sm font-semibold text-foreground">{t('emptyTitle')}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t('emptyState')}</p>
    </div>
  </motion.div>
)}
```

- [ ] **Step 5: Type-check**

```bash
pnpm type-check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/form-app/src/components/form-builder/AIEditDrawer.tsx
git commit -m "feat(ai-chat): send/cancel swap, staggered chips, enriched empty state"
```

---

## Task 6: Animated token meter fill

**Files:**
- Modify: `apps/form-app/src/components/form-builder/AITokenMeter.tsx`

- [ ] **Step 1: Add Framer Motion import**

At the top of `AITokenMeter.tsx`, add:

```tsx
import { motion } from 'framer-motion';
import { tokenMeterTransition } from './aiChatMotion';
```

- [ ] **Step 2: Replace static fill bar with animated motion.div**

Find:
```tsx
<div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
  <div
    className={cn('h-full rounded-full transition-all duration-500', barColor)}
    style={{ width: `${pct}%` }}
  />
</div>
```

Replace with:
```tsx
<div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
  <motion.div
    className={cn('h-full rounded-full', barColor)}
    initial={{ width: '0%' }}
    animate={{ width: `${pct}%` }}
    transition={tokenMeterTransition}
  />
</div>
```

- [ ] **Step 3: Type-check + commit**

```bash
pnpm type-check
git add apps/form-app/src/components/form-builder/AITokenMeter.tsx
git commit -m "feat(ai-chat): animate token meter fill bar on mount"
```

---

## Task 7: Animate tool-parts cards and pills

**Files:**
- Modify: `apps/form-app/src/components/form-builder/tool-parts/ChangeSummaryCard.tsx`
- Modify: `apps/form-app/src/components/form-builder/tool-parts/DestructiveActionCard.tsx`
- Modify: `apps/form-app/src/components/form-builder/tool-parts/ValidationSuggestionCard.tsx`
- Modify: `apps/form-app/src/components/form-builder/tool-parts/MutationToolPart.tsx`
- Modify: `apps/form-app/src/components/form-builder/tool-parts/ListFieldsToolPart.tsx`

- [ ] **Step 1: ChangeSummaryCard — wrap root in motion.div**

Add imports at top of `ChangeSummaryCard.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

Replace the root element of the return (currently `<div className="mt-1.5 rounded-lg border ...">`) with:
```tsx
return (
  <motion.div
    className="mt-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
  >
    {/* ... all existing inner content unchanged ... */}
  </motion.div>
);
```

- [ ] **Step 2: DestructiveActionCard — wrap root in motion.div**

Add imports at top of `DestructiveActionCard.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

Replace the root element (currently `<div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">`) with:
```tsx
return (
  <motion.div
    className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm"
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
  >
    {/* ... all existing inner content unchanged ... */}
  </motion.div>
);
```

- [ ] **Step 3: ValidationSuggestionCard — wrap root in motion.div**

Add imports at top of `ValidationSuggestionCard.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

Replace the root element (currently `<div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">`) with:
```tsx
return (
  <motion.div
    className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm"
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
  >
    {/* ... all existing inner content unchanged ... */}
  </motion.div>
);
```

- [ ] **Step 4: MutationToolPart — wrap spans in motion.span**

Add imports at top of `MutationToolPart.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

The component has three `return` branches, each returning a `<span>`. Replace all three with `<motion.span>`:

```tsx
// input-streaming branch
if (state === 'input-streaming') {
  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
      {part.type.slice(5)}
    </motion.span>
  );
}

// input-available branch
if (state === 'input-available') {
  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      {getActionLabel(part)}
    </motion.span>
  );
}

// output-available / default branch
return (
  <motion.span
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
    className={cn(
      'inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
    )}
  >
    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
    {getDoneLabel(part)}
  </motion.span>
);
```

- [ ] **Step 5: GetFieldToolPart — wrap spans in motion.span**

Add imports at top of `GetFieldToolPart.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

Replace both return branches:

```tsx
if (state === 'input-streaming' || state === 'input-available') {
  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Checking field details…
    </motion.span>
  );
}

return (
  <motion.span
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
  >
    Read field details
  </motion.span>
);
```

- [ ] **Step 6: ListFieldsToolPart — wrap spans in motion.span**

Add imports at top of `ListFieldsToolPart.tsx`:
```tsx
import { motion } from 'framer-motion';
import { msgVariants, easeOut } from '../aiChatMotion';
```

The component has two branches returning `<span>`. Replace both with `<motion.span>`:

```tsx
// loading branch
if (state === 'input-streaming' || state === 'input-available') {
  return (
    <motion.span
      variants={msgVariants}
      initial="hidden"
      animate="visible"
      transition={easeOut}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      Reading form structure…
    </motion.span>
  );
}

// done branch
return (
  <motion.span
    variants={msgVariants}
    initial="hidden"
    animate="visible"
    transition={easeOut}
    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground"
  >
    Scanned {pageCount} page{pageCount !== 1 ? 's' : ''}, {fieldCount} field{fieldCount !== 1 ? 's' : ''}
  </motion.span>
);
```

- [ ] **Step 7: Type-check all**

```bash
pnpm type-check
```

Expected: no errors across all modified files.

- [ ] **Step 8: Commit**

```bash
git add apps/form-app/src/components/form-builder/tool-parts/
git commit -m "feat(ai-chat): animate tool-part cards and status pills on entry"
```

---

## Task 8: Visual verify + lint + final commit

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Expected: no errors or warnings in the modified files.

- [ ] **Step 2: Start the dev server and open the builder**

```bash
pnpm form-app:dev
```

Open `http://localhost:3000`, open a form, and click the AI Assistant button to open the drawer.

- [ ] **Step 3: Verify panel entry animation**

Close and re-open the AI drawer. Expected: panel slides in from the right with a 250ms ease-out fade — not a hard pop.

- [ ] **Step 4: Verify message animations**

Send a message. Expected: user bubble appears with a 200ms fade+slide-up. AI response bubbles do the same. Streaming response shows a blinking `|` cursor inline.

- [ ] **Step 5: Verify typing dots**

While the AI is streaming with no text yet (StatusIndicator), confirm the three dots bounce smoothly rather than using CSS `animate-bounce`.

- [ ] **Step 6: Verify send/cancel swap**

While the AI is streaming, confirm the Send button has been replaced by a red Cancel button with a smooth 150ms crossfade. After streaming completes, confirm Send returns.

- [ ] **Step 7: Verify chips stagger**

Open a form with fields. AI chips should stagger in (50ms delay between each) each time the chip bar re-renders (e.g., after sending a message).

- [ ] **Step 8: Verify empty state**

Create a new conversation. Confirm the empty state now shows the icon + title + body and fades in, instead of a plain text paragraph.

- [ ] **Step 9: Verify token meter**

Open the AI drawer. The token meter fill bar should animate from 0% to the actual usage percentage over 500ms.

- [ ] **Step 10: Verify header visual refinements**

Confirm:
- Header icon is a square with border (not a circle with primary bg)
- Undo button has a border and muted background
- Conversation dropdown trigger has border and muted background
- User bubble has chat-style asymmetric corners (top-right is 3px)
- AI bubble has chat-style asymmetric corners (top-left is 3px)

- [ ] **Step 11: Final commit if any lingering tweaks**

```bash
git add -p  # review any remaining hunks
git commit -m "fix(ai-chat): visual tweaks after dev-server review"
```
