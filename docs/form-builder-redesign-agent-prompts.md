# Form Builder Redesign — Coding-Agent Prompts

One copy-paste prompt per ticket of Epic [#226](https://github.com/dculussoftwares/dculus-forms/issues/226) (Unified Content Workspace). Run them **in order** — each prompt assumes its dependency PRs are merged into `main`.

**Execution order**: #227 → #228 → #229 → #230 ∥ #231 · #232 and #233 any time after #227 (parallel-safe) → #234 last.
(∥ = can run in parallel.)

Every prompt already instructs the agent to: read the GitHub issue + epic, read the design docs (`docs/form-builder-redesign.md`, `docs/form-builder-redesign-implementation.md`) and open the prototype (`docs/prototypes/form-builder-redesign-prototype.html`), work on a feature branch, and open a PR. After each PR merges, tick the matching checkbox in epic #226. Recommended model: **Sonnet** (`/model sonnet`) — the design decisions are locked in the epic; tickets are execution-scoped.

**Shared requirements for every ticket** (in addition to what each prompt says):
- Before every commit: review `git status` and the staged `git diff`; stage only intended files and **stop immediately** if any `.env` file, key, token, password, or other credential appears — this repo is public.
- `pnpm test:unit` only runs the **backend** suite. Frontend tickets must also run the form-app suite: `pnpm --filter form-app test`. Treat every "Verify:" line below as including both.

**Worktree note** — if the session runs in a git worktree (default under `.claude/worktrees/`), run `./scripts/setup-worktree.sh` before anything else (see the "Git Worktrees" section of `CLAUDE.md`). It copies `.env` files + local Claude settings, installs deps, builds the `@dculus/*` packages, and generates the Prisma client. The dev/E2E login for manual browser verification is the `E2E_EMAIL`/`E2E_PASSWORD` fallback pair in `package.json`'s `test:e2e` script.

---

## 1 · Issue #227 — Shell: 3 tabs, redirects, Preview overlay, Settings gear

```text
Implement GitHub issue #227 of this repo (run: gh issue view 227 — follow it as the spec).
Context first: read the epic body (gh issue view 226) for locked decisions and cross-cutting
requirements, then docs/form-builder-redesign.md §1.3/§2.5/§2.6 and
docs/form-builder-redesign-implementation.md §1 (route map). Open
docs/prototypes/form-builder-redesign-prototype.html in a browser — match its app bar,
Preview overlay, and gear placement exactly.

Task: collapse the 5 builder tabs into Content | Logic | Automations:
- TabNavigation.tsx: BuilderTab = 'content'|'logic'|'automations'; move field-count badge to
  Content and circular-ref warning to Logic; delete the Preview/Settings tools cluster and
  unused top/bottom position modes.
- CollaborativeFormBuilder.tsx: new VALID_TABS/DEFAULT_TAB; content→PageBuilderTab (unchanged),
  logic→ConditionsTab, automations→placeholder card linking to the existing automations page.
  Redirects: layout→content?screen=intro, page-builder→content, conditions→logic,
  preview→content?preview=1, settings→content?settings=1. Cmd+1/2/3 shortcuts updated.
- New PreviewOverlay.tsx: full-screen Dialog hosting the existing PreviewTab as-is; opened by
  a ▶ Preview button in FormBuilderHeader, Cmd+P, and ?preview=1; Esc closes.
- Settings: gear in FormBuilderHeader opening a Dialog hosting SettingsTab as-is; ?settings=1
  deep link; gear hidden for VIEWER.

Mandatory: @dculus/ui components only, --tf-* tokens, no new CSS vars/hex colors; all new
strings via useTranslation in BOTH en and ta; keep data-testid="tab-<id>".

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test pass; all five old URLs redirect; preview
and settings overlays open via button, shortcut, and URL; E2E per the issue's policy.

When done: branch feat/builder-shell-3-tabs, commit (no .env/secrets), push, open a PR titled
"Builder redesign: 3-tab shell, redirects, preview/settings overlays" with body "Closes #227".
```

## 2 · Issue #228 — Journey rail + selection model + screenOverride canvas

```text
Implement GitHub issue #228 of this repo (run: gh issue view 228 — follow it as the spec).
Requires #227 merged. Context first: epic body (gh issue view 226),
docs/form-builder-redesign.md §2.1–§2.3, docs/form-builder-redesign-implementation.md §2–§3,
and the prototype docs/prototypes/form-builder-redesign-prototype.html (left rail: Intro /
Pages with numbered field chips / Thank You) — match it visually.

Task:
- selectionSlice.ts: add selection {kind:'intro'|'page'|'field'|'thankYou', pageId?, fieldId?}
  + setSelection, keeping selectedPageId/selectedFieldId working as compatible derived API.
- New hooks/useBuilderSelectionUrlSync.ts: two-way sync with ?screen=…&field=… search params.
- New components/form-builder/rail/JourneyRail.tsx (~236px, leftmost in Content): ＋ Add
  content button (opens existing FieldTypesPanel in a Popover for now), INTRO card, PAGES
  section (page groups with numbered field chips, rename/duplicate/delete via existing
  DraggablePageItem logic, add-page gated by permissions.canAddPages()), THANK YOU card.
  DnD via the existing dnd-kit setup and the insert-slot math documented in
  PageBuilderTab.handleDragEnd — reuse, do not reimplement. testids: rail-intro,
  rail-page-<index>, rail-field-<fieldId>, rail-thankyou; keep pages-list and
  add-page-button names on the rail.
- PageBuilderTab.tsx canvas modes: intro/thankYou selections render FormRenderer
  (mode=BUILDER, screenOverride='intro'|'thankYou', onLayoutChange=updateLayout — copy the
  exact wiring from LayoutTab.tsx); page/field selections render FormArea unchanged.
- PageBuilderSidebar.tsx: remove the Pages tab (rail owns it); keep Properties + JSON.
- Keep the existing left field-types column in place — it is removed by #230, not here.

Mandatory: @dculus/ui only, --tf-* tokens; i18n namespace journeyRail in BOTH en and ta;
VIEWER = fully read-only rail; verify collab with two browser windows.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; rail selection drives canvas + URL and
survives reload/back; all rail DnD paths work; E2E per the issue.

When done: branch feat/builder-journey-rail, push, PR titled
"Builder redesign: journey rail + selection model + screen canvas" with body "Closes #228".
```

## 3 · Issue #229 — Contextual right panel (Intro / Ending / page / field+logic)

```text
Implement GitHub issue #229 of this repo (run: gh issue view 229 — follow it as the spec).
Requires #228 merged. Context first: epic body (gh issue view 226),
docs/form-builder-redesign.md §2.2–§2.3, and the prototype's right-panel panes (Welcome
screen / Page settings / Field / Ending) — match them.

Task: make the right panel contextual on selection.kind:
- New panels/IntroSettingsPanel.tsx composing EXISTING pieces (move, don't rebuild):
  LayoutThumbnails, the customCTAButtonName input, and the full background block
  (BackgroundImageUpload/Gallery, Pexels/Pixabay modals, custom color) from LayoutSidebar.tsx
  — preserve the exact backgroundImageKey/backgroundVideoKey/backgroundDominantColor logic.
- New panels/EndingSettingsPanel.tsx: rich-text editing of layout.thankYouContent (lift the
  existing thank-you editor from components/form-settings/).
- Page pane: title (updatePageTitle), duplicate/delete, permission-gated.
- Field pane: FieldSettingsV2 unchanged + a logic-summary row "⚡ N logic rules use this
  field →" (scan store conditions; hide when 0) linking to /builder/logic?field=<id>;
  ConditionsTab reads ?field= and filters with a dismissible chip.

Mandatory: @dculus/ui only; i18n namespaces introSettings + endingSettings in BOTH en and ta;
VIEWER read-only; do NOT delete LayoutTab/LayoutSidebar files yet (#231 does).

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; parity checklist from the issue (every
old Design-tab intro control reachable and functional, incl. Pexels/Pixabay + video); collab
sync verified in a second window; E2E per the issue.

When done: branch feat/builder-contextual-panels, push, PR titled
"Builder redesign: contextual Intro/Ending/page/field panels" with body "Closes #229".
```

## 4 · Issue #230 — Field Library: mega-panel + pin-to-dock

```text
Implement GitHub issue #230 of this repo (run: gh issue view 230 — follow it as the spec).
Requires #228 merged. Context first: epic body (gh issue view 226),
docs/form-builder-redesign.md §2.1 "Field Library", and the prototype (＋ Add content →
mega-panel; 📌 Pin → docked column) — the "all field types visible in one shot" requirement
is hard; match the prototype's grid and docked layouts.

Task: new components/form-builder/field-library/FieldLibrary.tsx with two modes, both fed by
getFieldTypesConfig + the existing drag sources from FieldTypesPanel.tsx (dnd payload
{type:'field-type', fieldType} must stay byte-identical so every drop handler keeps working):
- Mega-panel (default): ~560px Popover from the rail's ＋ Add content button — search input,
  "Recently used" row (localStorage dculus.fieldLibrary.recent), Input/Choice/Content/
  Advanced sections as a 3-column tile grid; click appends via useFieldCreation/addField,
  drag inserts as today. Enter adds first search match; "/" opens with search focused.
- Docked: 📌 Pin persists (localStorage dculus.fieldLibrary.pinned) a ~200px single-column
  compact panel between rail and canvas, visually equivalent to the classic FieldTypesPanel.
- Delete the permanent LeftSidebar mounting from PageBuilderTab.tsx (FieldTypesPanel itself
  stays as the shared engine). Keep data-testid="field-type-<label>" on tiles.

Mandatory: @dculus/ui only; i18n namespace fieldLibrary in BOTH en and ta; VIEWER: no add
entry point, "/" inert.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; drag from both modes hits every existing
drop path (insert slots, append, cross-page); pin survives reload; E2E drag scenarios
migrated per the issue.

When done: branch feat/builder-field-library, push, PR titled
"Builder redesign: Field Library mega-panel with pin-to-dock" with body "Closes #230".
```

## 5 · Issue #231 — Design drawer + retire the Design tab

```text
Implement GitHub issue #231 of this repo (run: gh issue view 231 — follow it as the spec).
Requires #229 merged. Context first: epic body (gh issue view 226),
docs/form-builder-redesign.md §2.4, and the prototype's 🎨 Design drawer — match it.

Task:
- New CanvasToolbar.tsx atop the Content canvas: 🎨 Design button, desktop/mobile device
  toggle, ▶ Preview button (relocated from the header per the prototype).
- New design/DesignDrawer.tsx (Sheet over the right panel): LayoutThumbnails L1–L9, theme +
  spacing + pageMode (lifted from LayoutOptions/LayoutSidebar), and the global background
  block — extract a shared BackgroundControls.tsx used by both this drawer and
  IntroSettingsPanel instead of duplicating. All writes via updateLayout, gated by
  permissions.canEditLayout().
- Delete tabs/LayoutTab.tsx and tabs/layout/LayoutSidebar.tsx; keep reused leaf components;
  clean dead references. The /builder/layout redirect from #227 stays.

Mandatory: @dculus/ui only; i18n namespace designDrawer in BOTH en and ta; run the issue's
parity checklist — no old Design-tab capability may be lost.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; drawer changes sync live to canvas and a
second collab window; E2E: replace Design-tab scenarios per the skip-tag policy.

When done: branch feat/builder-design-drawer, push, PR titled
"Builder redesign: global Design drawer, Design tab retired" with body "Closes #231".
```

## 6 · Issue #232 — Unified AI: Ask-AI pill + context seeding

```text
Implement GitHub issue #232 of this repo (run: gh issue view 232 — follow it as the spec).
Requires #227 merged (parallel-safe with #228–#231 — guard on selection state existing).
Context first: epic body (gh issue view 226), docs/form-builder-redesign.md §2.7, the
prototype's ✨ Ask AI drawer (context line at top), and docs/ai-builder-chat-capabilities.md
for the existing chat contract — do not change the backend contract.

Task:
- New AskAIPill.tsx: bottom-center pill on ALL three tabs of CollaborativeFormBuilder,
  opening the root-mounted AIEditDrawer; replaces the corner AIFloatingButton mounting.
- Context seeding: pass builderContext {activeTab, selection {kind,pageId?,fieldId?,
  fieldLabel?}} into AIEditDrawer; render the context line at the drawer top; include the
  context in the outgoing message payload following the existing initialMessage threading;
  update live while the drawer is open.
- Verify convergence: ConditionsTab describe-with-AI keeps flowing through the same drawer;
  Cmd+K works on every tab; ?aiMessage= deep link unchanged.

Mandatory: @dculus/ui only; i18n namespace askAI in BOTH en and ta; pill hidden for VIEWER.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; context line correct for intro/page/
field/thank-you selections and reaches the request payload; condition drafting still lands
as pending suggestions in Logic.

When done: branch feat/builder-unified-ai, push, PR titled
"Builder redesign: unified Ask-AI pill with builder-context seeding" with body "Closes #232".
```

## 7 · Issue #233 — Embed Automations as a builder tab

```text
Implement GitHub issue #233 of this repo (run: gh issue view 233 — follow it as the spec).
Requires #227 merged (parallel-safe with #228–#232). Context first: epic body
(gh issue view 226) and docs/form-builder-redesign.md §4.

Task:
- Nested routes /builder/automations, /builder/automations/:automationId, and
  /builder/automations/:automationId/runs rendered inside the builder shell (FormBuilderHeader
  + TabNavigation stay); replace #227's placeholder pane.
- Adapt Automations.tsx / AutomationBuilder.tsx / AutomationRuns.tsx mechanically: strip
  duplicate chrome, use the new nested paths for list↔builder↔runs navigation, fix the
  automation canvas height inside the tab container (verify 1280×720 and 1920×1080).
- Redirect the old /dashboard/form/:formId/automations/* routes; update every in-app
  navigate/Link that targets them (grep '/automations' across apps/form-app/src).
- Zero automation-feature changes — routing and chrome only.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test; full flow list→create→configure→runs
works inside the tab; all old URLs redirect; E2E automations scenarios migrated per policy.

When done: branch feat/builder-automations-embed, push, PR titled
"Builder redesign: automations embedded as builder tab" with body "Closes #233".
```

## 8 · Issue #234 — Polish & release hardening

```text
Implement GitHub issue #234 of this repo (run: gh issue view 234 — follow it as the spec).
Requires ALL other epic #226 tickets merged. Context first: epic body (gh issue view 226).

Task (six workstreams, per the issue):
1. ⚡ logic badges on rail field chips (shared getRulesForField helper; deep link to
   /builder/logic?field=<id>).
2. Shortcut audit: Cmd+1/2/3, Cmd+P, Cmd+K, "/", layered Esc; none fire while typing.
3. One-time coach marks (rail / Design / gear) via @dculus/ui primitives, localStorage-
   flagged, suppressed in E2E runs.
4. JSON debug view: removed from the panel, re-homed behind a dev-only header menu entry.
5. i18n audit of every file the epic touched — all epic namespaces complete in en AND ta.
6. E2E consolidation: every @skip-ci introduced by this epic re-enabled or replaced
   (grep -rn "@skip-ci" test/); add the end-to-end journey scenario from the issue.

Verify: pnpm type-check, pnpm lint, pnpm test:unit, pnpm --filter form-app test, pnpm test:e2e all green; zero epic-
introduced @skip-ci remaining.

When done: branch feat/builder-redesign-polish, push, PR titled
"Builder redesign: polish + release hardening" with body "Closes #234". After merge, tick
the last checkbox on epic #226 and close it with a summary comment.
```
