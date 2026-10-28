# Security Review — Section Plan

Each section below is a self-contained unit of work for one agent. Sections are scoped by directory so agents do not overlap. Run them in parallel.

> **Public repo.** Never put secrets, tokens, or live exploit payloads in findings. Reference file:line and describe the class of issue.

## How to use

1. Give one agent one section (copy its block as the prompt, plus the "Common brief" below).
2. Each agent writes its report to `docs/security-review/findings/<section-id>.md`.
3. Review-only: agents must not modify source code.

## Common brief (prepend to every agent)

- Review-only. Report findings, do not fix.
- Each finding: **ID**, **Severity** (Critical/High/Medium/Low/Info), **File:line**, **Description**, **Exploit scenario** (who, with what privilege, does what), **Recommended fix**.
- Verify before reporting: trace the code path end to end, and drop findings you cannot reproduce by reading the code. Mark uncertain ones as `PLAUSIBLE`.
- Authorization model to check against (all three must pass): system role (`user|admin|superAdmin`), org membership (`member|owner`), form permission (`VIEWER|EDITOR|OWNER|NO_ACCESS`) plus sharing scope (`PRIVATE|SPECIFIC_MEMBERS|ALL_ORG_MEMBERS`).
- Tenancy rule: every read/write keyed by an ID must be scoped to the caller's organization. Look for IDOR, cross-tenant access, and ID-only lookups.
- Finish with a short "Not reviewed / out of scope" list.

---

## Backend

### S01 — Authentication & sessions
**Scope:** `apps/backend/src/lib/better-auth.ts`, `middleware/better-auth-middleware.ts`, `graphql/resolvers/better-auth.ts`, `lib/env.ts`
**Check:**
- better-auth config: cookie flags (Secure/HttpOnly/SameSite), session expiry, cookie cache staleness after role/membership change, trusted origins
- bearer plugin token handling, emailOTP (rate limiting, OTP entropy/expiry/attempt limits, enumeration via responses/timing)
- password reset and email verification flows, account enumeration, `BETTER_AUTH_SECRET` handling and defaults
- test-env relaxations (org limit 100, email verification skipped): can they leak into production via env?
- `requireAuth` / `requireOrganizationMembership` correctness and bypasses

### S02 — GraphQL authorization (resolvers, part A: core)
**Scope:** `resolvers/forms.ts`, `formSharing.ts`, `invitations.ts`, `templates.ts`, `tags.ts`, `admin.ts`, `lib/accessControlEnforcement.ts`, `services/formService.ts`, `formSharingService.ts`, `invitationService.ts`, `organizationService.ts`, `userService.ts`, `templateService.ts`, `tagService.ts`
**Check:** missing `requireAuth`, missing org/form permission checks, IDOR on every ID argument, privilege escalation (member → owner, EDITOR → OWNER, user → admin), invitation token reuse/expiry/email binding, admin resolvers gated by role, template visibility across orgs, form duplication copying data across tenants. Agent `auth-permission-auditor` fits here.

