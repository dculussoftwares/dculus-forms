# How Dculus Works

Architecture documentation for developers. Every page here answers one question:
**"what actually happens when …?"**

These docs are readable two ways:

- **On GitHub / in your editor** — they're plain Markdown, so they show up in PR diffs.
- **In the app** — visit `/docs` in form-app. Same text, plus an interactive diagram
  where you can click any box to see which file it lives in.

New to the codebase? Read them in this order:

| # | Page | Read it to understand |
|---|------|----------------------|
| 1 | [The Life of a Submission](./01-submission-lifecycle.md) | What happens between a respondent clicking Submit and the thank-you screen |
| 2 | [One Event, Three Listeners](./02-event-fanout.md) | Why plugins, automations, and PDFs all fire on submit |
| 3 | [Request Anatomy](./03-request-anatomy.md) | How any GraphQL request flows through the backend layers |

### Planned

Not written yet. Listed so the set has a shape, and so nobody has to re-derive
it — pick one up when you next touch that subsystem, while it's fresh.

**Feature engines**

| Page | Would cover |
|------|-------------|
| Automations: From Graph to Run | Graph snapshotting per run, pg-boss enqueue and `runId:nodeId` keying, delay/condition/action nodes, the retry policy, and the fact that automation actions *are* plugin handlers |
| The Plugin Pipeline | Registry, sequential execution, `PluginDelivery`, export-column registration, backfill jobs |
| PDF Generation | `PdfTemplate → PdfGenerator → PdfGenerationRun → PdfGenerationResult`, the binding conventions, private-bucket storage, auto-run on submit |
| Real-Time Collaboration | Zustand slices → Y.js → Hocuspocus → `CollaborativeDocument`, WebSocket auth, the debounced metadata extractor |
| The AI Form Editor | Two-tier model routing, tool tiers, prompt-cache affinity, context compaction, and the hand-off into AI credit accounting |

**Cross-cutting**

| Page | Would cover |
|------|-------------|
| Who Can Do What | The builder-side stack (`User.role` × `Member.role` × `FormPermission` × sharing scope) and the separate respondent-side gate |
| Plans, Usage & Billing | Chargebee checkout and webhooks, cached usage counters, the 80% threshold, and why AI credits reset on a different clock |
| Where Files Live | Public vs private R2, the upload type allowlist, pre-signed URLs, temporary export TTL |
| The Field Type System | The `FormField` class tree, and the serialization boundary between classes in memory and plain JSON in Postgres and Y.js |

---

## Writing a new page

Each page follows the same outline so readers always know where to look.
**Only sections 1, 2, 3 and 6 are required** — skip any other section rather than
writing "N/A", because empty headings train people to stop reading headings.

### 1. Title + summary

One sentence. What this subsystem does, in plain language.

### 2. At a glance

A five-row table so someone can orient in ten seconds:

| Field | What it answers |
|-------|-----------------|
| **Entry point** | Where does execution start? (`file.ts:functionName`) |
| **Trigger** | What causes this to run? |
| **Execution** | Sync or async? In-process or queued? |
| **Outcome** | What exists afterwards that didn't before? |
| **Fails loudly?** | Does an error reach the user, or get swallowed and logged? |

### 3. Diagram

The boxes-and-arrows view. In the app this is an interactive canvas; on GitHub
this section is a numbered list of the same steps, so the Markdown still reads
fine on its own.

### 4. Walkthrough

One short paragraph per step. Say **what** happens, **where** (`file.ts:120`),
and **why it's in this position** when the ordering isn't obvious.

### 5. Invariants & design decisions

The "please don't undo this" rules, each with its reason. This is where good code
comments get promoted into documentation so they stop being discoverable only by
whoever happens to open that file.

### 6. Shared surfaces

Two tables. First — what this subsystem exposes to others:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|------------------|-------------|----------------------|-----------------|

Second — what it depends on from elsewhere:

| Depends on | Owned by | Why |
|------------|----------|-----|

> **When to add a row:** the moment a *second* subsystem imports something. Not
> "when it feels important" — the second importer is the trigger. This is the
> section that stops someone refactoring a function without realising three
> other features call it.

### 7. Data touched

Prisma models, marked `R` (read), `W` (write) or `RW`. Cheap to write, and it's
the fastest way to answer "what breaks if I migrate this table?"

### 8. Failure & retry behavior

What retries and how many times, what gets swallowed, what reaches the user,
what goes to Sentry. For anything queue-backed, name the queue and the
idempotency key.

### 9. Configuration

Env vars, plan gates, and hardcoded constants that behave like config —
`ACTION_RETRY_LIMIT = 3`, `WARNING_THRESHOLD = 80`, and friends.

### 10. Related pages

Links, each with a reason to follow it. Not a bare list.

### 11. Gotchas

Things that have burned someone, or will. Name collisions especially.

---

## Adding a page to the app

1. Write `docs/architecture/NN-your-topic.md` using the outline above.
2. Add a diagram in `apps/form-app/src/pages/docs/diagrams/yourTopic.ts`
   (nodes carry a `file` reference — that's what powers click-to-explain).
3. Register both in `apps/form-app/src/pages/docs/registry.ts`.

A page with no diagram is fine — it just renders the Markdown. Not everything is
a flow.

## Keeping these honest

Every diagram node carries the source file it describes. `pnpm test:unit` in
form-app checks that each referenced path still exists, so a renamed or deleted
file fails CI instead of quietly rotting. It can't catch a flow that changed
shape — only humans do that — but it catches the common case.
