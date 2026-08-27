# Form Embedding — Analysis, UX Design & Implementation Strategy

> Let form owners put a dculus form **inside their own website** — inline, as a popup, as a slide-in drawer, or full-page — with a copy-paste snippet, a live preview, and analytics that distinguish embedded traffic from direct links.

- **Status**: Analysis / proposed. Nothing implemented.
- **Author**: analysis pass over `apps/form-viewer`, `packages/ui/src/layouts`, `apps/form-app` sharing surfaces, backend CSP/auth config.
- **Headline finding**: the hard part is **not** the iframe. It is (a) every layout is `h-full` inside a `h-screen` shell, so there is no content-height render mode to auto-resize against; (b) respondent auth and analytics both depend on `localStorage` + `sameSite=lax` cookies + a Google OAuth **redirect**, all three of which behave differently or break inside a third-party iframe.

---

## 1. Executive summary

### What exists today

| Capability | Today | File |
|---|---|---|
| Public form URL | ✅ `/f/:shortUrl` (+ legacy `/:shortUrl`) | `apps/form-viewer/src/App.tsx` |
| "Get link" dialog | ✅ copy-to-clipboard only | `apps/form-app/src/components/FormDashboard/Dialogs.tsx:111` |
| Internal share (org members) | ✅ permissions modal | `apps/form-app/src/components/sharing/ShareModal.tsx` |
| **Embed** | ❌ none — zero references in the codebase | — |
| QR code | ❌ none | — |
| Frame-ancestors control on the viewer | ❌ none (Cloudflare Pages, no `_headers` file) | `apps/form-viewer/public/` |

### The three decisions this document proposes

1. **Ship a loader script, not a bare iframe snippet.** A raw `<iframe>` cannot auto-resize, cannot open a popup, cannot report the parent URL. A ~4 KB `embed.js` served from the viewer origin unlocks all four embed modes from one snippet and one code path.
2. **Add a dedicated `embedded` render mode to `FormRenderer`/layouts** that swaps `h-full` + inner `overflow-y-auto` for content-driven height. Without it, inline embeds get the classic double-scrollbar trap and every layout looks broken at 500 px.
3. **Treat gated forms as a first-class embed case, not an edge case.** Sign-in must move to a **popup window** when embedded — the current Google redirect (`SignInGate.tsx:30`) will be blocked by Google's own `X-Frame-Options` inside an iframe.

### Effort at a glance

| Phase | Scope | Est. |
|---|---|---|
| Phase 0 | Spikes: content-height layout mode, popup auth | 3–4 d |
| Phase 1 | Inline embed + loader script + Share hub UI + analytics attribution | 8–10 d |
| Phase 2 | Popup / drawer / full-page modes, domain allowlist, branding toggle | 5–6 d |
| Phase 3 | QR, prefill via query params, `embed` events API, WordPress/Webflow guides | 4–5 d |

---

## 2. Competitive reference — what "good" looks like

| Capability | Typeform | Tally | Jotform | Google Forms | **Proposed (v1)** |
|---|---|---|---|---|---|
| Inline auto-resize | ✅ | ✅ | ✅ | ❌ fixed height | ✅ |
| Popup / modal | ✅ | ✅ | ✅ | ❌ | ✅ Phase 2 |
| Slide-in drawer | ✅ | ❌ | ✅ | ❌ | ✅ Phase 2 |
| Chat-bubble / FAB | ✅ | ❌ | ✅ | ❌ | 🔜 Phase 3 |
| Full-page | ✅ | ✅ | ✅ | ✅ | ✅ Phase 1 (trivial) |
| Live preview before copying | ✅ | ✅ | ✅ | ❌ | ✅ Phase 1 — **our differentiator** |
| React/Next/Vue package | ✅ | ❌ | ✅ | ❌ | 🔜 Phase 3 |
| Hide branding | paid | paid | paid | n/a | ✅ paid |
| Domain allowlist | ✅ enterprise | ❌ | ✅ | ❌ | ✅ Phase 2 |
| Prefill via URL params | ✅ | ✅ | ✅ | ✅ | 🔜 Phase 3 |
| `onSubmit` callback in host page | ✅ | ✅ | ✅ | ❌ | ✅ Phase 1 (comes free with postMessage) |

**Where we win:** live device-toggle preview inside the Share hub, and the fact that our 9 layouts already produce visually distinct embeds — competitors ship one look. **Where we must not lose:** auto-resize quality. Every negative review of an embed feature is about height jitter or double scrollbars.

