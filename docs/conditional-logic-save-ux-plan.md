# Logic editor save UX: implementation plan

Status: plan, ready to implement. Owner: implementer agent (Sonnet).
Scope: `apps/form-app` Logic tab (conditional rules) plus E2E steps. No backend changes.

Read before starting: `CLAUDE.md`, `AGENTS.md`, `.github/instructions/frontend.instructions.md`, `.github/instructions/i18n.instructions.md`, `.github/instructions/testing.instructions.md`.

---

## 0. TL;DR of the decision

**Use explicit save, with a local draft that is guarded and stashed.** This is a hybrid of options 1 and 3 in the brief, minus autosave:

- The inspector edits a **local draft**. Nothing reaches Y.js until the user clicks **Create rule** (new) or **Save changes** (existing), or presses Cmd/Ctrl+Enter.
- Every in-tab exit path (close X, Esc, Cancel, Add rule, picking a recipe, clicking another card, selecting from the health panel) is routed through **one guard**. A dirty draft opens a focus-trapped **Discard changes?** dialog. Clean and blank drafts close silently.
- Exit paths that **cannot be blocked** with `BrowserRouter`, such as builder tab switches, browser back and in-app navigation, are handled differently. The dirty draft is **stashed in `sessionStorage` per form** and **restored with a banner** when the Logic tab mounts again. Reload and tab close also show the native `beforeunload` prompt.
- **Remote changes** to the open rule are reconciled. A clean draft silently follows the live rule. A dirty draft shows a **conflict banner** with "Load their version", and Save still overwrites (last-writer-wins, which matches the slice contract and the existing E2E). If the rule is deleted, a **deleted banner** appears and the button becomes **Re-create rule**.
- Saves are **blocked while disconnected**. The draft is kept and the status line explains why. Slice writes now **return a boolean** and **no longer update local state when Y.js is not ready**. That old behavior was a silent data-loss bug.
- On a successful save the panel **closes**, focus moves to the saved card, and a polite live region announces it. **Toasts only for create and delete.**

---

## 1. Analysis

### 1.1 Problems with the current autosave (verified in code)

| # | Problem | Evidence |
|---|---------|----------|
| P1 | **Half-built rules go live to respondents.** The public viewer renders from the live Y.js doc, so every 600 ms autosave of a "complete" intermediate state immediately changes a published form's behaviour. Examples: `Country equals "U"` before "US" is finished, or "Show Q2" before the second action "Hide Q3" is added. | `apps/backend/src/graphql/resolvers/forms.ts` → `formSchemaPublic` calls `getFormSchemaFromHocuspocus(formId)`. Responses validation does the same (`responses.ts:388,617,725`). |
| P2 | **Collaborator noise.** Collaborators see rules appear and mutate keystroke by keystroke. Their own open editor for the same rule gets a stale `initialRule`. | `RuleInspector` autosave effect, `conditionsSlice.updateCondition` (delete+insert per save). |
| P3 | **Silent data loss when offline.** `withConditionsArray` no-ops when `!_isYJSReady()` (`ydoc && isConnected`), but `addCondition`, `updateCondition` and `removeCondition` still `set()` local state. The UI shows "All changes saved", then the next Y.js sync overwrites local state and the rule vanishes. | `conditionsSlice.ts` lines 26–33 and 51–80. `collaborationSlice._isYJSReady`. |
| P4 | **The Logic tab doesn't know the connection state.** `ConditionsTab` never reads `isConnected` (unlike `JourneyRail`), so cards, toggles, delete, AI accept and autosave all "succeed" offline. | `ConditionsTab.tsx`. `rail/JourneyRail.tsx:28`. |
| P5 | **Duplicate local entries.** `addCondition` appends locally even if the id already exists, for example through the autosave upsert race or an AI suggestion carrying an existing rule id. The Y.js side dedupes, so local state and Y.js disagree. | `conditionsSlice.addCondition`. `applyAIOp.ts` `PROPOSE_CONDITION_RULE` uses `toolCallId ?? rule.id`. |
| P6 | **No undo or revert.** Every autosave is the new truth, and there is no "discard my edits" for an existing rule. Y.js has no per-user undo wired for conditions. | The `RuleInspector` footer has only Done. |
| P7 | **Fragile create→edit promotion** (nonce juggling, `isNewRule` captured in `flush`, flush on unmount, flush on `beforeunload`). Under StrictMode the fake unmount runs `flush()`. Deleting the open rule from a card can race a pending flush, although the upsert guard mostly prevents resurrection. | `ConditionsTab.handleSave`. `RuleInspector` flush effects. |
| P8 | **Tab switch, back and reload.** A complete draft is flushed on unmount (live write, see P1). An incomplete draft is **silently dropped**, because the discard confirm only covers the X button. | `RuleInspector` unmount cleanup, `requestClose`. |
| P9 | **Confirm dialog accessibility.** `ConfirmationDialog` is a plain `div` with no `role="dialog"`, focus trap or Esc handling. `@dculus/ui`'s `AlertDialog` is also custom and non-Radix. Only `@dculus/ui` `Dialog` is Radix-based. | `form-builder/ConfirmationDialog.tsx`, `packages/ui/src/alert-dialog.tsx`, `packages/ui/src/dialog.tsx`. |
| P10 | **Cleanup can drop unknown actions.** `cleanupRuleReferences` keeps a non-`fieldIds` action only if `livePageIds.has(action.pageId)`, so an unknown future action shape without `pageId` is dropped. | `hooks/useLogicHealth.ts:89-96`. |

### 1.2 Options considered

| Option | Collaborator noise | Live-form safety (P1) | Undo/revert | Discoverability | Verdict |
|---|---|---|---|---|---|
| **Current: autosave everything** | High | ❌ Intermediate states go live | ❌ None | Good ("Saved" text) | Rejected. P1 is a correctness bug for published forms. |
| **1. Explicit Save + guard on every exit** | None until Save | ✅ | ✅ Discard/revert | Good if the footer is always visible | **Base of the choice.** Unblockable route changes still need handling, though. |
| **2. Autosave existing rules, explicit Create for new** | Medium | ❌ Edits to a live rule still leak mid-edit (P1) | ❌ | Mixed: two mental models in one panel | Rejected. It fixes only creation and is inconsistent. |
| **3. Local draft + explicit Apply + "Saved" confirmation** | None | ✅ | ✅ | Good | Same as 1 in practice. Its "Saved" confirmation is adopted. |
| **4. Hybrid (chosen): 1 + 3 + sessionStorage stash + remote reconciliation + offline gating** | None | ✅ | ✅ Revert in edit mode, discard dialog | Good: always-visible status, Cmd/Ctrl+Enter, restored-draft banner | **Chosen** |

Why not keep autosave for consistency with the Content tab's field settings (`useFieldEditor`)? A field setting is a single independent property: each intermediate value is meaningful and harmless. A rule is a **compound statement** whose meaning depends on all rows together. "Valid" (`canSave`) is not the same as "intended". Only the author knows when the sentence is finished, and the live sentence preview exists precisely so the author can read it back *before* committing.

Why close the panel after Save, rather than keeping it open? It gives a single clear "done" moment, removes the create→edit promotion and post-save re-baselining (P7), and makes the saved card the confirmation. Re-opening is one click away.

Why no "saving…" state? The Y.js write is synchronous and local. Network propagation is the connection indicator's job. The save states we surface are: idle/clean, dirty, incomplete, invalid (after an attempt), offline (blocked), error (write rejected), conflict, deleted and read-only. "Saved" is shown by the panel closing, focus moving to the card, a live-region announcement, and a toast for creation.

