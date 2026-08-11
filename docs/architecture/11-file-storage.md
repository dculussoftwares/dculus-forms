# Where Files Live

Two Cloudflare R2 buckets with genuinely different access models. Getting an
upload into the wrong one is either a privacy incident or a broken image, so the
routing is a lookup table rather than a judgement call at each call site.

| Bucket | Access | Holds |
|---|---|---|
| **Public** | Served via CDN, no auth | Template thumbnails, form backgrounds, avatars, org logos |
| **Private** | Pre-signed URLs only | Respondent file uploads, base PDFs, generated PDFs, temporary exports |

The rule of thumb: **anything a respondent produced is private.** Anything the
form owner chose to display publicly is public.

## At a glance

| | |
|---|---|
| **Entry point** | `apps/backend/src/routes/upload.ts` — `POST /upload` |
| **Trigger** | Any file upload from any of the three apps |
| **Execution** | Synchronous multipart upload |
| **Outcome** | An object in one of two buckets, plus a CDN URL or an S3 key |
| **Fails loudly?** | Yes — rejections return 400 / 413 with a code |

## The flow

```
   POST /upload  (multipart, 50 MB multer ceiling)
        │
        ▼
   ┌────────────────────────────────┐
   │ Type allowlist                 │  6 known values, else 400
   ├────────────────────────────────┤
   │ Per-type required params       │  formId, organizationId, …
   ├────────────────────────────────┤
   │ Auth + permission              │
   ├────────────────────────────────┤
   │ Blocked MIME types             │  html, js, php, sh, executables
   ├────────────────────────────────┤
   │ Per-type MIME + size limits    │
   └───────────────┬────────────────┘
                   ▼
   ┌────────────────────────────────┐
   │ UPLOAD_TYPE_BUCKET_MAP         │  unknown type → PRIVATE
   └───────┬────────────────┬───────┘
           ▼                ▼
   ┌──────────────┐   ┌──────────────┐
   │ PUBLIC       │   │ PRIVATE      │
   │ ACL public   │   │ no ACL       │
   │ → CDN URL    │   │ → S3 key     │
   └──────────────┘   └──────┬───────┘
                             ▼
                     pre-signed download URL
                          (15 min)

   separately:  temp-exports/{ts}-{uuid}-{name}   → 5 h, swept periodically
```

## Walkthrough

### The routing table

```ts
const UPLOAD_TYPE_BUCKET_MAP: Record<string, BucketMode> = {
  FormTemplate:     'PUBLIC',   // Template thumbnails shown in the UI
  FormBackground:   'PUBLIC',   // Backgrounds served in the viewer
  UserAvatar:       'PUBLIC',   // Profile pictures
  OrganizationLogo: 'PUBLIC',   // Org logos
  FormResponse:     'PRIVATE',  // Respondent uploads
  PdfTemplateAsset: 'PRIVATE',  // Base PDFs
};
```

The lookup **defaults to `PRIVATE` for unknown types**. A new upload type that
someone forgets to add here fails closed — the file is inaccessible rather than
world-readable. That default is the single most important line in this file.

The route separately rejects any `type` not in its own allowlist, so an unknown
type shouldn't reach the map at all. Two layers, and the inner one fails safe.

### Validation, in order

**Type allowlist** — six known values, anything else is a 400.

**Per-type required parameters** — `FormBackground` and `PdfTemplateAsset` need a
`formId`, `OrganizationLogo` needs an `organizationId`.

**Blocked MIME types, unconditionally** — HTML, XHTML, JavaScript in all its
declared forms, PHP, shell scripts, and executables (ELF, Mach-O, PE). This runs
regardless of what a field's own config allows, because a public-bucket object is
served from a CDN origin: stored HTML or JS would be stored XSS.

**Per-type restrictions** — `PdfTemplateAsset` must be `application/pdf`.
`FormBackground` accepts images plus `video/mp4` and `video/webm`, for stock video
backgrounds.

### Size limits, layered

| Limit | Value | Where |
|---|---|---|
| Route ceiling | 50 MB | multer, `upload.ts` |
| Images | 5 MB | `fileUploadService.ts` |
| Background video | 45 MB | `fileUploadService.ts` |
| Base PDFs | 10 MB | `fileUploadService.ts` |

The video limit sits deliberately *below* the multer ceiling so an oversized video
fails through the service's controlled path — mapped to a 413 with
`FILE_TOO_LARGE` — rather than surfacing multer's raw `LIMIT_FILE_SIZE`.

The 50 MB route ceiling exists to accommodate `FormResponse` uploads, whose real
cap is the form field's own `maxFileSizeMb`.

### Reading files back

**Public** objects get a CDN URL built from `PUBLIC_S3_CDN_URL`. No auth, cacheable,
shareable.

**Private** objects have no URL. `generatePresignedDownloadUrl` mints one on
demand, valid **15 minutes** by default. Permission is checked when the URL is
requested, not when it's used — a leaked URL works for its remaining lifetime,
which is what the short expiry is for.

### Temporary export files

Excel and CSV exports are a third case: private bucket, but with their own
lifecycle.