---

## 3. Current architecture — what blocks embedding

### 3.1 The viewer is hard-wired to full-screen

```
apps/form-viewer/src/pages/FormViewer.tsx:421   <div className="h-screen w-full">
packages/ui/src/renderers/LayoutRenderer.tsx:79 <div className="w-full h-full">
packages/ui/src/layouts/L*.tsx                  w-full h-full flex flex-col
                                                └── inner: h-full … overflow-y-auto
```

All nine layouts (`L1ClassicLayout` … `L9PagesLayout`) follow the same shape: a `h-full` shell whose content pane scrolls **inside** itself (`overflow-y-auto`). This is correct for a full-page form and wrong for an inline embed:

- The iframe has a fixed height → content scrolls inside the iframe → **double scrollbar**, and on iOS Safari the inner scroll container is frequently unreachable.
- Nothing ever reports a natural content height, so there is nothing for a resize observer to read.
- Image-heavy layouts (`L5SplitLayout`, `L8ImageLayout`) allocate a percentage of viewport height to art; at 500 px of embed height they degrade badly.

**Implication:** an `embedded` mode is not cosmetic polish, it is the load-bearing change. See §6.1.

### 3.2 Respondent auth will break in a third-party iframe

Three independent mechanisms, three different failure modes:

| Mechanism | File | Behaviour in a cross-site iframe |
|---|---|---|
| better-auth session cookie, `sameSite: 'lax'` | `apps/backend/src/lib/better-auth.ts:173` | **Not sent.** `lax` excludes cross-site subresource requests. |
| Respondent bearer token in `localStorage` | `apps/form-viewer/src/lib/respondentAuth.ts` | Works, but **storage-partitioned** per top-level site (Safari ITP, Chrome CHIPS-era partitioning). A respondent signed in on `dculus.com` is *not* signed in inside `customer.com`'s iframe. |
| Google OAuth via **redirect** | `apps/form-viewer/src/components/SignInGate.tsx:30` | **Hard fail.** `accounts.google.com` sends `X-Frame-Options: DENY`; the iframe renders Google's refusal page. |

Apollo already sends `credentials: 'include'` (`apps/form-viewer/src/services/apolloClient.ts:10`), so the cookie path is *attempted* and silently yields an anonymous context.

**Implication:** embedded gated forms need popup-based sign-in with a `postMessage` token handback (§6.4). Until that ships, Phase 1 should **detect** a gated form in the embed builder and tell the owner plainly what happens.

### 3.3 Analytics silently degrade

`useFormAnalytics` (`apps/form-viewer/src/hooks/useFormAnalytics.ts`) and `getOrCreateSessionId` (`apps/form-viewer/src/lib/sessionId.ts`) both key off `localStorage`:

- Session IDs become **per-embedding-site**, so the same human counted once on the hosted form is counted again on each embedding site. Not wrong, but it must be documented.
- The completion-time key `form_start_time_{sessionId}_{formId}` lives in partitioned storage — it survives within one embed, so completion time still works.
- `FormViewAnalytics` (`apps/backend/prisma/schema.prisma:335`) and `FormSubmissionAnalytics` (`:362`) have **no column recording where the view came from**. Every embedded view is indistinguishable from a direct link view. This is the single most valuable analytics addition the feature can make (§6.6).

### 3.4 Frame headers: nothing is set today

- The backend sets `frame-ancestors: 'self'` via helmet (`apps/backend/src/index.ts:120`) — but that governs **backend responses only** (GraphQL, `/upload`), not the viewer.
- The viewer is a static Cloudflare Pages deploy (`.github/workflows/multi-cloud-deployment.yml:1536`) with **no `_headers` file**. Cloudflare Pages adds no `X-Frame-Options` by default.

**So: every published dculus form is already iframe-able by anyone, today, with no control and no visibility.** That is a pre-existing clickjacking-adjacent exposure, and it is also the reason a naive "embed" launch feels free — it is free, and uncontrolled. Phase 1 should ship a baseline `_headers` posture and Phase 2 the per-form allowlist (§6.5).

### 3.5 What is already right and needs no change