---

## 2. Target behaviour spec

### 2.1 Inspector modes and states

```
InspectorState (ConditionsTab):
  { mode: 'closed' }
  { mode: 'create', draftId: string, seed: RuleDraftSeed | null, restored?: LogicDraftStash }
  { mode: 'edit',   ruleId: string,                                restored?: LogicDraftStash }
```

- `edit` stores only `ruleId`. The inspector receives `liveRule = conditions.find(id)` on every render, which may be `undefined` if the rule was deleted. There is no stale snapshot prop.
- `RuleInspector` key: `create:${draftId}` or `edit:${ruleId}`. Re-clicking the open card is a no-op (same target, so no guard and no remount).

Inside the inspector:

- `draft` is `{ terms, actions, combinator }` (local `useState`).
- `base` is `{ signature, enabled, preserved }`, the version the draft is compared against:
  - **edit:** from `liveRule` at open, or from `restored` when restoring.
  - **create:** the signature of the initial draft (blank or recipe seed), with `enabled: true` and `preserved: []`.
- `isDirty = draftSignature(draft) !== base.signature`.
  - A blank or unedited recipe-seeded draft is **not dirty**, so it closes silently and nothing is persisted.
- `issues = getDraftIssues(draft, ...)` and `isComplete = issues.count === 0`.
- `remote = reconcileWithLive(...)` returns one of `'in-sync' | 'rebase' | 'conflict' | 'deleted'` (create mode is always `'in-sync'`).
- `status = deriveSaveStatus(...)` drives the footer line.

### 2.2 Footer (always visible, fixed)

Layout: a status line on its own row, then a button row with `flex flex-wrap justify-end gap-2`, so it works at 280 px.

| Mode | Left button | Primary button (`data-testid="condition-save"`) |
|---|---|---|
| create | **Cancel** (`condition-cancel`) → guarded close | **Create rule** |
| edit | **Discard changes** (`condition-revert`). `disabled` when not dirty. Reverts the draft to `base` in place, without a confirm. | **Save changes** |
| edit + `remote==='deleted'` | **Discard changes** → closes (no guard, the user chose it) | **Re-create rule** |
| read-only (`!canEdit`) | (no buttons) | (none) |

The primary button is **never `disabled`**, which keeps the E2E `toBeEnabled()` checks valid. Instead it uses `aria-disabled` plus muted styling when it would no-op:
- edit + clean → no-op;
- offline → no-op;
- incomplete → reveals the row errors and focuses the first failing row.

Status line: `data-testid="condition-save-status"`, `data-state={status}`, `role="status"`, `aria-live="polite"`. It replaces `condition-autosave-status`, which no E2E step references.

| `status` | When | Text key | Tone/icon |
|---|---|---|---|
| `readOnly` | `!canEdit` | `editor.status.readOnly` | muted, `Eye` |
| `offline` | `!isConnected` (and canEdit) | `editor.status.offline` | amber, `CloudOff` |
| `error` | last commit returned `failed` | `editor.status.error` | red, `AlertCircle` |
| `deleted` | `remote==='deleted'` | `editor.status.deleted` | amber |
| `conflict` | `remote==='conflict'` | `editor.status.conflict` | amber |
| `createIdle` | create & !dirty | `editor.status.createIdle` | muted |
| `clean` | edit & !dirty | `editor.status.clean` | muted, `Check` |
| `invalid` | !complete & showErrors | `editor.status.invalid` | amber, `AlertCircle` |
| `incomplete` | !complete & !showErrors | `editor.status.incomplete` | muted |
| `dirty` | complete & dirty | `editor.status.dirty` | muted, dot |

The priority order is the row order above. Put it in the pure `deriveSaveStatus` function and unit test it.

### 2.3 Banners (top of the inspector body, above "If…")

All banners use `text-xs`, wrap, and have dark mode variants. Use a small local `InspectorBanner` component inside `RuleInspector.tsx`, not a new file.

| Banner | testid | When | Actions |
|---|---|---|---|
| Restored draft | `condition-restored-banner` | `restored` provided and not yet dismissed | **Discard** (`condition-restored-discard`) → `onDiscard()` (closes with no guard and clears the stash). The ✕ just hides the banner. |
| Conflict | `condition-conflict-banner` | `remote==='conflict'` | **Load their version** (`condition-load-theirs`) → rebases to live. The message explains that Save replaces their version. |
| Deleted | `condition-deleted-banner` | `remote==='deleted'` | (the footer handles it: Re-create / Discard) |
| Broken references | `condition-broken-refs-banner` | `checkRuleReferences(draftAsRule, pages)` has missing term fields, action fields or action pages | **Remove broken references** (`condition-remove-broken-refs`) → `cleanupDraftReferences` applied **to the draft only**, not saved |
| Lost edit access | `condition-readonly-banner` | `!canEdit && (isDirty \|\| restored)` | (none) |

### 2.4 Exit paths

| Exit path | Handling |
|---|---|
| ✕ / Esc / Cancel | `onRequestClose()` → `ConditionsTab.requestInspector({mode:'closed'})` → guard |
| Add rule, recipe pick, card click/edit, health panel select | `requestInspector(next)` → guard |
| Card delete of the open rule | The delete confirm *is* the explicit decision: on confirm, close the inspector without a guard and clear the stash |
| Builder tab switch (route change, Cmd+1/2/3), browser back, in-app navigation away | Unblockable (`BrowserRouter`, no `useBlocker`). The dirty draft is already in `sessionStorage`. On the next Logic tab mount it is restored with the restored banner. |
| Reload / tab close | `beforeunload` prompt while dirty (skipped if `isIntentionalNavigationPending()`). After a reload, the stash restores the draft. |

Guard: if `dirtyRef.current`, set `pendingTransition = next` and open the discard dialog. **Confirm** clears the stash, resets the dirty state and applies `next`. **Keep editing** or Esc clears `pendingTransition`.

The discard dialog message differs by completeness:
- **Incomplete:** `editor.discardMessageIncomplete`, which says the rule is incomplete and so hasn't been saved. This tells the user why nothing was persisted.
- **Complete:** `editor.discardMessage`, which says the changes haven't been saved.

### 2.5 Keyboard and focus

- **Cmd/Ctrl+Enter** anywhere inside the inspector → `handleSave()`. Ignore it when `e.nativeEvent.isComposing` is set (IME).
- **Plain Enter is not hijacked.** It keeps its native meaning: opening a Select, toggling a checkbox, or newline/no-op in inputs. Submitting on Enter inside a value input would commit half-typed values, which is the same problem as P1.
- **Esc** → `onRequestClose()`. This applies only when `rootRef.current.contains(e.target)` and no dialog is open. Radix Select and Popover content is portalled outside the inspector DOM, so an Esc that closes a dropdown never also closes the panel.
- **On open:**
  - create → focus `condition-term-field-0`;
  - edit → focus the panel heading (`tabIndex={-1}`, `id` for `aria-labelledby` on the panel `region`);
  - restored → focus the restored banner.
- **On a failed save attempt (incomplete):** set `showErrors=true`, then focus the first interactive element in the first row with `data-issue="true"`.
- **After a successful save:** the inspector closes. `ConditionsTab` scrolls to and focuses `condition-edit-${id}`. If that card is filtered out, it focuses `condition-add-rule`. It also sets the live-region text.
- **After any other close:** restore focus to the element that opened the inspector (`returnFocusRef`), if it is still in the document. Otherwise focus `condition-add-rule`.
- **Discard dialog:** built on `@dculus/ui` **`Dialog`**, which is Radix-based (focus trap, Esc, `role="dialog"`). The initial focus is the **Keep editing** button (safe default, via `onOpenAutoFocus` + ref). `@dculus/ui`'s `AlertDialog` is custom and has no focus trap, so don't use it.