### S03 — GraphQL authorization (resolvers, part B: responses & data)
**Scope:** `resolvers/responses.ts`, `myResponse.ts`, `responseDrafts.ts`, `responseFiles.ts`, `formFiles.ts`, `analytics.ts`, `fieldAnalytics.ts`, `unifiedExport.ts`, `subscriptions.ts`, `services/responseService.ts`, `myResponseService.ts`, `responseDraftService.ts`, `responseCopyService.ts`, `responseEditTrackingService.ts`, `analyticsService.ts`, `fieldAnalyticsService.ts`, `repositories/*`
**Check:** respondent vs owner access, "my response" on identity-gated forms (can respondent A read/edit B's response), draft access, edit-history exposure, analytics leaking PII (IP, geo, user agent) to low-permission roles, bulk operations, pagination limits, export authorization.

### S04 — Public form submission surface (unauthenticated)
**Scope:** public GraphQL operations used by `apps/form-viewer`, `lib/respondentAccess.ts`, `lib/timeWindowEnforcement.ts`, `lib/responsePayloadLimits.ts`, `lib/conditionalStrip.ts`, `lib/formSchemaCache.ts`, `lib/embedAttribution.ts`, `middleware/edge-geolocation.ts`
**Check:** anonymous submission abuse (no rate limit, spam, payload size, nesting depth), validation bypass (server trusts client-side validation, conditional-logic fields stripped or forced), access controls (password, sign-in, time window, response caps) enforced server side, schema cache poisoning/stale access settings, spoofable `cf-*` headers and client IP trust, view/submission counters used for billing being inflatable, embed attribution trust.

### S05 — GraphQL layer hardening
**Scope:** `graphql/schema.ts`, `graphql/resolvers.ts`, `index.ts` (Apollo/Express setup), `middleware/errorHandler.ts`, `lib/graphqlErrors.ts`, `lib/logger.ts`, `instrument.ts`
**Check:** introspection and playground in production, query depth/complexity/alias/batching limits, CSRF on GraphQL, CORS config (`CORS_ORIGINS` wildcard/credentials), helmet/security headers, body size limits, error messages leaking stack traces/SQL/internal paths, logging of PII/tokens/auth headers, Sentry scrubbing, `/debug` and `/health` information disclosure.

### S06 — File upload & storage (R2/S3)
**Scope:** `routes/upload.ts`, `resolvers/fileUpload.ts`, `formFiles.ts`, `responseFiles.ts`, `services/fileUploadService.ts`, `formFileService.ts`, `temporaryFileService.ts`, `responseFiles/`, `lib/contentDisposition.ts`
**Check:** upload type allow-list enforcement (`FormTemplate`, `FormBackground`, `UserAvatar`, `OrganizationLogo`, `FormResponse`, `PdfTemplateAsset`) and per-type authorization, MIME/extension/magic-byte validation, size limits, filename/path traversal and key injection, SVG/HTML upload leading to stored XSS from the public CDN, public vs private bucket mix-ups, presigned URL scope/expiry and whether any authenticated user can mint URLs for others' objects, content-disposition header injection, temp export key guessability and 5h TTL enforcement, orphaned file cleanup.

### S07 — Plugins & outbound integrations (SSRF / secrets)
**Scope:** `plugins/**` (webhook, email, google-sheets, microsoft-sheets, quiz, ai-tagger, core), `routes/google-oauth.ts`, `routes/microsoft-oauth.ts`, `resolvers/plugins.ts`, `services/pluginService.ts`, `copyFormPlugins.ts`
**Check:** webhook SSRF (internal IPs, cloud metadata `169.254.169.254`, redirects, DNS rebinding, non-HTTP schemes), webhook signing and secret storage, stored plugin credentials/OAuth tokens (encrypted at rest? returned to the client in GraphQL?), OAuth `state` / CSRF / redirect URI validation, token refresh handling, email plugin as spam relay or header injection (To/Subject/Reply-To from user input), template substitution injection (HTML in emails, formula injection in sheets), plugin config authorization (who can read/modify), plugin access across tenants, quiz answer-key leakage to respondents.

### S08 — Automations
**Scope:** `resolvers/automations.ts`, `services/automationService.ts`, `services/automation/**`
**Check:** authorization on create/publish/edit/delete, draft vs published state tampering, ability to trigger actions on other tenants' forms, action execution privileges (runs as whom), loops/amplification and resource exhaustion, injection through field values into actions, secret handling in action configs.

### S09 — AI features
**Scope:** `resolvers/ai.ts`, `aiChat.ts`, `routes/aiChat.ts`, `services/aiService.ts`, `aiChatService.ts`, `aiUsageService.ts`, `aiTelemetry.ts`, `lib/ai.ts`, `aiFormEditTools.ts`, `formEditAgent.ts`, `intentClassifier.ts`, `evals/`, `.github/workflows/ai-evals.yml`
**Check:** prompt injection via form content/responses leading to unauthorized tool calls, agent tools acting on forms the caller cannot edit, cross-tenant data in prompts, PII sent to the model provider, AI credit/usage enforcement bypass (cost abuse), streaming endpoint auth, rate limiting, API key handling, telemetry logging sensitive prompts, `ai-tagger` plugin trust boundary, CI eval workflow secrets exposure to PRs from forks.

### S10 — PDF templates & generators
**Scope:** `resolvers/pdfTemplates.ts`, `pdfGenerators.ts`, `services/pdfTemplateService.ts`, `pdfGeneratorService.ts`, `pdfGeneratorStorage.ts`, `pdfGeneratorZipService.ts`, `pdfGenerationJobService.ts`, `copyPdfTemplates.ts`, `plugins/core/pdfGeneratorAutoRun.ts`
**Check:** authorization on template and job access, base PDF asset handling (`PdfTemplateAsset`, private bucket), template JSON validation (resource exhaustion, huge pages, font/image fetch from user-supplied URLs → SSRF), generated PDF access (signed URL scope), zip generation (zip-slip, filename sanitisation, memory/DoS on large batches), job queue abuse.

### S11 — Response querying, filtering & export
**Scope:** `services/responseFilterService.ts`, `responseQueryBuilder.ts`, `responseFilterContext.ts`, `responseFieldSuggestions.ts`, `unifiedExportService.ts`, `plugins/core/exportRegistry.ts`, `fakeResponseService.ts`
**Check:** injection in dynamic query/filter building (raw SQL, `$queryRaw`, JSON path operators, ORDER BY/column names from input), filters that leak data across forms/orgs, CSV/Excel formula injection (`=`, `+`, `-`, `@` prefixes) in exports, export size/DoS limits, plugin export columns exposing metadata (quiz answers, webhook status) to unauthorized roles, fake-response generator reachable in production. Agent `response-filter-auditor` fits here.

### S12 — Billing & subscriptions
**Scope:** `routes/chargebee-webhooks.ts`, `services/chargebeeService.ts`, `subscriptionService.ts`, `subscriptions/`, `lib/planLimits.ts`, `resolvers/subscriptions.ts`
**Check:** webhook authenticity (basic-auth/secret verification, constant-time compare, replay/idempotency), plan/limit tampering via user-controlled input, checkout/portal session creation authorized against the right org, usage counter races (TOCTOU) letting limits be exceeded, enterprise admin-set limits overwritten by webhooks, free-plan feature gates enforced server side. Agent `subscription-billing-expert` fits here.

### S13 — Real-time collaboration (Hocuspocus / Y.js)
**Scope:** `services/hocuspocus.ts`, `repositories/collaborativeDocumentRepository.ts`, `apps/form-app/src/store/slices/collaborationSlice.ts`
**Check:** WebSocket auth on connect (token validation, document name `form:{formId}` authorization per user), read-only (VIEWER) clients able to write updates, origin checking on the WS server, ability to join arbitrary document names, malicious Y.js updates (size, malformed, prototype pollution via nested field keys), persistence of poisoned state, connection/message rate limits, session revocation while connected.

### S14 — Database & data layer
**Scope:** `apps/backend/prisma/schema.prisma`, `prisma/migrations/**`, `lib/prisma.ts`, `repositories/**`, `services/auditLogService.ts`, `lib/audit.ts`
**Check:** raw query usage (`$queryRaw`/`$executeRaw` with interpolation), missing org scoping in repositories, sensitive columns stored in plaintext (OAuth tokens, webhook secrets, API keys) and cascade-delete behaviour, indexes/unique constraints that enforce tenant isolation, migration scripts with unsafe operations, audit log coverage for privileged actions and tamper resistance, PgBouncer/connection string handling.

### S15 — Admin surface
**Scope:** `resolvers/admin.ts`, `apps/admin-app/src/**`, `scripts/` (`admin:setup`), `apps/backend/src/scripts/`
**Check:** admin/superAdmin role gating server side (not just UI), admin impersonation/ban/role-change flows, admin bootstrap script defaults (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), ability for a normal user to set own `role`, org-wide data access by admins and its audit trail.

---

## Frontend

### S16 — form-app (builder dashboard)
**Scope:** `apps/form-app/src/**`
**Check:** XSS sinks (`dangerouslySetInnerHTML`, rich text rendering, markdown, `innerHTML`, `href`/`src` from user data with `javascript:` URLs), token/session storage (localStorage vs cookies), open redirects after sign-in/invite acceptance, authorization enforced only in UI (cross-check with S02/S03), PDF designer (pdfme) rendering untrusted template/binding content, `@-mention` editor injection, logging PII to console, secrets in `VITE_*` vars, source maps in production.

### S17 — form-viewer (public)
**Scope:** `apps/form-viewer/src/**`
**Check:** stored XSS from form content shown to respondents (titles, descriptions, rich text, thank-you messages, custom redirect URLs), open redirect / `javascript:` URL in thank-you redirect, embed/iframe security (clickjacking, `postMessage` origin validation, `X-Frame-Options`/CSP frame-ancestors), file upload client flow, password-gated/sign-in-gated forms rely on server enforcement, third-party scripts, analytics PII collection and consent.

### S18 — admin-app
**Scope:** `apps/admin-app/src/**`
**Check:** same sinks as S16, plus UI-only role gating, exposure of admin tokens, CSRF on state-changing admin actions.

### S19 — Shared packages
**Scope:** `packages/types`, `packages/utils`, `packages/ui`, `packages/plugins`
**Check:** `deserializeFormSchema` / `deserializeFormField` handling untrusted JSON (prototype pollution, type confusion, unbounded recursion), validation logic shared by client and server (server must re-run it), ID generation using non-crypto randomness for security-relevant tokens (`generateId`), UI components rendering unsanitized HTML, utility functions for URLs/redirects/regex (ReDoS).

---

## Infrastructure & supply chain

### S20 — CI/CD & GitHub Actions
**Scope:** `.github/workflows/*` (`build.yml`, `release.yml`, `multi-cloud-deployment.yml`, `multi-cloud-destroy.yml`, `codeql.yml`, `ai-evals.yml`), `lefthook.yml`
**Check:** `pull_request_target` or untrusted input in `run:` (script injection via branch names/PR titles), secrets exposed to fork PRs, third-party actions not pinned to SHAs, overly broad `permissions:`, OIDC/cloud credential scope, environment protection on production, destroy workflow guards, artifact/image provenance, pre-commit secret scanning.

### S21 — Infrastructure as code & deployment
**Scope:** `infrastructure/multi-cloud/**` (Terraform), `docker-compose.yml`, `Dockerfile*`, `docs/deployment/**`
**Check:** public storage buckets, overly permissive IAM/network rules, DB exposed publicly, secrets in tfvars/state or container env, container running as root, base image pinning, TLS config, Cloudflare/WAF/rate-limit rules, security headers at the edge, backup and state-file protection.

### S22 — Secrets & repository hygiene (public repo)
**Scope:** whole repo including git history, `*.sh` at the root (`test-*.sh`), `.env.example` files, `static-files/`, `test/`, `screenshot/`, `scripts/`, `PRODUCTION_READINESS.md`
**Check:** committed credentials/tokens/keys (current tree and history), hardcoded test credentials that also work in non-local environments (the E2E account must be local/disposable only), scripts that target production URLs with credentials, sensitive info in docs and screenshots, `.gitignore` coverage, `pnpm`-lockfile integrity.

### S23 — Dependencies & supply chain
**Scope:** `package.json` + `pnpm-lock.yaml` in root and every app/package
**Check:** `pnpm audit` results (triage reachable vs not), unmaintained or typosquat-risk packages, postinstall scripts, known-vulnerable versions of `better-auth`, `@apollo/server`, `express`, `hocuspocus`, `@pdfme/*`, `exceljs`, `@aws-sdk/*`, `prisma`, version ranges allowing malicious updates, license/provenance concerns.

### S24 — Privacy, abuse & compliance
**Scope:** cross-cutting; analytics/geo (`services/analyticsService.ts`, `fieldAnalytics`), response edit history, audit logs, data retention (drafts 30-day expiry, temp exports), account/org deletion
**Check:** PII inventory (IP, geo, user agent, form answers, files), deletion completeness (user, org, form, response, R2 objects, Y.js docs, plugin-synced external copies), data retention enforcement, consent for tracking, rate limiting and abuse controls across all unauthenticated endpoints, email-sending abuse (invite/OTP spam).

---

## Suggested run order

| Wave | Sections | Why |
|------|----------|-----|
| 1 | S01, S02, S03, S04, S13 | Highest blast radius: authn/authz and the public surface |
| 2 | S05, S06, S07, S09, S10, S11 | Injection, SSRF, uploads, AI, exports |
| 3 | S08, S12, S14, S15, S16, S17, S18, S19 | Business logic and frontend |
| 4 | S20, S21, S22, S23, S24 | Pipeline, infra, supply chain, privacy |

## Findings tracker

| Section | Agent | Status | Critical | High | Medium | Low |
|---------|-------|--------|----------|------|--------|-----|
| S01 | | todo | | | | |
| S02 | | todo | | | | |
| S03 | | todo | | | | |
| S04 | | todo | | | | |
| S05 | | todo | | | | |
| S06 | | todo | | | | |
| S07 | | todo | | | | |
| S08 | | todo | | | | |
| S09 | | todo | | | | |
| S10 | | todo | | | | |
| S11 | | todo | | | | |
| S12 | | todo | | | | |
| S13 | | todo | | | | |
| S14 | | todo | | | | |
| S15 | | todo | | | | |
| S16 | | todo | | | | |
| S17 | | todo | | | | |
| S18 | | todo | | | | |
| S19 | | todo | | | | |
| S20 | | todo | | | | |
| S21 | | todo | | | | |
| S22 | | todo | | | | |
| S23 | | todo | | | | |
| S24 | | todo | | | | |
