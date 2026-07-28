# Form Builder Redesign — Unified Content Workspace

> Status: **Proposal** · Author: UX deep-dive with Claude · Date: 2026-07-28
> Companion doc: [`form-builder-redesign-implementation.md`](./form-builder-redesign-implementation.md)

---

## 1. Why redesign — the business case

### 1.1 Problems with the current builder

The builder today has **5 sibling tabs** (`Design → Build → Logic | Preview · Settings`), and
Automations lives on a **completely separate route** outside the builder shell.

| Problem | Evidence in current UX | Cost |
|---|---|---|
| **Tab ping-pong** | Editing a form = Build (fields) → Design (look) → Preview (check) → Build … Each hop is a full context switch with different sidebars. | Slow iteration loop; the #1 activity (tweak → check) needs 2 navigations every cycle. |
| **Intro / Thank You are buried** | They only exist as a small 3-way toggle *inside* the Design tab. Users editing questions in Build never see them. | Low discoverability → forms ship with default welcome/thank-you screens → weaker respondent experience → lower completion rates. |
| **Design is global-only and separated from content** | Layout (L1–L9), background, CTA text live in Design, but the CTA belongs to the Intro screen and thank-you content belongs to the ending. | Users can't find "where do I change the start button text?" — it's a *screen* property presented as a *theme* property. |
| **Automations are orphaned** | `/dashboard/form/:id/automations` is a separate page tree with its own chrome. | Feature invisible from the builder → low adoption of a differentiating feature. |
| **Preview is a destination, not a glance** | Full tab switch, loses selection state. | Users check less often; errors caught later. |
| **AI is fragmented** | Build tab has the Cmd+K `AIEditDrawer`; Conditions has its own "describe with AI" input; automations AI is a separate surface again. | No unified "the assistant" — users can't build a habit around one entry point, and cross-domain asks ("add a question and alert me on low scores") are impossible. |

### 1.2 What Typeform gets right (reference: `screenshot/`)

Typeform's builder has exactly **three top-level modes** — `Content · Workflow · Connect` — and inside
Content, one **journey rail** on the left that lists everything the respondent will see, in order:
**Welcome screen → questions → Endings**. Key principles worth adopting:

1. **The left rail *is* the respondent journey.** One ordered list, one mental model. No separate "design vs build" split.
2. **Selection drives everything.** Click the Welcome screen → the canvas shows it AND the right panel becomes Welcome-screen settings (button text, time-to-complete, image/video). Click a question → question settings. Nothing is more than one click from its context.
3. **Design is a tool, not a place.** A "Design" button opens theme controls over the canvas; you keep seeing your content while restyling it.
4. **Preview is instant** — play button in the toolbar, overlay, no navigation.
5. **AI entry point is ambient** — "Chat to create" bar floats at the bottom of the canvas.

### 1.3 Target information architecture

```text
CURRENT                                    PROPOSED
───────────────────────────────            ───────────────────────────────
Design | Build | Logic | Preview | Settings    Content | Logic | Automations
  │        │      │        │         │            │        │         │
  │        │      │        │         └ Settings   │        │         └ embedded automations
  │        │      │        └ full-tab preview     │        └ condition rules (kept, + rail badges)
  │        │      └ condition rules               │
  │        └ fields/pages editor                  └ ONE workspace:
  └ layout/theme + intro/thankyou toggle              rail:   Intro · Pages · Thank You
                                                      canvas: WYSIWYG of selected screen
Automations = separate route                          right:  contextual settings
                                                      tools:  Design drawer · Preview overlay
                                                      header: Share · Publish · Settings (gear)
```

Naming note: the top-level tabs mirror Typeform's `Content / Workflow / Connect` but use our
domain words: **Content** (what respondents see), **Logic** (existing Conditions — "Logic" reads
better next to Content), **Automations** (what happens after submit). Settings and Preview stop
being top-level destinations.

---

## 2. The Content workspace — detailed design

