# PDF Template Designer Redesign

Status: **planned** — implemented in phases, each phase manually tested before the next starts.

## Problem

The PDF template designer (`apps/form-app/src/pages/PdfTemplateDesigner.tsx`) inserts form
fields as pdfme text elements whose visible content is the raw binding placeholder
(`{{<fieldId>}}`). Users see opaque IDs like `{{cm3xk9a2b…}}` on the canvas. The "Form
fields" panel is click-only (no drag), visually disconnected from the form builder, and
there is no way to preview a template with real response data.

Reference UX: JotForm's PDF Editor (screenshots reviewed 2026-07-11) — left "Document
Elements" panel with **Basic Elements / Form Fields** tabs, search, type icons, drag-and-drop
with drop guides, labels (never IDs) on the canvas, and a submission picker for previewing
with real data.

## Verified constraints (facts, not assumptions)

- **Substitution is already shared**: PDF generation (`pdfTemplateService.ts`) uses
  `substitutePlaceholdersPlainText` + `createFieldLabelsMap` from `@dculus/utils` — the same
  utilities as the email plugin and thank-you page. Value formatting
  (`formatResponseValueForPdf`) is already human-readable: localized dates, international
  phone format, file keys → filenames, arrays joined.
- **pdfme v6.1.11** (`@pdfme/common`, `@pdfme/ui`, `@pdfme/schemas`):
  - Element schema zod object is `.passthrough()` — custom props (e.g. `dculusFieldId`)
    survive `checkTemplate()` and Designer round-trips.
  - Designer public API: `updateTemplate`, `getTemplate`, `getPageCursor`, `getTotalPages`,
    `onPageChange`, `onChangeTemplate`, `onChangeSelection`, `getSelection` (returns pixel
    bounds), `selectSchemas(targets, { scroll })`.
  - `options.sidebarOpen`, `options.maxZoom`, `updateOptions` exist; custom plugins can
    define `ui` + `propPanel` renderers.
- **DnD stack**: form builder uses `@dnd-kit/core` 6.3.1 (`FieldTypesPanel` items are
  `useDraggable`; `PageBuilderTab` owns `DndContext` + `DragOverlay`). Reuse this pattern.
- **Preview data**: `GENERATE_PDF_FROM_RESPONSE` mutation and `GET_FORM_RESPONSES`
  (`responsesByForm`) query already exist.

## Core design

### 1. Binding model — label on canvas, ID as binding

A "bound field" element inserted from the panel:

```jsonc
{
  "name": "full_name",            // slugified truncated label + numeric suffix; unique across ALL pages
  "type": "text",
  "content": "Full Name",         // display-only, truncated to ~30 chars with ellipsis
  "dculusFieldId": "cm3xk9a2b…",  // the actual binding (custom passthrough prop)
  "position": { "x": 20, "y": 20 },
  "width": 60,                    // auto-sized from label length, clamped 40–120 mm
  "height": 10,
  "fontSize": 12
}
```

Generation (`generatePdfForResponse`):

1. If `schema.dculusFieldId` is set → output the formatted response value directly,
   ignoring `content`.
2. Else → existing `{{…}}` substitution on `content`.

Both paths coexist permanently: legacy templates and hand-typed `{{fieldId}}` placeholders
in static text keep working. No data migration.

Label drift: on designer load, bound elements' `content` is re-synced to the field's
current label (in memory; does **not** mark the template dirty). Elements bound to deleted
fields are kept, surfaced as "missing field" warnings, and generate as empty strings.

Silent upgrade: on open, a text element whose content is exactly `{{<known fieldId>}}` is
converted to the bound form (persists on next user save).

### 2. Layout — form-builder look and feel

```
┌─ Toolbar: back | name input | … | Preview | Save ────────────────────┐
├──────────────┬────────────────────────────────────┬──────────────────┤
│ Left panel   │  pdfme Designer canvas             │ pdfme built-in   │
│ w-72         │  (keeps own zoom/pages/snap/undo)  │ right sidebar    │
│ ┌──────────┐ │                                    │ (prop panel)     │
│ │Fields│Elem│ │                                    │                  │
│ └──────────┘ │                                    │                  │
│ 🔍 search    │                                    │                  │
│ [icon] Label │                                    │                  │
└──────────────┴────────────────────────────────────┴──────────────────┘
```

- Left panel styled like `FieldTypesPanel` (w-72, underline tabs, Typeform tokens).
- **Form fields tab**: search, field-type icon (existing icon color map), full-label
  tooltip, "placed ×N" badge, click **or** drag to insert.
- **Elements tab**: Text / Image / Line / Rectangle / Ellipse / Table / QR, built from each
  pdfme plugin's `propPanel.defaultSchema`, click or drag to insert. pdfme's own
  add-element UI remains as a secondary path.
- pdfme's built-in right sidebar stays (it is the per-element property panel).

### 3. Drag & drop

- One `DndContext` wraps the left panel and the canvas container; panel rows are
  `useDraggable` (payload `{ kind: 'formField' | 'element', … }`); canvas container is a
  single `useDroppable`.
- On drop: pointer px → PDF mm. Find the pdfme page element under/nearest the pointer,
  `scale = renderedPageWidthPx / pageWidthMm`, subtract page rect origin, clamp into page
  bounds; resolve page index; `updateTemplate` then `selectSchemas([{ name }], { scroll: true })`.
