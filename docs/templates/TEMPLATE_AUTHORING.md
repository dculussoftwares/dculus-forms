# Public form templates — authoring guide

Everything needed to add or change a template on **dculus.com/forms/templates**: how the
pipeline works, which field and layout to pick, how to choose a photo, what the SEO fields
do, and how thumbnails and share previews are generated.

Templates are **data**: one JSON file per template in
`apps/backend/seed-data/public-templates/<slug>.json`. The app itself only ever reads the
database — the JSON is seed data, outside `src/` (not compiled) and excluded from the
Docker image (`/.dockerignore`). The same files seed every environment, matched by slug,
so there are never duplicates. Templates made in the product UI ("Save as template",
admin app) still work and appear in the same gallery.

---

## 1. Pipeline

```
seed-data/public-templates/<slug>.json ──pnpm db:seed-public-templates──▶ form_template row (+ photo in public R2)
                                                        │
          publicTemplateCatalog (GraphQL, no auth) ◀────┘
                    │
dculus-forms-home: pnpm sync:templates (daily PR) ──▶ src/data/templates.generated.json
                    │
          /forms/templates, /forms/templates/<slug>, /<category>  (static Astro pages)

Images (backend, @vercel/og):
  /og/templates/<slug>/card.png   1200×800 gallery thumbnail (mirrors the layout)
  /og/templates/<slug>.png        1200×630 share image for the template page
  /og/forms/<shortUrl>.png        1200×630 share image for a published form
  /og/forms/<shortUrl>.json       title/description/image for the viewer's link tags
```

## 2. Add a template (checklist)

1. **Pick the search intent.** One template = one query people type ("volunteer sign up form").
   Check it is not already covered by another template.
2. **Copy the closest JSON file** to `seed-data/public-templates/<slug>.json` (file name =
   slug). Give every page and field a **new unique id** (`uuidgen`) — ids must be unique
   across all templates.
3. **Write the fields** in `formSchema.pages[].fields` (section 4) and pick a **layout** in
   `formSchema.layout.code` (section 5).
4. **Pin a photo** (section 6) and write `thumbnailAlt`.
5. **Write the SEO copy** (section 3): `seoDescription`, `keywords`, `tags`, `content`.
6. Check it:
   ```bash
   cd apps/backend
   npx vitest run src/publicTemplates            # authoring rules
   pnpm templates:preview --only=<slug>          # PNGs in ./template-previews (no DB needed)
   ```
   Look at all three PNGs: the gallery card, the template share image and the form share image.
