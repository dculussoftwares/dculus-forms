# Competitive Positioning

How dculus-forms compares to the tools a prospective buyer would already have open in another tab. Based on what's actually implemented in this codebase (see [02-feature-inventory.md](02-feature-inventory.md)) plus general market knowledge of the competitors — the competitor claims are from general knowledge and should be spot-checked against each vendor's current pricing/feature pages before publishing, since those change independently of this repo.

## vs. Typeform

Typeform is the aesthetic/UX benchmark this product has explicitly studied (see the Typeform builder/design-token research already captured in project memory — one-question-per-screen flow, layout polish, AI chat bar). The honest comparison:

| | Typeform | dculus-forms |
|---|---|---|
| Simultaneous multi-editor collaboration | No — single editor at a time | **Yes — real-time CRDT-based, multiple editors live** |
| AI form editing agent | Chat-to-create, but not full tool-calling schema edits | Tool-calling agent that adds/edits/reorders fields and layout directly |
| Quiz auto-grading | Not native | Native, with pass/fail thresholds and export columns |
| Pricing model | Per-seat, response-volume tiers, no meaningful free tier for real use | Per-org (not per-seat), genuinely usable free tier, $6–$15/mo paid tiers |
| Per-field analytics depth | Basic | Deep — word clouds, correlations, percentile completion times, domain breakdowns |
| Native language/currency for India | English/USD-centric | Full Tamil localization + INR pricing |

**Positioning line:** "Typeform's polish, without paying per teammate."

## vs. Google Forms

Google Forms wins on zero cost and ubiquity, loses almost everywhere else a paying customer would care:

| | Google Forms | dculus-forms |
|---|---|---|
| Cost | Free, no tiers | Free tier + paid tiers for scale/features |
| Real-time collaborative editing | Yes (Google's general doc collaboration) | Yes — comparable strength, but purpose-built for forms (field-level CRDT, not just text) |
| Response analytics | Basic charts | Deep per-field-type analytics, geolocation, completion-time percentiles |
| Automation/integrations | Apps Script (code required) or Zapier | Built-in webhook, email, Sheets/Excel sync, AI tagging — no code, no separate Zapier bill |
| Quiz grading | Basic (correct answer + point value) | Comparable core mechanic, plus export columns and pass/fail thresholds |
| Branding/theming | Limited | 9 layout templates, full background/theme customization |
| Audit trail on edited responses | None | Full field-level edit history |

**Positioning line:** "Everything Google Forms doesn't do: real analytics, real integrations, real branding — with the same real-time editing you're used to."

## vs. JotForm

JotForm competes on breadth (huge template library, widget marketplace, payment forms). dculus-forms is narrower but deeper on the things that matter for a team building forms together:

| | JotForm | dculus-forms |
|---|---|---|
| Template library size | Very large (thousands) | Small, curated (verify current count before quoting) |
| Real-time multi-editor collaboration | No | Yes |
| Plugin/integration model | Large marketplace, many third-party widgets | Smaller, first-party set (webhook, email, Sheets, Excel, quiz, AI tagging), but each is deeply integrated with export/analytics |
| Pricing | Per-submission tiers, can get complex | Simple 3-tier, unlimited views on all paid plans |
| AI form building | Some AI features | Tool-calling AI agent with schema-level edit capability |

**Positioning line:** "Fewer templates, more collaboration — built for teams who build forms as a team, not a template gallery to browse alone."

## vs. Tally

Tally is the closest peer in spirit (simple, modern, generous free tier) but is fundamentally a single-editor tool with light collaboration (comments/duplication, not live co-editing):

| | Tally | dculus-forms |
|---|---|---|
| Real-time collaborative editing | No | Yes |
| Quiz grading | Not native | Native |
| Analytics depth | Basic | Deep per-field analytics |
| Localization | English | English + Tamil |

**Positioning line:** "Tally's simplicity, with the team collaboration Tally doesn't have."

## The one sentence that ties it together

Every competitor above either (a) doesn't support real simultaneous multi-editor collaboration, or (b) charges per seat if it does. dculus-forms is the only one in this set that combines **live multiplayer editing** with **per-org (not per-seat) pricing** — which is the single clearest wedge for the landing page's core pitch.

## Risks / where competitors still win — be honest about these internally

- **Template library breadth** — JotForm and Typeform both have far larger pre-built template galleries; don't compete head-on here, lean into "build it live with AI" instead of "browse 3,000 templates."
- **Payment collection** — no native Stripe/payment-field integration found in this codebase; JotForm and Typeform both support payment forms natively. Worth flagging to product before a landing page implies parity.
- **Marketplace/third-party integrations** — the plugin set is first-party and small (6 working integrations); JotForm's widget marketplace and Typeform's App/Zapier ecosystem are much larger. Position as "deeply integrated, not exhaustively integrated."
