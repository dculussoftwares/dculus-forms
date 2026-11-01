# Chargebee setup script

`setup-chargebee.ts` bootstraps a Chargebee site (item family, features, plans, the hidden
enterprise plan, add-ons, item prices and entitlements) from
`docs/pricing-plan-catalog.json`. It is idempotent and **dry-run by default**; applying
requires `--execute --confirm-site=<CHARGEBEE_SITE>`.

Full procedure (credentials, dashboard-only settings, GitHub secrets, verification):
[`docs/deployment/CHARGEBEE_PRODUCTION_SETUP.md`](../../../../docs/deployment/CHARGEBEE_PRODUCTION_SETUP.md)

```bash
CHARGEBEE_SITE=<site> CHARGEBEE_API_KEY=<key> npx tsx src/scripts/setup-chargebee.ts          # dry run
CHARGEBEE_SITE=<site> CHARGEBEE_API_KEY=<key> npx tsx src/scripts/setup-chargebee.ts \
  --execute --confirm-site=<site>                                                           # apply
```

Existing catalogs are changed from the admin app (Plans / Add-ons), not by re-running this script.