The Content tab is a persistent **3-pane layout**: journey rail (left, ~236px — canonical width, matches the prototype) · canvas (center,
fluid) · contextual panel (right, 320px resizable — reuses today's resize handle).

### 2.1 Mode A — a Page is selected (default landing state)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← Customer Feedback ✎        Content · Logic · Automations        Share  Publish  ⚙ │
├───────────────┬──────────────────────────────────────────────────┬───────────────────┤
│ + Add content │  ┌─ canvas toolbar ────────────────────────────┐ │  PAGE 1 SETTINGS  │
│               │  │ 🎨 Design   💻/📱   ▶ Preview               │ │  ───────────────  │
│ INTRO         │  └─────────────────────────────────────────────┘ │  Title            │
│ ┌───────────┐ │                                                  │  [About you     ] │
│ │▛ Welcome  │ │   ┌────────────────────────────────────────┐    │                   │
│ └───────────┘ │   │  Page 1 · About you                    │    │  — or, with a     │
│               │   │                                        │    │  field selected → │
│ PAGES     ⊕  │   │  ┌──────────────────────────────────┐  │    │                   │
│ ┌───────────┐ │   │  │ 1 What is your full name?     ⠿ │  │    │  FIELD SETTINGS   │
│ │≡ Page 1   │ │   │  └──────────────────────────────────┘  │    │  (FieldSettingsV2)│
│ │ ├ 1 Name  │ │   │  ┌──────────────────────────────────┐  │    │  Label, required, │
│ │ ├ 2 Email │ │   │  │ 2 What is your email?    [sel] ⠿ │  │    │  validation,      │
│ │ └ 3 Phone │ │   │  └──────────────────────────────────┘  │    │  options…         │
│ ├───────────┤ │   │      + Add field (popover)             │    │                   │
│ │≡ Page 2   │ │   └────────────────────────────────────────┘    │  ⚡ Logic on this │
│ └───────────┘ │                                                  │  field → 2 rules  │
│               │                                                  │                   │
│ THANK YOU     │   ┌────────────────────────────────────────┐    │                   │
│ ┌───────────┐ │   │      ✨ Chat to create…            ➤  │    │                   │
│ │▟ Thanks!  │ │   └────────────────────────────────────────┘    │                   │
│ └───────────┘ │                                                  │                   │
└───────────────┴──────────────────────────────────────────────────┴───────────────────┘
```

- **Rail** — merges today's right-sidebar "Pages" tab with two fixed sections. Page cards expand
  to show their fields as numbered chips (type icon + truncated label, exactly like Typeform's
  question list). Drag to reorder pages, fields, and move fields across pages (all store actions
  already exist: `reorderPages`, `reorderFields`, `moveFieldBetweenPages`).
- **`+ Add content` → the Field Library** — one primary button (top of rail, Typeform-style).
  The old builder's best trait — *seeing every field type in a single shot* — is preserved and
  improved, not popover-ized away:
  - Opens a **mega-panel** (~560px wide, anchored beside the rail): a 3-column grid of **all**
    field types with icons, grouped Input / Choice / Content / Advanced — *more* visible at once
    than the old 288px single column, plus a **search box** with keyboard navigation
    (type "em" ↵ to add an Email field) and a "Recently used" row on top.
  - Tiles are **draggable onto the canvas** exactly like the old panel (same dnd-kit sources);
    clicking a tile appends to the selected page.
  - A **📌 pin control docks the library** as a persistent compact column between rail and
    canvas — the old always-visible palette, one click away for power users, remembered per
    user (`localStorage`). Unpinned (default) the canvas keeps the ~300px it gained.
  - Keyboard: `/` or `F` opens the library with search focused; Esc closes.

  This replaces the permanent 288px left field-types column for everyone who doesn't pin it,
  while pinners lose nothing relative to today.
- **Canvas** — the current `FormArea` (field cards, drop indicators, inline add). Unchanged
  interaction model; gains the toolbar.
- **Right panel** — contextual: page selected → page settings; field selected → `FieldSettingsV2`
  (auto-switch behavior already exists). New: a **Logic summary** row showing rules touching the
  selected field, deep-linking to the Logic tab. The JSON debug view moves behind a dev-only
  toggle in the ⚙ menu.

### 2.2 Mode B — Intro selected  ← the key UX upgrade

Clicking the **Welcome** card flips all three panes together:

```text
┌───────────────┬──────────────────────────────────────────────────┬───────────────────┐
│ + Add content │  🎨 Design   💻/📱   ▶ Preview                   │  WELCOME SCREEN   │
│               │                                                  │  ───────────────  │
│ INTRO         │   ┌────────────────────────────────────────┐    │  Layout           │
│ ┌───────────┐ │   │                                        │    │  ┌──┐┌──┐┌──┐    │
│ │▛ Welcome ●│ │   │        Customer Feedback               │    │  │L1││L2││L3│ …  │
│ └───────────┘ │   │   We'd love to hear what you think.    │    │  └──┘└──┘└──┘    │
│               │   │   (inline-editable rich text —         │    │  (L1–L9 thumbs)   │
│ PAGES     ⊕  │   │    FormRenderer BUILDER mode,           │    │                   │
│ ┌───────────┐ │   │    screenOverride='intro')             │    │  Button text      │
│ │≡ Page 1   │ │   │                                        │    │  [ Start ]  5/24  │
│ ├───────────┤ │   │          ┌─────────┐                   │    │                   │
│ │≡ Page 2   │ │   │          │  Start  │                   │    │  Background       │
│ └───────────┘ │   │          └─────────┘                   │    │  ○ Color  [#…]    │
│               │   │                                        │    │  ○ Image / Video  │
│ THANK YOU     │   └────────────────────────────────────────┘    │    [Upload]       │
│ ┌───────────┐ │                                                  │    [Pexels]       │
│ │▟ Thanks!  │ │                                                  │    [Pixabay]      │
│ └───────────┘ │                                                  │                   │
└───────────────┴──────────────────────────────────────────────────┴───────────────────┘
```

This is exactly what the user asked for: *"on intro click, field types should change with layout
options."* Since the left column is now a journey rail (not a field-types column), the morph
happens in the **right panel**: field settings are replaced by **screen settings** — layout
thumbnails, CTA button text (`customCTAButtonName`, today hidden in Design), and the background
controls (today's `LayoutSidebar` background section). The canvas renders the real intro screen
via the already-shipped `screenOverride='intro'`.

### 2.3 Mode C — Thank You selected

Same pattern: canvas renders `screenOverride='thankYou'` with the rich-text thank-you content
inline-editable; right panel shows **Ending settings**: thank-you content controls, and (future)
redirect URL, social share buttons, "create your own form" branding toggle — the panel gives these
a natural home that doesn't exist today. The rail section is named **Thank You** now but is built
as an "Endings" list (array of one) so conditional multiple endings can land later without another
redesign — Typeform's Endings section validates this direction.

### 2.4 Design drawer — theme as a tool, not a tab

The 🎨 **Design** button in the canvas toolbar opens a right-side drawer *over* the contextual
panel (or replaces it while open), containing the **global** look controls from today's Design
tab: L1–L9 layout thumbnails, theme/text color, spacing, page mode, global background. Screen-
specific things (CTA text, per-screen backgrounds if we add them) stay in the screen's contextual
panel. You restyle while watching your actual content re-render live — the tightest possible
feedback loop, and the Design *tab* disappears.

### 2.5 Preview overlay

▶ opens a **full-screen overlay** (Esc / ✕ to close) reusing `PreviewTab`'s renderer with its
desktop/mobile toggle and test-submission flow. No navigation, selection state preserved, always
one keystroke away (`Cmd+P`).

### 2.6 Settings

Form settings (title, short URL, submission limits, access control, respondent-email copy) are
administrative, not creative — they move to the **⚙ gear in the header**, opening a focused
settings overlay/route (`/builder/settings` still works as a deep link). This keeps the top nav
purely about the three creative modes.

### 2.7 Unified AI — one assistant, everywhere

Today the AI experience is fragmented: an `AIEditDrawer` on the Build tab (Cmd+K), a separate
"describe with AI" input inside Conditions, and automation agent prompts live in yet another
surface. Three entry points, three behaviors — no single "the AI" the user can trust.

The redesign makes AI **one ambient layer over the whole builder**:

```text
            ┌────────────────────────────────────────────┐
            │        ✨ Ask AI anything…             ➤   │   ← one pill, every tab
            └────────────────────────────────────────────┘
   Content tab:  "add a rating question after email"      → edits fields/pages
                 "make the welcome screen friendlier"     → edits intro content
   Logic tab:    "hide page 3 unless they pick 'Other'"   → drafts a pending rule
   Automations:  "send responses to a Google Sheet"       → scaffolds an automation
```

- **One entry point** — the bottom-center "✨ Ask AI" pill (Typeform's "Chat to create" position)
  plus `Cmd+K`, on **all three tabs**. Both open the same drawer with the same conversation.
- **Context-aware** — the drawer is seeded with builder context: active tab, selected screen
  (intro / page / thank-you), selected field. "Make this required" just works because the AI
  knows what *this* is.
- **One conversation, cross-domain tools** — content edits, condition-rule drafting
  (`upsertConditionRule` pending-suggestion flow already exists), and automation scaffolding are
  tools of the *same* assistant, so "add a satisfaction question and email me low scores"
  resolves in one thread instead of three UIs.
- **Suggestions render where they land** — AI-drafted conditions still appear as pending cards in
  Logic; AI-added fields highlight in the rail and canvas (existing drop-highlight animation).
  The AI never feels like a separate app writing to your form from outside.
- Existing deep links ("Fix with AI" from analytics, `?aiMessage=`) keep working — they open the
  same unified drawer.

---

## 3. Logic tab

Kept as a top-level tab (dculus conditions are cross-page rules, which fit a dedicated surface
better than Typeform's per-question branching), with three additions:

1. **Rail badges in Content** — a small ⚡ on rail field chips that have rules, so logic is
   visible where content is edited.
2. **Field → Logic deep link** — "Logic on this field" row in field settings (see Mode A) opens
   the Logic tab pre-filtered to that field's rules.
3. Existing circular-reference warning badge moves onto the new tab trigger unchanged.

---

## 4. Automations tab

The existing Automations pages (`Automations`, `AutomationBuilder`, `AutomationRuns`) are
**embedded into the builder shell** as the third tab, keeping the builder header (title, Share,
Publish, presence). List → canvas builder → runs become in-tab views. Old routes 301-redirect.
This turns an orphaned feature into a first-class step of form creation, mirroring Typeform's
"Connect" placement — the moment users finish content is exactly when "what happens with
responses?" is on their mind.

---

## 5. What this wins

| Metric to watch | Expected effect |
|---|---|
| Intro/Thank-You customization rate | ↑ sharply — screens are now first-class rail items instead of a hidden toggle |
| Time from edit → preview | ~0 (overlay) vs. 2 navigations today |
| Automation creation per form | ↑ — promoted into the builder journey |
| Canvas width on 13" laptops | +~300px (field-types column → popover) |
| Nav complexity | 5 tabs + external route → 3 tabs |
| AI usage breadth | ↑ — one assistant reachable from every tab, seeded with selection context, able to act across content + logic + automations in one thread |

## 6. Risks / constraints honored

- **Collaboration**: no data-model change — same Zustand ⇄ Y.js store; rail/canvas/panels are
  views over existing state. Presence and permission gating (`VIEWER` read-only) apply per pane
  exactly as today.
- **i18n**: every new string ships in `en` + `ta` namespaces (mandatory).
- **E2E**: existing `data-testid`s preserved where components are reused; redirects keep old
  `/builder/layout|page-builder|preview|settings` URLs working (see implementation doc).
- **No backend change** for phases 1–5; multiple endings (future) would need schema work.