7. Publish to the database this checkout points at (dev by default; for another
   environment, run with that environment's `DATABASE_URL` + public bucket env):
   ```bash
   pnpm db:seed-public-templates                 # dry run — shows create/update per slug
   pnpm db:seed-public-templates --confirm --only=<slug>
   ```
   `--draft` writes it but keeps it off the gallery (`isPublic: false`).
8. On the landing repo: `TEMPLATES_GRAPHQL_URL=<api>/graphql pnpm sync:templates --dry-run`
   to see the diff. Production syncs itself daily and opens a PR.

**Deploys seed automatically.** `multi-cloud-deployment.yml` runs
`db:seed-public-templates --confirm` at the end of `terraform-infrastructure-deploy` (after
`run-migrations`, with that environment's DB + R2 keys + `PEXELS_API_KEY`/`PIXABAY_API_KEY`).
Merging a new or edited JSON file is enough; the next deploy of each environment publishes
it. The step never fails a deploy — check its log if a template is missing.

Re-running the seed is safe: rows are matched by slug, field ids come from the file, the
photo is only downloaded when the pinned id changes, and templates whose data hasn't changed
are skipped (`= unchanged`), so `updatedAt` and the image URLs only change when the template
does. **Never change the ids of a live
template** — forms copied from it and the landing sync rely on them.

## 3. Definition reference and SEO rules

| Property | Rule | Used for |
|---|---|---|
| `slug` | lowercase-hyphenated, ends in the search noun (`-form`, `-survey`). Not `og`, `index`, `page`, `search`, `category`. | URL |
| `name` | Title case, ≤ 32 chars. Heading becomes "`name` Template", or "`name` Form Template" when the name has no form word (form, survey, quiz, application, order…). | Card, H1, images |
| `description` | One sentence, ≤ 140 chars. | Gallery card |
| `category` | Reuse an existing one when you can. Its slug must not equal a template slug. | Gallery sections, `/forms/templates/<category>` |
| `seoTitle` | Optional, ≤ 60 chars, main keyword first, "Free … Template". | `<title>` |
| `seoDescription` | **140–160 chars**, starts with the main keyword, lists what it collects, ends with a benefit. | Meta description |
| `keywords` | 3–8 phrases people search, most important first. Not shown as a meta keywords tag; used for copy and gallery search. | Search, copy review |
| `tags` | 1–4 short labels ("File upload", "Multi-page"). | Card chips, gallery filter |
| `content.intro` | 1–2 sentences: what it does and why it is good. | Page lead paragraph |
| `content.audience` | Who it is for, one sentence. | "Who it's for" |
| `content.useCases` | 3–5 concrete situations. | "Use it for" list |
| `content.tips` | 2–4 practical tips that mention real product features. | "Tips" list |
| `content.faq` | ≥ 2 template-specific Q&As. Only claim features that exist. | FAQ + FAQPage JSON-LD |
| `featured` / `sortOrder` | Featured templates lead the gallery; `sortOrder` orders within a category. | Gallery order |
| `photo` | Pinned `{ source, id }` list, preferred first. | Background + images |
| `thumbnailAlt` | Describe the card: "<Name> form beside a photo of …". | `<img alt>` |

Write for people first: plain words, short sentences, no "unlock/seamless/supercharge".
Every claim in tips/FAQ must be true of the product (check before writing — e.g. response
limits and time windows live in Form Settings, respondent emails use the email plugin's
"recipient from field", Google/Microsoft Sheets are plugins).

## 4. Fields — which type when

Fields are stored JSON (what `serializeFormSchema` writes). Common keys on every answerable
field: `id`, `type`, `label`, `hint`, `placeholder`, `prefix`, `defaultValue`,
`validation: { required, type }`. The seed normalises each file through the
`@dculus/types` classes, so unknown keys are dropped.

| `type` | Extra keys | Use when | Notes |
|---|---|---|---|
| `text_input_field` | `validation.minLength/maxLength` (`validation.type: "text_field_validation"`) | Names, short answers, URLs | Put examples in `placeholder` |
| `text_area_field` | same as above | Messages, explanations | `maxLength` 1500–2000 for open feedback |
| `email_field` | — | Any email | Placeholder `name@example.com` |
| `phone_number_field` | `defaultCountry` | Phone numbers | Country picker built in |
| `number_field` | `min`, `max`, `suffix` | Counts, ages, amounts | Always bound counts (party size 1–20) |
| `date_field` | `minDate`, `maxDate` | Dates | ISO strings |
| `radio_field` | `options[]` | One answer from ≤ 6 options | All-numeric options (`"0"…"10"`) draw as a scale in images |
| `select_field` | `options[]` | One answer from > 6 options | Times, departments, sizes |
| `checkbox_field` | `options[]`, `defaultValues[]`, `validation.minSelections/maxSelections` (`"checkbox_field_validation"`) | Several answers; a single option = consent box | `minSelections: 1` + `required` for "pick at least one" |
| `file_upload_field` | `allowedMimeTypes[]`, `maxFileSizeMb`, `maxFiles` | Résumés, IDs, photos | Files go to the **private** bucket |
| `rich_text_field` | `content` (HTML) | Instructions, legal text | Not a question; ignored in counts |
| `grid_field` | `columnWidths` (e.g. `[50, 50]`) | Two short fields side by side | Put it just before its children; each child gets `gridId` (the grid's id) and `gridColumn` (0, 1…) |

Pages: `{ id, title, order, showPageName, fields[] }` — single-page forms use `showPageName: false`.

Form-design rules that make templates convert:

- Ask the **minimum**. Every optional question lowers completion; mark optional ones with `hint: 'Optional'`.
- **Order**: easy → personal → effortful. Identity first for applications/registrations;
  the key question first for surveys (NPS before demographics).
- **Multi-page** when there are > 8 questions or natural sections; 3–6 questions per page.
- First + last name side by side in a `grid_field`; email + phone in another.
- Options are mutually exclusive, ordered (scale from best to worst, or natural order), and
  include "Other"/"Prefer not to say" where real people need it.
- Labels are questions or nouns in sentence case, no trailing colon.

## 5. Layouts — L1 to L9

All layouts are mobile-first (image band + content sheet on phones). Choose by **purpose**
and **photo**. In `formSchema.layout`: `code`, `content` (intro: `<h1>` + one `<p>`),
`thankYouContent`, `customCTAButtonName` (1–3 word verb phrase), `theme` (`light`),
`spacing` (`normal`), `pageMode: "multipage"`.

| Code | Name | Composition (desktop) | Best for | Photo needs |
|---|---|---|---|---|
| L1 | Classic | Photo left 46%, content card overlapping it | Onboarding, general business | Subject on the left half |
| L2 | Modern | Flat content panel left, photo right 55% | Applications, B2B | Subject centred/right; tall crop |
| L3 | Card | Full-bleed photo, centred card | Bookings, hospitality | Busy-but-soft scene, nothing important centre |
| L4 | Minimal | Narrow photo rail (30%), airy centred column, underlined inputs | Weddings, invitations, premium brands | Vertical detail (flowers, texture) |
| L5 | Split | 50/50, content left on grey, photo right | Contact, lead capture | Person/subject facing left |
| L6 | Steps | Wide banner, headline + all pages in one scroll | Long multi-section forms (intake, onboarding) | Wide scene, subject in the middle band (top/bottom crop) |
| L7 | Single | One centred panel over a soft photo wash | Feedback, short surveys | Anything — it is heavily veiled |
| L8 | Hero | Full-bleed photo, headline + CTA on a bottom scrim | Events, campaigns, volunteer drives | Dramatic, darker lower third |
| L9 | Direct | No intro screen; the form card over a soft wash | Quick surveys (NPS/CSAT), embedded forms | Anything |

Other layout fields: `theme` (`light` default), `spacing` (`normal`), and the seed fills
`backgroundImageKey` and `backgroundDominantColor` from the photo.

## 6. Photos (Pexels / Pixabay)

- Search with the backend's keys (`PEXELS_API_KEY`, `PIXABAY_API_KEY` in `apps/backend/.env`):
  `GET https://api.pexels.com/v1/search?query=…&orientation=landscape` (header
  `Authorization: <key>`), or `https://pixabay.com/api/?key=…&q=…&image_type=photo&orientation=horizontal&min_width=1920`.
- Pin by id: `photo: [{ source: 'pexels', id: 7709148 }]`. Add a second entry as a fallback.
- Pick: landscape, ≥ 1920 px wide, natural light, real people doing the thing the form is
  for, diverse, no visible brand logos or text, no faces cut by the layout's crop (preview it!).
- Licences: both allow free commercial use without attribution. We still store and show
  credit (`imageCredit`: photographer + links) on the template page.
- **Pixabay's CDN rejects some server-side downloads (HTTP 429 from Cloudflare bot
  protection)** even when its API works. Always give a Pexels fallback for a Pixabay pick.
- The seed resizes to 2000 px JPEG (q80) and stores it at
  `files/form-template/<templateId>/<source>-<id>.jpg` in the public bucket.

## 7. Generated images (thumbnails and share cards)

Code: `apps/backend/src/services/og/` — `describe.ts` (schema → facts), `designs.ts`
(satori element trees, one gallery composition per layout), `render.ts` (`@vercel/og`),
`ogImageService.ts` (data, photo fetch + resize, LRU cache), routes in `src/routes/og.ts`.

- Fonts: Inter (400/600/700/800, from `@fontsource/inter`) with Noto Sans Tamil fallback, so
  Tamil titles render.
- Every URL handed out carries `?v=<version>` (template `updatedAt`; for forms a hash of
  updatedAt/title/background/question count). Versioned URLs are cached `immutable`;
  unversioned ones for an hour. An edit = a new URL, so no cache purge is needed.
- `PublicTemplate.thumbnailUrl` is the uploaded thumbnail if there is one, otherwise the
  generated card. `PublicTemplate.ogImageUrl` is always the generated share image.
- `Cross-Origin-Resource-Policy: cross-origin` is set on these routes (helmet defaults to
  same-origin, which would block dculus.com from showing them).
- Satori gotchas: every multi-child `div` needs `display: flex` (`box()` sets it); text is
  not measured — `truncate()` long strings; `objectPosition` is not reliable, so choose
  photos whose subject survives a centre crop.

## 8. Share previews for published forms

`apps/form-viewer/public/_worker.js` (Cloudflare Pages advanced mode) + `_routes.json`
(`/f/*` only). For `/f/<shortUrl>` it fetches `<api>/og/forms/<shortUrl>.json` (1.5 s
timeout, edge-cached 5 min), injects `og:*` / `twitter:*` tags and the form title into the
SPA shell, and returns the page. Missing/unpublished forms or API errors return the page
untouched.

- `_headers` is **not** applied to worker responses, so the worker re-applies the `/*`
  security headers. `src/__tests__/shareWorker.test.ts` fails if they drift apart.
- Only published, non-deleted forms produce meta/images. The image uses the live (Y.js)
  schema, like the viewer.
- Local check: build the viewer, write a `config.js` with `VITE_API_URL`, run
  `npx wrangler pages dev dist` and `curl localhost:8788/f/<shortUrl>`.

## 9. The landing site (dculus-forms-home)

- Snapshot fields: everything in `PublicTemplate` (incl. `seoTitle`, `keywords`, `tags`,
  `content`, `imageCredit`, `featured`, `sortOrder`, `ogImageUrl`).
- Hand-written MDX in `src/content/templates/<slug>.mdx` still overrides `intro` and adds
  FAQ items and body copy on top of `content`.
- "Use this template" → `forms.dculus.com/signup?template=<slug>`; the product remembers
  the slug through sign-up and opens the copy in the builder.

## 10. Current catalog

| Slug | Category | Layout | Pages | Questions | Time | Photo | Field types |
|---|---|---|---|---|---|---|---|
| `contact-form` | Business | L5 | 1 | 6 | ~2 min | pexels 7709148 | grid, text_input, email, phone_number, radio, text_area |
| `event-registration-form` | Events | L8 | 2 | 12 | ~3 min | pexels 22669860 | grid, text_input, email, phone_number, radio, checkbox, text_area, select |
| `job-application-form` | HR & Recruiting | L2 | 3 | 16 | ~4 min | pexels 5439153 | grid, text_input, email, phone_number, select, radio, date, number, text_area, file_upload, checkbox |
| `customer-satisfaction-survey` | Feedback & Surveys | L9 | 1 | 6 | ~2 min | pexels 6612709 | radio, checkbox, text_area, email |
| `employee-onboarding-form` | HR & Recruiting | L1 | 4 | 20 | ~5 min | pexels 3865537 | grid, text_input, date, email, phone_number, text_area, select, radio, checkbox, file_upload |
| `restaurant-reservation-form` | Hospitality | L3 | 1 | 9 | ~2 min | pexels 17057034 | grid, date, select, number, radio, text_input, phone_number, email, text_area |
| `wedding-rsvp-form` | Events | L4 | 1 | 8 | ~2 min | pexels 33104578 | text_input, email, radio, number, text_area |
| `volunteer-sign-up-form` | Nonprofit | L8 | 3 | 13 | ~3 min | pexels 6646916 | grid, text_input, email, phone_number, radio, checkbox, select, text_area |
| `workshop-feedback-form` | Education | L7 | 1 | 9 | ~3 min | pexels 5756649 | text_input, radio, text_area, checkbox, email |
| `patient-intake-form` | Healthcare | L6 | 4 | 18 | ~6 min | pexels 6129159 (fallback 4269274) | grid, text_input, date, select, phone_number, email, text_area, file_upload, checkbox, radio, rich_text |

Ideas for the next batch (high search volume, no overlap): lead generation, product order,
support ticket, course registration, membership application, gym/class booking, NPS-only
survey, employee feedback, quiz (uses `formSchema.settings.quiz`), appointment request.