### 2.6 Validation timing

- While composing, row errors are hidden and the status line says `incomplete` (neutral).
- After the first save attempt (`showErrors = true`), row errors show and update live, and the status is `invalid` (amber).
- An **existing** rule that opens already invalid (for example with deleted references) starts with `showErrors = true`, because the problem pre-exists and is not the user's mid-composition state.
- Stale option values stay **warn-only**, as today: the Select already shows "(no longer an option)". They don't block save.

### 2.7 Toasts and announcements

- **Toast** on create (`toast.ruleCreated`) and delete (`toast.ruleDeleted`, existing). Keep the existing duplicate and cleanup toasts unchanged.
- **No toast** for saving edits. Use the live-region announcement `announce.ruleSaved` and focus on the card instead.
- No toast for offline or blocked states; the status line covers them.

### 2.8 Connection and permissions

- `ConditionsTab` reads `isConnected = useFormBuilderStore((s) => s.isConnected)` and `canWrite = canEdit && isConnected`.
- While offline, the following are disabled with the title `editor.status.reconnectToEdit`:
  - card toggle, duplicate and delete, through a new optional `writeDisabled` prop on `ConditionRuleCard`;
  - bulk toggle;
  - AI suggestion Accept;
  - health-panel cleanup (pass `canEdit={canWrite}` to `LogicHealthPanel`).
- Composing still works offline. Only committing is blocked.
- Read-only users can't open the inspector (cards aren't clickable), so they see no edit controls and nothing is ever written. If `canEdit` flips to false mid-edit (refetch), the inspector hides its footer actions and shows the lost-access banner. The stash is kept, not cleared, in case access returns.

---

## 3. Implementation steps (in order)

Keep changes focused. Don't refactor unrelated code. Backend is untouched.

### Step 1: Pure draft logic module

**New file:** `apps/form-app/src/components/form-builder/conditions/ruleDraft.ts`

**Move verbatim** from `RuleInspector.tsx` (and delete them there):
- `EditorActionType`, `EditorAction`, `ACTION_TYPES`, `isFiniteNumeric`, `emptyTerm`, `emptyAction`, `preservedActions`, `toEditorActions`, `RuleDraftSeed`, `RuleDraft`, `initialDraftFor`.

Update the `RuleDraftSeed` imports in `ConditionsTab.tsx` and `RecipeGallery.tsx` to `./ruleDraft`.

**Add:**

```ts
/** Key-order independent, so AI-authored or remote rules with different JSON key order compare equal. */
export const draftSignature = (d: RuleDraft): string =>
  JSON.stringify({
    c: d.combinator,
    t: d.terms.map((x) => [x.fieldId, x.operator, x.value ?? null]),
    a: d.actions.map((x) => [x.type, [...x.fieldIds], x.pageId]),
  });

export const ruleSignature = (rule: ConditionalRule): string =>
  draftSignature(initialDraftFor(rule));

export type TermIssue = 'selectField' | 'selectOperator' | 'enterNumber' | 'enterValue';
export type ActionIssue = 'selectPage' | 'selectTarget' | 'missingPage' | 'missingTarget';
export interface DraftIssues {
  terms: (TermIssue | null)[];
  actions: (ActionIssue | null)[];
  noTerms: boolean;
  noActions: boolean;     // actions.length + preservedCount === 0
  count: number;          // total blocking issues
}
export interface DraftIssueContext {
  /** From getTriggerFieldOptions(pages) — same map the inspector already builds. */
  triggerFieldById: Map<string, { type: FieldType; options?: string[] }>;
  /** All field ids present in `pages` (same notion as checkRuleReferences). */
  existingFieldIds: Set<string>;
  existingPageIds: Set<string>;
  preservedCount: number;
}
export const getDraftIssues = (draft: RuleDraft, ctx: DraftIssueContext): DraftIssues
```

Rules for `getDraftIssues`:
- **Term issues:** exactly the current `termError` logic, returning a code instead of a translated string.
- **Page actions** (`hidePage`/`skipToPage`): `pageId === ''` → `selectPage`; a page not in `existingPageIds` → `missingPage`.
- **Field actions:** empty → `selectTarget`; any id not in `existingFieldIds` → `missingTarget`.
- **`count`:** number of non-null issues, plus `noTerms`, plus `noActions`.

```ts
export type RemoteState = 'in-sync' | 'rebase' | 'conflict' | 'deleted';
export const reconcileWithLive = (args: {
  mode: 'create' | 'edit';
  baseSignature: string;
  draftSignature: string;
  liveRule: ConditionalRule | undefined;
}): RemoteState
```

Rules for `reconcileWithLive`, applied in order:
1. `mode === 'create'` → `'in-sync'`.
2. `!liveRule` → `'deleted'`.
3. `liveSig === baseSignature` → `'in-sync'`.
4. `liveSig === draftSignature` → `'rebase'` (both sides made the same change, so adopt it as clean).
5. `draftSignature === baseSignature` (clean) → `'rebase'`.
6. Otherwise → `'conflict'`.

```ts
export type CommitIntent = 'create' | 'update' | 'recreate';
export type CommitPlan =
  | { kind: 'add'; rule: ConditionalRule }
  | { kind: 'update'; rule: ConditionalRule }
  | { kind: 'blocked'; reason: 'deleted' };
export const planCommit = (args: {
  intent: CommitIntent;
  ruleId: string;
  draft: RuleDraft;
  baseEnabled: boolean;
  basePreserved: ConditionAction[];
  liveRules: ConditionalRule[];
}): CommitPlan
```

Rules for `planCommit`:
- `editorActions` = draft actions mapped exactly like the current `draftRule.actions`. Terms are deep-cloned.
- `live = liveRules.find(r => r.id === ruleId)`.
- **`update`:**
  - `!live` → `blocked/deleted`. This is the delete race: never resurrect.
  - Otherwise `update` with `enabled: live.enabled` (the card toggle wins) and `actions: [...editorActions, ...preservedActions(live)]`. Preserved actions come from the **live** rule, so they are never dropped or stale.
- **`create` / `recreate`:**
  - `live` exists (double-submit or id collision) → `update` as above. This makes the commit idempotent with no duplicates.
  - Otherwise `add` with `enabled: baseEnabled`, `actions: [...editorActions, ...basePreserved]`.

```ts
/** Strips references to deleted fields/pages from the draft only; preserved actions are untouched. */
export const cleanupDraftReferences = (
  draft: RuleDraft,
  ctx: { existingFieldIds: Set<string>; existingPageIds: Set<string>; preservedCount: number }
): { draft: RuleDraft; removed: number }
```

Rules for `cleanupDraftReferences`:
- Filter out terms whose `fieldId` is missing. Keep blank in-progress terms (`fieldId === ''`). If none are left, use `[emptyTerm()]`.
- Filter missing ids out of field actions. Drop page actions whose page is missing. Keep blank in-progress rows.
- If no actions are left and `preservedCount === 0`, use `[emptyAction()]`.

