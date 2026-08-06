# PDF Generation

Someone designs a certificate once, and every matching response turns into a
filled-in PDF — automatically on submit, or in bulk over 5,000 old responses.
Four models carry that, and the chain is easier to follow once you know what each
one is *for*:

| Model | Answers |
|---|---|
| `PdfTemplate` | What does the document look like, and where do the fields sit? |
| `PdfGenerator` | Which responses get one, and what is the column called? |
| `PdfGenerationRun` | One batch job — how far has it got? |
| `PdfGenerationResult` | One PDF for one response |

The template is designed with [pdfme](https://pdfme.com); the interesting part
here is how a placed box on that canvas finds the right answer.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/services/pdfGenerationJobService.ts:159` — `runPdfGenerationLoop` |
| **Trigger** | A manual run from the Generators UI, or `form.submitted` when `autoRunOnSubmit` is set |
| **Execution** | Asynchronous, fire-and-forget, batched |
| **Outcome** | A PDF per response in the private bucket, plus a `PdfGenerationResult` row |
| **Fails loudly?** | No — per-response failures are recorded and the run continues |

## The flow

```
   PdfTemplate                       PdfGenerator
   (pdfme design +          ┌──────  (template + response filters
    field bindings)         │         + autoRunOnSubmit + columnName)
        │                   │
        └───────────────────┘
                  │
      manual run  │  or  form.submitted (autoRunOnSubmit)
                  ▼
        ┌─────────────────────┐
        │  PdfGenerationRun   │  status: running
        └──────────┬──────────┘
                   │  batches of 10, 500 ms apart
                   ▼
        ┌─────────────────────┐
        │  per response:      │
        │   · hydrate template│  ← base PDF pulled from private R2
        │   · build inputs    │  ← three binding conventions
        │   · @pdfme/generator│
        └──────────┬──────────┘
                   ▼
        ┌─────────────────────┐        ┌──────────────────┐
        │ PdfGenerationResult │───────▶│ Private R2 bucket│
        └─────────────────────┘        └──────────────────┘
                   │
                   ▼
        run: completed | cancelled | failed
```

## Walkthrough

### The template

`PdfTemplate.template` holds a pdfme `Template` JSON. For an uploaded base PDF,
the `basePdf` bytes are **stripped out** and kept in the private bucket under
`fileKey` — the JSON column stores layout, not a base64 document. Blank-page
templates keep `{ width, height, padding }` inline and have no `fileKey`.

`hydrateTemplate` puts them back together at generation time, downloading the
base PDF and reattaching it as a `Uint8Array`.

### How a box on the canvas finds an answer

`buildTemplateInputs` is the heart of this feature. Three binding conventions,
checked in this order per element:

**1. Bound field** — the element carries `dculusFieldId`.
Inserted by the designer's form-fields panel. The element's visible `content` is
just a display label and is ignored entirely; the value comes from the response.
A deleted or unanswered field resolves to `''` rather than erroring.

**2. Inline field tokens** — the element carries `dculusTextTemplate` plus a
`dculusFieldVars` map of token → field id.
This is what the designer's @-mention text editor writes, letting one text box
mix prose and answers: `Dear {name}, your score was {score}.` Again the rendered
`content` is display-only; the `dculusTextTemplate` string is the real source.

Note the replacement regex uses lookarounds to match a standalone `{token}` and
never the inner braces of a legacy `{{fieldId}}` — a token named the same as a
field id would otherwise corrupt the third convention.

**3. Legacy `{{fieldId}}` placeholders** typed directly into text content. Same
convention as the email plugin and the thank-you page, but plain text — no HTML
escaping.

Elements marked `readOnly` render from their own content and are deliberately
excluded from inputs.

### The generator

A `PdfGenerator` is a saved combination: a template, a set of response filters
(the *same* `ResponseFilter[]` shape the responses table uses, via
`applyResponseFilters`), and a few presentation choices.

Two of its fields have non-obvious rules:

- **`columnName` is locked once set.** It's the header of this generator's column
  in the Responses table; changing it after responses and exports have referenced
  it would be confusing. Setting it for the first time is still allowed.
- **`filenameFieldId`** picks the form field whose value becomes the downloaded
  filename, plus a random suffix for uniqueness. Unset falls back to a
  template-name / response-id pattern.

Empty strings are normalised to `null` on write, so the `?? name` fallbacks
behave consistently rather than rendering an empty header.

### The run loop

Batches of 10 with a 500 ms pause. Two details worth knowing:

**Progress is written after every response, not every batch.** Not for
granularity — because `getLatestPdfGenerationRun` uses `updatedAt` to detect
stalled runs, and a slow batch would otherwise look like a hung one.

**The run row can vanish mid-loop.** Deleting the generator cascades to its runs.
The loop re-reads the run at each batch boundary and returns quietly if it's
gone; without that check, the update would throw "record not found" from inside a
fire-and-forget `void` call and surface as an unhandled rejection.

Cancellation is cooperative: status is set to `cancelling`, and the loop notices
at the next batch boundary and switches to `cancelled`.

### Fonts

`getPdfFonts` loads Roboto as the fallback plus **Noto Sans Tamil**, read from
`apps/backend/src/assets/fonts/`. Without the Tamil face, Tamil answers render as
empty boxes — the font map is not optional dressing.

### Storage and cleanup

Generated PDFs go to the **private** bucket; there is no public URL. Downloads go
through pre-signed URLs, and bulk download goes through
`pdfGeneratorZipService`. Deleting a generator cleans up its objects, best-effort
— a storage failure there logs a warning rather than blocking the delete.

## Invariants & design decisions

- **Base PDF bytes never live in the database.** They're in R2 under `fileKey`
  and rehydrated per run. The JSON column stays a layout description.
- **Binding order is load-bearing.** `dculusFieldId` beats `dculusTextTemplate`
  beats `{{fieldId}}`. An element matching more than one must resolve the same
  way every time.
- **A missing or deleted field renders empty, never throws.** One removed form
  field must not fail generation for 5,000 responses.
- **Per-response failures don't fail the run.** They're recorded as a `failed`
  `PdfGenerationResult` and the loop moves on.
- **Soft-deleted responses are filtered out of results everywhere.** Single
  lookup, list view, and the ZIP-availability count all need the same exclusion —
  a response deleted after its PDF was generated must disappear from all three.
- **`columnName` is immutable once set.** See above.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `generateSinglePdfForGenerator` | `plugins/core/pdfGeneratorAutoRun.ts` | Generates for one response id | The signature becomes batch-only |
| `regeneratePdfsForResponse` | Response edit flow | Regenerates every generator's PDF for a response | It stops being idempotent per `(generatorId, responseId)` |
| `PdfGenerator.columnName` | Responses table columns | Stable header string | It becomes mutable |
| `generatePdfForResponse` | `resolveResponsePdfAttachment` (email attachments) | Returns PDF bytes for one response | It starts requiring a generator |
| `PdfGenerationResult` | Responses table cells, ZIP export | `(generatorId, responseId)` uniqueness | The unique constraint is dropped |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| `applyResponseFilters` | `services/responseFilterService.ts` | Generator filters reuse the responses-table filter engine |
| `deserializeFormSchema` | `@dculus/types` | Field labels and value formatting |
| `downloadFileBuffer` / private bucket | `services/fileUploadService.ts` | Base PDFs in, generated PDFs out |
| `plugin:event` emitter | `plugins/core/events.ts` | `autoRunOnSubmit` |
| `@pdfme/generator` + `@pdfme/schemas` | npm | Rendering |

## Data touched

| Model | Access |
|---|---|
| `PdfTemplate` | R |
| `PdfGenerator` | RW |
| `PdfGenerationRun` | RW |
| `PdfGenerationResult` | RW |
| `Response` | R |

## Failure & retry behavior

| Situation | What happens |
|---|---|
| One response fails to render | `PdfGenerationResult` with `status: 'failed'` and the message; loop continues |
| The whole run throws | Run marked `failed` — inside its own try/catch, because the run row may already be gone |
| Run row deleted mid-loop | Loop returns silently at the next batch boundary |
| User cancels | Status `cancelling` → loop switches it to `cancelled` |
| Storage cleanup fails on generator delete | Warning logged; the delete still succeeds |

No automatic retry. A failed result is re-attempted by re-running the generator.

## Configuration

| Setting | Where | Effect |
|---|---|---|
| `BATCH_SIZE = 10` | `pdfGenerationJobService.ts` | Responses per batch |
| `BATCH_DELAY_MS = 500` | `pdfGenerationJobService.ts` | Pause between batches |
| `autoRunOnSubmit` | Per generator | Generates on new matching submissions |
| `enabled` | Per generator | Excluded from auto-run when false |
| `PRIVATE_S3_BUCKET_NAME` | Environment | Where base PDFs and output live |

## Related pages

- [One Event, Three Listeners](./02-event-fanout.md) — the third listener is what
  makes `autoRunOnSubmit` work.
- [The Life of a Submission](./01-submission-lifecycle.md) — where that event is
  emitted.

## Gotchas

- **A text element's visible `content` is not what gets rendered** for
  conventions 1 and 2. The designer shows a label; generation uses
  `dculusFieldId` / `dculusTextTemplate`. Debugging "the PDF prints something
  different from the canvas" almost always lands here.
- **`readOnly` elements are excluded from inputs.** Adding one and wondering why
  its binding is ignored is the expected first confusion.
- **Tamil needs its font explicitly.** No Noto Sans Tamil in the font map means
  blank glyphs, not an error.
- **The generator's filters share the responses-table filter engine.** Changing
  `applyResponseFilters` semantics silently changes which responses get PDFs.
