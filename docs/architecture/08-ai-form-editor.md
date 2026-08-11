# The AI Form Editor

"Add a phone number field to page 2 and make the email required." The fields
appear in the builder a second later — and if a colleague has the same form open,
they see them too.

The mechanism behind that last part is the thing worth understanding, and it's
not what most people guess. **The backend never edits the form.** Its tools
return *descriptions* of operations; the browser applies them to the Y.js
document, which syncs to everyone else through the normal collaboration path. The
AI is just another editor sitting at the same document.

The rest of this page is about cost. Every design decision here — model routing,
tool tiers, prompt structure, history summarisation — exists to make a turn
cheaper without making it worse.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/routes/aiChat.ts` — `POST /api/ai/chat` |
| **Trigger** | A message in the AI drawer in the form builder |
| **Execution** | Streaming HTTP response; the tool loop runs server-side |
| **Outcome** | Streamed tool calls, applied to Y.js by the browser, plus an `AIUsage` charge |
| **Fails loudly?** | Yes — budget and permission failures return 402 / 403 |

## The flow

```
   User message
        │
        ▼
  ┌──────────────────────────────────┐
  │ Guards                           │
  │  · requireOrganizationMembership │
  │  · checkAITokenBudget → 402      │
  │  · conversation ownership        │
  └──────────────┬───────────────────┘
                 ▼
  ┌──────────────────────────────────┐
  │ Build context                    │
  │  · load history, prune tool calls │
  │  · summarise if long              │
  │  · read Y.js schema (10 s cache)  │
  └──────────────┬───────────────────┘
                 ▼
  ┌──────────────────────────────────┐
  │ classifyIntent  (regex, no API)  │
  │   simple → nano  + core tools    │
  │   complex → mini + full tools    │
  │   question → nano, no agent      │
  └──────────────┬───────────────────┘
                 ▼
  ┌──────────────────────────────────┐
  │ ToolLoopAgent                    │
  │   static prompt (byte-stable)    │
  │ + tools                          │
  │ + history                        │
  │ + ephemeral context (last)       │
  └──────────────┬───────────────────┘
                 │  streamed tool results
                 ▼
  ┌──────────────────────────────────┐
  │ Browser applies ops to Y.js      │  ← the actual edit happens here
  └──────────────┬───────────────────┘
                 ▼
        Hocuspocus → every other editor

  and, on finish:  recordAITokenUsage → AIUsage