- Server-side gating (published check, submission limits, time windows, access control) all runs in `formByShortUrl` / `submitResponse` — an embed cannot bypass any of it.
- `credentials: 'include'` + the existing CORS allowlist mean the embedded iframe's GraphQL calls come from the **viewer origin**, not the host site. **No CORS change is required.** This is worth stating loudly because it is the thing teams usually get wrong.
- Rate limits (`graphqlLimiter`, 5000/min) are per-IP on the respondent, unaffected by embedding.
- File uploads POST to `/upload` from the iframe's own origin — unchanged.

---

## 4. UX design

### 4.1 The core UX problem: sharing is scattered

Today a form owner encounters three unrelated surfaces:

| Surface | Trigger | What it does |
|---|---|---|
| `CollectResponsesDialog` | "Get link" button | Shows the URL + a copy button |
| `ShareModal` | "Share" in the footer strip | **Internal** org permissions, not distribution |
| Nothing | — | Embedding |

The word "Share" currently means *"give my colleague edit access"*, which is not what any form owner means by share. Bolting a fourth dialog on makes it worse.

**Proposal: one "Share & Publish" hub** replacing both dialogs, opened from the existing `FormHeader` footer strip (`apps/form-app/src/components/FormDashboard/FormHeader.tsx:213`).

```
┌─ Share & Publish ─────────────────────────── [Live ●] ─ ✕ ┐
│                                                            │
│  [ Link ]  [ Embed ]  [ QR ]  [ Team access ]              │
│  ───────                                                   │
│  ┌──────────────────────────┬───────────────────────────┐ │
│  │ HOW IT APPEARS           │  LIVE PREVIEW             │ │
│  │                          │   ┌───────────────────┐   │ │
│  │ ◉ Inline                 │   │ ▓▓ your website ▓▓│   │ │
│  │   Sits in the page flow  │   │ ┌───────────────┐ │   │ │
│  │ ○ Popup                  │   │ │  [ the form ] │ │   │ │
│  │ ○ Slide-in drawer        │   │ └───────────────┘ │   │ │
│  │ ○ Full page              │   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│   │ │
│  │                          │   └───────────────────┘   │ │
│  │ Width      [ 100%    ▾]  │      🖥 Desktop  📱 Mobile │ │
│  │ Height     ◉ Auto-fit    │                           │ │
│  │            ○ Fixed [600] │                           │ │
│  │ Background ◉ Transparent │                           │ │
│  │                          │                           │ │
│  │ ▸ Advanced                                           │ │
│  └──────────────────────────┴───────────────────────────┘ │
│                                                            │
│  <script src="…/embed.js" …>       [ Copy code ] [ ✓ ]    │
│  Platform: [ HTML ] [ WordPress ] [ React ] [ Webflow ]    │
└────────────────────────────────────────────────────────────┘
```

### 4.2 The eight UX rules this design is built on

1. **Preview before snippet.** The single biggest cause of embed churn is pasting code and discovering it looks wrong. The preview pane is a real iframe of `/embed/:shortUrl` with the current options applied — the owner sees the truth, not a mockup.
2. **Copy is one click, always visible.** The snippet box is pinned at the bottom of the panel, never below a fold, and the copy button flips to a check for 2 s (the pattern `ShareModal` already uses via `linkCopied`).
3. **Progressive disclosure.** Four mode radios + three common options up front. Everything else (custom CSS class, `onSubmit` callback, prefill params, auto-focus, redirect-after-submit) lives behind one **Advanced** disclosure. Tally's embed panel is the reference for restraint here.
4. **Sensible defaults that need no thought.** Inline · width 100% · auto-fit height · transparent background. An owner who clicks Embed and clicks Copy gets the right thing.
5. **Warn where reality bites, at the moment of choosing.** Three inline warnings, each shown only when it applies:
   - Form is a **draft** → "Embedding a draft shows a 'not found' page to your visitors. Publish first." with a Publish button.
   - Form has **access control / collect email** on → "Respondents will be asked to sign in. Sign-in opens in a popup window — make sure your site doesn't block popups."
   - **Fixed height** selected on a multi-page form → "Long pages will scroll inside the frame. Auto-fit is usually better."
6. **Platform tabs, not a wall of docs.** The same configuration rendered four ways: raw HTML, a WordPress shortcode/HTML-block note, a React component snippet, a Webflow embed-element note. This is cheap (string templates) and removes the top support question.
7. **Transparent background by default** so the form adopts the host page's surface. Layouts currently hard-code `bg-white dark:bg-gray-900` on the shell (e.g. `L1ClassicLayout.tsx:146`) — the embedded mode must be able to drop that.
8. **Never surprise-scroll the host page.** On page navigation in a multi-page embedded form, scroll the **host** page to the top of the iframe only if the iframe's top is above the viewport. Blindly calling `scrollIntoView` yanks a reader out of the surrounding article and is the most-complained-about embed behaviour on the web.

