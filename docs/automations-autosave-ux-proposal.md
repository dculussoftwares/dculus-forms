# Automations builder: autosave proposal

Status: **Phase 1 implemented** (see "As built" below for where the implementation differs from the original proposal)
Scope: `apps/form-app` automation builder, automation list card, and the `apps/backend` automation service, resolvers, and Prisma model
Related: [conditional-logic-save-ux-plan.md](./conditional-logic-save-ux-plan.md) (that plan rejected autosave for a reason that applies here too; see §2.2)

---

## As built (deviations from the proposal below)

- **No publish-preview query.** The frontend computes the high-impact confirmation (removed action steps, changed schedule) by comparing the live graph/trigger config it already has with the draft, so `automationPublishPreview` / `getAutomationPublishPreview` were not added.
- **Schedule hint instead of "Next run".** The schedule editor shows "Changes are saved automatically and take effect when you publish." and the publish dialog names the new schedule (e.g. "Every day at 09:00"); it does not compute a next-run date.
- **`draftUpdatedBy` / `publishedBy`** are a small `AutomationEditor { id, name }` type rather than the full `User` type.
- **Unapplied-changes guard** covers the panel's ✕ and Cancel only (detected via input/change events inside the panel). Switching nodes by clicking the canvas still drops un-applied plugin-form edits, as before; the real fix is Phase 2 (`ConfigForm.onChange`).
- **OAuth redirect (Sheets Connect)** relies on the sessionStorage mirror rather than an explicit flush: the mirror records the server `draftRevision` it was based on and is re-sent on return.
- **Engine write-back goes to the live graph only.** Copying it into `draftGraph` would overwrite the editor's unpublished edits to that node (the handler returns a config derived from the *live* one). Instead `publishAutomation` carries the engine-owned fields (spreadsheet identity, destination folder, `sheetColumns`) from live into the draft being published. A refreshed OAuth access token is therefore not carried; the handler refreshes it again from the refresh token. No `graphSource` on runs, because the Test feature is removed and only the published graph is ever run.
- **Known limitations (follow-ups).** (1) A publish that races an engine write-back landing on the live graph in the same few milliseconds can drop that write-back (the next run would create a second spreadsheet); fixing it needs a row lock or a second CAS column. (2) If cron scheduling throws after a publish has committed, the mutation errors and the client keeps a stale revision until reload. (3) The card-menu Discard has no `baseRevision`, so it can discard an edit another editor saved after the list loaded.
- **Autosave holds off while a publish is in flight**, and the builder is never swapped for a spinner by a background revalidation (it would otherwise reload from an Apollo cache whose `draftGraph` is stale).
- **Deploy:** the Prisma migration `20261018120000_automation_draft` is additive (`ADD COLUMN IF NOT EXISTS`) and is applied by the deploy pipeline (`db:migrate:deploy`); it must be applied before any backend built from this change serves automation queries against that database.

---

## 0. TL;DR

**Autosave every edit to a server-side *draft*. Only an explicit *Publish* (or *Activate*) changes what runs.**

This is the Zapier, Make, and n8n model: the builder is a document that is always saved, and going live is a separate, deliberate action.

| Today | Proposed |
| --- | --- |
| Edits are local until the header **Save** button is clicked. A sessionStorage copy survives reloads in the same tab only. | Every edit is autosaved to `Automation.draftGraph` about 800 ms after the user stops editing. The header shows **Saving… / Saved / Couldn't save**. |
| **Save** on an ACTIVE automation writes straight to the live graph. Half-finished edits go live, or the save is rejected as invalid. | Draft saves never touch the live graph and are never rejected for being incomplete. The live graph changes only through **Publish changes**. |
| **Activate** is disabled while dirty ("Save your changes before activating"). | **Activate**, **Publish changes**, and **Resume** publish the current draft. There is no separate save step to remember. |
| Validation errors appear only after a failed Save or Activate. | Every draft save returns validation issues. They show inline and in an "N issues" pill, and the user sees them before trying to publish. |
| The schedule trigger has its own **Save** button that reschedules the live cron immediately. | The schedule config becomes part of the draft and is applied on Publish, like everything else. |
| Leaving with unsaved edits triggers `window.confirm`. | Nothing is lost when leaving. The draft persists across tabs, devices, and sessions, and the user can come back later to Publish or Discard it. |
| A **Test automation** button appears on the list card, the builder header, and the Runs page. | **Removed** (§4.8). It needs an existing response, fires real webhooks and sheet appends, and changes meaning once drafts exist. The Runs page plus Publish replaces it. |

The header goes from **Save + Test + Activate** to one context-aware primary button plus a save-status indicator.

---

## 1. Current behaviour (verified in code)