```

## Walkthrough

### Guards

Organization membership, then `checkAITokenBudget`, then conversation ownership.
An over-budget org gets a **402** with used-vs-limit numbers in the message, so
the UI can show something better than "request failed".

The budget check is explicitly a soft pre-check, not an atomic reservation — two
concurrent requests from the same org can both pass it. `allowed: true` means
"very likely fine right now", not "guaranteed under budget". It also blocks
outright when the subscription is `past_due`, matching how view and submission
limits behave.

### Building the context cheaply

Three compressions run before the model sees anything:

1. **`truncateToolResults`** caps any single tool result at 8,000 characters.
2. **`pruneToolCallsFromHistory`** replaces old tool-call payloads with compact
   annotations.
3. **`summarizeHistoryIfNeeded`** summarises once the conversation passes four
   user turns, and only the six most recent messages are carried verbatim.

Then the form schema is read from the Y.js document — cached for 10 seconds, so a
rapid back-and-forth doesn't re-parse it every turn.

Note this route parses the collaborative document *itself* (`getFormSchemaFromYjs`
is local to `aiChat.ts`) rather than calling the shared
`getFormSchemaFromHocuspocus`, because it needs a flattened `{ pages, fields }`
shape rather than the raw serialized schema. Same source row, different
projection.

### Intent classification

`classifyIntent` is pure regex. No API call, no latency, no cost. It sorts the
message into three buckets that each pick a model *and* a tool set:

| Intent | Model | Tools | Steps |
|---|---|---|---|
| `simple` — add, rename, remove, reorder | nano | `core` | 8 |
| `complex` — analysis, remix, bulk edits | mini | `full` | 15 |
| `question` — "what field types do you support?" | nano | `minimal` | no agent at all |

Questions skip the `ToolLoopAgent` entirely and use a direct `streamText`, saving
roughly 2,100 tokens of tool schemas that were never going to be called. Ambiguous
or short messages default to `simple`, so nano is the cost-saving default.

### The prompt, shaped for caching

This is the part most worth copying elsewhere. The prompt is deliberately split so
its **prefix is byte-identical on every request**, because that's the only way
provider-side prefix caching hits:

```
[ static system prompt ]   ← no per-turn data, byte-stable
[ tool definitions     ]   ← varies only by tier
[ conversation history ]   ← append-only
[ ephemeral context    ]   ← ALL the per-turn data, last
```

The static prompt contains no form structure and no current page. Everything
dynamic goes into a trailing user message built by `buildEphemeralContext`, placed
*after* history so it can't disturb the cacheable prefix. That message is
ephemeral in the strict sense — it must never be persisted into conversation
history, or the next turn's prefix changes and every cache hit is lost.

Tool-specific behavioural rules live in each tool's own description rather than
the system prompt, which cut it from ~525 tokens to ~210.

`buildPromptCacheOptions(conversationId)` adds cache affinity so repeated turns in
one conversation land on the same cached prefix.

### Snapshot or read tools, not both

`SNAPSHOT_FIELD_THRESHOLD = 40`. Under it, the whole form is inlined as a compact
snapshot (`id|type|"label"|req`) and the read tools are omitted — the model can
act without a round-trip. Over it, the snapshot is dropped to a page-level summary
and `listFields` / `getField` are included instead.

Paying for one of the two, never both.

### Running out of room mid-loop

`prepareStep` estimates tokens each step and, past ~50,000, calls `pruneMessages`
to drop reasoning traces and tool calls older than the last three messages. A long
remix converges instead of hitting the context limit.

### How the edit actually lands

The tools return operation descriptions — `ADD_FIELD`, `UPDATE_FIELDS`,
`REMOVE_FIELDS`, `RELOCATE_FIELD`, `REORDER`, `ADD_PAGE`, and so on. The backend
does not touch the document.

`useAIChat` watches the streamed message parts and, for each mutation tool result
it hasn't already seen, calls `applyAIOp` against the Zustand store — which writes
to Y.js, which syncs to every other connected editor. Applied tool-call ids are
tracked in a ref so a re-streamed part can't apply twice, and historical messages
loaded on page reload are skipped entirely since their mutations are already in
the document.

**Proposals are separate.** `removeFields`, `removePage`,
`proposeFieldTypeChange`, `proposeValidation` and `upsertConditionRule` don't
mutate anything — they enqueue a confirmation card, and the real mutation happens
when the user clicks Accept. The system prompt instructs the model to say "will be
once confirmed" rather than "deleted".

### Billing

`recordAITokenUsage` converts tokens to milli-credits at a per-tier rate and
writes to `AIUsage`, keyed on the organization and the billing period. Credits
derive their period from `Subscription.currentPeriodStart` — a different clock
from views and submissions, which reset on renewal.

## Invariants & design decisions

- **The backend never mutates the form.** Tools describe; the browser applies.
  This is what makes AI edits participate in collaboration, undo, and conflict
  merging for free.
- **The prompt prefix must stay byte-stable.** Any per-turn data that leaks into
  the system prompt, tool definitions, or persisted history costs every
  subsequent turn its cache hit.
- **The ephemeral context is never persisted.** It's the enforcement of the rule
  above.
- **Intent classification stays free.** A regex, not a model call. The moment it
  needs an API call, the cost model it exists to protect is gone.
- **Snapshot or read tools, never both.** They solve the same problem at
  different form sizes.
- **Applied tool-call ids are deduplicated.** Streaming can redeliver a part;
  applying `ADD_FIELD` twice adds two fields.
- **Proposals never apply themselves.** Destructive operations require an explicit
  user confirmation.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `POST /api/ai/chat` | `useAIChat` in form-app | AI SDK UI message stream | The stream protocol version changes |
| Operation shapes (`ADD_FIELD`, …) | `applyAIOp` in form-app | Discriminated union on `type` | An op is renamed without updating the client |
| `MUTATION_TOOL_NAMES` / `PROPOSAL_TOOL_NAMES` | `useAIChat` | A tool is in exactly one set | A new tool is added to neither and silently does nothing |
| `checkAITokenBudget` | This route, the subscription UI | `{ allowed, used, limit }` in credits | Units change from credits to tokens |
| `STATIC_SYSTEM_PROMPT` | The agent, prefix caching | Byte-identical across requests | Anything dynamic is interpolated into it |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `CollaborativeDocument` state | `repositories/collaborativeDocumentRepository.ts` | The authoritative form structure — this route parses the Y.js doc itself rather than going through `getFormSchemaFromHocuspocus`, because it needs a different shape |
| `formSchemaCache` | `lib/formSchemaCache.ts` | The 10-second schema cache |
| `requireOrganizationMembership` | Auth middleware | Access control |
| `aiUsageService` | Services | Budget and metering |
| `ai` SDK (`ToolLoopAgent`, `streamText`) | npm | The agent loop |
| Y.js store slices | form-app | Where operations are applied |

## Data touched

| Model | Access |
|---|---|
| `AIChatConversation` / `AIChatMessage` | RW |
| `AIUsage` | RW |
| `Subscription` | R — plan credit limit and period |
| `CollaborativeDocument` | R on the server, RW via the browser |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Over AI credit budget | 402 with used and limit in the message |
| Not an org member | 403 |
| Conversation not found or not owned | 404 |
| `validateUIMessages` throws | Falls back to unvalidated messages with a warning — validation never executes tools |
| Question-path `streamText` fails | Falls back to the full agent |
| Context grows past ~50k tokens | `pruneMessages` drops old reasoning and tool calls |

No automatic retry on model errors; the user resends.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `AI_PRIMARY_MODEL` (default `gpt-5.4-mini`) | Environment | The `mini` tier |
| `AI_FAST_MODEL` (default `gpt-5.4-nano`) | Environment | The `nano` tier |
| `AI_PRIMARY_BASE_URL` / `AI_PRIMARY_API_KEY` | Environment | Provider endpoint |
| `SNAPSHOT_FIELD_THRESHOLD = 40` | `aiChat.ts` | Snapshot vs read tools |
| `MAX_TOOL_RESULT_CHARS = 8000` | `aiChatService.ts` | Tool result truncation |
| `MAX_HISTORY_MESSAGES = 6` | `aiChatService.ts` | Verbatim history depth |
| `SUMMARISE_AFTER_USER_TURNS = 4` | `aiChatService.ts` | When summarisation kicks in |
| `COMPACTION_THRESHOLD_TOKENS = 50000` | `formEditAgent.ts` | Mid-loop pruning |
| Plan AI credit limit | Per plan | Budget ceiling |

## Related pages

- [Real-Time Collaboration](./07-realtime-collaboration.md) — where the applied
  operations go, and why the schema is read from Y.js rather than the `Form` table.
- [Request Anatomy](./03-request-anatomy.md) — why this is a REST route rather
  than a GraphQL mutation (it streams).

## Gotchas

- **Persisting the ephemeral context silently doubles your token bill.** Nothing
  breaks. The prefix cache just stops hitting, on every turn, forever.
- **A new mutation tool must be added to `MUTATION_TOOL_NAMES`.** If it isn't, the
  model calls it, the result streams, and nothing happens in the builder — with no
  error anywhere.
- **`classifyIntent` is regex-based and will misroute.** An unusually phrased
  complex request can land on nano with `core` tools. That's an accepted
  trade — the failure mode is a weaker answer, not a wrong edit.
- **The 10-second schema cache can serve a stale form.** If a collaborator changes
  the structure mid-conversation, the model may act on the previous shape.
- **Budget checks race.** Concurrent requests from one org can both pass and
  together exceed the limit. Deliberate — an atomic reservation would serialise
  every AI request in the organization.