### 4.3 Respondent-side UX inside an embed

| Moment | Full-page today | Embedded — required behaviour |
|---|---|---|
| Load | Full-viewport layout | Content-height, no internal scrollbar |
| Page change (multi-page) | Inner container scrolls | Iframe resizes; host scrolls only if frame top is off-screen |
| Validation error | Inline | Same, **plus** resize event (error text changes height) |
| Sign-in required | `SignInGate` fills viewport | Popup window; iframe shows a compact "Sign in to continue" card |
| Submitting | Full-screen dark overlay (`FormViewer.tsx:504`) | Overlay must be scoped to the iframe, not `position: fixed` at viewport scale |
| Thank-you | Full-viewport screen | Resize down to the thank-you card's natural height, **not** a jarring collapse — animate the height transition |
| Redirect after submit | n/a | Host-page navigation via `postMessage`, never `top.location` from inside the frame |

### 4.4 Branding

A "Powered by dculus" chip in the embed's bottom-right is the standard growth loop and the standard paid-plan removal. Gate `hideBranding` on plan tier — the plan-features plumbing already exists (`apps/backend/src/services/chargebeeService.ts`, `features` map). The chip must be part of the *embedded* layout only; the hosted `/f/:shortUrl` page should stay as it is.

---

## 5. Proposed data model

### 5.1 `FormSettings.embed` (additive, JSON — no migration)

`FormSettings` is a `Json?` column (`apps/backend/prisma/schema.prisma:148`), typed in `packages/types/src/index.ts:98` and mirrored in GraphQL at `apps/backend/src/graphql/schema.ts:151`. Adding `embed` is purely additive — absent means "defaults", byte-for-byte unchanged behaviour for existing forms.

```typescript
export type EmbedMode = 'inline' | 'popup' | 'drawer' | 'fullPage';

export interface EmbedSettings {
  /** Absent/false = the form is not embeddable; frame-ancestors stays 'none'. */
  enabled: boolean;
  mode: EmbedMode;
  /** CSS width, e.g. "100%" | "640px". Default "100%". */
  width?: string;
  /** 'auto' = post-message resize; number = fixed px. Default 'auto'. */
  height?: 'auto' | number;
  transparentBackground?: boolean;
  /** Paid-plan gated. */
  hideBranding?: boolean;
  /** Empty/absent = any origin may frame it. Hostnames, no scheme. */
  allowedDomains?: string[];
  /** popup/drawer only. */
  trigger?: { label: string; position?: 'right' | 'left'; openOnLoadDelayMs?: number };
  /** Host-page URL to navigate to after submit (postMessage → host). */
  redirectAfterSubmitUrl?: string;
  autoFocusFirstField?: boolean;   // default FALSE — autofocus in an iframe scroll-jacks
}
```

Mirror as `EmbedSettings` / `EmbedSettingsInput` in the GraphQL schema alongside `AccessControlSettings`.

### 5.2 Analytics attribution (requires a migration)

```prisma
model FormViewAnalytics {
  // … existing …
  embedContext  String?   // 'direct' | 'inline' | 'popup' | 'drawer' | 'fullPage'
  embedHost     String?   // parent page hostname only — never the full URL/query
  @@index([formId, embedHost])
}
// identical two columns on FormSubmissionAnalytics
```

**Privacy:** store the **hostname only**, never path or query string. A parent URL can carry PII in its query string; a hostname cannot. Per `CLAUDE.md`, this needs a checked-in migration with `ADD COLUMN IF NOT EXISTS` guards, plus `pnpm db:generate && pnpm db:push` after pulling.

---

## 6. Technical design

### 6.1 The `embedded` render mode (the load-bearing change)

Add to `LayoutProps` / `FormRendererProps`:

```typescript
/** Renders at content height with no internal scroll container — for iframe embeds. */
embedded?: boolean;
```

Per layout, `embedded` selects a different container class set:

