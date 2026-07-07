# Chargebee Single Source of Truth + AI Credits — SDD Progress Ledger

(Previous ledger: submission-limits-time-window, FEATURE COMPLETE, merged — replaced.)

Plan: /Users/natheeshkumarrangasamy/.claude/plans/i-want-to-keep-velvet-sunrise.md
Branch: feature/ai-credits-chargebee (from main @ 9105d381)
Model policy (user directive): implementers + task reviewers = sonnet; final whole-branch review = Fable main loop.

## Pre-flight notes
- Working tree at branch start already contains PARTIAL Task 1 edits to
  apps/backend/src/scripts/setup-chargebee.ts (ai_credits feature block added,
  activateFeatures() defined but NOT wired into main(), free-plan entitlement
  configs updated with ai_credits:200; starter/advanced entitlement configs
  still missing ai_credits). Task 1 implementer completes and commits these.
- Verified against Chargebee SDK 3.14.0 typings: chargebee.feature.activate(id)
  exists; subscription.createWithItems(customerId, params) exists;
  auto_collection: 'off' is the documented way to create $0 subs with no card.
- Phase 0 (test-site separation) is blocked on the user creating a
  dculus-global-test API key — user-facing checklist, not dispatched to subagents.

## Tasks
- [x] Task 1: Extend setup-chargebee.ts (ai_credits feature + entitlements + activation)
- [x] Task 2: Schema columns (creditsUsedMilli, aiCreditsLimit) + lib/ai.ts credit weights
- [x] Task 3: aiUsageService credits rework + caller tier params + tests
- [x] Task 4: chargebeeService (ai_credits mapping, case-insensitive unlimited, $0 free subs, aiCreditsLimit sync) + tests
- [x] Task 5: Backfill scripts (ai credits, free subscriptions)
- [x] Task 6: GraphQL + form-app credits UI + i18n (en/ta)
- [x] Task 7: Full-suite verification sweep (type-check, build, test:unit) + db:push (deferred from Task 2 — shared dev DB)

Task 7: complete (db:push applied to dculus_forms_dev_db — pre-existing form_template [name,category] unique-constraint drift verified duplicate-free before --accept-data-loss; root type-check PASS, build PASS, backend 2374/2374 tests PASS)

Final whole-branch review (Fable main loop, main..2fc8c98e, 27 files +1060/-110): APPROVED — verified aiUsageService final state (effectiveCreditLimit fallback chain, both counters in both upsert branches), chargebeeService (isUnlimited on all 3 features, fail-open $0 sub creation with Sentry, aiCreditsLimit at all 3 write sites incl. hardcoded outage fallback), en/ta locale parity + natural Tamil, meter renders credits with divide-by-zero guard. All deferred Minors triaged: cosmetic/documented, none blocking. READY FOR MERGE.

## Rollout log (2026-07-07)
- Test site dculus-global-test: catalog fully provisioned (10 prices, ai_credits entitlements verified via API), features ACTIVE, multi-currency+USD enabled by user, webhook configured by user.
- Dev backfills: aiCreditsLimit seeded (1 org), $0 sub created (customer had to be created on test site first — dev orgs' customers only existed on live).
- GitHub: dev/staging env secrets = test site; repo secrets = live; CHARGEBEE_WEBHOOK_PASSWORD wired via terraform (commit 7f6277e7), passwords in ~/dculus-chargebee-webhook-passwords.txt (gitignored copy in repo root).
- Bug fixed during rollout: backfill scripts crashed on module-load env validation (ESM import order) — load-env.ts shim, commit e275f4b9.
- Live site dculus-global: ai_credits feature + entitlements created, all 3 features activated (setup script run 2026-07-07 05:15 UTC).
- Prod DB: migration 20260707051800_add_ai_credits applied via migrate deploy (repo uses migrations in prod — migration file committed 6075d30b); backfills executed: 10/10 orgs seeded with aiCreditsLimit=200 and real $0 live-site subscriptions, 0 failures.
- Secret audit of all pushed commits: clean.
- Deploy: main push auto-deploys dev; tag v1.2.111 pushed → production deploy via Build Pipeline → multi-cloud-deployment.
- Pre-existing prod drift noted (NOT touched): form_template has 7×3 duplicate name+category rows; schema.prisma's unique constraint has no migration. dedupe-templates.ts exists in scripts/. Separate cleanup task.

## Deploy + webhook verification (2026-07-07, final)
- Prod container runs image v1.2.111 (dispatched via workflow_dispatch — v* tag push does NOT trigger prod deploy; workflow_run ignores tags filter). Dev on sha-6075d30b.
- Webhook password mismatch found post-deploy: user configured Chargebee dashboards with their own credentials, not the generated secrets. Resolved by adopting the user's password everywhere (repo + dev/staging gh secrets, both container apps via az update, local .env).
- Live verification: /health 200 on both; POST /api/webhooks/chargebee → 200 with dashboard credentials, 401 with wrong password, on BOTH prod and dev. Chargebee webhooks functional end-to-end for the first time.

## FEATURE + ROLLOUT COMPLETE (pending: e2e tests in prod deploy run 28844422130)

## Remaining (user-dependent, not code)
- Phase 0: create dculus-global-test API key; switch local .env; gh env secrets (dev/staging); test-site webhook + separate CHARGEBEE_WEBHOOK_PASSWORD
- Run setup-chargebee.ts against test site, then live site (adds ai_credits + activates the draft features)
- Run backfill-ai-credits.ts then backfill-free-subscriptions.ts (dry-run first, then --execute) per environment

Task 2: complete (commit 627d9ea9, review clean — Important finding [prisma format collateral on 5 unrelated models] ruled acceptable by controller: cosmetic, no other task touches schema.prisma. Minor deferred to final review: missing afterEach env cleanup in new describe block; no invalid-override test for NANO weight specifically)

DESIGN DEVIATION (controller, Task 3): plan said aiCreditsLimit null = unlimited; changed to null = not-synced → fall back to AI_CREDIT_LIMITS_FALLBACK[planId]. Reason: after db:push every existing row is null; null=unlimited would unmeter all orgs until backfill/webhook sync. No current plan has unlimited AI credits. Surface to user in final summary.

Task 3: complete (commit 90a1e6ca, review clean after controller fix round — Important [resolver error string said "tokens" for credit values] + Minor [stale null=unlimited schema comment] fixed directly + amended; reviewer re-approved, confirmed frontend keys off error code not string. NOTE for Task 6: frontend locale JSONs aiEditDrawer.json / aiFormBar.json / subscriptionDashboard.json still say "AI token limit reached" — reword to credits.)

Task 4: complete (commit 419f6548, review clean — first dispatch died to API error then stalled; fresh dispatch kept its RED tests. Reviewer confirmed the "extra" hardcoded-fallback aiCredits addition is load-bearing, not scope creep. Minor deferred: failure-path test spies logger.error without asserting it; pre-existing `parseInt || null` treats "0" entitlement as null [inherited, all three features])

Task 5: complete (commit a0bc3c4d, review clean — Minor deferred [brief-inherited]: subscription.list ignores next_offset for >100-sub customers; documented-unlikely)

Task 6: complete (commit 2fc8c98e, review clean — reviewer verified ta naturalness + placeholder parity; Minor deferred: BillingSettings UsageCard shows unit only in label [matches sibling cards]; redundant toLocaleString on 1dp creditsUsed)

Task 1: complete (commit 02d55ead — reviewed at 50e80540, spec ✅, quality approved; Important finding [loose 'active' substring match in activateFeatures error handling] fixed directly by controller + amended; Minor deferred: per-item log lines in activateFeatures omit trailing \n)