```ts
export type SaveStatus =
  | 'readOnly' | 'offline' | 'error' | 'deleted' | 'conflict'
  | 'createIdle' | 'clean' | 'invalid' | 'incomplete' | 'dirty';
export const deriveSaveStatus = (args: {
  canEdit: boolean; isConnected: boolean; mode: 'create' | 'edit';
  isDirty: boolean; isComplete: boolean; showErrors: boolean;
  remote: RemoteState; writeFailed: boolean;
}): SaveStatus   // priority per §2.2 table
```

Keep the module free of React and `t`, so it is fully jest-testable.

### Step 2: Draft stash module

**New file:** `apps/form-app/src/components/form-builder/conditions/logicDraftStorage.ts`

Follow the safe-access pattern in `components/automations/builder/draftStorage.ts` (try/catch around every `sessionStorage` call). Treat stored data as **untrusted**: validate it with zod and enforce size caps.

```ts
export interface LogicDraftStash {
  v: 1;
  mode: 'create' | 'edit';
  ruleId: string;            // draftId for create
  baseSignature: string;
  baseEnabled: boolean;
  basePreserved: ConditionAction[];
  draft: RuleDraft;
  savedAt: number;
}
const key = (formId: string) => `dculus:logic-draft:${formId}`;
export function writeLogicDraft(formId: string, stash: LogicDraftStash): void;
export function readLogicDraft(formId: string): LogicDraftStash | null;  // invalid → remove + null
export function clearLogicDraft(formId: string): void;
```

Zod schema:
- `raw.length <= 200_000` before parsing;
- `terms` and `actions` `.max(50)`;
- `fieldIds` `.max(500)`;
- `type` is `z.enum(ACTION_TYPES)`;
- `operator` is `z.string()`, cast to `ConditionOperator` (an unknown operator surfaces as a `selectOperator` issue);
- `basePreserved` is `z.array(z.record(z.unknown())).max(20)`;
- `ruleId` is `z.string().min(1).max(200)`.

### Step 3: Make slice writes honest

File: `apps/form-app/src/store/slices/conditionsSlice.ts`, plus `apps/form-app/src/store/types/store.types.ts` (lines ~166–169).

- `withConditionsArray(mutate)` returns `boolean`: `false` when not ready, `true` after `transact`.
- `addCondition(rule): boolean`:
  1. Write to Y.js first.
  2. If the write didn't happen, return `false` and **don't touch local state**.
  3. Otherwise set local state with a **dedupe by id**, and return `true`.
- `updateCondition(id, rule): boolean`:
  1. Use a local `let found = false` inside the mutate.
  2. Update local state only if it was written and `found`.
  3. Return `written && found`.
- `removeCondition(id): boolean`: same pattern.
- `setConditionEnabled(id, enabled): boolean`: returns the `updateCondition` result.
- Update the doc comment that currently says "local state still updates so the UI stays responsive". It is wrong and causes P3.
- Change the `ConditionsSlice` type signatures from `=> void` to `=> boolean`.

### Step 4: Fix cleanup dropping unknown actions (P10)

File: `apps/form-app/src/hooks/useLogicHealth.ts` → `cleanupRuleReferences`. Change the action filter:

```ts
.filter((action) => {
  if ('fieldIds' in action) return action.fieldIds.length > 0;
  // Unknown action shapes from newer clients are preserved untouched.
  return typeof (action as { pageId?: unknown }).pageId === 'string'
    ? livePageIds.has((action as { pageId: string }).pageId)
    : true;
})
```

### Step 5: Rewrite RuleInspector save model

File: `conditions/RuleInspector.tsx`. Keep all of the following as is: term/action rendering, pickers, the sentence preview, `renderValueInput`, and existing testids.

**Remove:**
- `AUTOSAVE_DELAY_MS`;
- `pendingRef`, `flush` and `savedSignature`;
- the autosave effect;
- the `beforeunload` flush effect;
- `hasUnsavedIncomplete`, `handleDone` and the local `ConfirmationDialog`.

**New props:**

```ts
interface RuleInspectorProps {
  pages: FormPage[];
  mode: 'create' | 'edit';
  ruleId: string;                                  // draftId when creating
  liveRule: ConditionalRule | undefined;           // edit: current store version
  seed?: RuleDraftSeed | null;
  restored?: LogicDraftStash;
  canEdit: boolean;
  isConnected: boolean;
  onCommit: (payload: {
    intent: CommitIntent; ruleId: string; draft: RuleDraft;
    baseEnabled: boolean; basePreserved: ConditionAction[];
  }) => 'ok' | 'deleted' | 'failed';
  onRequestClose: () => void;      // guarded by ConditionsTab
  onDiscard: () => void;           // unguarded close + clear stash (restored banner / deleted "Discard")
  onDraftChange: (state: { stash: LogicDraftStash | null; isComplete: boolean }) => void;
}
```

**State (initialisers must be pure for StrictMode):**
- `initial = restored?.draft ?? initialDraftFor(mode === 'edit' ? liveRule ?? null : null, seed)`. If an edit has no `liveRule` and no `restored`, `ConditionsTab` never opens it.
- `base` (`useState`):
  - from `restored` → `{ signature: restored.baseSignature, enabled: restored.baseEnabled, preserved: restored.basePreserved }`;
  - else edit → `{ signature: ruleSignature(liveRule), enabled: liveRule.enabled, preserved: preservedActions(liveRule) }`;
  - else create → `{ signature: draftSignature(initial), enabled: true, preserved: [] }`.
- Keep `terms`, `actions` and `combinator` states, and add `applyDraft(d: RuleDraft)` that sets all three.
- `showErrors`: initially `mode === 'edit' && !restored && issues(initial).count > 0`.
- `writeFailed`, `restoredDismissed`, and `committingRef`.

**Derived values:**
- `signature`, `isDirty`;
- `issues` via `getDraftIssues`. Build `existingFieldIds` and `existingPageIds` from `pages` with `useMemo`, and set `preservedCount = base.preserved.length`;
- `isComplete`, `remote`, `status`;
- `brokenRefs = checkRuleReferences(draftAsRule, pages)`.

**Translated row errors:**
- `termErrors[i] = issue ? t(\`editor.errors.${issue}\`) : null`, and likewise for actions.
- Add `data-issue={showErrors && issue ? 'true' : undefined}` on each row wrapper.

**Effects:**
1. **Rebase:**
   ```ts
   useEffect(() => {
     if (committingRef.current || remote !== 'rebase' || !liveRule) return;
     applyDraft(initialDraftFor(liveRule));
     setBase({ signature: ruleSignature(liveRule), enabled: liveRule.enabled, preserved: preservedActions(liveRule) });
   }, [remote, liveRule]);
   ```
2. **Report the draft upward.** Use a ref for the callback. Run it on `[signature, isDirty, isComplete, base, canEdit, mode, ruleId]`:
   ```ts
   onDraftChangeRef.current({
     stash: canEdit && isDirty ? { v: 1, mode, ruleId, baseSignature: base.signature, baseEnabled: base.enabled,
       basePreserved: base.preserved, draft: { terms, actions, combinator }, savedAt: Date.now() } : null,
     isComplete,
   });
   ```
   **Don't** call `onDraftChange(null)` on unmount. Unmounting on a tab switch must keep the stash.
3. **Initial focus** on mount, per §2.5.

**`handleSave`:**

```ts
if (!canEdit || committingRef.current) return;
const intent: CommitIntent = remote === 'deleted' ? 'recreate' : mode === 'create' ? 'create' : 'update';
if (intent === 'update' && !isDirty) return;
if (!isComplete) { setShowErrors(true); focusFirstIssue(); return; }
if (!isConnected) return;                           // status already 'offline'
committingRef.current = true;
const result = onCommit({ intent, ruleId, draft: { terms, actions, combinator },
  baseEnabled: base.enabled, basePreserved: base.preserved });
if (result !== 'ok') { committingRef.current = false; if (result === 'failed') setWriteFailed(true); }
```