| | Hosted (today) | Embedded |
|---|---|---|
| Shell | `w-full h-full flex flex-col` | `w-full flex flex-col` |
| Content pane | `h-full … overflow-y-auto` | `w-full` (no height, no overflow) |
| Shell background | `bg-white dark:bg-gray-900` | conditional on `transparentBackground` |
| Submitting overlay | `fixed inset-0` | `absolute inset-0` |
| Intro/thank-you art | viewport-proportional | capped `max-h-[40vh]` / hidden below a width threshold |

Nine layouts × one conditional each. Mechanical, but it must be done for all nine or the embed quality is a lottery depending on which layout the owner picked. **`L5SplitLayout` and `L8ImageLayout` need real design attention**, not just a class swap — a 50/50 split at 600×500 is unusable.

**Spike first (Phase 0):** implement `embedded` for `L1ClassicLayout` only, measure resize stability across a multi-page form with conditional fields. If height jitters, the whole approach needs revisiting before nine layouts are touched.

### 6.2 Routes and the loader script

```
/embed/:shortUrl          new — renders FormViewer with embedded={true}
/embed.js                 new — the loader script, served from the viewer origin
/f/:shortUrl              unchanged
```

`/embed/:shortUrl` reads its options from query params (`?mode=inline&bg=transparent&branding=0`) so the preview pane in form-app can render it live without a save round-trip.

**Why a loader script rather than a bare iframe snippet:**

| | Bare `<iframe>` | `embed.js` |
|---|---|---|
| Auto-resize | ❌ impossible | ✅ |
| Popup / drawer modes | ❌ | ✅ |
| Reports parent hostname | unreliable (`document.referrer` policy-dependent) | ✅ explicit |
| Host-page `onSubmit` hook | ❌ | ✅ |
| Fix a bug post-launch | ❌ snippet is frozen in customers' HTML | ✅ script is versioned server-side |

That last row is the decisive one. Snippets pasted into customer sites are effectively immutable; a loader script is the only upgrade path.

The snippet stays declarative so it degrades sanely:

```html
<div data-dculus-form="aB3xY9" data-dculus-mode="inline"></div>
<script src="https://forms.example.com/embed.js" async></script>
```

Script budget: **< 5 KB gzipped, zero dependencies, no framework.** It must not assume it is the only copy on the page (multiple forms per page → `querySelectorAll`, idempotent init guard).

### 6.3 postMessage protocol

Namespaced, versioned, origin-checked in both directions. Never `postMessage(..., '*')` for anything carrying a token.

```typescript
// iframe → host
{ type: 'dculus:ready',    v: 1, formId }
{ type: 'dculus:resize',   v: 1, formId, height: number }
{ type: 'dculus:page',     v: 1, formId, pageIndex, pageCount }
{ type: 'dculus:submit',   v: 1, formId }            // no response data — never leak answers to the host
{ type: 'dculus:redirect', v: 1, formId, url }
{ type: 'dculus:scroll',   v: 1, formId }            // "my top is off-screen, please scroll"

// host → iframe
{ type: 'dculus:host',     v: 1, hostname, viewportWidth }
{ type: 'dculus:close',    v: 1 }                    // popup/drawer dismissal
```

Rules:
- The iframe validates `event.origin` against the `hostname` it was told, and the host validates against the viewer origin baked into `embed.js` at build time.
- **`dculus:submit` carries no answer data.** A host page that wants the response should use a webhook/automation. Posting answers to the parent frame is a data-exfiltration path dressed up as a convenience.
- Resize is emitted from a `ResizeObserver` on the layout root, **debounced (~100 ms) and dead-banded (ignore deltas < 4 px)** — this is what prevents the jitter loop where a resize changes wrapping which changes height which triggers a resize.

### 6.4 Sign-in inside an embed (popup handshake)

```
iframe: "Sign in to continue"  ──click──▶ window.open(/embed-auth?formId&returnOrigin)
                                              │  (top-level window: Google OAuth works,
                                              │   cookies are first-party)
                                              ▼
                                          /auth/callback issues the respondent token
                                              │
                              postMessage({dculus:auth, token}) ──▶ opener (the iframe)
                                              │
iframe stores token via setRespondentToken() ─┘ then refetch() — the exact same
                                                call the existing SignInGate makes.
```

- `SignInGate` gains an `embedded` prop that swaps the redirect for `window.open`. The OTP path could stay inline (it is our own UI, no third-party frame busting) — but keeping **both** paths in the popup is simpler to reason about and to test.
- Popup blockers: the `window.open` must be called **synchronously in the click handler**, never after an `await`.
- The iframe needs `allow-popups` and `allow-popups-to-escape-sandbox` if a `sandbox` attribute is used at all.

