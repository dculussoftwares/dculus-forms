# Chargebee — Production Setup Runbook

Use this to bootstrap a **new, empty Chargebee site** (e.g. the production account).
The catalog is defined in `docs/pricing-plan-catalog.json`; the backend reads limits
from Chargebee entitlements only (no hardcoded fallbacks), so **the catalog must exist
and be correct before the backend serves traffic**.

> Never paste API keys into chat, commits or logs. Pass them via environment variables.

## 0. Pre-flight
- [ ] Product sign-off on `docs/pricing-plan-catalog.json`. `emails_sent` and `ai_credits`
      values are proposals. Prices can be edited later in the admin app, but changing
      them after customers subscribe affects those customers.
- [ ] Chargebee site is in **live** mode and the business/tax/currency settings (USD, INR)
      are configured: *Settings → Configure Chargebee → Currencies*.
- [ ] Create a **full-access** API key for the setup run (*Settings → API Keys*). Use a
      separate, restricted key for the running app if you want least privilege
      (needs: customers, subscriptions, hosted pages, portal sessions, items,
      item prices, entitlements, features).

## 1. Seed the catalog (script)
Dry run first (touches nothing):
```bash
cd apps/backend
CHARGEBEE_SITE=<prod-site> CHARGEBEE_API_KEY=<prod-key> npx tsx src/scripts/setup-chargebee.ts
```
Apply (both flags are required; the site must match):
```bash
CHARGEBEE_SITE=<prod-site> CHARGEBEE_API_KEY=<prod-key> \
  npx tsx src/scripts/setup-chargebee.ts --execute --confirm-site=<prod-site>
```
Creates: item family `dculus-forms`; features `form_views`, `form_submissions`,
`emails_sent`, `ai_credits` (activated); plans `free`, `starter`, `standard`,
`professional`, `premium` with USD/INR monthly (+ yearly for paid) prices; hidden
`enterprise` plan with four $0 item prices (per-deal amounts are overridden at
checkout); the `extra-submissions` add-on; and all entitlements. Idempotent — re-running
skips what exists and never edits it.

## 2. Dashboard-only settings (no API)
1. **Webhook** — *Settings → Configure Chargebee → API Keys and Webhooks → Add Webhook*
   - URL: `<production backend URL>/api/webhooks/chargebee`
   - Protect with HTTP Basic Auth: any username, password = the value you set as
     `CHARGEBEE_WEBHOOK_PASSWORD` (the backend rejects all webhooks if it is unset).
   - Events: `subscription_created`, `subscription_started`, `subscription_changed`,
     `subscription_activated`, `subscription_reactivated`, `subscription_resumed`,
     `subscription_scheduled_cancellation_removed`, `subscription_cancellation_scheduled`,
     `subscription_cancelled`, `subscription_paused`, `subscription_renewed`,
     `subscription_deleted`, `customer_deleted`, `payment_succeeded`, `payment_failed`.
2. **Checkout quantity lock** — *Settings → Configure Chargebee → Checkout & Self-Serve
   Portal → Advanced settings*: enable "Customize plan/addon quantity based on meta
   configuration". Required so enterprise checkout quantity stays 1.
3. **Hosted checkout & portal** — enable the self-serve portal and hosted pages; add the
   production domains (`forms.dculus.com`) as allowed redirect/return URLs.
4. **Dunning / payment retry** — configure retry schedule; the backend marks orgs
   `past_due` on `payment_failed` and lifts it on `payment_succeeded`.
5. **Email/notification sender and invoice branding** — set to production values.

## 3. Wire the credentials into the `production` environment
Today the `production` GitHub environment has **no** Chargebee secrets, so deployments
fall back to the repo-level (older) ones. Environment secrets override repo secrets, so
set all three on the environment (values are read from stdin, never echoed):
```bash
gh secret set CHARGEBEE_SITE --env production
gh secret set CHARGEBEE_API_KEY --env production
gh secret set CHARGEBEE_WEBHOOK_PASSWORD --env production
```
Then redeploy production (`release.yml` / `multi-cloud-deployment.yml`); Terraform maps
them to the container app (`CHARGEBEE_SITE`, `CHARGEBEE_API_KEY`,
`CHARGEBEE_WEBHOOK_PASSWORD`). `CHARGEBEE_ITEM_FAMILY_ID` is optional (defaults to the
family of the `free` plan).

## 4. Verify
- [ ] Chargebee → Product Catalog shows 6 plans + 1 add-on, entitlements on every price.
- [ ] `{ availablePlans { id prices { currency amount period } features } }` returns the
      five public plans (enterprise is hidden).
- [ ] Send a **test webhook** from the Chargebee dashboard → backend logs
      `[Chargebee Webhook] Received event` (a 401 means the Basic Auth password differs).
- [ ] Create a throwaway org: a `$0` free subscription appears in Chargebee and its
      `Subscription` row has limits from the `free` plan.
- [ ] Complete a test checkout with a real low-value card (or Chargebee test cards on a
      test site) and confirm the plan/limits sync; cancel and confirm the org falls back
      to the free limits.

## Rollback
The script only creates resources. To abandon a bad seed on a still-unused site,
archive the items in the dashboard (Chargebee does not allow deleting items that have
been used). Do not change a live plan's item/price ids.