Clear `writeFailed` whenever `isConnected` becomes true or the draft changes.

**Other handlers:**
- **Revert (edit):** `applyDraft(initialDraftFor(liveRule ?? null))`. When live exists, also set `base` from live; then `setShowErrors(false)`.
- **Load theirs:** the same as revert.
- **Remove broken refs:** apply `cleanupDraftReferences(...)` with `applyDraft(result.draft)`. If the result is still incomplete, set `setShowErrors(true)`.

**Keyboard and structure:**
- `onKeyDown` on the root (`ref={rootRef}`), with `role="region"` and `aria-labelledby={headingId}`. Behaviour per §2.5.
- Header ✕: `onClick={onRequestClose}`. Keep `data-testid="condition-inspector-close"` and `aria-label={t('editor.close')}`.
- Footer per §2.2 and banners per §2.3.
- Read-only: render the status line only, with no buttons.

### Step 6: ConditionsTab orchestration

File: `conditions/ConditionsTab.tsx`.

1. Get `formId` from `useParams<{ formId: string }>()`, which is already in route context. Get `isConnected` from the store selector, and compute `canWrite`.
2. Replace the `InspectorState` type per §2.1. Initialise it purely:
   ```ts
   const [inspector, setInspector] = useState<InspectorState>(() => {
     const stash = formId ? readLogicDraft(formId) : null;
     if (!stash) return { mode: 'closed' };
     return stash.mode === 'edit'
       ? { mode: 'edit', ruleId: stash.ruleId, restored: stash }
       : { mode: 'create', draftId: stash.ruleId, seed: null, restored: stash };
   });
   ```
   A restored edit whose rule is gone still opens: the inspector shows the deleted banner with Re-create or Discard. This requires that `RuleInspector` tolerates `liveRule === undefined` when `restored` is set.
3. Track dirty state with both a state and a ref: `dirtyRef`, `[inspectorDirty, setInspectorDirty]`, `draftCompleteRef`, `[pendingTransition, setPendingTransition]`, `returnFocusRef`, `[announcement, setAnnouncement]` and `focusAfterSaveRef`.
4. `handleDraftChange({ stash, isComplete })`:
   - set `dirtyRef.current = !!stash`;
   - call `setInspectorDirty(!!stash)` and set `draftCompleteRef.current = isComplete`;
   - if `formId`, call `stash ? writeLogicDraft(formId, stash) : clearLogicDraft(formId)`.
5. `resetDraftTracking()`: `dirtyRef.current = false`, `setInspectorDirty(false)`, `clearLogicDraft(formId)`.
6. `requestInspector(next)`:
   - same target (both `edit` with the same `ruleId`, or both `closed`) → return;
   - `dirtyRef.current` → `setPendingTransition(next)`;
   - otherwise → `openInspector(next)`.

   `openInspector(next)` records `returnFocusRef` when it opens from `closed`, then calls `setInspector(next)`. If `next.mode === 'closed'`, call `resetDraftTracking()` too. A clean draft can still have a leftover stash from a previous dirty state; effect 2 already cleared it, so this is just defensive.
7. Wire all entry points:
   - `onAddRule` → `requestInspector({ mode: 'create', draftId: generateId(), seed: null })`;
   - `RecipeGallery.onPick` → `requestInspector({ mode: 'create', draftId: generateId(), seed })`;
   - card `onEdit` → `requestInspector({ mode: 'edit', ruleId: rule.id })`;
   - `selectRuleById` → `requestInspector({ mode: 'edit', ruleId })`.
8. `handleCommit(payload)`:
   ```ts
   const plan = planCommit({ ...payload, liveRules: useFormBuilderStore.getState().conditions });
   if (plan.kind === 'blocked') return 'deleted';
   const ok = plan.kind === 'add' ? addCondition(plan.rule) : updateCondition(plan.rule.id, plan.rule);
   if (!ok) return useFormBuilderStore.getState().isConnected ? 'deleted' : 'failed';
   resetDraftTracking();
   setInspector({ mode: 'closed' });
   focusAfterSaveRef.current = plan.rule.id;
   if (payload.intent === 'update') setAnnouncement(t('announce.ruleSaved'));
   else toastSuccess(t('toast.ruleCreated'));
   return 'ok';
   ```
9. Focus effect when `inspector.mode === 'closed'`:
   - if `focusAfterSaveRef.current` is set → `scrollIntoView({ block: 'nearest' })` + `focus()` on `[data-testid="condition-edit-${id}"]`, falling back to `condition-add-rule`, then clear the ref;
   - otherwise → focus `returnFocusRef.current` if it is still `document.contains`, falling back to `condition-add-rule`.

   Run this only on transitions from open to closed: track the previous mode in a ref so it doesn't fire on mount.
10. `confirmDelete`:
    1. `const ok = removeCondition(id)`. If not ok, call `toastError(t('toast.offlineTitle'), t('editor.status.offline'))` and return.
    2. If the inspector is in edit mode on that id, call `resetDraftTracking()` and close it with no guard.
    3. Show the existing toast.
11. AI accept:
    ```ts
    const accepted = acceptConditionSuggestion(id);
    if (!accepted) return;
    const exists = useFormBuilderStore.getState().conditions.some(c => c.id === accepted.rule.id);
    exists ? updateCondition(accepted.rule.id, accepted.rule) : addCondition(accepted.rule);
    ```
    Disable Accept when `!canWrite`. If the accepted rule is the one open in the inspector, the reconcile logic handles it: rebase if clean, conflict banner if dirty.
12. `handleSave`, the `isNew` logic and the nonce promotion are deleted.
13. **Offline gating:**
    - `toggleAllVisible` → no-op plus disabled button when `!isConnected`;
    - cards get `writeDisabled={!isConnected}`;
    - `LogicHealthPanel canEdit={canWrite}`;
    - `handleDuplicate` and `handleCleanupRule` check the boolean results and show `toastSuccess` only on `true`.
14. Add the `beforeunload` effect:
    ```ts
    useEffect(() => {
      if (!inspectorDirty) return;
      const handler = (e: BeforeUnloadEvent) => {
        if (isIntentionalNavigationPending()) return;
        e.preventDefault(); e.returnValue = '';
      };
      window.addEventListener('beforeunload', handler);
      return () => window.removeEventListener('beforeunload', handler);
    }, [inspectorDirty]);
    ```
15. Render `RuleInspector` with:
    - `key = inspector.mode === 'edit' ? \`edit:${inspector.ruleId}\` : \`create:${inspector.draftId}\``;
    - `liveRule = conditions.find(c => c.id === ruleId)`, and `isSelected` on the card uses `inspector.ruleId`.

    If an `edit` state has neither `liveRule` nor `restored` (for example the user re-clicks after a delete), render the closed state instead: add an effect that sets `closed` and calls `resetDraftTracking()`.
16. **Discard dialog** (inline in `ConditionsTab`, using `@dculus/ui` `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`):
    - `open={pendingTransition !== null}`;
    - `onOpenChange={(o) => { if (!o) setPendingTransition(null); }}`;
    - `data-testid="condition-discard-dialog"` on the content;
    - description is `draftCompleteRef.current ? t('editor.discardMessage') : t('editor.discardMessageIncomplete')`;
    - buttons: **Keep editing** (`condition-discard-cancel`, variant `outline`, autofocused through `onOpenAutoFocus={(e) => { e.preventDefault(); keepRef.current?.focus(); }}`) and **Discard changes** (`condition-discard-confirm`, variant `destructive`);
    - confirm runs `const next = pendingTransition; setPendingTransition(null); resetDraftTracking(); openInspector(next)`. If `next` is `closed`, use `setInspector`.