**Recommended sandbox** (permissive on purpose — the form needs its own origin for storage):

```html
sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
allow="clipboard-write"
```

### 6.5 Frame-ancestors: static baseline now, dynamic later

Cloudflare Pages serves the viewer statically, so a per-form `frame-ancestors` header cannot come from a `_headers` file.

**Phase 1 — static baseline** (`apps/form-viewer/public/_headers`):

```
/embed/*
  Content-Security-Policy: frame-ancestors *;
  X-Frame-Options:
/*
  Content-Security-Policy: frame-ancestors 'self';
  X-Frame-Options: SAMEORIGIN
```

This closes the current gap in §3.4: only `/embed/*` is framable, and the hosted form page stops being silently embeddable by anyone.

**Phase 2 — per-form allowlist** needs a **Cloudflare Pages Function** at `/embed/[shortUrl]` that looks up `settings.embed.allowedDomains` and emits the header. Costs one edge lookup per embed load; cache it hard (the settings change rarely). This is the only piece of the feature that adds infrastructure, which is exactly why it belongs in Phase 2 rather than Phase 1.

**Client-side defence in depth** (not a substitute): if `settings.embed.enabled === false`, `/embed/:shortUrl` renders a "This form is not available for embedding" card rather than the form.

### 6.6 Analytics wiring

- `embed.js` sends the parent **hostname** in `dculus:host`; the iframe includes `embedContext` + `embedHost` in `TrackFormViewInput` and `SubmitResponseInput`.
- Falls back to `document.referrer`'s hostname if the message hasn't arrived yet, and to `'direct'` when not framed (`window.self === window.top`).
- New analytics views in form-app: a **Traffic source** breakdown (direct vs each embedding host) on `FormAnalytics`, and the same split on the submissions funnel. This turns embed from a feature into a reporting story — "your form converts at 34% on your pricing page and 8% in the footer" is the thing owners actually want.

### 6.7 Things that need no change (verified)

- **CORS** — the iframe's GraphQL/upload calls originate from the viewer origin, already allowlisted.
- **Server-side gating** — publish state, submission limits, time windows, access control all enforced in resolvers.
- **Y.js / collaboration** — not involved; the viewer reads `formSchemaPublic`, not the collaborative doc.
- **Plugins / automations** — a submission is a submission regardless of surface.

---

## 7. Risks and edge cases

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Resize jitter loop** — height change → reflow → height change | High | Debounce + 4 px dead band + `ResizeObserver` on a single stable root |
| 2 | **iOS Safari** ignores iframe height and collapses scroll containers | High | Content-height mode removes inner scrolling entirely; test on real hardware, not the simulator |
| 3 | Gated forms unusable when embedded (Google frame-bust) | High | Popup handshake §6.4; until then, warn in the embed builder |
| 4 | Host page has a strict CSP without `frame-src` | Medium | Document the required `frame-src`/`script-src` directives per platform tab |
| 5 | `L5Split`/`L8Image` layouts illegible in small frames | Medium | Layout-specific embedded breakpoints; consider recommending L4/L7 for embeds |
| 6 | Owner embeds an unpublished form | Medium | Draft warning + publish CTA in the panel; `/embed/*` shows a clear card, not a 404 |
| 7 | Analytics double-count across embedding sites | Medium | Documented; `embedHost` makes it visible rather than mysterious |
| 8 | Snippet frozen in customer HTML with a bug | Medium | Loader script is server-versioned; snippet carries no logic |
| 9 | Autofocus scroll-jacks the host page | Low | `autoFocusFirstField` defaults **false** when embedded |
| 10 | Multiple embeds of the same form on one page | Low | Per-instance IDs in the loader; `postMessage` messages carry `formId` + instance |
| 11 | Print / PDF of the host page cuts the form | Low | `@media print` rules in the embedded layout |
| 12 | Dark-mode mismatch with the host site | Low | Transparent background default + an explicit `theme=light|dark|auto` param |

---

## 8. Implementation plan

### Phase 0 — Spikes (3–4 d) — *must precede Phase 1*