- `DragOverlay` chip: field icon + truncated label (same as builder's `FieldTypeDisplay`).
- **Spike first**: confirm page DOM rect/scale is queryable at all zoom levels. Fallback if
  flaky: drop = insert at viewport center of current page (still selected/scrolled).
- Click-to-insert stays (accessibility); placement cascades from the last insert.
- `PointerSensor` activation distance ~8 px so click and drag coexist.

### 4. Preview with response data

Toolbar "Preview" opens a panel/overlay:

- **Response picker**: recent submissions via `GET_FORM_RESPONSES` (identity heuristic:
  first text/email value + submitted date).
- Preview calls a new `previewPdfTemplate` mutation with the **working template JSON**
  (validated server-side via `checkTemplate`) + optional `responseId`; without a
  `responseId` the backend builds deterministic per-field-type sample values
  (text → "Sample answer", email → "user@example.com", date → today, select → first
  option, …). Renders the returned temp URL in an `<iframe>`.
- Rationale: true generated PDF = pixel-exact preview, zero client/server formatting
  drift. (JotForm-style inline label+value on canvas was considered and rejected: needs a
  custom pdfme plugin plus a duplicated client-side formatter.)
- AI-generated sample data is a possible later enhancement (backend `aiService` exists);
  deterministic samples ship first.

### 5. Backend changes (small, backward compatible)

- `generatePdfForResponse`: `dculusFieldId` path first, `{{…}}` fallback second.
- New mutation `previewPdfTemplate(templateId, template?, responseId?)` (EDITOR+): hydrate
  base PDF, generate, store via `temporaryFileService`, return temp download URL.
- `validatePdfTemplate` unchanged (passthrough already accepts the custom prop).
- Unit tests: bound substitution, legacy coexistence, deleted field → empty string,
  formatting parity.

## Edge cases

Binding & labels

1. Label renamed → content re-synced on load; ID binding never breaks.
2. Field deleted → element kept, "missing field" warning + one-click remove-all;
   generates empty string (not `[id]`).
3. Empty label → display "Untitled field" (i18n); slug fallback `field_n`.
4. Duplicate labels → allowed; schema `name` suffixed `_2`, `_3`… unique across all pages
   and against user-created element names.
5. Same field placed multiple times → allowed; panel badge shows count.
6. Tamil/unicode labels → slug falls back to `field_n`; pdfme default font (Roboto) lacks
   Tamil glyphs — add Noto Sans Tamil via `options.font` in **both** Designer and
   generator (must match). Also fixes Tamil response values in generated PDFs (latent bug).
7. Very long labels → content truncated ~30 chars + ellipsis; width clamped 40–120 mm;
   full label in panel tooltip.

Template lifecycle

8. Legacy `{{id}}` templates → work forever; silently upgraded on open + save.
9. User edits a bound element's text in the prop panel → harmless (content is cosmetic).
10. User duplicates a bound element via pdfme UI → copies `dculusFieldId`; verify pdfme
    regenerates unique names — dedupe on save if not.
11. Uploaded-PDF vs blank templates → identical insertion; drop math handles per-page
    sizes.
12. Multi-page → drop resolves page under pointer; click-insert targets `getPageCursor()`.

DnD & canvas

13. Drop on gutter/outside pages → clamp to nearest page edge or snap-back cancel.
14. Zoomed canvas → scale derived from live DOM rect.
15. Designer not ready / no edit permission → panel disabled (keep existing
    `data-testid="pdf-designer-insert-<id>"`).

Preview

16. Zero responses → sample-data mode auto-selected.
17. Response deleted between list and preview → toast + refresh picker.
18. Unsaved changes → preview posts working template JSON, so preview always matches the
    canvas.
19. VIEWER permission → preview allowed, editing/drag disabled.

Misc

20. Label re-sync on load must NOT set dirty; user inserts do (via `onChangeTemplate`).
21. i18n: all new strings in `locales/{en,ta}/pdfTemplates.json`.
22. E2E: keep existing testids; add `pdf-designer-panel-tab-*`, `pdf-designer-preview-*`.

## Phases (each independently shippable; manual test gate between phases)

| Phase | Scope |
|---|---|
| 1 | Binding + label display: `dculusFieldId`, label content, truncation, auto-width, unique names, cascade placement, select-on-insert, label re-sync, legacy upgrade, backend dual-path + unit tests |
| 2 | Left panel redesign: Fields/Elements tabs, search, icons, placed-count badges, tooltips, Elements insertion |
| 3 | Drag & drop: coordinate-mapping spike → dnd-kit wiring → overlay chip → select-on-drop (fallback: viewport-center insert) |
| 4 | Preview: response picker + `previewPdfTemplate` mutation + sample data + iframe render |
| 5 (optional) | Tamil font support, chip-styled custom plugin for bound fields, AI sample data |
| 6 | JotForm-parity canvas UX: guided-drop column grid + snap ghost, floating selection toolbar (duplicate / delete / edit text), text editor modal with inline field tokens (`{token}` bound via `dculusFieldVars`), larger resize handles. Chip-styled bound fields dropped by decision (new schema type not worth cosmetic gain). pdfme built-ins worth knowing: rulers support dragging out guide lines, and elements snap to them while moving/resizing. |

Spikes before committing to Phase 3/5: (a) page DOM rect/scale mapping under zoom,
(b) duplicate-element naming, (c) custom font parity Designer ↔ generator.

## Files touched

- `apps/form-app/src/pages/PdfTemplateDesigner.tsx` → supporting modules in
  `apps/form-app/src/components/pdf-designer/`: `LeftPanel.tsx` (tabbed
  Fields/Elements palette), `PreviewDialog.tsx`, `fieldBinding.ts`,
  `dropPlacement.ts`
- `apps/backend/src/services/pdfTemplateService.ts` + `__tests__`
- `apps/backend/src/graphql/schema.ts` + resolver (preview mutation)
- `apps/form-app/src/graphql/pdfTemplates.ts`
- `apps/form-app/src/locales/{en,ta}/pdfTemplates.json`
- `packages/utils` untouched (substitution reused as-is)
