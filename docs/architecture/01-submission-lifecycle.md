# The Life of a Submission

A respondent clicks **Submit**. Roughly a second later they see a thank-you
screen. In between, the backend runs eight checks, writes one row, and kicks off
three background jobs — and if any of those background jobs explodes, the
respondent never finds out. This page walks that whole path.

If you only read one architecture page, read this one. Almost every feature in
the product hangs off this flow somewhere.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/graphql/resolvers/responses.ts:145` — the `submitResponse` mutation |
| **Trigger** | A respondent submits a public form in form-viewer, or a builder submits from the preview panel |
| **Execution** | Synchronous up to the database write, then fire-and-forget |
| **Outcome** | One `Response` row, plus analytics, plugin deliveries, and possibly PDFs and emails |
| **Fails loudly?** | Only before the write. After the row is saved, nothing can fail the request |

The mutation is **public** — anyone can call it directly with a GraphQL client.
That single fact explains most of what looks like paranoia below. Every check the
form-viewer UI performs is repeated here, because the UI is a convenience, not a
security boundary.

## The flow

```
                       ┌─────────────────────────┐
   respondent  ───────▶│  submitResponse         │
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┴──────────────────────────┐
          │  GATES  (any one of these can reject the request)   │
          │                                                    │
          │   1. Preview claim verified                        │
          │   2. Form is published                             │
          │   3. Access control (sign-in / email domain)        │
          │   4. Org is under its submission quota              │
          │   5. Payload size is sane                           │
          │   6. Hidden-field values stripped                   │
          └─────────────────────────┬──────────────────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  7.  WRITE Response     │   ◀── the point of no return
                       └────────────┬────────────┘
                                    │
          ┌─────────────────────────┴──────────────────────────┐
          │  AFTERMATH  (nothing here can fail the request)     │
          │                                                    │
          │   8.  Tag preview submissions                       │
          │   9.  Record submission analytics                   │
          │  10.  Build the thank-you message                   │
          │  11.  Emit form.submitted  ──▶ plugins,             │
          │                                automations, PDFs    │
          │  12.  Emit usage event     ──▶ billing counters     │
          │  13.  Email the respondent a copy                   │
          └─────────────────────────┬──────────────────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │  thank-you screen       │
                       └─────────────────────────┘
