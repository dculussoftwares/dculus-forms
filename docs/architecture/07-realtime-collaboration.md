# Real-Time Collaboration

Two people open the same form builder. One renames a field, the other drags a new
one onto page 2, and both see both changes without either of them saving
anything. No lock, no "someone else is editing" banner, no last-write-wins.

That's [Y.js](https://yjs.dev) — a CRDT, which means concurrent edits merge by
construction rather than by arbitration. This page is about the plumbing around
it: how the browser connects, how the server authenticates a WebSocket, where the
document actually lives, and why the *rest* of the backend reads form schemas
from here rather than from the `Form` table.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/form-app/src/store/collaboration/CollaborationManager.ts:202` — `initialize(formId)` |
| **Trigger** | Opening the form builder |
| **Execution** | A long-lived WebSocket, plus debounced background writes |
| **Outcome** | A `CollaborativeDocument` row holding the compacted Y.js state |
| **Fails loudly?** | Connection failures surface in the UI; persistence failures are logged only |

## The flow

```
   Form builder (Zustand slices)
            │  edits
            ▼
   ┌────────────────────────┐
   │  CollaborationManager  │  Y.Doc + HocuspocusProvider
   │   · granular observers │
   └───────────┬────────────┘
               │  WebSocket
               ▼
   ┌────────────────────────┐
   │  onAuthenticate        │  bearer token OR session cookie
   │   · getSession         │  → checkFormAccess(VIEWER)
   └───────────┬────────────┘
               ▼
   ┌────────────────────────┐
   │  Hocuspocus server     │
   │   Database extension:  │
   │    fetch  ← on load    │
   │    store  → compacted  │
   └───────────┬────────────┘
               ▼
   ┌────────────────────────┐
   │ CollaborativeDocument  │  documentName = formId
   └───────────┬────────────┘
               │
        ┌──────┴───────────────────────┐
        ▼                              ▼
   FormMetadata                getFormSchemaFromHocuspocus
   (debounced 5 s)            (read by submission + resolvers)