Key format: `temp-exports/{timestamp}-{uuid}-{filename}`, with a **5-hour**
pre-signed URL matching a 5-hour retention.

Cleanup is deliberately simple — `cleanupExpiredFiles` lists the `temp-exports/`
prefix and parses the timestamp **out of the key itself**, deleting anything older
than the cutoff. No database table, no metadata read. The key *is* the expiry
record, which means cleanup works even if the process that created the file died
immediately after.

That also makes the key format load-bearing: change the prefix or move the
timestamp and cleanup silently stops matching, and the bucket fills up quietly.

## Invariants & design decisions

- **Unknown upload types default to private.** Fail closed.
- **Dangerous MIME types are blocked unconditionally**, above and beyond per-field
  configuration. A CDN-served HTML file is stored XSS.
- **Respondent-produced files are never public.** Response uploads only ever reach
  the private bucket.
- **Private objects have no durable URL.** Pre-signed, short-lived, permission
  checked at mint time.
- **The temp-export key encodes its own expiry.** Cleanup needs no other state.
- **Service-level limits sit under the route ceiling**, so failures take the
  controlled path with a proper error code.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| `uploadFile` | Upload route, PDF template save, response copy | Returns key plus a CDN URL for public objects | The return shape changes |
| `generatePresignedDownloadUrl` | Responses table, PDF download, exports | Default 15-minute expiry | The default shortens without callers being updated |
| `downloadFileBuffer` | `hydrateTemplate` for base PDFs | Returns a `Buffer` by key | It starts streaming instead |
| `UPLOAD_TYPE_BUCKET_MAP` | The whole upload path | Unknown → `PRIVATE` | The default flips to public |
| `temp-exports/{ts}-{uuid}-{name}` | `cleanupExpiredFiles` | Timestamp is the first segment | The key format changes |
| `copyFileForForm` | Template instantiation | Copies within a bucket, preserving mode | It crosses buckets |

What this depends on:

| Depends on | Owned by | Why |
|---|---|---|
| Cloudflare R2 (S3 API) | External | Both buckets |
| `@aws-sdk/s3-request-presigner` | npm | Pre-signed URLs |
| `multer` | npm | Multipart parsing, memory storage |
| Auth middleware | Middleware | Permission checks on the route |

## Data touched

| Model | Access |
|---|---|
| `FormFile` | W — `FormBackground` uploads with a `formId` |
| `PdfTemplate.fileKey` | W — base PDF location |
| `Response.data` | R — file field values hold private keys |

No table tracks public-bucket objects generally; the CDN URL is stored inline
wherever it's used.

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Unknown `type` | 400 `BAD_USER_INPUT` |
| Missing required param | 400 with the specific field named |
| Blocked MIME type | Throws — "not allowed for security reasons" |
| Over a service size limit | 413 `FILE_TOO_LARGE` |
| Over the 50 MB multer ceiling | multer's own error, before the handler runs |
| R2 unreachable | Throws; the caller surfaces the failure |
| Cleanup fails for one object | Counted in `errors`; the sweep continues |

No retry. Uploads are user-initiated and re-tried by the user.

## Configuration

| Variable | Effect |
|---|---|
| `PUBLIC_S3_BUCKET_NAME` | Public bucket |
| `PRIVATE_S3_BUCKET_NAME` | Private bucket |
| `PUBLIC_S3_CDN_URL` | Base for public URLs |
| `PUBLIC_S3_ENDPOINT` / `PUBLIC_S3_ACCESS_KEY` / `PUBLIC_S3_SECRET_KEY` | R2 credentials |
| `MAX_FILE_SIZE` = 5 MB | Images |
| `MAX_VIDEO_FILE_SIZE` = 45 MB | Background video |
| `MAX_PDF_TEMPLATE_SIZE` = 10 MB | Base PDFs |
| multer `fileSize` = 50 MB | Route ceiling |
| Pre-signed default = 900 s | Download URL lifetime |
| Temp export TTL = 5 h | Retention and URL lifetime |

## Related pages

- [PDF Generation](./06-pdf-generation.md) — the largest consumer of the private
  bucket, in both directions.
- [The Life of a Submission](./01-submission-lifecycle.md) — where response file
  values (private keys) are written.

## Gotchas

- **A new upload type needs two edits.** The route's allowlist *and*
  `UPLOAD_TYPE_BUCKET_MAP`. Add only the first and it lands in the private bucket
  by default — safe, but the file will be unreachable if you expected a CDN URL.
- **Public objects cannot be un-published.** Once served from the CDN, assume it's
  cached. Moving a type from public to private doesn't retract what's already out.
- **The temp-export key format is parsed, not just generated.** Change it and
  cleanup silently stops working — no error, just a bucket that keeps growing.
- **Pre-signed URLs outlive the permission check.** Permission is verified when the
  URL is minted, not when it's followed. That's what the 15-minute default is
  guarding.
- **`FormResponse` size is not capped at 5 MB.** Images are; response uploads are
  bounded by the field's `maxFileSizeMb` under the 50 MB route ceiling.