```

## Walkthrough

### The gates

**1. Preview claim verified** — `responses.ts:156`

The payload can carry `isPreview: true`, which skips the publish check and access
control so builders can test draft forms. That flag is therefore an attack
surface: unchecked, anyone could set it and submit to an unpublished, restricted
form. So before honouring it, the resolver requires a signed-in user with
`EDITOR` permission on that specific form.

**2. Form is published** — `responses.ts:165`

Draft forms reject submissions. Preview bypasses this, which is the whole point
of step 1 running first.

**3. Access control** — `responses.ts:181`

Two independent settings converge here. `accessControl.enabled` restricts *who*
may respond (optionally to an email-domain allowlist). `collectRespondentEmail`
doesn't restrict anyone — it just requires sign-in so the response carries a
verified email. Either one means "we need an identity", and the resolver treats
them together as `requiresIdentity`.

Note that this is the *second* place these rules run. `resolveAccessStatus` in
`lib/accessControlEnforcement.ts` already decided what form-viewer was allowed to
render. This is the boundary that actually matters.

**4. Subscription quota** — `responses.ts:186`

Checks the organization's cached submission counter against its plan. Over the
limit, the submission is rejected outright — this is a hard stop, not a warning.

**5. Payload size** — `responses.ts:195`

At most 500 fields, and no single string over 10,000 characters. A cheap guard
against someone pointing a script at a public mutation.

**6. Hidden values stripped** — `responses.ts:213`

If the form has conditional logic, answers to fields the rules hide are deleted
server-side. The client already does this, but again — public mutation. The
stripping runs against the **live schema read from Hocuspocus**, falling back to
the database column, so a rule edited thirty seconds ago is already in force.

### The write

**7. Persist the response** — `responses.ts:250` or the plain path just after

Two routes into the database, depending on the form's settings:

- **Normal** — a simple insert.
- **Max-responses limit set** — a *Serializable* transaction that counts and
  inserts atomically (`responseService.submitResponseWithMaxLimitCheck`).
  Without the transaction, two requests arriving together could both see
  "99 of 100 used" and both insert.

The response id is generated *before* either path so it's stable across them.

Everything after this point has already succeeded from the respondent's point of
view.

### The aftermath

**8. Preview tagging** — `responses.ts:277`

Preview submissions get an automatic `__preview__` tag so they can be filtered
out of the real response table.

**9. Submission analytics** — `responses.ts:301`

Device, browser, OS, geolocation, language, timezone, and how long the respondent
took. Geo comes from Cloudflare edge headers when present.

**10. Thank-you message** — `responses.ts:350`

The message lives in `formSchema.layout.thankYouContent` and can reference
answers (`substituteMentions` swaps them in). Like step 6, the schema is read
**from Hocuspocus first**, database column second — the column is only a periodic
snapshot and lags behind in-progress collaborative edits.

**11. `emitFormSubmitted`** — `responses.ts:362`

The big one. One event, picked up by three independent listeners — see
[One Event, Three Listeners](./02-event-fanout.md), because there's more going on
here than one line suggests.

Note the payload construction: user answers are spread *first*, then `responseId`,
`submittedAt` and `isPreview` are written over the top. That ordering is
deliberate — a form field literally named `isPreview` must not be able to spoof
the real one, since it now decides whether automations fire.

**12. Usage event** — `responses.ts:379`

Increments the organization's billing counters. Confusingly this is *also* called
`emitFormSubmitted`, imported under an alias. See Gotchas.

**13. Response copy email** — `responses.ts:389`

If the form owner enabled it and the respondent consented, emails them their
answers. Deliberately not awaited — email and PDF generation are slow, and the
respondent shouldn't wait for either. Skipped for previews so testing a form
never sends real mail.

## Invariants & design decisions

- **Nothing after the write may throw.** Steps 8–13 are each individually wrapped
  so a failure is logged (and sent to Sentry) but never propagates. A broken
  webhook plugin must not turn into a failed submission for the respondent.
- **Every UI-side check is repeated server-side.** The mutation is public.
  Treat form-viewer's gating as user experience only.
- **The live schema comes from Hocuspocus, not the database.**
  `Form.formSchema` is a periodic snapshot. Any decision made against the schema
  during submission — conditional stripping, thank-you rendering — must read the
  collaborative document first. Two places already do this; a third would be a
  bug if it didn't.
- **Respondent identity is only recorded when the form asked for it.** Even if a
  valid session cookie is present, `respondentUserId` and `respondentEmail` stay
  null unless `requiresIdentity` is true. A stale token must not silently
  de-anonymise a public form.

## Shared surfaces

What this flow exposes to the rest of the system:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `emitFormSubmitted` (`plugins/core/events.ts`) | Plugin executor, automation triggers, PDF auto-run | Event shape `{ type, formId, organizationId, data, timestamp }` | You rename `data` keys, or make emission conditional |
| `data.isPreview` on the event | Automation trigger service | Server-authoritative boolean | It stops being overwritten after the user-data spread |
| `data.responseId` on the event | Plugin delivery log, PDF auto-run | Always present | You emit before the row exists |
| `Response` row | Responses table, exports, analytics, PDF generators | `data` is a flat `{ fieldId: value }` JSON object | Field values become nested or class instances |

What this flow depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `getFormSchemaFromHocuspocus` | `services/hocuspocus.ts` | Live schema for conditional stripping and thank-you text |
| `enforceAccessControlForSubmission` | `lib/accessControlEnforcement.ts` | Shared with the viewer's gate so viewing and submitting are gated identically |
| `checkUsageExceeded` | `subscriptions/usageService.ts` | Plan quota enforcement |
| `checkFormAccess` | `resolvers/formSharing.ts` | Verifying the preview claim |
| `stripConditionallyHiddenValues` | `lib/conditionalStrip.ts` | Server-side conditional logic |

## Data touched

| Model | Access |
|---|---|
| `Form` (+ `settings`) | R |
| `Response` | W |
| `ResponseTag` / `ResponseTagAssignment` | RW (preview only) |
| `FormSubmissionAnalytics` | W |
| `Subscription` | RW (quota read, counter write) |
| `CollaborativeDocument` | R (via Hocuspocus) |

## Failure & retry behavior

| Stage | On failure |
|---|---|
| Gates 1–6 | GraphQL error with a `GRAPHQL_ERROR_CODES` code; nothing written |
| The write | Error propagates; respondent sees a failure and can retry |
| Steps 8–13 | Logged + Sentry, execution continues; the respondent sees success |

There is no retry for steps 8–13 at this level. Anything that needs durable
retry — plugin deliveries, automation actions — implements it downstream.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `settings.accessControl` | Per form | Sign-in requirement + email domain allowlist |
| `settings.collectRespondentEmail` | Per form | Requires sign-in purely to capture an email |
| `settings.submissionLimits.maxResponses` | Per form | Switches to the atomic insert path |
| `settings.submissionLimits.timeWindow` | Per form | Open/close times |
| Plan submission limit | Per organization | Hard rejection when exceeded |
| 500 fields / 10,000 chars | Hardcoded, `responses.ts` | Payload guard |

## Related pages

- [One Event, Three Listeners](./02-event-fanout.md) — unpacks step 11, which is
  where plugins, automations, and PDF generation all begin.
- [Request Anatomy](./03-request-anatomy.md) — the layering this mutation sits in,
  and where the auth context comes from.

## Gotchas

- **Two different functions named `emitFormSubmitted`.** One in
  `plugins/core/events.ts` (fans out to plugins, automations, PDFs), one in
  `subscriptions/events.ts` (increments billing counters). They are unrelated.
  This resolver imports the second under the alias
  `emitSubscriptionFormSubmitted` — worth keeping that alias if you touch these
  imports.
- **The time-window check runs *after* the max-responses insert.** If a form has
  both limits configured, a submission outside the allowed window can already
  have been written by the atomic path before the window check rejects it. Worth
  knowing before you debug an orphaned row.
- **`Form.formSchema` is not authoritative during submission.** It's a snapshot.
  Reach for `getFormSchemaFromHocuspocus` first.
- **Preview submissions are real rows.** They're tagged, not separated. Anything
  that counts or exports responses needs to decide whether to include them.