| Area | File | Behaviour |
| --- | --- | --- |
| Builder header | [AutomationBuilder.tsx](../apps/form-app/src/pages/AutomationBuilder.tsx) | The `Save` button calls `UPDATE_AUTOMATION(graph)`. `Activate` is disabled while `isDirty`. An "Unsaved changes" text label is shown. `beforeunload` and `window.confirm` run on Back. |
| Builder state | [automationBuilderSlice.ts](../apps/form-app/src/store/slices/automationBuilderSlice.ts) | `insertStepOnEdge`, `updateNodeData`, and `removeNode` set `isDirty: true` and mirror the graph into sessionStorage. `markSaved()` clears both. |
| Local draft | [draftStorage.ts](../apps/form-app/src/components/automations/builder/draftStorage.ts) | Exists only so unsaved edits survive the Google/Microsoft Sheets OAuth full-page redirect. Scoped to the tab. |
| Node editors | [NodeConfigPanel.tsx](../apps/form-app/src/components/automations/builder/NodeConfigPanel.tsx) | Delay, digest, and condition editors call `updateNodeData` on every change (per keystroke). Plugin `ConfigForm`s (email, webhook, sheets, …) commit only on their own in-panel **Save**. So there are two save levels: panel Save, then header Save. |
| Schedule trigger | [ScheduleTriggerEditor.tsx](../apps/form-app/src/components/automations/builder/ScheduleTriggerEditor.tsx) | Has its own Save that calls `updateAutomation(triggerConfig)` immediately. If the automation is ACTIVE, this **reschedules the live cron**. It bypasses the graph's dirty flow. |
| List card | [AutomationCard.tsx](../apps/form-app/src/components/automations/AutomationCard.tsx) | Shows status, trigger, "Updated {date}", and health. The menu has Activate/Pause, Rename, Duplicate, and Delete. It does not know about unsaved or unpublished work. |
| Service | [automationService.ts](../apps/backend/src/services/automationService.ts) `updateAutomation` | When ACTIVE, the graph must pass `validateAutomationGraph`, otherwise the save fails with `AUTOMATION_INVALID_GRAPH`. `version` is incremented on **every** graph change. |
| Runs | `triggerService.ts`, `testAutomation` | Each run snapshots `Automation.graph` into `AutomationRun.graphSnapshot`. Test runs use the same saved graph. |
| Test | [useTestAutomation.ts](../apps/form-app/src/hooks/useTestAutomation.ts), used by [AutomationCard.tsx](../apps/form-app/src/components/automations/AutomationCard.tsx), [AutomationBuilder.tsx](../apps/form-app/src/pages/AutomationBuilder.tsx), [AutomationRuns.tsx](../apps/form-app/src/pages/AutomationRuns.tsx) | `testAutomation` runs the graph against the latest response (or an empty schedule context). It is disabled when the form has no responses. The engine has test-mode branches in `engine.ts` (`context.test`): delays fast-forward, emails go to the tester, digests are sampled, and non-ACTIVE automations are allowed to run. Webhooks and sheet appends **fire for real**. |
| Engine write-back | `engine.ts` `updateAutomationNodeConfig` → `automationRepository.setNodeConfigInGraph` | At runtime, an action may write an auto-created spreadsheet ID or a refreshed token back into `Automation.graph`. `carrySheetColumnsInGraph` exists so a builder save doesn't overwrite the sheet layout. |

---

## 2. Problems and constraints

### 2.1 UX problems today

1. **Two-level save.** A user configures an email step, clicks the panel **Save**, sees the panel close, and reasonably thinks the work is saved. It isn't until they also click the header **Save**. This is the most likely source of "I lost my automation" reports.
2. **Work is lost on close.** Closing the tab, a crash, or a session expiry loses everything. The sessionStorage draft doesn't survive closing the tab and isn't available on another device.
3. **Editing a live automation is risky or blocked.** On an ACTIVE automation, every Save is a deploy:
   - A finished but wrong edit goes live immediately (for example, an email step pointed at the wrong field).
   - An unfinished edit is rejected (`AUTOMATION_INVALID_GRAPH`), so the user can't even park their work. They have to pause the automation to save it.
4. **Validation is late.** Errors appear only after clicking Save or Activate.
5. **Inconsistent save rules.** The schedule trigger saves (and goes live) on its own button, while the graph needs the header Save.
6. **`version` is noise.** It is incremented on every save, so `v23` doesn't mean "the 23rd version that ran".
7. **Test doesn't fit most real uses.** It is disabled on forms with no responses. It re-sends real webhooks and appends real spreadsheet rows using an old respondent's data. Only email is made safe. With drafts, it would also be unclear whether it tests the draft or the live version. Removing it is simpler and more honest than adding a "test draft / test live" mode.

### 2.2 Why naive autosave is wrong here

[conditional-logic-save-ux-plan.md](./conditional-logic-save-ux-plan.md) removed autosave from the Logic tab because *intermediate states went live to respondents*. Autosaving straight into `Automation.graph` would repeat that bug, and worse: automations send emails, call webhooks, and append to spreadsheets. A half-typed webhook URL or an email step with no recipient yet must never become what the next submission runs.

So the requirement is:

- **Autosave**: never lose work, with no Save button.
- **Safe publish**: nothing changes in production until the author says the automation is ready.

Separating the draft from the live graph satisfies both.

---

## 3. Options considered

| Option | Data loss | Live safety | Complexity | Verdict |
| --- | --- | --- | --- | --- |
| A. Keep explicit Save, and improve the dirty warnings | ❌ Still lost on crash or tab close | ✅ | Low | Rejected. Doesn't meet the request. |
| B. Autosave directly into `graph`, but only when status ≠ ACTIVE | ✅ for drafts | ⚠️ Still needs Save on ACTIVE, which gives two mental models | Low | Rejected. "Why does Save appear only sometimes?" |
| C. Autosave into `graph` and pause the automation while editing | ✅ | ⚠️ Submissions are missed while it is paused | Medium | Rejected. Losing production events is worse than the current UX. |
| **D. Autosave into `draftGraph`, and publish explicitly** | ✅ | ✅ | Medium | **Recommended.** |
| E. D plus full version history (an `AutomationVersion` table with restore) | ✅ | ✅ | High | Deferred to Phase 3. D is built so E can be added later. |

---

## 4. Target UX

### 4.1 Mental model (copy for docs and the empty state)

> Your changes are saved automatically as a **draft**. The draft doesn't run.
> When you're ready, **Publish** to make it live. Until then, the published version keeps running unchanged.

### 4.2 Builder header

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Automations   Welcome email ✎  [Active · v7]  [● Unpublished changes]                       │
│                                                                                              │
│                                ✓ Saved · just now      ⚠ 2 issues      Runs   │ Discard │ [ Publish changes ▾ ] │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

From left to right:

1. **Back**. Never prompts. The draft is already on the server, or is being flushed (§4.6).
2. **Name**. Inline rename, unchanged: saves immediately. The name isn't behavioural, so it doesn't go through the draft or Publish.
3. **Status badge**. `Draft` / `Active · v7` / `Paused · v7`. `vN` is now the **published** version.
4. **Unpublished changes chip**. Shown only when status ≠ DRAFT and `hasUnpublishedChanges`. Tooltip: "Edited {relative time} by {name}. The live automation still runs v7."
5. **Save-status indicator** (§4.3). Replaces the Save button and the "Unsaved changes" text.
6. **Issues pill**. `⚠ N issues`. Shown when the latest draft validation returned errors. Clicking it opens a popover that lists the issues. Clicking an issue selects that node and opens its panel. Structural (non-node) errors stay in the existing red banner.
7. **Runs**. Unchanged.
8. **Discard**. Shown only when there are unpublished changes on an automation that has been published at least once. Opens a confirmation: "Discard unpublished changes? The builder will reset to the live version (v7). This can't be undone." Calls `discardAutomationDraft`.
9. **Primary button**. Changes with state (§4.4).