```

## Walkthrough

### The browser side

`CollaborationManager.initialize(formId)` creates a `Y.Doc` and a
`HocuspocusProvider`, passing the bearer token from session storage. The document
name is the form id, **sanitised to alphanumerics, hyphens and underscores** —
it lands in a WebSocket path, so anything else is stripped before it gets there.

The document's shape mirrors the form schema:

```
formSchema (Y.Map)
├── pages (Y.Array of Y.Map)
│   └── fields (Y.Array of Y.Map)
│       └── validation (Y.Map)
└── conditions (Y.Array)
```

Observers are attached at **every** level — the schema map, the pages array, each
individual page map, the fields array, each field map, and each validation map.
That granularity is what makes a title edit on page 2 not look like a wholesale
replacement of the pages array to the Zustand store. Every observer registers a
cleanup, and `disconnect()` runs all of them before destroying the doc; without
that, switching forms leaks observers onto a discarded document.

### Authenticating a WebSocket

`onAuthenticate` accepts credentials **two** ways, and it needs both:

- A **bearer token**, passed by the provider from session storage.
- A **session cookie**, read from the upgrade request's headers.

The cookie path is the fallback for direct URL navigation, where session storage
hasn't been populated yet. Whichever arrives, it goes through
`auth.api.getSession` and then `checkFormAccess(userId, formId, VIEWER)` — the
same permission function the GraphQL resolvers use. Collaboration is not a
side door into a form you can't otherwise open.

### Persistence

The `Database` extension does two things:

**`fetch`** loads the stored state on first connection and returns it as a
`Uint8Array`, or `null` for a document that has never been saved.

**`store`** compacts before writing. `Y.encodeStateAsUpdate(ydoc)` produces the
full current state as a single update, discarding the accumulated delta chain —
without it, the stored blob grows without bound as edits pile up. If compaction
throws for any reason it falls back to the raw state rather than losing the save.

`store` also swallows its errors deliberately. A persistence failure logs and
returns; it does not throw, because throwing out of the extension takes the
server down and disconnects every other editing session.

### The debounced metadata cache

Page and field counts are shown in list views that shouldn't have to load and
parse a Y.js document to render. So on save, a 5-second debounce (one timer per
document name) runs `extractFormStatsFromYDoc` and writes the counts into
`FormMetadata`.

Debounced because a burst of edits during active typing would otherwise mean a
`FormMetadata` write per keystroke.

### Reading the schema from outside the builder

This is the part with the widest blast radius.

`getFormSchemaFromHocuspocus(formId)` reads the `CollaborativeDocument` row
**directly from the database**, reconstructs a `Y.Doc` from the stored bytes, and
returns the `formSchema` map. It does not talk to the running Hocuspocus server.

It exists because **`Form.formSchema` is only a periodic snapshot.** Any backend
decision made against a form's schema has to read the collaborative document
first, or it acts on a schema that may be minutes stale. Three places already do:

- Conditional-logic stripping during submission
- Thank-you message rendering
- The `Form.formSchema` / `formSchemaPublic` GraphQL field resolvers

A fourth place that read the column directly would be a bug.

The call is wrapped in a 30-second timeout, because under PgBouncer pool pressure
this query has hung indefinitely rather than failing.

## Invariants & design decisions

- **Observers are granular, and every one has a cleanup.** Coarser observation
  turns a small edit into a full-array diff; a missed cleanup leaks onto a
  destroyed document when the user switches forms.
- **Compact before persisting.** The delta chain grows forever otherwise.
- **`store` never throws.** One form's persistence failure must not disconnect
  every other editing session.
- **The WebSocket enforces the same permissions as GraphQL.** Same
  `checkFormAccess`, not a parallel implementation.
- **Two credential paths are both required.** Bearer for normal navigation,
  cookie for direct URL entry.
- **`Form.formSchema` is not authoritative.** Read the collaborative document.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `getFormSchemaFromHocuspocus` | Submission resolver, `forms.ts` field resolvers | Returns the raw serialized schema or `null` | It starts throwing instead of returning `null` |
| `CollaborativeDocument.documentName` | Every read path | Equals the sanitised form id | A prefix or namespace is introduced |
| `extractFormStatsFromYDoc` | `formMetadataService`, batch metadata jobs | Takes a live `Y.Doc` | The document structure changes shape |
| The `formSchema` document layout | AI chat route, which parses it independently | `pages → fields → validation` nesting | A level is added or renamed |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `checkFormAccess` | `resolvers/formSharing.ts` | WebSocket authorization |
| `auth.api.getSession` | `lib/better-auth.ts` | Resolving bearer or cookie into a user |
| `collaborativeDocumentRepository` | Repositories | The only persistence path |
| `updateFormMetadata` | `services/formMetadataService.ts` | The debounced counts |

## Data touched

| Model | Access |
|---|---|
| `CollaborativeDocument` | RW |
| `FormMetadata` | W (debounced) |
| `FormPermission` / `Member` | R (via `checkFormAccess`) |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Authentication fails | Connection rejected; the builder shows a disconnected state |
| `fetch` throws | Returns `null` — treated as a brand-new document |
| `store` throws | Logged and swallowed; the in-memory doc is unaffected and the next save retries implicitly |
| Compaction throws | Falls back to persisting the raw state |
| Metadata update throws | Logged; counts go stale until the next save |
| `getFormSchemaFromHocuspocus` times out | Rejects after 30 s; callers fall back to the `Form.formSchema` column |

Y.js itself handles reconnection and re-sync — an offline client's edits merge on
reconnect rather than being lost or overwriting.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `METADATA_UPDATE_DEBOUNCE_MS = 5000` | `hocuspocus.ts` | Delay before writing counts |
| `VITE_API_URL` | form-app env | Derives the WebSocket URL |
| `quiet: true` | `hocuspocus.ts` | Suppresses the library's own banner |

## Related pages

- [The Life of a Submission](./01-submission-lifecycle.md) — two of the reads that
  depend on this being the source of truth.
- [Request Anatomy](./03-request-anatomy.md) — Hocuspocus as one of the four
  runtimes in the backend process, and why services take no request object.

## Gotchas

- **The document name is the bare form id.** `CLAUDE.md` describes it as
  `form:{formId}` — that is not what the code does. The `collab-` prefix that
  appears in `saveDocumentState` is the row's **`id`**, not its `documentName`.
- **`Form.formSchema` lags.** It's a snapshot. Reaching for it in new backend code
  is the single easiest way to introduce a subtly stale read.
- **Switching forms without `disconnect()` leaks observers.** The manager tracks
  cleanups precisely because the observer set is large and nested.
- **The form id is sanitised, not validated.** A form id containing only
  disallowed characters throws rather than silently connecting to `""`.