1. `embedded` mode on `L1ClassicLayout` only + a `ResizeObserver` prototype; verify stable height across page navigation, validation errors, and conditional field reveals.
2. Popup OAuth handshake against a local `file://`-ish host page; confirm the token reaches the iframe and `refetch()` unblocks the form.
3. Decide: Cloudflare Pages Function feasible for dynamic `frame-ancestors`? (blocks Phase 2 scope, not Phase 1).

### Phase 1 — Inline embed MVP (8–10 d)

- `EmbedSettings` in `packages/types`, GraphQL schema + input, `updateForm` plumbing.
- `embedded` mode across all nine layouts.
- `/embed/:shortUrl` route; submitting overlay scoped to the frame.
- `embed.js` loader — inline mode, auto-resize, `dculus:*` protocol, parent hostname.
- **Share & Publish hub** in form-app replacing `CollectResponsesDialog`; Link + Embed tabs, live preview, device toggle, platform snippets, the three contextual warnings. `ShareModal` moves under a "Team access" tab.
- `_headers` baseline (§6.5 Phase 1).
- Analytics migration + `embedContext`/`embedHost` capture; traffic-source breakdown in `FormAnalytics`.
- i18n: new `embed` namespace in **both** `apps/form-app/src/locales/en/` and `.../ta/`, registered in `locales/index.ts` (mandatory per `CLAUDE.md`).

### Phase 2 — Modes, control, branding (5–6 d)

- Popup, drawer, full-page modes in `embed.js` + their trigger config UI.
- Popup sign-in handshake shipped for real (`SignInGate` `embedded` prop).
- Per-form domain allowlist via Pages Function.
- "Powered by dculus" chip + plan-gated `hideBranding`.
- `redirectAfterSubmitUrl` via `dculus:redirect`.

### Phase 3 — Reach (4–5 d)

- QR tab (offline → form; pairs naturally with the Link tab).
- Prefill via query params → hidden/prefilled fields.
- `@dculus/embed-react` package; WordPress plugin or documented shortcode.
- Chat-bubble/FAB mode.

---

## 9. Acceptance criteria

**Functional**
- A published form embedded inline on a third-party page renders, submits, and shows the thank-you screen with **no internal scrollbar** and no host-page scroll jump.
- Height tracks content within ±4 px across: page navigation, validation errors, conditional field reveal/hide, thank-you transition.
- All nine layouts render acceptably at 375 px, 768 px, and 1280 px embed widths.
- An unpublished form, or one with `embed.enabled === false`, shows an explanatory card — never the form, never a raw 404.
- A gated form embedded on a third-party page can be completed end to end via popup sign-in (Phase 2).
- Submissions from an embed are indistinguishable from direct submissions in every downstream system (plugins, automations, exports, PDF templates) except for the new `embedContext`/`embedHost` attribution.

**Non-functional**
- `embed.js` ≤ 5 KB gzipped, no dependencies, safe when included twice, safe with multiple forms per page.
- No answer data ever crosses the `postMessage` boundary.
- `frame-ancestors` restricts `/f/*` to `'self'` after Phase 1 (a security improvement over today).
- Every new user-facing string exists in `en` **and** `ta`.

**Test plan**
- Unit: resize debounce/dead-band logic; `postMessage` origin validation (both directions); snippet generation per platform tab.
- E2E (Cucumber, `test/e2e`, tag `@embed`): serve a static fixture host page that includes the snippet; drive the form inside the frame; assert submission lands with `embedContext = 'inline'`.
- Manual matrix: Chrome/Safari/Firefox desktop, iOS Safari, Android Chrome × inline/popup/drawer.

---

## 10. Open questions

1. **Plan gating** — is embedding itself free (growth loop, branding chip attached) with only `hideBranding` + `allowedDomains` paid? Recommendation: **yes**. Gating the embed itself suppresses exactly the distribution we want.
2. **Domain allowlist default** — open (any origin) or closed (owner must list domains)? Recommendation: **open by default**, allowlist as an opt-in control. A closed default generates support tickets on day one.
3. **Does `/f/:shortUrl` stay framable at all?** Recommendation: **no** — `frame-ancestors 'self'` — so embedding always goes through `/embed/*` and is always attributable.
4. **Do we ever expose response data to the host page?** Recommendation: **never**. Webhooks and automations are the supported path.
5. **`L5Split`/`L8Image` in embeds** — adapt them, or steer owners toward embed-friendly layouts with a hint in the panel? Cheapest good answer: adapt the breakpoints *and* show the hint.