17. Live region: `<div role="status" aria-live="polite" className="sr-only" data-testid="logic-live-region">{announcement}</div>`. Clear it about 3 s later with a timeout that is cleaned up on unmount.

### Step 7: ConditionRuleCard

- Add an optional prop `writeDisabled?: boolean`. When true:
  - `Switch disabled`;
  - the duplicate and delete buttons are `disabled` with `title={t('editor.status.reconnectToEdit')}`.
- Edit stays enabled.
- No other changes.

### Step 8: i18n (mandatory, en + ta)

Files: `apps/form-app/src/locales/en/conditions.json` and `apps/form-app/src/locales/ta/conditions.json`. The namespace is already registered.

**Remove** from `editor`: `done`, `autosaveIncomplete`, `autosaveBlocked`, `autosaving` and `autosaved`. First grep to confirm no other usage.

**Keep:** `discardTitle`, `discardConfirm`, `keepEditing` and `cancel`.

**Add or replace** these keys under `editor` (both languages):

| Key | en | ta |
|---|---|---|
| `editor.createRule` | Create rule | விதியை உருவாக்கு |
| `editor.saveChanges` | Save changes | மாற்றங்களைச் சேமி |
| `editor.recreateRule` | Re-create rule | விதியை மீண்டும் உருவாக்கு |
| `editor.revert` | Discard changes | மாற்றங்களை நிராகரி |
| `editor.close` | Close editor | திருத்தியை மூடு |
| `editor.shortcutHint` | ⌘/Ctrl + Enter to save | சேமிக்க ⌘/Ctrl + Enter |
| `editor.discardMessage` *(replace)* | Your changes to this condition haven't been saved. Discard them? | இந்த நிபந்தனையில் நீங்கள் செய்த மாற்றங்கள் சேமிக்கப்படவில்லை. அவற்றை நிராகரிக்கவா? |
| `editor.discardMessageIncomplete` | This condition is incomplete, so it hasn't been saved. Closing now will discard it. | இந்த நிபந்தனை முழுமையடையாததால் சேமிக்கப்படவில்லை. இப்போது மூடினால் அது நிராகரிக்கப்படும். |
| `editor.status.readOnly` | You have view-only access to this form. | இந்தப் படிவத்தைப் பார்க்க மட்டுமே உங்களுக்கு அனுமதி உள்ளது. |
| `editor.status.offline` | Offline — your changes are kept here. Save once reconnected. | இணைப்பு இல்லை — உங்கள் மாற்றங்கள் இங்கே வைக்கப்பட்டுள்ளன. மீண்டும் இணைந்ததும் சேமிக்கவும். |
| `editor.status.error` | Couldn't save. Your changes are kept here — try again once reconnected. | சேமிக்க முடியவில்லை. உங்கள் மாற்றங்கள் இங்கே வைக்கப்பட்டுள்ளன — மீண்டும் இணைந்ததும் முயற்சிக்கவும். |
| `editor.status.deleted` | This rule was deleted. Re-create it or discard your changes. | இந்த விதி நீக்கப்பட்டது. அதை மீண்டும் உருவாக்கவும் அல்லது உங்கள் மாற்றங்களை நிராகரிக்கவும். |
| `editor.status.conflict` | Changed by a collaborator — saving will replace their version. | ஒரு கூட்டுப்பணியாளர் மாற்றியுள்ளார் — சேமித்தால் அவர்களின் பதிப்பு மாற்றப்படும். |
| `editor.status.createIdle` | Build the rule, then create it. | விதியை அமைத்து, பின்னர் உருவாக்கவும். |
| `editor.status.clean` | No unsaved changes | சேமிக்காத மாற்றங்கள் இல்லை |
| `editor.status.dirty` | Unsaved changes | சேமிக்காத மாற்றங்கள் உள்ளன |
| `editor.status.incomplete` | Unsaved — finish the rule to save it. | சேமிக்கப்படவில்லை — சேமிக்க விதியை நிறைவு செய்யவும். |
| `editor.status.invalid` | Complete the highlighted rows to save. | சேமிக்க, குறிக்கப்பட்ட வரிசைகளை நிரப்பவும். |
| `editor.status.reconnectToEdit` | Reconnect to make changes | மாற்றங்களைச் செய்ய மீண்டும் இணைக்கவும் |
| `editor.banner.restoredTitle` | Unsaved changes restored | சேமிக்காத மாற்றங்கள் மீட்டெடுக்கப்பட்டன |
| `editor.banner.restoredMessage` | We kept the rule you were editing. Save it or discard it. | நீங்கள் திருத்திக்கொண்டிருந்த விதியை வைத்திருக்கிறோம். அதைச் சேமிக்கவும் அல்லது நிராகரிக்கவும். |
| `editor.banner.discard` | Discard | நிராகரி |
| `editor.banner.dismiss` | Dismiss | மூடு |
| `editor.banner.conflictTitle` | A collaborator changed this rule | ஒரு கூட்டுப்பணியாளர் இந்த விதியை மாற்றியுள்ளார் |
| `editor.banner.conflictMessage` | Saving will replace their version with yours. | சேமித்தால் அவர்களின் பதிப்பு உங்களுடையதால் மாற்றப்படும். |
| `editor.banner.loadTheirs` | Load their version | அவர்களின் பதிப்பை ஏற்று |
| `editor.banner.deletedTitle` | This rule was deleted | இந்த விதி நீக்கப்பட்டது |
| `editor.banner.deletedMessage` | Someone deleted this rule while you were editing it. | நீங்கள் திருத்திக்கொண்டிருந்தபோது யாரோ இந்த விதியை நீக்கிவிட்டனர். |
| `editor.banner.brokenRefs` | This rule points to deleted fields or pages. | இந்த விதி நீக்கப்பட்ட புலங்கள் அல்லது பக்கங்களைக் குறிக்கிறது. |
| `editor.banner.removeBrokenRefs` | Remove broken references | உடைந்த குறிப்புகளை நீக்கு |
| `editor.banner.lostAccess` | You no longer have edit access, so these changes can't be saved. | உங்களுக்கு இனி திருத்த அனுமதி இல்லை, எனவே இந்த மாற்றங்களைச் சேமிக்க முடியாது. |
| `editor.errors.missingPage` | This page was deleted. Choose another page. | இந்தப் பக்கம் நீக்கப்பட்டது. வேறு பக்கத்தைத் தேர்ந்தெடுக்கவும். |
| `editor.errors.missingTarget` | One or more fields here were deleted. Remove them or choose others. | இங்குள்ள ஒன்று அல்லது அதற்கு மேற்பட்ட புலங்கள் நீக்கப்பட்டன. அவற்றை நீக்கவும் அல்லது வேறு புலங்களைத் தேர்ந்தெடுக்கவும். |

Top-level keys:

| Key | en | ta |
|---|---|---|
| `toast.ruleCreated` | Condition created | நிபந்தனை உருவாக்கப்பட்டது |
| `toast.offlineTitle` | You're offline | இணைப்பு இல்லை |
| `announce.ruleSaved` | Condition saved | நிபந்தனை சேமிக்கப்பட்டது |

