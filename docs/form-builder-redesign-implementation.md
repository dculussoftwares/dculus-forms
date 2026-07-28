# Form Builder Redesign — Implementation Plan

> Companion to [`form-builder-redesign.md`](./form-builder-redesign.md) (read that first).
> No backend/schema changes required for phases 1–6. All state stays in the existing
> Zustand ⇄ Y.js store, so real-time collaboration works unchanged.

---

## 1. Route map

```
NEW (canonical)                                  OLD → redirect
/dashboard/form/:id/builder/content              /builder/page-builder → /builder/content
  ?screen=intro | thankyou | page:<pageId>       /builder/layout       → /builder/content?screen=intro
  &field=<fieldId>                               /builder/preview      → /builder/content + preview overlay open
/dashboard/form/:id/builder/logic                /builder/conditions   → /builder/logic
/dashboard/form/:id/builder/automations          /dashboard/form/:id/automations/* → /builder/automations/*
/dashboard/form/:id/builder/settings (overlay route, opened by header ⚙)
```

`BuilderTab` type becomes `'content' | 'logic' | 'automations'`. Selection (`screen`, `field`)
lives in search params so deep links, browser back, and E2E tests can target exact states.

## 2. Component mapping — reuse first

| New piece | Built from (existing) | New work |
|---|---|---|
| Top nav (3 tabs) | `TabNavigation` inline mode | Trim rail to 3 entries; keep count/warning badges; drop Preview/Settings cluster (move to toolbar/header) |
| **Journey rail** | `DraggablePageItem`, `PageBuilderSidebar` pages tab, dnd-kit `SortableContext` | New `JourneyRail` component: INTRO / PAGES / THANK YOU sections; expandable page cards listing field chips (icon + label + ⚡ logic badge); `+ Add content` button |
| Field Library (mega-panel + pin-to-dock) | `FieldTypesPanel` (grouped categories, draggable items), `AddFieldPopover` | New `FieldLibrary` shell with two render modes: 3-col grid mega-panel (search + recently-used + keyboard nav) and docked compact column (visually ≈ today's panel); pin state in `localStorage`; drag-to-canvas AND click-to-append in both modes |
| Canvas — page mode | `PageBuilderFormArea`, `PageBuilderFieldCard`, `DropIndicator`, drag/drop handlers from `PageBuilderTab` | Extract DnD orchestration into a hook shared by rail + canvas |
| Canvas — intro / thank-you mode | `FormRenderer` (`mode=BUILDER`, `screenOverride='intro'|'thankYou'`) — already shipped, used by today's `LayoutTab` | Wire selection → `screenOverride`; keep inline rich-text editing |
| Canvas toolbar | `PreviewTab` device toggle, new Design + Preview buttons | Small new component |
| Right panel — field | `FieldSettingsV2` (auto-switch on selection already implemented) | Add "Logic on this field" summary row (uses `conditions` from store) |
| Right panel — intro | `LayoutThumbnails` (L1–L9), CTA input, background controls from `LayoutSidebar` | New `IntroSettingsPanel` composing them; per-screen framing |
| Right panel — thank-you | thank-you content controls (rich text) | New `EndingSettingsPanel`; stub sections for future redirect/share |
| Design drawer (global) | `LayoutSidebar` (thumbnails, theme, spacing, background + Pexels/Pixabay modals) | Re-house in a `Sheet`/drawer; remove screen toggle (now the rail's job) |
| Preview overlay | `PreviewTab` (mobile CSS overrides, test-submit flow) | Wrap in full-screen `Dialog`; `Cmd+P`; open via `?preview=1` for the old-route redirect |
| Settings overlay | `SettingsTab` / `FormSettingsContainer` | Route-driven overlay from header ⚙ |
| Logic tab | `ConditionsTab` unchanged | Accept `?field=` filter for deep links |
| Automations tab | `Automations`, `AutomationBuilder`, `AutomationRuns` pages | Render inside builder shell (keep `FormBuilderHeader`); old routes redirect |
| **Unified AI** | `AIEditDrawer`, `AIFloatingButton`, pending-condition-suggestion flow | Mount drawer at builder root (all tabs); "✨ Ask AI" pill on every tab; seed context `{activeTab, selectedScreen, selectedPageId, selectedFieldId}` into the drawer's initial system context; route automation asks to automation tools |

Deleted after migration: `LayoutTab` (contents absorbed), standalone Preview/Settings tabs,
permanent left field-types column, JSON tab (moves behind a dev toggle in the ⚙ menu).

## 3. Store changes (Zustand only — no Y.js schema change)

- `selectionSlice`: generalize `selectedFieldId`/`selectedPageId` into
  `selection: { kind: 'intro' | 'page' | 'field' | 'thankYou'; pageId?; fieldId? }`
  (keep old selectors as derived getters so `FieldSettingsV2`, `FormArea`, tests keep working).
- URL ⇄ store sync hook (`useBuilderSelectionUrlSync`) mapping `?screen`/`?field` to selection.
- No changes to `fieldsSlice` / `pagesSlice` / `layoutSlice` mutations — rail and panels call the
  same actions (`updateLayout`, `addFieldAtIndex`, `reorderPages`, …).

## 4. Phases (each independently shippable)

| Phase | Scope | Notes |
|---|---|---|
| **P1 — Shell** | New 3-tab nav, routes + redirects, header ⚙ settings overlay, preview overlay behind ▶ | Old tabs still render inside new shell; zero behavior change otherwise |
| **P2 — Journey rail** | `JourneyRail` replaces right-sidebar Pages tab + left column stays temporarily; Intro/Thank-You cards render `screenOverride` canvas | The "unified content" moment |
| **P3 — Contextual right panel** | `IntroSettingsPanel`, `EndingSettingsPanel`, field logic summary row | Design tab now redundant for screens |
| **P4 — Add-content popover + Design drawer** | Remove permanent field-types column; global design drawer; delete `LayoutTab` | Canvas gains ~300px |
| **P5 — Unified AI** | Root-mounted drawer, per-tab pill, selection context seeding, logic + automation tool routing | Depends on P1 only — can run parallel to P2–P4 |
| **P6 — Automations embed** | Move automation pages under `/builder/automations`, redirects | Mostly routing/chrome work |
| **P7 — Polish** | Keyboard shortcuts (Cmd+1/2/3 = tabs, Cmd+P preview), rail ⚡ badges, empty states, i18n audit, E2E migration | |

## 5. Testing & i18n checklist

- **i18n**: new namespaces `journeyRail`, `introSettings`, `endingSettings`, `designDrawer`,
  `askAI` — each registered in `locales/index.ts` for **both `en` and `ta`**.
- **E2E**: keep `data-testid`s: `tab-*`, `pages-list`, `add-page-button`, `draggable-field-*`,
  `layout-screen-toggle-*` (re-point to rail cards: `rail-intro`, `rail-page-<n>`,
  `rail-thankyou`), `new-page-builder-tab` → `content-workspace`. Update Cucumber steps that
  navigate to `/builder/page-builder` etc. — redirects keep them passing during migration, then
  migrate step definitions.
- **Permissions**: rail/canvas/panels all consult `useFormPermissions` exactly as the components
  they're built from; VIEWER = read-only rail (no drag, no add), settings panels disabled.
- **Collab**: multi-client test — page reorder from client A while client B has intro selected;
  selection is local-only state, so no conflict surface is added.

## 6. Risks

| Risk | Mitigation |
|---|---|
| DnD regressions when rail + canvas share one `DndContext` | Extract current collision strategy into shared hook; keep existing insert-slot math (documented in `PageBuilderTab.handleDragEnd`) untouched |
| Users lost by moved Design/Preview/Settings | Redirects + one-time "things moved" coach marks on first open |
| Inline intro/thank-you editing conflicts with canvas selection | Intro/thank-you canvas is `FormRenderer`-owned (already works on Design tab today); only selection wiring is new |
| Automations embed inherits builder header actions that don't apply | Header stays; tab content controls its own sub-toolbar (list/canvas/runs) |