The **Test automation** button is removed (§4.8).

There is no Save button. **⌘S / Ctrl+S** forces an immediate flush and briefly shows "Saved". People press it out of habit, so it should do something reassuring instead of opening the browser's save dialog.

### 4.3 Save-status indicator

Use `role="status"` and `aria-live="polite"`, with `data-testid="automation-save-status"` and `data-state=<state>`.

| State | Visual | When | Action |
| --- | --- | --- | --- |
| `saved` | `✓ Saved` (muted). Hover shows "Saved at 14:02:31". | No pending changes, and the last request succeeded | None |
| `pending` | `Editing…` (muted) | Changes are waiting for the debounce | None |
| `saving` | spinner + `Saving…` | A request is in flight | None |
| `offline` | cloud-off icon + `Offline. Changes kept on this device.` | `navigator.onLine === false`, or a network error | Retries automatically when back online |
| `error` | red `Couldn't save · Retry` | A non-network error, or 3 network retries failed | **Retry** link triggers a flush |
| `conflict` | amber `Edited elsewhere` | The server returned `AUTOMATION_DRAFT_CONFLICT` | Opens the conflict banner (§4.7) |
| `readonly` | hidden | Viewer permission | None |

Avoid flicker: hold `saving` for at least 400 ms, and show "Saved · just now" for about 3 s before it settles to "Saved".

**No toasts for autosave.** Use toasts only for Publish, Discard, Activate/Pause, and errors that need attention.

### 4.4 Primary action by state

`P` means "has unpublished changes". `I` means "the draft has validation issues".

| Status | P | Primary button | Secondary (menu ▾ or ghost button) | Notes |
| --- | --- | --- | --- | --- |
| DRAFT (never published) | – | **Activate** | – | Publishes the draft and activates it in one step. "Unpublished" isn't shown, because nothing is live yet. |
| ACTIVE | no | **Pause** (outline) | – | Same as today. |
| ACTIVE | yes | **Publish changes** | ▾ Pause · Discard changes | Publishing increments `version`. A toast "Published v8" includes a **View runs** link. |
| PAUSED | no | **Resume** | – | |
| PAUSED | yes | **Publish & resume** | ▾ Publish without resuming · Discard changes | "Publish without resuming" is useful before retrying failed runs, because retry uses the live graph. |

When `I` is true, the primary button **stays enabled**. Clicking it opens the issues popover anchored to the button: "Fix 2 issues before publishing", with the list. A disabled button can't explain itself and is invisible to keyboard and screen-reader users. This replaces the current "disabled while dirty" tooltip.

Before publishing, the button flushes any pending autosave and waits for it. It then calls `publishAutomation(id, baseRevision)` so the version published is exactly the one on screen.

**Publish confirmation.** No dialog for normal publishes, because the button label is explicit. Show a confirmation dialog only when the change is high-impact:
- the schedule cron or timezone changed ("Next run moves from Mon 09:00 to Tue 09:00"), or
- the draft removes an action step that exists live ("2 steps will stop running: Send email, Append to sheet").

The frontend computes this by comparing the live graph/trigger config with the draft (no extra backend call).

### 4.5 Node config panel

| Editor | Today | Proposed |
| --- | --- | --- |
| Delay, Digest, Condition | Live `updateNodeData` | Unchanged. Autosave picks the changes up. |
| Plugin `ConfigForm` (email, webhook, sheets, …) | In-panel **Save** commits to local state | **Phase 1**: rename the button to **Apply** (`builder.panel.action.applyButton`). Apply commits and closes the panel, and autosave persists the change within about 1 s. If the user closes the panel (✕, Esc, or clicking another node) with un-applied form changes, show an inline guard: "Apply changes to this step? [Apply] [Discard]". **Phase 2**: give `ConfigForm` an optional `onChange` prop so plugin forms can also update live, then remove Apply. This is a plugin-API change, so it's out of scope for Phase 1. |
| Schedule trigger | Own **Save** that goes live immediately | Remove the Save button. Preset, time, and timezone changes go to the store's `triggerConfig` (draft) and are autosaved. Invalid cron or timezone shows inline (already supported) and becomes a draft validation issue. It doesn't block the draft save. For ACTIVE automations, the new schedule applies on **Publish**. Show the hint "Changes are saved automatically and take effect when you publish." |

### 4.6 Leaving the builder

- **Back button, or navigating to another tab**: if `pending` or `saving`, flush and wait at most 3 s, then navigate. If the save fails, show a non-blocking toast: "Your latest edit couldn't be saved. It's kept on this device and will sync when you return."
- **Tab close or refresh**: `beforeunload` prompts **only** when there are changes not yet acknowledged by the server (`pending`, `saving`, `error`, or `offline`). In the normal "Saved" state, closing is silent.
- **OAuth redirect (Sheets Connect)**: before redirecting, flush and wait. `isIntentionalNavigationPending()` keeps bypassing the prompt. The sessionStorage mirror stays as a backup for edits made while offline.

### 4.7 Concurrent edits (multiple tabs or editors)

Automations are single-editor and last-write-wins today. Autosave makes silent overwrites more likely, for example with two tabs of the same automation open. To prevent this, every draft save sends `baseRevision`.

- If the revision matches, the save is accepted and `draftRevision` is incremented.
- If it doesn't match, the server returns `AUTOMATION_DRAFT_CONFLICT` with `{ draftRevision, draftUpdatedAt, draftUpdatedBy }`. The client pauses autosave and shows an amber banner above the canvas:

  > **This automation was edited elsewhere** by {name or "you in another tab"}, {relative time}.
  > [Load latest] [Keep my version]

  - **Load latest** reloads the server draft and drops local changes. Close the panel only if its node no longer exists.
  - **Keep my version** saves again with `force: true`. This overwrites the other draft and resumes autosave.

In Phase 2, optionally: on `visibilitychange` back to visible, cheaply poll `draftRevision` so the banner appears before the user edits a stale tab.

### 4.8 Remove "Test automation"

**Remove** the Test button from the list card, the builder header, and the Runs page header. See problem 7 in §2.1 for why.