`editor.status` and `editor.banner` are nested objects. Keep the key structure **identical** in en and ta. Run a quick key-parity check (for example a small node one-liner) as part of verification.

### Step 9: Unit tests (jest, form-app)

Put the tests in `apps/form-app/src/components/form-builder/conditions/__tests__/` and `apps/form-app/src/store/slices/__tests__/`.

Note that `setupTests.ts` globally mocks `@dculus/types` (partially), `@dculus/ui` and `zustand`. Pure modules that import only types and `conditionFieldConfig` work, as `conditionFieldConfig.test.ts` shows. For slice tests, copy the header of `store/slices/__tests__/updateFieldClear.test.ts` (`jest.unmock('@dculus/types')`, `jest.unmock('zustand')`, the config and auth mocks, a real `Y.Doc`).

**`ruleDraft.test.ts`**
- **`draftSignature`:**
  - identical drafts with different key order → equal;
  - a `value` of `undefined` vs absent → equal;
  - a combinator change → different;
  - action `fieldIds` order → different;
  - `ruleSignature(rule) === draftSignature(initialDraftFor(rule))`.
- **Dirty detection:**
  - a blank create draft is not dirty against its own base;
  - an unedited recipe seed is not dirty;
  - editing then undoing the edit → clean again.
- **`getDraftIssues`** (validity gate):
  - each term issue code, including `isEmpty` with no value → no issue;
  - a numeric string accepted for numbers;
  - `selectPage`, `selectTarget`, `missingPage` and `missingTarget`;
  - `noActions` false when only preserved actions exist;
  - `count` arithmetic.
