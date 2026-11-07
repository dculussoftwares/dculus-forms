<div align="center">

<a href="https://dculus.com">
  <img src="https://dculus.com/favicon.svg" alt="Dculus Forms logo" width="72" height="72">
</a>

# Dculus Forms

### The open-source AI form builder your whole team can build together

Describe a form and AI builds it. Refine it by chat or drag and drop, co-edit it live with your team, and send every response into logic, automations, PDFs and analytics.
Use the free managed cloud, or self-host it and own your data.

[![License: GPL v3](https://img.shields.io/badge/license-GPLv3-blue.svg)](LICENSE.md)
[![Build](https://github.com/dculussoftwares/dculus-forms/actions/workflows/build.yml/badge.svg)](https://github.com/dculussoftwares/dculus-forms/actions/workflows/build.yml)
[![CodeQL](https://github.com/dculussoftwares/dculus-forms/actions/workflows/codeql.yml/badge.svg)](https://github.com/dculussoftwares/dculus-forms/actions/workflows/codeql.yml)
[![npm @dculus/form-renderer](https://img.shields.io/npm/v/@dculus/form-renderer?label=%40dculus%2Fform-renderer)](https://www.npmjs.com/package/@dculus/form-renderer)
[![GitHub stars](https://img.shields.io/github/stars/dculussoftwares/dculus-forms?style=social)](https://github.com/dculussoftwares/dculus-forms/stargazers)
[![Last commit](https://img.shields.io/github/last-commit/dculussoftwares/dculus-forms)](https://github.com/dculussoftwares/dculus-forms/commits/main)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

**[Try it free](https://forms.dculus.com)** · **[Website](https://dculus.com)** · **[Templates](https://dculus.com/forms/templates)** · **[Self-hosting](https://dculus.com/docs/self-hosting)** · **[Docs](https://dculus.com/docs)** · **[Architecture](docs/architecture/)**

</div>

---

> ⭐ **If Dculus Forms is useful to you, star the repo.** It helps other teams find an open-source alternative to closed form builders.

## Table of contents

- [What is Dculus Forms?](#what-is-dculus-forms)
- [Features](#features)
- [How it compares](#how-it-compares-to-typeform-jotform-and-zoho-forms)
- [Form templates](#form-templates)
- [Quick start](#quick-start)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Self-hosting and deployment](#self-hosting-and-deployment)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## What is Dculus Forms?

**Dculus Forms is a free, open-source (GPLv3) AI-powered form builder and survey tool.** You type what you need ("a job application form with a CV upload") and it generates the form. You then edit it by chatting with the AI or by drag and drop, while teammates edit the same form in real time. It is a self-hostable alternative to **Typeform, Jotform, Google Forms and Zoho Forms**, built with React, GraphQL, PostgreSQL and Y.js.

- **Cloud:** sign up free at [forms.dculus.com](https://forms.dculus.com). Team collaboration is on every plan.
- **Self-hosted:** run the whole stack on a single small server and keep every response on your own infrastructure.

> **Status:** Dculus Forms is in **public beta**. It's used in production and under active development.

## Features

### 🤖 AI form builder
- **Generate a form from a prompt**: describe it in plain language and get pages, fields and validation.
- **Edit forms by chat**: "make the phone number optional", "add a rating question after page 2".
- **AI auto-tagging of responses** so you can sort and filter feedback without reading every answer.

### 👥 Built for teams
- **Live co-editing** (Google Docs-style) powered by Y.js and Hocuspocus.
- **Organizations and per-form permissions** (view / edit / own).
- **Response edit history** with per-field diffs.

### 🧩 Form building
- **13 field types**: short text, long text, email, number, phone, date, dropdown, radio, checkbox, grid, file upload, rating (stars, numbers and NPS) and rich text.
- **Conditional logic**: show or hide questions and whole pages.
- **Quizzes** with automatic grading.
- **9 layouts** and a **theme editor**, multi-page forms and custom endings.
- **CAPTCHA** and **e-signature**.

### ⚡ Automations and integrations
- **Workflow automations** with triggers, delays, conditions, run history and retries.
- **Email notifications** and **webhooks**.
- **Google Sheets** and **Microsoft Sheets (Excel Online)** plugins.

### 📄 Responses, PDFs and analytics
- **PDF generated from each response** with a visual template designer (pdfme), including Tamil font support.
- **Excel and CSV export**, advanced response filters.
- **Analytics**: views, submissions, completion time, device, location and per-field charts (including NPS).

### 🌐 Share anywhere
- **Embed** as a link, inline, popup, drawer or full page.
- **60+ ready-made templates** across HR, education, events, healthcare, feedback and more.
- UI in **English and Tamil**, billing in **USD and INR**.

## How it compares to Typeform, Jotform and Zoho Forms

| | **Dculus Forms** | Typeform | Jotform | Zoho Forms |
|---|:---:|:---:|:---:|:---:|
| Open source (GPLv3) | ✅ | ❌ | ❌ | ❌ |
| Self-host and own your data | ✅ | ❌ | ❌ | ❌ |
| Team collaboration on every plan | ✅ | 1–5 seats | Single user below Enterprise | 1–100 users by tier |
| Free plan | ✅ | ✅ | ✅ | ✅ |

<sub>Seat limits checked against the vendors' pricing pages ([Typeform](https://www.typeform.com/pricing), [Jotform](https://www.jotform.com/pricing/), [Zoho Forms](https://www.zoho.com/forms/pricing.html)) in November 2026; plans change, so check them before deciding. Other vendors also offer AI and collaboration features, so compare on what matters to you. See [dculus.com](https://dculus.com/#pricing) for current Dculus plans.</sub>

## Form templates

Start from a template and customize it with AI. Browse all of them in the [form template gallery](https://dculus.com/forms/templates).

<table>
  <tr>
    <td align="center"><a href="https://dculus.com/forms/templates/contact-form"><img src="https://form-services.dculus.com/og/templates/contact-form/card.png?v=2.mw2im4fq" width="200" alt="Contact form template"><br><sub><b>Contact form</b></sub></a></td>
    <td align="center"><a href="https://dculus.com/forms/templates/job-application-form"><img src="https://form-services.dculus.com/og/templates/job-application-form/card.png?v=2.mw2imeqf" width="200" alt="Job application form template"><br><sub><b>Job application form</b></sub></a></td>
    <td align="center"><a href="https://dculus.com/forms/templates/event-registration-form"><img src="https://form-services.dculus.com/og/templates/event-registration-form/card.png?v=2.mw4whrfq" width="200" alt="Event registration form template"><br><sub><b>Event registration form</b></sub></a></td>
    <td align="center"><a href="https://dculus.com/forms/templates/customer-satisfaction-survey"><img src="https://form-services.dculus.com/og/templates/customer-satisfaction-survey/card.png?v=2.mw4whkji" width="200" alt="Customer satisfaction survey template"><br><sub><b>Customer satisfaction survey</b></sub></a></td>
  </tr>
</table>

Want to add a public template? See the [template authoring guide](docs/templates/TEMPLATE_AUTHORING.md).

## Quick start

### Option 1: Use the cloud (fastest)

Sign up free at **[forms.dculus.com](https://forms.dculus.com)**. No install needed.

### Option 2: Run it locally

**Prerequisites:** Node.js ≥ 22.12, pnpm ≥ 8, Docker (for PostgreSQL).

```bash
# 1. Clone and install
git clone https://github.com/dculussoftwares/dculus-forms.git
cd dculus-forms
pnpm install

# 2. Configure the backend
cp apps/backend/.env.example apps/backend/.env

# 3. Start PostgreSQL and set up the database
#    (pnpm docker:up runs `docker-compose`; with only the Compose plugin, use `docker compose up -d`)
pnpm docker:up
pnpm db:generate
pnpm db:push
pnpm db:seed        # optional sample data

# 4. Build shared packages, then start everything
pnpm build
pnpm dev
```

| App | URL |
|---|---|
| Form builder (`form-app`) | http://localhost:3000 |
| Form viewer (`form-viewer`) | http://localhost:5173 |
| Admin dashboard (`admin-app`) | http://localhost:3002 |
| Backend API | http://localhost:4000 |
| GraphQL endpoint | http://localhost:4000/graphql |
| pgAdmin | http://localhost:5050 |

The `.env.example` defaults let the apps start, but some features need real credentials in `apps/backend/.env`:

| Feature | What to configure |
|---|---|
| Sign-up and password emails | SMTP settings (`SMTP_*`). Email verification is required outside the test environment. |
| File upload fields | S3-compatible storage (AWS S3, MinIO, Spaces, B2): set the endpoint, keys, and a **public** and a **private** bucket (`PUBLIC_S3_*`, `PRIVATE_S3_BUCKET_NAME`). The placeholder values will not work. |
| AI form builder | Model credentials (`AI_PRIMARY_*`, `AI_FAST_*`). AI chat is also checked against a credit allowance tied to the billing setup, so AI needs a configured plan allowance as well. See [The AI form editor](docs/architecture/08-ai-form-editor.md) and [Plans, usage and billing](docs/architecture/10-plans-usage-billing.md). |
| Billing and plans | Chargebee (`CHARGEBEE_*`). Optional for basic local development. |

<details>
<summary><b>More scripts</b></summary>

```bash
pnpm backend:dev          # backend only
pnpm form-app:dev         # form builder only
pnpm form-viewer:dev      # form viewer only

pnpm lint                 # lint all packages
pnpm type-check           # type-check all packages
pnpm test:unit            # backend unit tests (Vitest)
pnpm test:integration     # API integration tests (Cucumber)
pnpm test:e2e             # end-to-end tests (Playwright + Cucumber)

pnpm db:studio            # Prisma Studio
pnpm db:migrate:dev       # create a migration
pnpm docker:down          # stop PostgreSQL
```

</details>

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Apollo Client |
| Backend | Node.js, Express, Apollo Server (GraphQL), Prisma |
| Database | PostgreSQL |
| Real-time collaboration | Y.js, Hocuspocus |
| Auth | Better Auth |
| PDFs | pdfme |
| Rich text | Lexical |
| Testing | Vitest, Cucumber, Playwright |
| Infra | Docker, Terraform, Azure Container Apps, Cloudflare Pages and R2 |

## Project structure

```
dculus-forms/
├── apps/
│   ├── backend/        # Express + Apollo GraphQL API, Prisma, Hocuspocus
│   ├── form-app/       # Form builder (React)
│   ├── form-viewer/    # Public form renderer and submission (React)
│   └── admin-app/      # Admin dashboard (React)
├── packages/
│   ├── form-renderer/  # @dculus/form-renderer, published to npm
│   ├── plugins/        # Integrations: email, webhooks, sheets, quiz grading
│   ├── types/          # Shared TypeScript types and field models
│   ├── ui/             # Shared shadcn/ui components and rich text editor
│   └── utils/          # Shared utilities and constants
├── infrastructure/     # Terraform for cloud deployments
├── docs/               # Architecture guides, specs and deployment docs
└── test/               # Integration and E2E test suites
```

**New to the codebase?** Read [How Dculus Works](docs/architecture/): 12 guides with diagrams, each answering "what actually happens when...?":

1. [The life of a submission](docs/architecture/01-submission-lifecycle.md)
2. [One event, three listeners](docs/architecture/02-event-fanout.md)
3. [Request anatomy](docs/architecture/03-request-anatomy.md)
4. [Automations](docs/architecture/04-automations.md)
5. [The plugin pipeline](docs/architecture/05-plugin-pipeline.md)
6. [PDF generation](docs/architecture/06-pdf-generation.md)
7. [Real-time collaboration](docs/architecture/07-realtime-collaboration.md)
8. [The AI form editor](docs/architecture/08-ai-form-editor.md)
9. [Authorization](docs/architecture/09-authorization.md)
10. [Plans, usage and billing](docs/architecture/10-plans-usage-billing.md)
11. [File storage](docs/architecture/11-file-storage.md)
12. [The field type system](docs/architecture/12-field-type-system.md)

### Preview forms in your own React app

[`@dculus/form-renderer`](https://www.npmjs.com/package/@dculus/form-renderer) renders a Dculus form schema as an interactive, **read-only preview** (it powers the [template gallery](https://dculus.com/forms/templates)). It never submits responses; to collect responses, share or [embed](https://forms.dculus.com) a live form from the builder. See the [package guide](packages/form-renderer/README.md).

```bash
npm install @dculus/form-renderer
```

## Self-hosting and deployment

Dculus Forms runs on a single small server: a Node.js backend (Docker image), static frontends and PostgreSQL.

- **Self-hosting guide:** [dculus.com/docs/self-hosting](https://dculus.com/docs/self-hosting)
- **Step-by-step deployment guide:** [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)
- **Pre-built artifacts:** every [GitHub Release](https://github.com/dculussoftwares/dculus-forms/releases) ships ZIPs of the form builder, form viewer and admin app, plus a backend Docker image.

The frontends are static and run on any static host (Cloudflare Pages, Netlify, Vercel, S3 + CloudFront, Azure Static Web Apps, nginx).

Maintainers cut releases from **Actions → Release → Run workflow** on `main`. See [Creating a Release](docs/deployment/DEPLOYMENT_GUIDE.md#creating-a-release).

## FAQ

<details>
<summary><b>Is Dculus Forms free?</b></summary>

Yes. The source code is free under GPLv3 and you can self-host it at no cost. The managed cloud at [forms.dculus.com](https://forms.dculus.com) has a free plan. Paid plans add higher limits ([pricing](https://dculus.com/#pricing)).
</details>

<details>
<summary><b>Is Dculus Forms a good open-source alternative to Typeform, Jotform or Google Forms?</b></summary>

Yes, if you want AI form generation, live team co-editing and the option to self-host. It covers multi-page forms, conditional logic, quizzes, file uploads, automations, webhooks, Google Sheets and Microsoft Sheets sync, PDFs and analytics. It does not take payments.
</details>

<details>
<summary><b>Can I self-host Dculus Forms?</b></summary>

Yes. It runs on one small server with PostgreSQL. Follow the [self-hosting guide](https://dculus.com/docs/self-hosting) or the [deployment guide](docs/deployment/DEPLOYMENT_GUIDE.md).
</details>

<details>
<summary><b>How does the AI form builder work?</b></summary>

You describe the form in plain language, and the AI proposes a structured form schema with pages, fields and validation. You keep editing it by chat or by hand. The backend never edits a form behind your back: every AI change goes through the same collaborative editor as a human edit. Details: [The AI form editor](docs/architecture/08-ai-form-editor.md).
</details>

<details>
<summary><b>Where is my data stored?</b></summary>

Self-hosted: wherever you deploy it. On the managed cloud, data is stored in India.
</details>

<details>
<summary><b>Can I move my forms from another form builder?</b></summary>

There are no importers yet. Describe the form to the AI builder or start from a [template](https://dculus.com/forms/templates) to rebuild it in minutes. Email [hello@dculus.com](mailto:hello@dculus.com) if you need help.
</details>

## Contributing

Contributions are welcome: bug reports, feature ideas, docs and code.

1. Check [open issues](https://github.com/dculussoftwares/dculus-forms/issues) or open a new one using the [bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [feature request](.github/ISSUE_TEMPLATE/feature_request.md) template.
2. Fork the repo and create a branch from `main`.
3. Follow the local setup above and read the relevant [architecture guide](docs/architecture/).
4. Add tests where it makes sense, and run `pnpm lint` and `pnpm type-check`.
5. Open a pull request describing the change.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=dculussoftwares/dculus-forms&type=Date)](https://star-history.com/#dculussoftwares/dculus-forms&Date)

## License

Dculus Forms is licensed under the [GNU General Public License v3.0](LICENSE.md).

## Acknowledgements

Product analytics for Dculus Forms is powered by [OpenPanel](https://openpanel.dev), an open-source analytics platform.

## Support

- 🐛 Bugs and feature requests: [GitHub Issues](https://github.com/dculussoftwares/dculus-forms/issues)
- ✉️ Email: [hello@dculus.com](mailto:hello@dculus.com)
- 🌐 Website: [dculus.com](https://dculus.com)

<div align="center">
<sub>Keywords: open-source form builder · AI form builder · self-hosted form builder · Typeform alternative · Jotform alternative · Google Forms alternative · Zoho Forms alternative · online survey tool · quiz maker · form automation · React · GraphQL · PostgreSQL</sub>
</div>