How a user checks an automation without Test:
1. Fix the inline validation issues. The draft is validated on every save (§4.2, item 6).
2. Publish or Activate.
3. Submit the form (for example from the form's own preview or share link).
4. Watch the run on the **Runs** page. Per-step status and errors are already shown there, and a failed run can be fixed, published, and retried (`retryAutomationRun`, unchanged).

What stays:
- **Historical test runs.** Existing `AutomationRun` rows with `context.test === true` still render, so keep the **Test** chip on run history and run detail (`runs.testChip`, `AutomationRunDetail` `isTest`).
- **Engine test-mode branches** (`engine.ts` `context.test`). Test runs that are already in progress (for example, waiting on a delay, or retried later) must still finish safely, with emails redirected and the watermark untouched. Remove them in a later cleanup (Phase 2, §9) once no `RUNNING` or `WAITING` test runs remain.

Because nothing runs a draft, a draft can never execute. Only the published `graph` is ever snapshotted into a run. This keeps the engine changes in §5.4 small.

### 4.9 Automations list card ([AutomationCard.tsx](../apps/form-app/src/components/automations/AutomationCard.tsx))

```
[⚙]  Welcome email  [Active]  [● Unpublished changes]
     Form submission · Published v7 on 12 Oct · Edited 5 min ago by Priya
     ⚠ Last 2 runs failed
```

- Show the **Unpublished changes** chip next to the status when status ≠ DRAFT and `hasUnpublishedChanges`.
- Meta line:
  - DRAFT: `Edited {date}` (from `draftUpdatedAt ?? updatedAt`).
  - Published with no draft: `Published v{n} · {date}`.
  - Published with a draft: `Published v{n} · Edited {relative} by {name}`.
- Remove the **Test** button (and its no-responses tooltip) from the card actions, so only the ⋮ menu is left.
- Menu changes:
  - **Activate** on a DRAFT automation publishes and activates it (`publishAutomation(activate: true)`). If there are issues, show the error toast "Open the builder to fix N issues" with an **Open** action.
  - **Resume** on a PAUSED automation with P resumes the **published** version and doesn't publish the draft. The menu label says this: "Resume (v7)", with helper text "Unpublished changes aren't included".
  - Add **Publish changes** when P (and issues = 0, from the stored `draftIssueCount`) and **Discard changes** when P.
  - **Duplicate** copies what the author sees: `draftGraph ?? graph`.
- Rename: unchanged.

### 4.10 Read-only viewers

Viewers see the **published** graph, because that is what runs. If a draft exists, show a muted note: "An editor has unpublished changes to this automation."

### 4.11 Accessibility and i18n

- The save status is announced politely. Publish, Discard, and conflicts are announced through toasts and the banner (`role="alert"` for conflict and error).
- The issues popover is keyboard reachable, and items are buttons that move focus to the node panel.
- Every string is in `automations.json` for both **en** and **ta** (§7).

---

## 5. Backend design

### 5.1 Prisma (`Automation` model)

The `graph` and `triggerConfig` columns keep their meaning: they are **published / live**. This means the trigger service, engine, retry, and cron code don't need to change.

```prisma
model Automation {
  // ...existing fields; `graph`, `triggerConfig` and `version` now mean the PUBLISHED graph,
  // trigger config and version

  /// Autosaved working copy. Null means no unpublished changes (the editor starts from `graph`).
  draftGraph         Json?
  /// Draft schedule config. Null means it equals `triggerConfig`.
  draftTriggerConfig Json?
  /// Incremented on every accepted draft save. Used for optimistic concurrency (baseRevision).
  draftRevision      Int       @default(0)
  draftUpdatedAt     DateTime?
  draftUpdatedById   String?
  /// Validation issue count from the last draft save. Lets the list card gate "Publish" without
  /// re-validating every row.
  draftIssueCount    Int       @default(0)
  publishedAt        DateTime?
  publishedById      String?
}
```

The migration is `apps/backend/prisma/migrations/<ts>_automation_draft/migration.sql`, using `ADD COLUMN IF NOT EXISTS` for each column (per CLAUDE.md). No backfill is needed: `draftGraph = null` already means "no unpublished changes". For existing ACTIVE or PAUSED rows, `publishedAt` can be backfilled from `updatedAt` so the "Published on" text isn't blank.

### 5.2 GraphQL schema ([schema.ts](../apps/backend/src/graphql/schema.ts))

```graphql
type Automation {
  # ...existing
  draftGraph: JSON
  draftTriggerConfig: JSON
  draftRevision: Int!
  draftUpdatedAt: String
  draftUpdatedBy: AutomationEditor   # { id, name }, resolved from draftUpdatedById; null if unknown
  draftIssueCount: Int!
  hasUnpublishedChanges: Boolean!
  publishedAt: String
  publishedBy: AutomationEditor
}

type AutomationDraftSaveResult {
  automation: Automation!
  """Non-blocking: issues that would currently prevent publishing."""
  validationErrors: [AutomationValidationError!]!
}

extend type Mutation {
  """Autosave. Never validates for publishability. Rejects with AUTOMATION_DRAFT_CONFLICT if baseRevision is stale (unless force)."""
  saveAutomationDraft(id: ID!, graph: JSON, triggerConfig: JSON, baseRevision: Int!, force: Boolean): AutomationDraftSaveResult!
  """Validates and promotes the draft to live. Increments version. Optionally activates in the same transaction."""
  publishAutomation(id: ID!, baseRevision: Int!, activate: Boolean): Automation!
  discardAutomationDraft(id: ID!): Automation!
}
```

- `updateAutomation(graph, triggerConfig)`: keep accepting it for one release for backwards compatibility, but the form-app stops sending `graph` and `triggerConfig`. Mark both args `@deprecated`. `name` is still used for rename.
- `setAutomationStatus`: unchanged. It acts on the published graph. Pause and Resume never publish implicitly. Only `publishAutomation(activate: true)` both publishes and activates.
- New error codes in `packages/types/src/graphql.ts`: `AUTOMATION_DRAFT_CONFLICT` (extensions: `draftRevision`, `draftUpdatedAt`, `draftUpdatedById`) and `AUTOMATION_DRAFT_TOO_LARGE`. Rebuild `@dculus/types` afterwards (the backend resolves `dist/`).
- Permissions: all three mutations require **EDITOR** on the form, the same as `updateAutomation`. The preview query requires EDITOR too. Viewers get `draftGraph: null` from field resolvers, so drafts don't leak to viewers.

### 5.3 Service (`automationService.ts`)

`saveAutomationDraft(automation, { graph?, triggerConfig?, baseRevision, force }, userId)`:
1. Size guard: reject a serialized graph over 512 KB with `AUTOMATION_DRAFT_TOO_LARGE`.
2. Shape guard only: `nodes` and `edges` must be arrays. **No** publishability validation.
3. Apply `carrySheetColumnsInGraph(automation.draftGraph ?? automation.graph, graph)` (the existing helper) so engine-written sheet layout survives.
4. **Normalise**: if the resulting draft deep-equals the live `graph` and `triggerConfig`, store `null`. Then `hasUnpublishedChanges` becomes false when the user undoes their way back to the live version.
5. Conditional update: `UPDATE … WHERE id = $id AND draftRevision = $baseRevision` (skip the condition when `force`). If 0 rows are updated, throw `AUTOMATION_DRAFT_CONFLICT`.
6. Run `validateAutomationGraph(draft, { pluginTypes, triggerType })`, plus `assertValidScheduleTriggerConfig` converted to issues. Persist `draftIssueCount` and return `validationErrors`.
7. Don't increment `version`, don't reschedule cron, and don't write an audit log (this is too frequent).

`publishAutomation(automation, { baseRevision, activate }, userId)`, inside one `prisma.$transaction`:
1. Check the revision (stale → `AUTOMATION_DRAFT_CONFLICT`). This guarantees the published version is the one the user saw.
2. Set `candidate = draftGraph ?? graph` and `candidateTrigger = draftTriggerConfig ?? triggerConfig`.
3. Validate fully, at the same level as activation today. Invalid → `AUTOMATION_INVALID_GRAPH` with `validationErrors`.
4. Carry engine write-backs from live into the candidate (`carrySheetColumnsInGraph(graph, candidate)`, plus node config fields written by `setNodeConfigInGraph`).
5. Write `graph = candidate` and `triggerConfig = candidateTrigger`. Increment `version` only if something changed. Clear `draftGraph` and `draftTriggerConfig`. Set `publishedAt` and `publishedById`, and `draftIssueCount = 0`.
6. If `activate`, apply the existing `setAutomationStatus('ACTIVE')` logic in the same transaction (digest watermark seeding included). If the automation is ACTIVE and it is a schedule automation, reschedule the cron after commit. Factor `setAutomationStatus` into a reusable inner function that takes a transaction client.
7. Write an AuditLog `automation.published` entry with `{ fromVersion, toVersion, activated }`.

`discardAutomationDraft`: null the draft columns, increment `draftRevision` (so other tabs see a conflict and reload), and set `draftIssueCount = 0`.

`duplicateAutomation` / `copyAutomation`: the source graph becomes `draftGraph ?? graph`.

`testAutomation`: no new behaviour. Mark the mutation `@deprecated(reason: "Test automation was removed from the UI")` in the schema, and keep the resolver for one release so old clients don't break. Remove it in the Phase 2 cleanup.

### 5.4 Engine write-back (`engine.ts` → `updateAutomationNodeConfig`)

- Runs only ever snapshot the published `graph` (§4.8), so the write to `graph` and the run snapshot stays as it is.
- Also write the same node config into `draftGraph` when a draft exists and contains that node. Otherwise the next Publish would reintroduce a stale token or spreadsheet ID.
- Add a `setNodeConfigInDraftGraph` repository function next to `setNodeConfigInGraph`. It is a no-op when `draftGraph` is null.

### 5.5 Backend tests (vitest, keep coverage ≥ 80%)

- `saveAutomationDraft`: stale revision gives a conflict, and `force` overwrites. Normalises to null when equal to live. Returns validation errors without throwing. Doesn't increment `version`. Rejects oversized graphs. Requires EDITOR.
- `publishAutomation`: invalid → `AUTOMATION_INVALID_GRAPH`, and live is untouched. Valid → `version` incremented, draft cleared. `activate: true` seeds the digest watermark and schedules cron. A stale revision gives a conflict. Engine-written sheet config survives.
- `discardAutomationDraft`: clears the draft and increments the revision.
- Engine write-back: a live run updates both `graph` and, if present, `draftGraph`. With no draft, `draftGraph` stays null.
- Existing `testAutomation` tests stay until the resolver is removed in Phase 2.
- Resolver auth: a VIEWER can't save, publish, or discard, and gets `draftGraph: null`.

---

## 6. Frontend design

### 6.1 Store ([automationBuilderSlice.ts](../apps/form-app/src/store/slices/automationBuilderSlice.ts))

Replace the boolean `isDirty` with explicit sync state:

```ts
type SaveState = 'saved' | 'pending' | 'saving' | 'offline' | 'error' | 'conflict';

interface AutomationBuilderState {
  // ...
  /** Monotonic local edit counter; incremented by every graph/trigger mutation. */
  localRevision: number;
  /** localRevision value last acknowledged by the server. */
  syncedLocalRevision: number;
  /** Server draftRevision this client last saw; sent as baseRevision. */
  serverDraftRevision: number;
  saveState: SaveState;
  lastSavedAt: number | null;
  hasUnpublishedChanges: boolean;
  draftIssues: ValidationErrorEntry[];        // from the last save response, shown inline and in the pill
  // derived: hasUnsyncedChanges = localRevision !== syncedLocalRevision
}
```

- `insertStepOnEdge`, `updateNodeData`, `removeNode`, and `setTriggerConfig` increment `localRevision` and set `saveState: 'pending'`. They keep mirroring to sessionStorage, now as `{ graph, triggerConfig, baseRevision, localRevision }`.
- `loadGraph({ automation })` seeds from `automation.draftGraph ?? automation.graph` and `draftTriggerConfig ?? triggerConfig`. A sessionStorage draft wins **only if** its `baseRevision === automation.draftRevision`. That means it holds edits the server never received, and its `saveState` should start as `pending` so it is synced immediately. Otherwise, discard it.
- Replace `markSaved` with `ackSave({ sentLocalRevision, serverDraftRevision, issues, hasUnpublishedChanges })`. It moves `syncedLocalRevision` forward only to `sentLocalRevision`, so edits made during the request stay pending.
- `validationErrorsByNode` and `structuralErrors` are fed from `draftIssues` after each save and from publish errors.

### 6.2 `useAutomationAutosave` hook (new, `apps/form-app/src/hooks/useAutomationAutosave.ts`)

It owns all network behaviour and keeps the page component thin.

- **Debounce** 800 ms after the last change, with a **maxWait** of 5 s during continuous typing.
- **Single flight**: at most one request at a time. When it finishes, if `localRevision > sentLocalRevision`, schedule another save immediately. Coalesce; never queue one request per keystroke.
- **Retry**: network errors back off 2 s → 4 s → 8 s and then set `error`. Use `offline` while `navigator.onLine` is false, and flush on the `online` event. GraphQL errors (auth, not found, too large) set `error` with no retry. `AUTOMATION_DRAFT_CONFLICT` sets `conflict` and pauses autosave.
- Exposes `flush(): Promise<boolean>`, used by Publish, Back, OAuth Connect, and ⌘S.
- Uses `useMutation(SAVE_AUTOMATION_DRAFT)` with `fetchPolicy: 'no-cache'` on the response's `automation` fields, **except** `hasUnpublishedChanges`, `draftRevision`, and `draftUpdatedAt`, which are written to the Apollo cache. Writing the returned `draftGraph` into the cache would trigger re-renders on every keystroke. `loadedAutomationIdRef` already prevents re-loading.
- Is fully disabled when `isReadOnly`.

Unit tests (jest, form-app) use fake timers: debounce and maxWait, coalescing during flight, edits made during flight stay pending, retry and backoff, conflict pauses autosave, `flush` waits for in-flight requests, and read-only never saves.

### 6.3 Components

| File | Change |
| --- | --- |
| [AutomationBuilder.tsx](../apps/form-app/src/pages/AutomationBuilder.tsx) | Remove `handleSave`, the Save button, the dirty-disabled Activate tooltip, `window.confirm` on Back, and the unconditional `beforeunload`. Add `useAutomationAutosave`, `<SaveStatusIndicator/>`, `<IssuesPill/>`, `<UnpublishedChip/>`, `<PublishControls/>` (the §4.4 matrix), `<DraftConflictBanner/>`, and ⌘S. Back calls `await flush()` with a 3 s timeout. Extract the header into `components/automations/builder/BuilderHeader.tsx`, because the file is already large. |
| `builder/SaveStatusIndicator.tsx` (new) | Implements §4.3. |
| `builder/PublishControls.tsx` (new) | Primary and split button, Discard confirmation, publish confirmation dialog (impact computed client-side), and the issues popover when blocked. |
| `builder/DraftConflictBanner.tsx` (new) | Implements §4.7. |
| [NodeConfigPanel.tsx](../apps/form-app/src/components/automations/builder/NodeConfigPanel.tsx) | Change `submitLabelOverride` to `applyButton`. Add an unapplied-changes guard on close. This needs a `onDirtyChange` callback from `ConfigForm`, or use the form's dirty state if it is exposed; check the plugin `ConfigForm` contract first. |
| [ScheduleTriggerEditor.tsx](../apps/form-app/src/components/automations/builder/ScheduleTriggerEditor.tsx) | Remove the Save button and the `UPDATE_AUTOMATION` call. Push every valid or invalid change through `setTriggerConfig` (the draft). Show the "applies on publish" hint. |
| [AutomationCard.tsx](../apps/form-app/src/components/automations/AutomationCard.tsx) | Implements §4.9: the chip, the meta line, and the new menu items (Publish changes, Discard changes, "Resume (v7)"). Activate on DRAFT calls `publishAutomation(activate: true)`. |
| [graphql/automations.ts](../apps/form-app/src/graphql/automations.ts) | Add `SAVE_AUTOMATION_DRAFT`, `PUBLISH_AUTOMATION`, `DISCARD_AUTOMATION_DRAFT`, and `AUTOMATION_PUBLISH_PREVIEW`. Add the draft fields to `GET_AUTOMATION` and `GET_FORM_AUTOMATIONS` (list: `hasUnpublishedChanges draftUpdatedAt draftUpdatedBy { name } draftIssueCount publishedAt`, no `draftGraph`). |
| [AutomationRuns.tsx](../apps/form-app/src/pages/AutomationRuns.tsx) | Remove the Test button (`data-testid="test-automation-button"`), the `canTest` prop, and `useTestAutomation`. **Keep** the `runs.testChip` badge for historical test runs and the `?runId=` deep link, which other places also use. |
| [useTestAutomation.ts](../apps/form-app/src/hooks/useTestAutomation.ts) | Delete it. Remove `TEST_AUTOMATION` from `graphql/automations.ts`. Don't touch the plugin-system `testPlugin` usages in `components/plugins/*`; they are a separate feature. |
| [AutomationRunDetail.tsx](../apps/form-app/src/components/automations/runs/AutomationRunDetail.tsx) | No change. It keeps showing the Test chip for old runs. |

---

## 7. i18n keys (`apps/form-app/src/locales/{en,ta}/automations.json`)

**Remove** (after grepping for other usage): `builder.header.saveButton`, `saveSuccessTitle`, `saveSuccessMessage`, `activateDisabledUnsaved`, `unsavedIndicator`, `unsavedChangesConfirm`, and `builder.panel.schedule.saveButton`, `saveSuccessTitle`, `saveSuccessMessage` (if present). For Test: `card.actions.test`, `builder.header.testButton`, `builder.header.testDisabledNoResponses`, `runs.toasts.testTriggeredTitle`, `testTriggeredMessage`, `testErrorTitle`. **Keep** `runs.testChip`, because historical runs still use it.

**Add**:

| Key | en | ta |
| --- | --- | --- |
| `builder.saveStatus.saved` | Saved | சேமிக்கப்பட்டது |
| `builder.saveStatus.savedJustNow` | Saved · just now | சேமிக்கப்பட்டது · இப்போது |
| `builder.saveStatus.savedAt` | Saved at {{time}} | {{time}} மணிக்கு சேமிக்கப்பட்டது |
| `builder.saveStatus.pending` | Editing… | திருத்துகிறது… |
| `builder.saveStatus.saving` | Saving… | சேமிக்கிறது… |
| `builder.saveStatus.offline` | Offline. Changes kept on this device. | இணைப்பு இல்லை. மாற்றங்கள் இந்தச் சாதனத்தில் வைக்கப்பட்டுள்ளன. |
| `builder.saveStatus.error` | Couldn't save | சேமிக்க முடியவில்லை |
| `builder.saveStatus.retry` | Retry | மீண்டும் முயற்சி |
| `builder.saveStatus.conflict` | Edited elsewhere | வேறு இடத்தில் திருத்தப்பட்டது |
| `builder.header.unpublishedChip` | Unpublished changes | வெளியிடப்படாத மாற்றங்கள் |
| `builder.header.unpublishedTooltip` | Edited {{time}} by {{name}}. The live automation still runs v{{version}}. | {{name}} அவர்களால் {{time}} திருத்தப்பட்டது. நேரலை தானியக்கம் இன்னும் v{{version}} ஐ இயக்குகிறது. |
| `builder.header.publishButton` | Publish changes | மாற்றங்களை வெளியிடு |
| `builder.header.publishAndResumeButton` | Publish & resume | வெளியிட்டு மீண்டும் தொடங்கு |
| `builder.header.publishWithoutResume` | Publish without resuming | மீண்டும் தொடங்காமல் வெளியிடு |
| `builder.header.resumeButton` | Resume | மீண்டும் தொடங்கு |
| `builder.header.discardButton` | Discard changes | மாற்றங்களை நிராகரி |
| `builder.header.issuesPill` | {{count}} issue(s) | {{count}} சிக்கல்(கள்) |
| `builder.header.issuesBlockingTitle` | Fix {{count}} issue(s) before publishing | வெளியிடும் முன் {{count}} சிக்கல்(களை) சரிசெய்யவும் |
| `builder.header.publishedToastTitle` | Published v{{version}} | v{{version}} வெளியிடப்பட்டது |
| `builder.header.publishedToastMessage` | New runs will use this version. | புதிய இயக்கங்கள் இந்தப் பதிப்பைப் பயன்படுத்தும். |
| `builder.header.publishErrorTitle` | Couldn't publish | வெளியிட முடியவில்லை |
| `builder.header.leaveSaveFailed` | Your latest edit couldn't be saved. It's kept on this device and will sync when you return. | உங்கள் சமீபத்திய திருத்தத்தைச் சேமிக்க முடியவில்லை. அது இந்தச் சாதனத்தில் வைக்கப்பட்டு, நீங்கள் திரும்பும்போது ஒத்திசைக்கப்படும். |
| `builder.discardDialog.title` | Discard unpublished changes? | வெளியிடப்படாத மாற்றங்களை நிராகரிக்கவா? |
| `builder.discardDialog.description` | The builder will reset to the live version (v{{version}}). This can't be undone. | பில்டர் நேரலைப் பதிப்பிற்கு (v{{version}}) மீட்டமைக்கப்படும். இதைத் திரும்பப் பெற முடியாது. |
| `builder.discardDialog.confirm` | Discard | நிராகரி |
| `builder.publishDialog.title` | Publish these changes? | இந்த மாற்றங்களை வெளியிடவா? |
| `builder.publishDialog.scheduleChanged` | The schedule changes to: {{schedule}}. | அட்டவணை மாறுகிறது: {{schedule}}. |
| `builder.publishDialog.removedSteps` | These steps will stop running: {{names}} | இந்தப் படிகள் இயங்குவது நிறுத்தப்படும்: {{names}} |
| `builder.conflict.title` | This automation was edited elsewhere | இந்தத் தானியக்கம் வேறு இடத்தில் திருத்தப்பட்டது |
| `builder.conflict.description` | {{name}} saved changes {{time}}. | {{name}} {{time}} மாற்றங்களைச் சேமித்தார். |
| `builder.conflict.youInAnotherTab` | You (another tab) | நீங்கள் (வேறு தாவல்) |
| `builder.conflict.loadLatest` | Load latest | சமீபத்தியதை ஏற்று |
| `builder.conflict.keepMine` | Keep my version | என் பதிப்பை வைத்திரு |
| `builder.panel.action.applyButton` | Apply | பயன்படுத்து |
| `builder.panel.action.unappliedTitle` | Apply changes to this step? | இந்தப் படிக்கு மாற்றங்களைப் பயன்படுத்தவா? |
| `builder.panel.schedule.appliesOnPublish` | Changes are saved automatically and take effect when you publish. | மாற்றங்கள் தானாகச் சேமிக்கப்படும்; நீங்கள் வெளியிடும்போது அவை நடைமுறைக்கு வரும். |
| `builder.readOnlyDraftNotice` | An editor has unpublished changes to this automation. | ஒரு திருத்துநர் இந்தத் தானியக்கத்தில் வெளியிடப்படாத மாற்றங்களை வைத்துள்ளார். |
| `card.meta.edited` | Edited {{date}} | {{date}} திருத்தப்பட்டது |
| `card.meta.published` | Published v{{version}} · {{date}} | v{{version}} வெளியிடப்பட்டது · {{date}} |
| `card.meta.publishedEdited` | Published v{{version}} · Edited {{time}} by {{name}} | v{{version}} வெளியிடப்பட்டது · {{name}} அவர்களால் {{time}} திருத்தப்பட்டது |
| `card.actions.publish` | Publish changes | மாற்றங்களை வெளியிடு |
| `card.actions.discard` | Discard changes | மாற்றங்களை நிராகரி |
| `card.actions.resumeVersion` | Resume (v{{version}}) | மீண்டும் தொடங்கு (v{{version}}) |
| `card.actions.resumeVersionHint` | Unpublished changes aren't included | வெளியிடப்படாத மாற்றங்கள் சேர்க்கப்படவில்லை |
| `card.actions.fixIssuesToActivate` | Open the builder to fix {{count}} issue(s) | {{count}} சிக்கல்(களை) சரிசெய்ய பில்டரைத் திறக்கவும் |

A native speaker should review the Tamil before merging.

---

## 8. Edge cases

| # | Scenario | Expected |
| --- | --- | --- |
| E1 | Rapid typing in a condition value | One save at most every 800 ms (or 5 s under continuous typing). No request storm, and no older response overwriting newer local state (`ackSave` uses `sentLocalRevision`). |
| E2 | Edit made while a save is in flight | Stays `pending`. A second save is sent after the first returns. |
| E3 | Network drops mid-session | `offline`. Edits stay in the store and sessionStorage, and flush on `online`. Closing the tab triggers the browser prompt. |
| E4 | Reload with unsynced sessionStorage draft, server unchanged | Restored and synced immediately. |
| E5 | Reload with sessionStorage draft, but the server draft moved on (another tab saved) | The local copy is discarded and the server draft loads. Optionally show "Loaded the latest version". |
| E6 | Two tabs editing | The second tab's next save gets a conflict, and the banner (§4.7) appears. |
| E7 | User undoes all edits back to the live state | The server normalises the draft to null, the chip disappears, and the Publish button returns to "Pause". |
| E8 | Publish with an invalid draft | Live is untouched. The issues popover opens and nodes are highlighted. |
| E9 | Publish while a save is pending | Publish flushes first, then publishes with the new `baseRevision`. |
| E10 | ACTIVE automation edited for days without publishing | The live version keeps running. The card shows the chip so the state is visible from the list. |
| E11 | Live run auto-creates a spreadsheet while a draft exists | Written to both `graph` and `draftGraph`. The next publish keeps it. |
| E12 | A test run started before this release is still WAITING on a delay | It finishes in test mode (the engine branches are kept). Run history shows the Test chip. |
| E13 | Auto-pause after 5 failures while a draft exists | Status becomes PAUSED and the draft is preserved. The card shows "Publish & resume" so the user can ship a fix. |
| E14 | Retry a failed run after "Publish without resuming" | Retry uses the newly published graph (existing behaviour). |
| E15 | Viewer opens the builder | Sees the published graph and the "unpublished changes" note. No save traffic. |
| E16 | Session expires | Save returns an auth error, so `error` "Couldn't save". Edits stay in sessionStorage, and sign-in followed by return restores them (E4). |
| E17 | Duplicate an automation with a draft | The copy is DRAFT status, with `graph = source.draftGraph ?? source.graph`. |
| E18 | Delete an automation with a pending autosave | The pending save gets AUTOMATION_NOT_FOUND. The hook stops silently, because the user has already navigated away. |
| E19 | Sheets OAuth redirect | `flush()` runs before redirect. On return, the selection is restored as it is today. |
| E20 | Schedule changed on an ACTIVE automation | The cron isn't rescheduled until Publish. The publish dialog shows the new next-run time. |

---

## 9. Rollout plan

**Phase 1: Draft and Publish (this proposal's core)**
1. Prisma migration and `prisma generate`.
2. Error codes in `@dculus/types`, then build.
3. Service functions and resolvers, with vitest coverage (§5.5).
4. GraphQL documents and store refactor (§6.1).
5. The `useAutomationAutosave` hook and its tests.
6. Header components, NodeConfigPanel Apply, and the schedule editor change.
7. AutomationCard changes, and removing the Test button everywhere (card, builder, Runs page, `useTestAutomation`, `TEST_AUTOMATION`). Deprecate `testAutomation` in the schema.
8. i18n (en + ta).
9. E2E: update `test/e2e/features/automations-happy-path.feature`. Replace "click Save" steps with "wait for `automation-save-status` `data-state=saved`", and add scenarios for publish on ACTIVE, discard, and reload restores the draft.

**Phase 2: Polish**
- `ConfigForm.onChange` for live plugin forms, then remove Apply.
- In-memory undo and redo (⌘Z / ⇧⌘Z) for structural operations in the slice.
- Conflict pre-check on `visibilitychange`.
- Remove the deprecated `graph` and `triggerConfig` args from `updateAutomation`.
- Remove the `testAutomation` resolver, `automationService.testAutomation`, and the engine's `context.test` branches once a query confirms no `RUNNING` or `WAITING` runs have `context->>'test' = 'true'`. Keep the UI's Test chip for history.

**Phase 3: Version history (optional)**
- An `AutomationVersion` table (`automationId, version, graph, triggerConfig, publishedAt, publishedById`), written on each publish.
- A "Versions" drawer: view any published version read-only, **Restore as draft**, and compare with the draft. Runs already store `automationVersion`, so a run can deep-link to the exact version it ran.

---

## 10. Verification checklist

```bash
pnpm db:generate && pnpm db:push
pnpm --filter @dculus/types build
pnpm --filter backend test:coverage          # thresholds must hold
pnpm --filter form-app test                  # autosave hook + slice tests
pnpm type-check
pnpm --filter form-app build
pnpm test:e2e --tags '@automations'          # with :4000 / :3000 / :5173 running
```

Manual QA (browser, `localhost:3000`):
1. Create an automation, add an email step, and reload the page. The step is still there, and there is no Save button anywhere.
2. Activate it. Edit the step. The "Unpublished changes" chip appears. Submit the form: the **old** version runs.
3. Publish. The toast says "Published v2". Submit again: the new version runs.
4. Edit, then Discard. The builder resets to v2.
5. Open the same automation in two tabs, edit in both, and confirm the conflict banner appears.
6. Turn on DevTools offline, edit, and confirm "Offline…". Go back online and confirm "Saved".
7. As a VIEWER: no save traffic in the Network tab, and the published graph is shown.

---

## 11. Open questions for the reviewer

1. **Removing Test from the backend.** Phase 1 removes it only from the UI and deprecates the mutation. Should the engine's test-mode branches and the `testAutomation` resolver be removed in this milestone (once in-flight test runs have drained), or later?
2. **Card "Resume" with unpublished changes.** Should it resume the live version (proposed), or offer "Publish & resume" directly from the card?
3. **Publish confirmation.** Should it appear only for high-impact changes (proposed), or on every publish of an ACTIVE automation?
4. **Draft visibility to viewers.** Proposed: hidden. Should viewers be able to see the draft read-only?
5. **Phase 3 version history.** Is it in scope for the same milestone, or later?
