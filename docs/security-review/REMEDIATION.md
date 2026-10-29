# Security Review — Remediation Notes (manual steps)

Code changes for S20-01/02, S21-01/02 and S23-01/02 are in the repository. The items below
**cannot be done in code** and must be performed by a repository/org admin.

## S20-01 — Protect GitHub environments and workflow files

Workflow YAML cannot protect itself: anyone who can push a branch can edit the guards inside it.
Enforce the controls in GitHub settings.

1. **Environments** (`Settings → Environments`) — for each of `dev`, `production`, `production-approval`
   (and `staging` if used):
   - **Required reviewers**: at least one admin other than the deployer; enable *Prevent self-review*.
   - **Deployment branches and tags**: *Selected branches* → `main` only (add the `v*` tag pattern only
     where tag deployments are intended).
   - Move cloud/Terraform/Cloudflare/DB secrets to **environment secrets** (not repository secrets) so a job
     cannot read them without passing the environment gate.
2. **Ruleset for workflow files** (`Settings → Rules → Rulesets`): target `main`, require a pull request with
   ≥1 approval and **Require review from Code Owners**. `.github/CODEOWNERS` now covers `.github/workflows/**`,
   `.github/actions/**`, `.github/scripts/**` and `infrastructure/**` — confirm the listed owners are
   correct (replace with a team handle if preferred). Also block force-pushes and deletions.
3. **Actions permissions** (`Settings → Actions → General`): default `GITHUB_TOKEN` to read-only, require
   approval for all outside-collaborator/fork workflow runs, restrict allowed actions to
   GitHub/verified + an explicit allow-list.
4. **Azure OIDC federated credentials** (Entra ID → App registration → *Certificates & secrets → Federated
   credentials*): scope each credential's subject to the environment
   (`repo:dculussoftwares/dculus-forms:environment:production`, `...:environment:dev`) instead of
   branch/wildcard subjects, so only jobs that pass the protected environment can obtain a token. Remove
   any credential whose subject matches `pull_request` or arbitrary refs.

## S20-02 — Destroy workflow

Done in code (`multi-cloud-destroy.yml`): every destroy job now requires
`validate-destroy-request` to be `success` with `confirmed == 'true'`, production destroy is main-only, and the
workflow shares the `multi-cloud-deploy-<environment>` concurrency group with the deploy workflow.
Additionally add required reviewers to the `production` environment (step 1) so a destroy needs human approval.

## S21-01 — Rotate the Cloudflare R2 API token (manual)

The R2 secret was a `nonsensitive()` Terraform output, so earlier `terraform apply` logs in this
**public** repository may contain it. The code fix (sensitive output + `::add-mask::`) only prevents future
leaks.

1. Review historical Actions logs of `multi-cloud-deployment.yml` runs (and delete them if they show the
   value: `Settings → Actions` or `gh run delete`).
2. Rotate the token **after** the fix is merged: `terraform apply -replace=cloudflare_api_token.r2_access`
   for each environment (`dev`, `production`). The next deploy re-reads the new value via
   `terraform output -raw` and passes it to the backend.
   Do **not** roll the token in the Cloudflare dashboard instead: Cloudflare does not return the new secret on
   later reads, so Terraform state (and therefore the next deploy) would keep the revoked value.
3. Verify uploads/downloads still work, then confirm the old token is revoked.

## S21-02 — Database TLS

Docs now recommend `sslmode=require` (or `verify-full` with a CA-signed certificate) and private networking.
Operational follow-ups:

- Enable TLS on the PgBouncer container (`client_tls_sslmode=require`, cert + key) and update every
  `DATABASE_URL` **and `DIRECT_URL`** secret/variable (dev/production; Azure takes `DIRECT_URL` from
  `var.postgres_direct_url`, and the migration runner and automation engine use it) from `sslmode=disable` to
  `sslmode=require`/`verify-full`.
- Restrict the PgBouncer ACI to a VNet / private IP or an IP allow-list so it is not reachable from the
  internet.
- Rotate the `dculus_admin` database password if cleartext connections crossed untrusted networks.

## S23 — Dependency overrides

- pnpm is pinned to 8.15.0, which **only reads `pnpm.overrides` from `package.json`**; an `overrides:` block in
  `pnpm-workspace.yaml` is ignored (verified: frozen install fails with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`).
  The overrides therefore stay in `package.json`, and CI (`.github/scripts/verify-pnpm-overrides.mjs`, run in
  the `lint-and-type-check` job) fails if the pnpm version differs from the pin, `pnpm-workspace.yaml` gains an
  `overrides:` block, or the lockfile `overrides:` block drifts from `package.json`. **Do not upgrade pnpm
  without moving the overrides** (pnpm ≥10 reads them from `pnpm-workspace.yaml` only).
- `nodemailer` is now `^10.1.4` (needs Node ≥ 20; repo uses Node 22). The 9.x line does not contain the
  fixes for all advisories (several require ≥ 10.1.4).
- `pnpm audit --prod` still reports unrelated advisories (`qs`, `zod`, `body-parser`, `multer`, `vite`,
  `proxy-addr`, `brace-expansion`, `deepmerge-ts`, `fast-copy`, `@vitest/mocker`) — not part of these findings;
  track separately.

## Hardening follow-ups (plugins / automations)

### Credential encryption at rest

Webhook secrets, request-header values and Google/Microsoft OAuth tokens in `FormPlugin.config`, `Automation.graph` /
`draftGraph` and `AutomationRun.graphSnapshot` are encrypted with AES-256-GCM (`apps/backend/src/lib/credentialCrypto.ts`,
applied by a Prisma client extension so no caller handles ciphertext).

- **Enable:** create the GitHub Actions secret `CREDENTIAL_ENCRYPTION_KEY` (`openssl rand -base64 32`). The deployment
  workflow passes it to Terraform (`credential_encryption_key`) and on to the backend container. Unset = encryption off.
- Existing plaintext values stay readable. A row's credentials are encrypted when a write includes that column
  (plugin config save, automation graph/draft save, a new run); a write that doesn't touch it (e.g. a run status
  update) leaves the old plaintext in place. Rows that are never rewritten stay plaintext until a one-off
  re-save/backfill is run; none is provided. Nested writes of plugin/automation/run rows through `Form`/`Automation`
  are rejected by the extension so they can't bypass sealing; write the model directly.
- **Never rotate or remove the key casually.** A value that cannot be decrypted makes reads of that plugin/automation
  fail loudly (`CredentialCryptoError`) instead of using ciphertext. Rotation needs a re-encryption script (the `enc:v1:`
  prefix leaves room for a `v2`).

### Outbound network policy

- Webhook and automation destinations that resolve to private / loopback / link-local addresses are blocked
  (`lib/urlGuard.ts`). Self-hosted installs that must reach internal services can set `OUTBOUND_ALLOW_PRIVATE_NETWORK=true`.
- Infrastructure (not done in code): put the backend container behind an egress policy (NAT / firewall allow-list) so a
  DNS-rebinding bypass of the application-level check still cannot reach the database, PgBouncer or cloud metadata.

### Other behaviour changes

- A webhook that returns `success: false` is recorded as a **failed** delivery (previously `success`), so backfill retries it.
- Email plugins only send to a recipient field that holds a single valid address, and the field must be an email field
  (checked at save time and again on every send).
- Automation action credentials are masked for everyone except the form OWNER (EDITORs can still edit; masked values are
  restored on save), matching plugin configs.
- The AI form builder no longer accepts a webhook signing secret through chat; set it in the integration's settings.
