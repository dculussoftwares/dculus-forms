# Feature Inventory

Neutral, code-grounded list of what dculus-forms does today. Source: exploration of `apps/*` and `packages/*` on 2026-07-05.

## Field types

Built on a typed class hierarchy (`packages/types/src/index.ts`): `FormField` → `FillableFormField` / `NonFillableFormField`.

| Field | Config |
|---|---|
| Text Input | min/max length |
| Text Area | min/max length |
| Email | required validation |
| Number | min/max |
| Date | min/max date |
| Select (dropdown) | options list |
| Radio | options list |
| Checkbox | options, default values, min/max selections |
| File Upload | allowed MIME types, max file size, max files (cap 10) |
| Rich Text | display-only HTML block (non-fillable) |

Every field's validation rules are enforced consistently in the builder, the live collaborative editor, the public viewer, and analytics/export — one schema, one source of truth.

## Form builder

- Drag-and-drop page/field reordering (`@dnd-kit/core`)
- Multi-page forms with page thumbnails, duplication, reorder, rename
- **Real-time multiplayer editing** — Y.js + Hocuspocus; multiple editors see each other's changes live
- 9 layout templates (`L1`–`L9`: classic, modern, card, minimal, split, wizard, single, image, pages)
- Theme (light/dark/auto) and spacing (compact/normal/spacious) controls
- Custom background: solid color, overlay, or blurred image; built-in Pixabay + Pexels stock photo search, plus direct upload
- Custom CTA button text, rich-text intro content per layout
- Question/response shuffling toggle
- Submission limits: max response count and/or a time window
- Custom thank-you message

### AI-assisted building

- **AI chat agent** that edits the live form via tool-calling (add/update/remove/reorder fields, change layout, manage pages, propose validation or field-type changes) — metered per-organization token usage
- **AI field insights** — automatic per-field quality tips (warning/error/success/info) with a one-click fix, cached and invalidated when the field changes
- **AI form creation wizard** — generate a form from a prompt (Quick ≤5 fields / Standard 6–10 / Professional 10–20, single- or multi-page) or start from a template

## Form viewer (public, respondent-facing)

- Loaded by short URL, no login required
- Tracks view + completion-time analytics automatically
- Client-side file validation before upload, 30s submission timeout, duplicate-submit guard
- Clear messaging when a form has hit its submission limit or closed its time window
- Custom or default thank-you page

## Response management

- Manual response editing with a **full audit trail**: who changed what, when, from where (IP/UA), with per-field before/after values (`ResponseEditHistory` + `ResponseFieldChange`)
- Response tagging (manual or AI-assisted, see plugins)
- Rich filtering: equals/contains/starts-with/ends-with/empty, numeric and date comparisons (including "last N days"), IN/NOT IN, AND/OR combinations — pushed down to SQL for performance
- Excel and CSV export with type-aware formatting (localized dates, filenames for uploads, joined arrays); plugins can contribute extra export columns (quiz score, etc.)

## Analytics

**Form-level**: views, unique sessions, device/browser/OS breakdown, geolocation (country/region/city, powered by MaxMind + Cloudflare edge headers), views-over-time, completion-time percentiles (p50/p75/p90/p95) and time-bucket distribution.

**Per-field** (a dedicated processor per field type):
- Text — length stats, word cloud, common phrases
- Number — min/max/average/median/std-dev, percentiles, trend
- Select/Radio — option frequency, distribution shape (even/concentrated/polarized)
- Checkbox — option stats, top combinations, pairwise correlations
- Date — earliest/latest/most-common, weekday/monthly/seasonal distribution
- Email — validity rate, domain/TLD breakdown, corporate vs. personal
- File Upload — total files, extension distribution, response coverage

Every field metric includes a response rate. Visualized via dedicated charts (world map, browser/OS, completion-time, per-field) in the form-app dashboard.

## Plugin system (event-driven: `form.submitted`, `plugin.test`)

| Plugin | What it does |
|---|---|
| Webhook | HMAC-signed POST of the submission to any URL, custom headers, delivery tracking |
| Email Notification | Custom HTML email with live `@mention` substitution of response values |
| Quiz Auto-Grading | Per-question correct-answer scoring, pass/fail threshold, adds 4 export columns |
| AI Auto-Tagger | LLM reads each response and applies your tag definitions automatically |
| Google Sheets | OAuth-connected; appends each submission as a spreadsheet row |
| Microsoft Excel | OAuth-connected to OneDrive; appends rows to a workbook |
| Slack | Listed in the UI catalog but not yet implemented (`comingSoon`) |

Every plugin invocation is logged (payload, response, success/failure) for debugging.

## Collaboration & sharing

- Form sharing scopes: **Private** (explicit grants only), **Specific members**, **All org members** (with a default permission)
- Per-user permission levels: Owner / Editor / Viewer / No access
- Organization model with member roles (owner/member), invitations with expiry

## Auth & multi-tenancy

- Email/password (with breach-password screening), email OTP, magic link, Google OAuth
- System roles: user / admin / superAdmin
- One organization per user (enforced), 7-day sessions

## Billing

Three tiers, priced in USD and INR:

| Plan | Views | Submissions | Price |
|---|---|---|---|
| Free | 10,000/mo | 1,000/mo | $0 |
| Starter | Unlimited | 10,000/mo | $6/mo or $66/yr (₹489/mo, ₹5,400/yr) |
| Advanced | Unlimited | 100,000/mo | $15/mo or $168/yr (₹1,289/mo, ₹14,268/yr) |

Usage warnings fire at 80%; enforcement blocks further views/submissions once the limit is hit. Plan pricing is fetched live from Chargebee with these values as a fallback.

*(Verify these numbers against `chargebeeService.ts` before publishing — they're the kind of thing that changes with pricing experiments.)*

## Admin app

Internal ops dashboard: storage/DB stats, plan distribution across orgs, usage alerts (orgs ≥80% of limit), org/user management (roles, ban), subscription plan changes, form template CRUD, transactional email previews.

## Internationalization

Full English and Tamil localization across form-app and admin-app (100+ translated namespaces), paired with INR pricing — a deliberate, explicit India/Tamil Nadu market focus alongside a global English audience.
