# Public templates — technical flow

How a template goes from a JSON file to a page on dculus.com, how its images are made,
and how a visitor turns it into their own form. Six flows:

1. [Big picture](#1-big-picture)
2. [Seeding a template into an environment](#2-seeding-a-template-into-an-environment)
3. [Landing site build (dculus.com)](#3-landing-site-build-dculuscom)
4. [Generated images (thumbnail and share card)](#4-generated-images-thumbnail-and-share-card)
5. [Visitor uses a template](#5-visitor-uses-a-template)
6. [Sharing a published form link](#6-sharing-a-published-form-link)

---

## 1. Big picture

```mermaid
flowchart LR
  subgraph Repo["dculus-forms repo (not shipped in the image)"]
    JSON["seed-data/public-templates/&lt;slug&gt;.json<br/>fields · layout · SEO copy · photo id"]
  end

  subgraph Stock["Stock photos"]
    PX["Pexels / Pixabay API"]
  end

  subgraph Env["Each environment (dev / prod)"]
    DB[("Postgres<br/>form_template")]
    R2[("R2 public bucket<br/>files/form-template/&lt;id&gt;/")]
    API["Backend API<br/>GraphQL + /og/* images"]
  end

  subgraph Landing["dculus-forms-home (Astro, static)"]
    SNAP["src/data/templates.generated.json"]
    SITE["dculus.com/forms/templates/*"]
  end

  JSON -- "pnpm db:seed-public-templates --confirm" --> DB
  PX -- "photo downloaded once" --> R2
  DB --> API
  R2 --> API
  API -- "pnpm sync:templates (daily PR)" --> SNAP
  SNAP -- "astro build" --> SITE
  SITE -- "Use this template" --> APP["forms.dculus.com/signup?template=&lt;slug&gt;"]
  APP --> API
```

The running app reads templates **only from the database**. The JSON files are seed data:
they live outside `src/`, are not compiled, and `.dockerignore` keeps them out of the image.

---

## 2. Seeding a template into an environment

`apps/backend/src/scripts/seed-public-templates.ts`. It runs **automatically on every
deploy** (GitHub Actions, see below), and you can also run it from a checkout whose `.env`
points at an environment (dev by default).

```mermaid
flowchart LR
  M["Merge JSON change to main"] --> B["build.yml → deploy dev"]
  R["release.yml → deploy prod"] --> D
  B --> D["multi-cloud-deployment.yml"]
  D --> MIG["run-migrations"]
  MIG --> INF["terraform-infrastructure-deploy<br/>(R2 keys from Terraform)"]
  INF --> S["Seed public templates<br/>(continue-on-error)"]
  S --> DB[("that env's DB + R2")]
```

```mermaid
sequenceDiagram
  autonumber
  actor Dev as You
  participant Seed as seed-public-templates.ts
  participant Files as seed-data/*.json
  participant Val as validate.ts
  participant DB as Postgres (form_template)
  participant Stock as Pexels / Pixabay
  participant R2 as R2 public bucket

  Dev->>Seed: pnpm db:seed-public-templates [--confirm] [--only=slug]
  Seed->>Files: loadCatalog() — read every <slug>.json
  Seed->>Val: validateCatalog()
  Val-->>Seed: problems[] (slug/file name, SEO lengths, ids, options, layouts…)
  alt any problem
    Seed-->>Dev: exit with the list, nothing written
  end
  alt dry run (no --confirm)
    Seed->>DB: find by slug (id only)
    Seed-->>Dev: "create" / "update" per template
  else --confirm
    Seed->>DB: find by slug
    opt not found
      Seed->>DB: createTemplate(name, category, schema, slug, isPublic=false)
    end
    alt photo already stored for this template
      Note over Seed: reuse key, no download
    else
      Seed->>Stock: GET photo by pinned id (first that works)
      Stock-->>Seed: image + photographer credit
      Note over Seed: sharp → 2000px JPEG, dominant colour
      Seed->>R2: put files/form-template/<id>/pexels-<photoId>.jpg
    end
    alt nothing changed
      Seed-->>Dev: = unchanged (no write, image URLs stay the same)
    else
      Seed->>DB: updateTemplate(schema + backgroundImageKey,<br/>seo fields, tags, content, imageCredit, isPublic=true)
      Seed-->>Dev: ✔ created / updated (changed fields listed)
    end
  end
```

Re-running is safe: matched by **slug** (no duplicates), field ids come from the file, and
the photo is only downloaded when the pinned id changes.

---

## 3. Landing site build (dculus.com)

```mermaid
flowchart TD
  CRON["GitHub Action (daily) or<br/>pnpm sync:templates"] --> Q["POST /graphql<br/>publicTemplateCatalog (no auth)"]
  Q --> API["Backend: templateService.getPublicTemplateCatalog()<br/>isActive + isPublic + slug, ordered by category · sortOrder · name"]
  API --> RESP["templates[]: formSchema, seo fields, tags, content,<br/>imageCredit, thumbnailUrl, ogImageUrl"]
  RESP --> CHECK["scripts/lib/public-templates.mjs<br/>strict validation (https, slugs, schema)"]
  CHECK -- invalid --> FAIL["run fails, snapshot untouched"]
  CHECK -- valid --> SNAP["src/data/templates.generated.json"]
  SNAP --> PR["PR with human-readable diff"]
  PR -- "you merge" --> BUILD["astro build"]
  BUILD --> G["/forms/templates<br/>gallery + search + Popular row"]
  BUILD --> T["/forms/templates/&lt;slug&gt;<br/>hero · live preview · questions · tips · FAQ · JSON-LD"]
  BUILD --> C["/forms/templates/&lt;category&gt;"]
  MDX["src/content/templates/&lt;slug&gt;.mdx<br/>(optional hand-written copy)"] --> T
```

On the template page:

| Part | Comes from |
|---|---|
| `<title>`, meta description | `seoTitle`, `seoDescription` |
| Hero thumbnail, gallery card | `thumbnailUrl` → backend `/og/templates/<slug>/card.png` |
| `og:image` | `ogImageUrl` → backend `/og/templates/<slug>.png` |
| Live preview | `@dculus/form-renderer` (the real form renderer) + `formSchema` |
| "What this template asks" | `formSchema` fields, rendered as HTML |
| Who it's for / tips / FAQ | `content` (+ MDX + standard FAQ) |
| Photo credit | `imageCredit` |

---

## 4. Generated images (thumbnail and share card)

`apps/backend/src/routes/og.ts` → `services/og/*`. Images are **drawn**, not screenshotted:
`designs.ts` is a simplified, hand-written copy of each layout (L1–L9). It reads the same
template data as the real form but is separate drawing code, with fixed limits (first 3
options per question, labels cut at ~34 chars, questions until the space is used).

```mermaid
sequenceDiagram
  autonumber
  participant Client as Browser / Astro build / Slack bot
  participant CF as Cloudflare cache
  participant Route as routes/og.ts
  participant Svc as ogImageService.ts
  participant DB as Postgres
  participant R2 as R2 (photo)
  participant OG as @vercel/og (satori + resvg)

  Client->>CF: GET /og/templates/<slug>/card.png?v=2.<updatedAt>
  alt cached
    CF-->>Client: PNG
  else
    CF->>Route: forward
    Route->>Svc: renderTemplateImage(slug, "card")
    Svc->>Svc: in-memory LRU hit? → return PNG
    Svc->>DB: public template by slug
    Svc->>Svc: describe.ts — fields, headline, counts, layout code
    Svc->>R2: fetch background photo
    Note over Svc: sharp → small JPEG data URI
    Svc->>Svc: designs.ts — element tree for this layout
    Svc->>OG: render element tree (Inter + Noto Sans Tamil)
    OG-->>Svc: PNG
    Svc-->>Route: PNG (cached in LRU)
    Route-->>CF: PNG, Cache-Control immutable (versioned URL)
    CF-->>Client: PNG
  end
```

| URL | Size | Used for |
|---|---|---|
| `/og/templates/<slug>/card.png` | 1200×800 | Gallery card + template hero |
| `/og/templates/<slug>.png` | 1200×630 | Template page share image |
| `/og/forms/<shortUrl>.png` | 1200×630 | Published form share image |
| `/og/forms/<shortUrl>.json` | — | Title/description/image for link previews |

The `?v=` version = `OG_DESIGN_VERSION` + the template's last edit, so editing a template or
bumping the design version creates a new URL instead of waiting for caches to expire.

---

## 5. Visitor uses a template

```mermaid
sequenceDiagram
  autonumber
  actor V as Visitor
  participant Site as dculus.com template page
  participant App as forms.dculus.com (form-app)
  participant API as Backend
  participant DB as Postgres

  V->>Site: opens /forms/templates/<slug> (from Google)
  V->>Site: tries the live preview (nothing is submitted)
  V->>Site: clicks "Use this template"
  Site->>App: /signup?template=<slug>
  App->>App: remember slug (pendingTemplate) through sign-up / sign-in
  App->>API: sign up → workspace created automatically
  App->>API: publicTemplate(slug)
  App->>API: createFormFromTemplate(templateId, organizationId)
  API->>DB: new Form with a copy of the template schema<br/>(background copied into the form's folder)
  App-->>V: opens the new form in the builder
```

---

## 6. Sharing a published form link

```mermaid
sequenceDiagram
  autonumber
  actor Bot as WhatsApp / Slack / LinkedIn crawler
  participant W as form-viewer _worker.js (Cloudflare Pages, /f/* only)
  participant A as Static assets (index.html, config.js)
  participant API as Backend /og/forms/*

  Bot->>W: GET /f/<shortUrl>
  W->>A: index.html (SPA shell)
  W->>A: config.js → VITE_API_URL
  W->>API: GET /og/forms/<shortUrl>.json (1.5s timeout, edge-cached 5 min)
  alt form published
    API-->>W: title, description, imageUrl
    W-->>Bot: index.html + og:title / og:description / og:image tags<br/>+ security headers
    Bot->>API: GET /og/forms/<shortUrl>.png?v=…
    API-->>Bot: share card (title, background photo, first questions)
  else draft / missing / API slow
    W-->>Bot: index.html unchanged (+ security headers)
  end
```

Cloudflare doesn't apply `_headers` to worker responses, so the worker re-adds the `/*`
security headers itself (a test keeps them in sync). Every other path (`/embed/*`, assets)
never reaches the worker.

---

## Files at a glance

| Step | Files |
|---|---|
| Template data | `apps/backend/seed-data/public-templates/*.json` |
| Load + validate | `apps/backend/src/publicTemplates/{loadCatalog,validate,photos,types}.ts` |
| Seed / preview CLIs | `apps/backend/src/scripts/{seed,preview}-public-templates.ts` |
| DB model | `form_template` in `apps/backend/prisma/schema.prisma` |
| API | `templateService.ts`, `graphql/resolvers/templates.ts` (`publicTemplateCatalog`) |
| Images | `apps/backend/src/services/og/*`, `apps/backend/src/routes/og.ts` |
| Link previews | `apps/form-viewer/public/_worker.js`, `_routes.json`, `_headers` |
| Owner's preview | `apps/form-app/src/components/sharing/ShareLinkPreview.tsx` |
| Landing sync | `dculus-forms-home/scripts/{sync-templates.mjs,lib/public-templates.mjs}` |
| Landing pages | `dculus-forms-home/src/pages/forms/templates/*`, `src/lib/templates.ts` |
| Sign-up from template | `apps/form-app/src/lib/pendingTemplate.ts`, `components/PendingTemplateHandler.tsx` |

More detail (field types, layouts, SEO rules): [TEMPLATE_AUTHORING.md](./TEMPLATE_AUTHORING.md).
