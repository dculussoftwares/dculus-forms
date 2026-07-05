# Value Proposition & Positioning

Source material for landing page copy — headlines, hero sections, feature callouts. Synthesized from the feature and technical deep dives in this folder; treat the framing as draft copy to react to, not final.

## What dculus-forms is, in one line

A form builder where teams **build forms together, live** — plus the analytics, grading, and integrations to act on the responses — priced for teams that Typeform's per-seat pricing shuts out.

## Who it's for

- **Teams, not solo form-makers.** The product's core technical investment (Y.js/Hocuspocus real-time collaboration) only pays off if more than one person edits a form. Positioning should lead with team/org use cases: marketing + ops co-building a lead form, HR co-editing an onboarding survey, event teams iterating on a registration form together.
- **Education / training / assessment users.** Built-in quiz auto-grading (per-question scoring, pass/fail threshold, exportable scores) is a distinct feature most general-purpose form tools don't ship natively.
- **India-based teams and the Tamil-speaking market specifically.** Full Tamil localization plus native INR pricing is a deliberate, explicit choice — this isn't an afterthought translation, it's a market bet. Worth a dedicated landing page variant or at least prominent language/currency switching.
- **Teams who've outgrown Google Forms but find Typeform's pricing steep for the volume they send.** The three-tier plan (free → $6/mo → $15/mo) undercuts Typeform meaningfully at the low-to-mid end while still offering unlimited views and depth of analytics.
- **Teams who want automation without hiring an integrations engineer.** Webhooks, email notifications with live value substitution, Google Sheets / Excel sync, and AI auto-tagging are all built-in, no Zapier subscription required.

## Headline-worthy differentiators (ranked by how defensible/rare they are)

1. **Real-time multiplayer form editing.** Multiple people editing the same form simultaneously, seeing each other's changes live, is a genuine CRDT-backed feature (Y.js + Hocuspocus) — not a "someone else is viewing this form" banner. This is the single most technically differentiated claim available and should anchor the hero section. Suggested framing: *"Build forms together, live — like a doc, not a form."*
2. **AI that edits the form for you, not just autocompletes text.** The AI agent calls real tools (add/remove/reorder fields, change layout, propose validation) against the live schema — a materially different claim than "AI writes your questions."
3. **Quiz auto-grading built in.** Per-question correct-answer scoring with pass/fail thresholds and export columns — positions the product for education/training use cases where Typeform and Google Forms both require bolt-on workarounds (Google Forms' quiz mode is basic; Typeform doesn't have native grading).
4. **Deep per-field analytics out of the box**, not just an aggregate response count — word clouds and length stats for text, correlation analysis for checkboxes, domain breakdowns for email, percentile completion times. This is the kind of depth usually reserved for enterprise-tier form tools.
5. **Full audit trail on response edits.** Field-level before/after history with who/when/IP — a trust/compliance signal for teams handling sensitive submissions (HR, healthcare intake, legal intake).
6. **Transparent, usage-based pricing in local currency.** Free tier with real limits (not a crippled trial), then flat per-org pricing rather than per-seat — collaboration doesn't cost extra per collaborator, which directly reinforces differentiator #1 (why charge per seat for a tool designed for many people to use one form at once?).

## Draft messaging angles

- **Hero angle A (collaboration-led):** "The form builder your whole team can edit at once." Sub-line: real-time collaborative editing, AI-assisted building, and response analytics that go deeper than a spreadsheet.
- **Hero angle B (value-led):** "Typeform-grade forms, without the per-seat bill." Sub-line: unlimited views on every paid plan, real-time team editing included, starting at $6/mo.
- **Hero angle C (India/Tamil-market-led, for a regional variant):** Lead with Tamil-language UI and INR pricing as first-class, not a toggle buried in settings.

## Proof points to surface on the page

- Free tier: 10,000 views / 1,000 submissions per month, $0 — genuinely usable, not a 14-day trial.
- Starter: unlimited views, 10,000 submissions/mo, $6/mo (~₹489/mo).
- Advanced: unlimited views, 100,000 submissions/mo, $15/mo (~₹1,289/mo).
- Native integrations without extra tooling: Webhooks, Email, Google Sheets, Microsoft Excel, AI auto-tagging, quiz grading.
- 9 layout templates, English + Tamil out of the box.

*(Re-verify pricing/limits against `chargebeeService.ts` and the live Chargebee catalog before publishing — see the caveat in [README.md](README.md).)*

## Gaps to be honest about internally before writing copy that overclaims

- The "50+ ready-made forms" template claim (seen in the AI wizard copy) doesn't match the current seed data (7 templates as of this deep dive) — don't publish a specific template count without checking the live template library first.
- Slack is listed in the plugin catalog UI but has no working backend handler yet (`comingSoon`) — don't advertise Slack notifications as available.
- No native SMS/WhatsApp notification channel exists yet, if that's relevant to the India-market positioning.