- **`reconcileWithLive`:** all branches (create, deleted, in-sync, same-change rebase, clean rebase, conflict).
- **`planCommit`:**
  - update keeps the live `enabled` (the toggle wins);
  - update re-appends preserved actions from the **live** rule (an unknown action type is not dropped);
  - update on a missing rule → `blocked/deleted` (no resurrection after delete);
  - create with no live rule → add with `enabled: true`;
  - create when the id already exists → update (idempotent, no duplicate);
  - recreate → add with `basePreserved`;
  - terms are deep-cloned (mutating the input after planning doesn't change the plan).
- **`cleanupDraftReferences`:**
  - removes missing term fields, action ids and pages;
  - keeps blank in-progress rows;
  - falls back to empty placeholder rows;
  - `preservedCount > 0` allows zero editor actions.
- **`deriveSaveStatus`:** the priority order from the §2.2 table, one test per row plus offline over invalid.

**`logicDraftStorage.test.ts`**
- round-trip;
- invalid JSON → `null` and the key removed;
- schema violation (unknown action type, too many terms) → `null`;
- oversize payload → `null`;
- `sessionStorage` throwing (spy `setItem` and `getItem` to throw) → no throw;
- keys are scoped per `formId`.

**`conditionsSlice.test.ts`** (real Y.Doc)
- ready:
  - `addCondition` writes Y.js and local state and returns true;
  - adding the same id twice → a single local entry and a single Y.js entry.
- not ready (`_isYJSReady: () => false`):
  - add, update and remove return false and **leave local state untouched** (regression for P3).
- `updateCondition` on a missing id → false, with no local change.
- `removeCondition` → true, and later `updateCondition` for the same id → false (no resurrection).
- `setConditionEnabled` returns the boolean.

**`useLogicHealth` cleanup test** (add it to an existing test file if there is one, otherwise create `hooks/__tests__/cleanupRuleReferences.test.ts`):
- an unknown action without `pageId` survives cleanup;
- a page action with a deleted page is removed.

### Step 10: E2E updates

Existing steps keep working without changes:
- `condition-save` is still the primary button and is never `disabled`;
- save closes the panel, and subsequent steps act on cards.

The LWW collab scenario still ends with B's write winning, because Save overwrites.

**Add steps.** Put single-session steps in `test/e2e/steps/conditional-logic.steps.ts` and session-prefixed ones in `conditional-logic-collab.steps.ts`. Use testids only, never translated text, except where existing steps already use English labels.

- `When I start a new rule with trigger {string}`: click `condition-add-rule`, choose the trigger in `condition-term-field-0` and stop. No value is entered, so the rule is incomplete.
- `When I click add rule`: click `condition-add-rule`.
- `When I close the condition inspector`: click `condition-inspector-close`.
- `Then I should see the discard changes dialog`: `condition-discard-dialog` visible.
- `When I keep editing the condition`: click `condition-discard-cancel`.
- `When I confirm discarding the condition changes`: click `condition-discard-confirm`.
- `Then the condition inspector should be open`: `condition-save` visible.
- `Then the condition inspector should be closed`: `condition-save` has count 0.
- `Then the condition save status should be {string}`: `expect(getByTestId('condition-save-status')).toHaveAttribute('data-state', value)`.
- `Then I should see the restored draft banner`: `condition-restored-banner` visible.
- `Then In session {string} I should see the condition conflict banner`: `condition-conflict-banner` visible (timeout 15 s).
- `Then In session {string} I should see the condition deleted banner`: `condition-deleted-banner` visible.

**`conditional-logic.feature`** (tag `@builder-ux`, two new scenarios):

```gherkin
  @builder-ux
  Scenario: Unsaved rule drafts are guarded and never auto-persisted
    Given I sign in with valid credentials
    When I create a form via GraphQL with conditional logic fields
    And I open the collaborative builder
    And I open the conditions tab
    When I click add rule
    And I close the condition inspector
    Then the condition inspector should be closed
    And I should see the conditions empty state
    When I start a new rule with trigger "Show bonus field?"
    Then the condition save status should be "incomplete"
    When I close the condition inspector
    Then I should see the discard changes dialog
    When I keep editing the condition
    Then the condition inspector should be open
    When I open the page builder tab
    And I open the conditions tab
    Then I should see the restored draft banner
    And I should see the conditions empty state
    When I close the condition inspector
    And I confirm discarding the condition changes
    Then the condition inspector should be closed
    And I should see the conditions empty state
```

**`conditional-logic-collab.feature`:**
- In "Same-rule concurrent edits resolve last-writer-wins", insert `Then In session "B" I should see the condition conflict banner` after `In session "A" I save the condition rule` and before B saves.
- Add a new scenario:

```gherkin
  Scenario: Rule deleted by a collaborator while open
    When In session "A" I add a rule showing "cond-bonus" when "Show bonus field?" is equal to "Yes"
    Then In session "B" I should see a condition rule card for "Show bonus field?"
    When In session "A" I edit the condition rule for "Show bonus field?"
    And In session "B" I delete the condition rule for "Show bonus field?"
    Then In session "A" I should see the condition deleted banner
```

Check that the existing step names used above match exactly, including "I open the page builder tab", "I open the conditions tab", "I should see the conditions empty state" and "In session ... I edit the condition rule for". Grep before adding duplicates.

---

## 4. Verification

Run these from the repo root and report the results:

```bash
pnpm --filter form-app test -- --testPathPattern 'conditions|conditionsSlice|cleanupRuleReferences'
pnpm --filter form-app test
pnpm --filter form-app type-check
pnpm --filter form-app lint
# i18n key parity (en vs ta) for conditions.json
node -e "const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const a=new Set(f(require('./apps/form-app/src/locales/en/conditions.json'))),b=new Set(f(require('./apps/form-app/src/locales/ta/conditions.json')));console.log('missing in ta',[...a].filter(k=>!b.has(k)),'missing in en',[...b].filter(k=>!a.has(k)))"
# Optional, requires backend :4000 + form-app :3000 + viewer :5173 running:
pnpm test:e2e --tags '@builder-ux'
pnpm test:e2e:collab
```

Grep for leftovers. All of these must return no hits:
- `autosave` and `AUTOSAVE_DELAY_MS` in `apps/form-app/src`;
- `editor.done`;
- `condition-autosave-status` in `test/`.

### Manual QA script

Sign in at `http://localhost:3000` with the `E2E_EMAIL`/`E2E_PASSWORD` fallback from root `package.json`. Then check:
- **Offline:** stop the backend while the inspector is dirty. The status should go to `offline`, Save should no-op, the card controls should be disabled, and the draft should be kept. Restart the backend: the status returns to `dirty`, and Save works.
- **StrictMode:** in dev, opening, closing and switching tabs must produce no double writes and no double toasts.
- **Narrow width:** drag the inspector to 280 px and check that the footer and banners wrap. Repeat in dark mode.
- **Keyboard:**
  - Cmd/Ctrl+Enter saves;
  - Esc inside an open Select only closes the Select;
  - Esc on the panel opens the discard dialog when dirty;
  - Tab cycles inside the dialog;
  - focus lands on the new card after create.
- **Read-only:** open with `?mockPermission=VIEWER`. Cards should not be clickable, and there should be no footer.
- **Content-tab deletion:** delete a field referenced by an open, stashed draft. Return to the Logic tab: the broken-refs banner should appear, and Remove should fix the draft.
- **Published form:** edit a rule without saving and reload the public viewer. The rule must not have changed.

---

## 5. Scenario checklist (fill in the Result column after implementing)

| # | Scenario | Handling | Verified by | Result |
|---|---|---|---|---|
| C1 | Blank new rule: close or Create doesn't error and creates nothing | Not dirty → close is silent. Create → `showErrors` and focus the first issue, with no `onCommit`. | E2E "guarded" (blank part), unit `deriveSaveStatus`/dirty | |
| C2 | Partially filled new rule: nothing persisted, and the user is told why | Never written before an explicit commit. Status `incomplete`/`invalid`. Discard dialog uses the incomplete message. | E2E "guarded", unit `getDraftIssues` | |
| C3 | Recipe-seeded rule: unedited seed not persisted | Base = seed signature, so it isn't dirty and only an explicit Create persists | Unit (seed not dirty), manual | |
| C4 | Add rule again or another recipe mid-draft | `requestInspector` guard → discard dialog when dirty, otherwise replace | Manual, plus E2E dialog steps | |
| C5 | AI accept while the inspector is open | Accept upserts (no duplicates). If it targets the open rule: rebase when clean, conflict banner when dirty. Disabled offline. | Unit `planCommit`/`reconcileWithLive`/slice dedupe, manual | |
| E1 | Edit then close: saved or discarded explicitly | Save closes and announces. Close while dirty → dialog. Revert button. | E2E lifecycle (existing), E2E guarded | |
| E2 | Edit into an invalid state, then close, switch rule, Add, change tab or navigate away: no silent loss | In-tab paths → dialog. Tab, back or navigation → sessionStorage stash, then restored banner. Reload or close → `beforeunload` plus stash. | E2E guarded (tab switch), unit stash, manual reload | |
| E3 | Rapid typing: no save storm, no stale overwrite | No autosave. A single commit built from the current render. `committingRef` blocks a double submit. `planCommit` is idempotent. | Unit `planCommit`, code review | |
| E4 | Revert or cancel an edit | `condition-revert` resets to base. Cancel in create mode is guarded. | Manual | |
| E5 | Existing rules with invalid references: editable, and clean-up works | Opens with `showErrors`, broken-refs banner, `cleanupDraftReferences`, and health-panel cleanup (fixed for unknown actions) | Unit cleanup ×2, E2E collab broken-ref (existing), manual | |
| E6 | Preserved unknown action types not dropped | `planCommit` re-appends `preservedActions(live)`. Cleanup keeps unknown shapes. Stash keeps `basePreserved`. | Unit `planCommit`, unit cleanup | |
| K1 | Collaborator edits, deletes or toggles the same rule while it is open | `liveRule` prop plus `reconcileWithLive`: rebase, conflict banner or deleted banner. The live toggle value is kept on save. | E2E collab LWW (+banner), E2E collab deleted, unit | |
| K2 | Card toggle while the inspector is open | `enabled` is not in the signature (no false dirty). Save uses `live.enabled`. | Unit `planCommit`, E2E lifecycle | |
| K3 | Deleting the open rule from the card, no resurrection | Delete confirm closes the inspector and clears the stash. `planCommit` update on a missing rule → blocked. The slice update on a missing id → false. | Unit slice + `planCommit` | |
| K4 | Disconnected or reconnecting | `isConnected` read in the Logic tab. Save blocked with `offline` status, draft kept. Card, bulk, AI and cleanup writes disabled. Slice no longer diverges locally. | Unit slice (not-ready), manual offline | |
| K5 | Form deleted, unpublished or made read-only mid-edit | Unpublish: no effect, and drafts never go live. Read-only: footer hidden and lost-access banner. Deleted: the builder errors out or disconnects, so saves are blocked and the stash is orphaned (harmless). | Manual (read-only via `mockPermission` on load only). **Form deletion and live permission revocation are not verifiable locally.** | |
| L1 | Switch rules, close panel, switch tabs, back, reload, tab close | Guard dialog, stash and restore, `beforeunload` | E2E guarded, manual | |
| L2 | React StrictMode double effects | Pure `useState` initialisers. No write-on-unmount. Stash writes are idempotent. Focus effects are idempotent. | Manual dev run, code review | |
| L3 | Field or page deleted in the Content tab while a rule referencing it is open | The draft shows `selectField`/`missingTarget`/`missingPage` and the broken-refs banner. Save is blocked until fixed. | Unit issues/cleanup, manual | |
| U1 | Always-visible save state with `aria-live` | `condition-save-status`, `data-state`, `role=status`, `aria-live=polite` | E2E status step, unit `deriveSaveStatus` | |
| U2 | Inline validation timing | Hidden while composing, shown after an attempt, immediate for already-broken existing rules | Unit, manual | |
| U3 | Keyboard: Enter, Esc + guard, focus after create, dialog focus trap | Cmd/Ctrl+Enter save, plain Enter native, Esc scoped, Radix `Dialog`, focus to the saved card | Manual | |
| U4 | Read-only users: no controls, no autosave | Cards not clickable, no footer, no writes | Manual (`mockPermission=VIEWER`) | |
| U5 | Dark mode and 280–600 px width | Stacked footer, wrapping banners, `dark:` variants | Manual | |
| U6 | Toasts: confirm create and delete, avoid noise | Toast on create and delete. Edit saves are announced through the live region and focus. | Manual, E2E lifecycle | |

---

## 6. Non-goals and known limitations

- No backend or Hocuspocus changes. Same-rule concurrent saves remain last-writer-wins, now with a visible conflict banner.
- No route-level blocking: the app uses `BrowserRouter`, so `useBlocker` is unavailable. Unblockable navigation is covered by stash and restore instead. Migrating to a data router is out of scope.
- `ConfirmationDialog` (the shared delete confirm) keeps its non-Radix implementation. Only the new discard dialog uses Radix `Dialog`. Upgrading `ConfirmationDialog` is a separate change.
- Server-side permission revocation isn't pushed live to the client. `canEdit` only changes on refetch.
- The stash lives in `sessionStorage`, which is per-tab and cleared when the tab closes. That is intentional: a draft shouldn't follow the user across tabs or devices.
