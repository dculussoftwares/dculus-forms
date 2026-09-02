# Form Embed v1 — Feature Spec & Full Flow

> The buildable v1. Five ways to put a dculus form in front of respondents — **link, button, plain iframe, inline JS (auto-resize), lightbox popup** — configured from one panel with a live preview, and attributed in analytics.

- **Status**: **Built.** All five types ship. See §15 for what was decided differently from this spec while building it, and what is still open.
- **Companion doc**: [`form-embed-strategy.md`](./form-embed-strategy.md) — competitive analysis, architectural constraints, phased roadmap. This doc is the narrow, concrete v1 cut of it.
- **Est.**: 9–12 dev-days (+0.5 for the §2 prerequisite fix, which can ship first and alone).

---

## 1. Scope

### In v1

| # | Type | Needs JS? | Auto-resize | Primary use |
|---|---|---|---|---|
| 1 | **Link** | no | — | Email, social, DM, QR |
| 2 | **Button** | no | — | "Give feedback" CTA in a page |
| 3 | **Standard iframe** | no | ❌ fixed height | CMS/newsletter/wiki that strips `<script>` |
| 4 | **Inline (JS)** ⭐ default | yes | ✅ | Landing page, contact page, blog post |
| 5 | **Lightbox popup** | yes | ✅ (in overlay) | Any page — button opens the form over the content |

Plus: **live preview with device toggle**, **QR code**, **traffic-source attribution** in analytics, **host-page `onSubmit` callback**.

### Explicitly out of v1

Slide-in drawer · chat bubble/FAB · per-form domain allowlist (needs a Pages Function) · popup sign-in for gated forms · URL prefill · React/WordPress packages · `hideBranding` plan gate (the chip ships, the toggle doesn't).

### The one v1 boundary that needs stating

**Gated forms (`accessControl.enabled` or `collectRespondentEmail`) cannot be embedded in v1** — types 3/4/5 are disabled for them in the UI with an explanation, and Link/Button are offered instead. Reason: Google OAuth frame-busts inside an iframe (`SignInGate.tsx:30` uses a redirect) and `sameSite: 'lax'` cookies aren't sent cross-site (`better-auth.ts:173`). Popup sign-in is a real piece of work and belongs in v2. Shipping a broken gated embed is worse than not shipping one.

---

## 2. Prerequisite fix — "Share" today shares the wrong thing

This must land with v1, because the Collect panel reorganises exactly these surfaces.

### 2.1 The bug

`ShareModal.handleCopyLink` (`apps/form-app/src/components/sharing/ShareModal.tsx:193`) copies:

```js
`${window.location.origin}/dashboard/form/${formId}`   // the BUILDER url, in form-app
```

…while the UI around it says (`apps/form-app/src/locales/en/sharing.json`):

| String | Current copy | Reality |
|---|---|---|
| `modal.copyLink.label` | "Form Link" | It's a builder link |
| `modal.copyLink.description` | **"Anyone with this link can view the form"** | Flatly false — it requires a form-app login *and* a `FormPermission` row |
| `toast.success.linkCopied` | "Form link copied to clipboard" | Builder link |

So: owner clicks **Share** → **Copy link** → sends it to a respondent → the respondent hits the form-app sign-in wall, and even after signing in gets an authorization error unless they're an org member with access. The one string that would stop them doing it promises the opposite.

The correct public URL is built by `getFormViewerUrl(shortUrl)` (`apps/form-app/src/lib/config.ts:75`) and is what **Get Link** (`CollectResponsesDialog`) already uses. Two buttons, two URLs, one of them wrong — and the wrong one is the one called "Share".

**Blast radius:** two mount points, both affected — `FormDashboard.tsx:323` and `FormBuilderHeader.tsx:368`. `ShareModal` isn't even given `shortUrl` as a prop today, so it *cannot* build the right URL without a signature change.

### 2.2 The deeper problem: "Share" means two different things

| Concept | Audience | Lives in | Governed by |
|---|---|---|---|
| **Distribution** — get responses | the public / respondents | `getLink` dialog, and now Embed | `isPublished`, `settings.accessControl` |
| **Collaboration** — let a teammate edit | org members | `ShareModal` | `sharingScope`, `FormPermission` |

Both are called "Share". Worse, both have a **"who can access this?" control** in different screens: `ShareModal`'s `sharingScope` (PRIVATE / SPECIFIC_MEMBERS / ALL_ORG_MEMBERS) governs *builder* access, while Form Settings → Access control governs *respondent* access. An owner who wants "only my company can fill this in" will find the wrong one first.

### 2.3 Resolution — follow the Microsoft Forms model

Microsoft Forms solved exactly this collision, and its answer is stronger than a tabbed
"Share" hub: **the two audiences never appear in the same panel.**

| Microsoft Forms | Where it lives | What it governs |
|---|---|---|
| **"Collect responses"** — the primary green button | top-right, always visible | respondents: audience dropdown + Link (shorten URL) · Email/Teams · QR · Embed |
| **"Collaborate or Duplicate"** | demoted into **⋯ More form settings** | teammates: "…can view and edit", plus "Get a link to duplicate" |

Two things it gets right that we don't:

1. **The word "Share" is never used alone.** Two unambiguous verbs — *collect responses* and *collaborate* — replace it. Our bug is a direct product of one word meaning both.
2. **Who-can-respond is set where the link is made.** MS puts the audience dropdown ("Anyone can respond" / "Only people in my organization can respond" / "Specific people…") at the **top of the collect panel**, immediately above the link. You cannot copy a link without seeing who it works for. Ours is buried two screens away in Settings → Access control.

### 2.4 The mapping to dculus-forms

| Microsoft Forms | dculus-forms | Backed by |
|---|---|---|
| "Collect responses" button | **"Collect responses"** — primary button (replaces *Get Link*) | — |
| Audience dropdown | **"Who can respond"** selector at the top of the panel | `settings.accessControl` + `collectRespondentEmail` |
| Link + shorten URL | **Link** tab | `getFormViewerUrl(shortUrl)` — already short, no shortener needed |
| QR code | **QR** tab | same URL |
| Embed `<>` | **Embed** tab | this spec |
| Email / Teams | *(optional)* `mailto:` compose | — |
| ⋯ → "Collaborate or Duplicate" | ⋯ → **"Collaborate"**, beside the existing **Duplicate** | `sharingScope` + `FormPermission` |

**Where I'd deviate from Microsoft — one change, deliberately.**

MS demotes *Collaborate* into the ⋯ overflow menu. That's right **for Microsoft**, where
co-authoring is a minor add-on. It's wrong for us: dculus has real-time Y.js co-editing, an
org permission model, and invitations — collaboration is a headline feature here, and burying
it makes it undiscoverable. Hiding it also isn't what fixes the bug; **the naming is.**

So: **MS's separation, without MS's demotion.**

| | Today | Recommended |
|---|---|---|
| Header primary | "Get Link" → thin AlertDialog | **"Collect responses"** → the real panel (audience + Link / QR / Embed) |
| Footer strip | "Share" → `ShareModal` | **"Collaborate"** → `ShareModal` — *same place, honest name* |
| ⋯ menu | Duplicate · Delete | unchanged |

**The four structural moves:**

1. **Retire "Share" as a standalone label.** Every surface is named by its audience: *Collect responses* (respondents) or *Collaborate* (teammates). One word meaning both is what produced §2.1.
2. **"Collect responses" is promoted to the primary button** and opens a real panel. It's already the phrase the codebase uses — `handleCollectResponses`, `dialogs.collectResponses.*` — so this is a rename of the button, not a new concept.
3. **The footer "Share" button becomes "Collaborate"** and keeps its position and both mount points. Two buttons, two audiences, two unambiguous verbs — visible side by side, so nobody has to guess which one they want.
4. **The "Who can respond" selector moves to the top of the Collect panel** (§2.5) — MS's best idea, and the one that fixes the *second* half of the collision.

**Why not the tabbed "Share hub" this spec originally proposed:** putting Link, Embed and
Collaborate in one panel keeps both audiences in one surface under one word. That is the
condition that produced the bug. Two named buttons cost less to build and separate harder.

### 2.5 "Who can respond" — the selector

Three presets, writing through to the **same** settings `AccessControlSettings.tsx` already owns. This is a *mirror*, not a parallel store — one source of truth, or the two screens drift:

| Option | Writes | Embeddable? |
|---|---|---|
| **Anyone with the link** *(default)* | `accessControl.enabled=false`, `collectRespondentEmail=false` | ✅ |
| **Anyone — but record their verified email** | `collectRespondentEmail=true` | ❌ v1 |
| **Only people from certain domains** | `accessControl.enabled=true`, `requireSignIn=true`, `allowedDomains=[…]` | ❌ v1 |

Two payoffs from putting it here:

- The **v1 embed limitation becomes visible at the moment of choosing** rather than as a surprise: pick option 2 or 3 and the Embed tab greys out with the reason stated inline (§1, "the one v1 boundary").
- Someone who wants "only my company can fill this in" now finds the right control first. Today they find `sharingScope` — which governs *editing* — and get it wrong.

Settings → Access control stays as the detailed editor (domain list management); the panel offers the presets plus a **"More options"** link through to it.

### 2.6 Status of the §2.1 bug fix: **landed**

`ShareModal.tsx` + `en/ta sharing.json` are updated — the "Form Link / Anyone with this link can view the form" card is now an honest **Internal link** card carrying a pointer to the public link, and the scope section reads "Who can edit this form" with a link through to Settings → Access control. Verified: type-check, lint, en/ta key parity (36/36).

**Still to do** (with the panel, §3): promoting *Collect responses* to primary, renaming the footer *Share* button to *Collaborate*, and the "Who can respond" selector.



## 3. Flow A — Owner creates an embed

### A.0 Entry points

Per §2.4 — two buttons, two audiences, both visible, neither called "Share".

| Entry | Where | Existing code | Opens |
|---|---|---|---|
| **Collect responses** *(primary)* | header, where "Get Link" is now | `FormHeader.tsx:136` | Collect panel → **Link** tab |
| **Embed** | ⋯ overflow menu — a shortcut, not the only route | `FormHeader.tsx` overflow | Collect panel → **Embed** tab |
| **Collaborate** | footer strip, where "Share" is now | `FormHeader.tsx:213` | `ShareModal` — unchanged (§2.6) |

`CollectResponsesDialog` (`Dialogs.tsx:111`) is **deleted** — the panel supersedes it.
`ShareModal` keeps both mount points (`FormDashboard.tsx:323`, `FormBuilderHeader.tsx:368`)
and gains only its new button label.

### A.1 The panel

```
┌─ Collect responses ─────────────────────────── [● Live] ── ✕ ┐
│                                                               │
│   Who can respond                                             │
│   ┌─────────────────────────────────────────────────────┐    │
│   │ 🌐  Anyone with the link                        ▾   │    │
│   └─────────────────────────────────────────────────────┘    │
│   Respondents don't sign in. Their email isn't recorded.      │
│                                        More options →         │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│    Link        QR        Embed                                │
│   ──────                                                      │
│                                                               │
│   ┌─────────────────────────────────────────┬──────────────┐  │
│   │ https://forms.dculus.com/f/aB3xY9       │  Copy   [⧉]  │  │
│   └─────────────────────────────────────────┴──────────────┘  │
│                                                               │
│   Anyone with this link can open and submit the form.         │
└───────────────────────────────────────────────────────────────┘

  header:  [ Collect responses ]  [ Unpublish ]  [ ⋯ ]
  footer:   Preview  ·  Collaborate  ·  Analytics
                        └─ was "Share" — same place, honest name
```

Embed tab:

```
┌─ Share ─────────────────────────────────────── [● Live] ── ✕ ┐
│   Link    QR    Embed                                         │
│           ──────                                              │
│  ┌─────────────────────────┬───────────────────────────────┐  │
│  │ HOW IT APPEARS          │  PREVIEW      🖥 Desktop  📱   │  │
│  │                         │  ┌─────────────────────────┐  │  │
│  │  ┌───┐ ┌───┐ ┌───┐ ┌──┐ │  │ ░░░ your page ░░░░░░░░░ │  │  │
│  │  │ ▤ │ │ ▥ │ │ ▦ │ │▧ │ │  │ ░░░░░░░░░░░░░░░░░░░░░░░ │  │  │
│  │  └───┘ └───┘ └───┘ └──┘ │  │ ┌─────────────────────┐ │  │  │
│  │  Inline Light- iframe Btn│  │ │                     │ │  │  │
│  │   (JS)  box          /Lnk│  │ │     [ the form ]    │ │  │  │
│  │    ◉                     │  │ │                     │ │  │  │
│  │                          │  │ └─────────────────────┘ │  │  │
│  │  Width    [ 100%     ▾]  │  │ ░░░░░░░░░░░░░░░░░░░░░░░ │  │  │
│  │  Height   ◉ Fit content  │  └─────────────────────────┘  │  │
│  │           ○ Fixed [600]px│                               │  │
│  │  Background ◉ Transparent│  Height updates live as you   │  │
│  │             ○ White      │  change options.              │  │
│  └─────────────────────────┴───────────────────────────────┘  │
│                                                               │
│  Paste this into your site                                    │
│  ┌──────────────────────────────────────────────┬──────────┐  │
│  │ <div data-dculus-form="aB3xY9" …></div>      │ Copy [⧉] │  │
│  │ <script src="…/embed.js" async></script>     │          │  │
│  └──────────────────────────────────────────────┴──────────┘  │
│  HTML   WordPress   React   Webflow                           │
│                                                               │
│  ▸ Advanced                                                   │
└───────────────────────────────────────────────────────────────┘
```

### A.2 Step-by-step

1. Owner opens the Collect panel from either entry point (§A.0).
2. **Publish guard.** If `isPublished === false`, a banner sits above the tabs: *"This form is a draft — visitors will see 'form not found'. [Publish now]"*. The Publish button reuses `useFormDashboard`'s existing `updateForm` path. Nothing is blocked; the owner may still copy a snippet.
3. **Gated guard.** If `settings.accessControl?.enabled || settings.collectRespondentEmail`, the Inline/Lightbox/iframe cards are disabled with a tooltip: *"Forms that ask respondents to sign in can't be embedded yet — use a link or button instead."* The type auto-selects **Button**.
4. Owner picks a type. The preview re-renders immediately (no save needed — options ride in the preview iframe's query string).
5. Owner adjusts width / height / background. Preview follows.
6. Owner clicks **Copy**. Button flips to a check for 2 s (same pattern as `ShareModal`'s `linkCopied`) and `toastSuccess` fires.
7. **Settings persist on copy**, not on every keystroke — one `updateForm` mutation writing `settings.embed`, so reopening the panel restores the last configuration. A debounced autosave on change is the alternative; copy-time save is simpler and matches the mental model ("this is the snippet I took").

### A.3 The three contextual warnings

Shown inline, only when they apply — never as a wall of caveats:

| Condition | Message |
|---|---|
| `!isPublished` | "This form is a draft — visitors will see 'form not found'. **Publish now**" |
| Gated form | "Forms that ask respondents to sign in can't be embedded yet. Share a link or button instead." |
| Fixed height on a form with > 1 page | "Long pages will scroll inside the frame. **Fit content** is usually better." |

---

## 4. Flow B — Respondent fills an inline JS embed

```
Host page loads
   │
   ├─ embed.js runs, finds every [data-dculus-form]
   │     └─ builds <iframe src="/embed/aB3xY9?mode=inline&bg=transparent&h=auto">
   │        width:100%  height:400px (placeholder)  border:0  loading="lazy"
   │
   ├─ iframe loads  →  FormViewer (embedded={true})
   │     └─ postMessage → host   { dculus:ready, formId }
   │
   ├─ host → iframe               { dculus:host, hostname, viewportWidth }
   │     └─ iframe records embedContext='inline', embedHost=hostname
   │        and includes them in trackFormView
   │
   ├─ ResizeObserver on the layout root
   │     └─ postMessage → host   { dculus:resize, height }   (debounced 100ms, ±4px dead band)
   │        └─ host sets iframe.style.height = height + 'px'
   │
   ├─ respondent navigates to page 2
   │     └─ { dculus:resize } + { dculus:scroll } if the frame top is above the viewport
   │        └─ host scrolls the frame into view — ONLY if it's actually off-screen
   │
   └─ submit
         ├─ resolver runs unchanged (limits, plugins, automations all fire)
         ├─ thank-you screen renders; height animates to its natural size
         └─ postMessage → host   { dculus:submit, formId }   ← no answer data, ever
               └─ host page's optional window.dculusForms.onSubmit(formId) fires
```

**Failure modes and what the respondent sees**

| Failure | Behaviour |
|---|---|
| `embed.js` blocked (ad blocker, CSP) | The `<div>` stays empty. **Mitigation:** the snippet includes a `<noscript>` fallback link to `/f/:shortUrl`. |
| Form unpublished / deleted | Iframe renders the existing "Form Not Found" card (`FormViewer.tsx:331`) at a compact height. |
| `embed.enabled === false` | `/embed/*` renders "This form isn't available for embedding" — never the form. |
| Resize message never arrives (old cached script) | Iframe keeps the 400 px placeholder. **Mitigation:** 400 px is the single placeholder value used everywhere (flow, CSS, fallback), chosen so the worst case is a usable-but-scrolling frame rather than a sliver. |

---

## 5. Flow C — Respondent uses a lightbox popup

```
Host page
   │
   ├─ embed.js renders the trigger button in place of the <div>
   │     (owner-configured label, inherits the host page's font)
   │
   └─ click
         ├─ overlay mounts: full-viewport backdrop (rgba(0,0,0,.6)) + centered panel
         │    · panel: max-width 720px, max-height 90vh, radius 12px
         │    · body scroll locked (overflow:hidden + scrollbar-width compensation)
         │    · iframe created lazily HERE — not on page load (no cost until opened)
         ├─ focus moves to the panel; focus trapped inside it
         ├─ Esc, backdrop click, and the ✕ all close it
         ├─ on close: focus returns to the trigger button, body scroll restored
         │
         └─ on submit
               ├─ thank-you screen renders inside the overlay
               └─ overlay auto-closes after 3 s  (owner-configurable: stay open / close)
```

**Accessibility is not optional here** — a modal is the one embed type that can trap a keyboard user:
- `role="dialog"` + `aria-modal="true"` + `aria-label` = the form title.
- Focus trap with a sentinel at each end; Tab cycles inside, never escapes to the host page behind.
- `Esc` closes.
- Trigger button is a real `<button>`, not a styled `<div>`.
- Respects `prefers-reduced-motion` — no fade/scale animation when set.

---

## 6. Flow D — Plain iframe (no JS)

For CMSes and newsletters that strip `<script>`. One `<iframe>`, fixed height, no messaging.

- Height comes from the owner's **Fixed height** setting (default 600 px).
- The embedded layout still renders content-height, so a form shorter than the frame simply leaves whitespace — acceptable. A form longer than the frame scrolls inside it — the one place we accept an internal scrollbar, because there is no alternative without JS.
- The panel shows a quiet note under this option: *"Height is fixed — pick a size that fits your longest page."*

---

## 7. Generated snippets (exact output)

Assume `shortUrl = aB3xY9`, viewer origin `https://forms.dculus.com`.

**1. Link**
```
https://forms.dculus.com/f/aB3xY9
```

**2. Button**
```html
<a href="https://forms.dculus.com/f/aB3xY9" target="_blank" rel="noopener"
   style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;
          border-radius:8px;text-decoration:none;font:600 15px/1 system-ui,sans-serif">
  Open the form
</a>
```

**3. Standard iframe**
```html
<iframe src="https://forms.dculus.com/embed/aB3xY9?mode=iframe&h=600&bg=transparent"
        style="width:100%;height:600px;border:0" loading="lazy"
        title="Customer feedback"></iframe>
```

**4. Inline (JS)** — the default
```html
<div data-dculus-form="aB3xY9" data-dculus-mode="inline"></div>
<script src="https://forms.dculus.com/embed.js" async></script>
<noscript><a href="https://forms.dculus.com/f/aB3xY9">Open the form</a></noscript>
```

**5. Lightbox popup**
```html
<div data-dculus-form="aB3xY9" data-dculus-mode="lightbox"
     data-dculus-label="Give feedback"></div>
<script src="https://forms.dculus.com/embed.js" async></script>
<noscript><a href="https://forms.dculus.com/f/aB3xY9">Open the form</a></noscript>
```

**Platform variants** (same config, four renderings — pure string templates, ~1 h of work, removes the top support question):

| Tab | Difference |
|---|---|
| HTML | as above |
| WordPress | identical HTML + a one-line note: "paste into a **Custom HTML** block, not the visual editor" |
| React | `useEffect` that injects the script once + the `<div>` with `data-*` props |
| Webflow | identical HTML + "use an **Embed** element; the script tag is allowed there" |

---

## 8. `embed.js` — contract

**Budget: ≤ 5 KB gzipped, zero dependencies, no framework, ES2018 (no build step needed for consumers).**

### Attributes it reads

| Attribute | Values | Default |
|---|---|---|
| `data-dculus-form` | shortUrl | *required* |
| `data-dculus-mode` | `inline` \| `lightbox` | `inline` |
| `data-dculus-height` | `auto` \| px number | `auto` |
| `data-dculus-width` | CSS width | `100%` |
| `data-dculus-bg` | `transparent` \| `white` | `transparent` |
| `data-dculus-label` | button text (lightbox only) | `Open form` |

### Behaviour rules

- Idempotent: guards on `window.__dculusEmbedLoaded` — including the script twice does nothing twice.
- Multi-instance: `querySelectorAll`, each instance gets its own id; every message carries `{ formId, instanceId }`.
- Late-added DOM: exposes `window.dculusForms.refresh()` for SPA hosts that inject the div after load.
- Never touches globals other than `window.dculusForms`, never injects page-wide CSS (all styles inline or in a scoped `<style>` it owns).
- Optional host hook: `window.dculusForms.onSubmit = (formId) => {…}`.

### postMessage protocol (v1 subset)

```js
// iframe → host
{ type:'dculus:ready',    v:1, formId, instanceId }
{ type:'dculus:resize',   v:1, formId, instanceId, height }
{ type:'dculus:submit',   v:1, formId, instanceId }   // no answers
{ type:'dculus:scroll',   v:1, formId, instanceId }
{ type:'dculus:closeself',v:1, formId, instanceId }   // "dismiss my overlay" — lightbox auto-close after submit

// host → iframe
{ type:'dculus:host',     v:1, instanceId, hostname, viewportWidth }
{ type:'dculus:close',    v:1, instanceId }           // host dismisses the lightbox
```

`dculus:close` is host→iframe only; the iframe asking to be dismissed is `dculus:closeself`. Same contract as the strategy doc — one name must not mean two directions.

**Origin checks, both directions.** The host validates `event.origin === VIEWER_ORIGIN` (baked in at build time) **and** `event.source === iframe.contentWindow`; the iframe validates `event.source === window.parent` and matches the **full** parent origin (scheme + host + port), then posts back to that exact origin — never `'*'`, and never a hostname match, which would accept `http://` and odd ports. The bare hostname is for analytics attribution only, never a trust decision. **No response data ever crosses this boundary** — a host page that wants answers uses a webhook or an automation.

---

## 9. `/embed/:shortUrl` — route contract

New route in `apps/form-viewer/src/App.tsx`, rendering the existing `FormViewer` with `embedded` on.

| Query param | Values | Effect |
|---|---|---|
| `mode` | `inline` \| `lightbox` \| `iframe` | recorded as `embedContext`; `iframe` is the no-JS snippet (fixed height, no resize messages) |
| `bg` | `transparent` \| `white` | shell background |
| `h` | `auto` \| px | `auto` enables the `ResizeObserver` + resize messages. `mode=iframe` always passes an explicit px value |

Guards, in order: `embed.enabled !== false` → published → the existing access-control/time-window/limit guards (all already server-side, all unchanged).

---

## 10. Data model

### 9.1 `FormSettings.embed` — additive JSON, no migration

`settings` is `Json?` (`schema.prisma:148`), typed at `packages/types/src/index.ts:98`, mirrored in GraphQL at `schema.ts:151` / `FormSettingsInput` at `schema.ts:484`. Absent = defaults = existing forms byte-for-byte unchanged.

```typescript
export type EmbedType = 'link' | 'button' | 'iframe' | 'inline' | 'lightbox';

export interface EmbedSettings {
  /** false = /embed/* refuses to render. Default true for new forms. */
  enabled: boolean;
  /** Last type the owner configured — restores the panel. */
  type?: EmbedType;
  width?: string;                  // default '100%'
  height?: 'auto' | number;        // default 'auto'
  transparentBackground?: boolean; // default true
  buttonLabel?: string;            // button + lightbox
  closeOnSubmit?: boolean;         // lightbox, default true (3s delay)
}
```

Three touch points to add it: the TS interface, `type EmbedSettings` + `input EmbedSettingsInput` in the GraphQL schema, and the `settings { … }` selection set in `UPDATE_FORM` (`apps/form-app/src/graphql/mutations.ts:53`) and `GET_FORM_BY_ID`.

### 9.2 Analytics attribution — needs a migration

```prisma
model FormViewAnalytics {          // schema.prisma:335
  embedContext String?   // 'direct' | 'inline' | 'lightbox' | 'iframe'
  embedHost    String?   // hostname ONLY
  @@index([formId, embedHost])
}
model FormSubmissionAnalytics {    // schema.prisma:362  — same two columns
}
```

**Hostname only, never the full parent URL** — a parent URL's query string can carry PII; a hostname cannot.

Per `CLAUDE.md`: a checked-in migration under `apps/backend/prisma/migrations/` using `ADD COLUMN IF NOT EXISTS`, then `pnpm db:generate && pnpm db:push` after pulling. Skipping the generate step produces the silent "Cannot return null for non-nullable field" failure mode.

---

## 11. File inventory

### Create

| File | Purpose |
|---|---|
| `apps/form-viewer/src/pages/EmbedFormViewer.tsx` | thin wrapper: `FormViewer` + `embedded`, param parsing, postMessage bridge |
| `apps/form-viewer/src/lib/embedBridge.ts` | resize observer, debounce/dead-band, origin-checked messaging |
| `apps/form-viewer/public/embed.js` | the loader (hand-written, or a separate tiny Vite lib build) |
| `apps/form-viewer/public/_headers` | `frame-ancestors *` on `/embed/*` (detaching the `'self'` inherited from `/*`), `'self'` elsewhere. See §15.6 for the zone-level `X-Frame-Options` that also has to change. |
| `apps/form-app/src/components/sharing/CollectResponsesPanel.tsx` | the panel: "Who can respond" + Link / QR / Embed tabs |
| `apps/form-app/src/components/sharing/WhoCanRespondSelect.tsx` | the three presets, writing through to `settings.accessControl` (§2.5) |
| `apps/form-app/src/components/sharing/LinkTab.tsx` | URL + copy + QR |
| `apps/form-app/src/components/sharing/EmbedTab.tsx` | type cards, options, preview, snippet box |
| `apps/form-app/src/components/sharing/EmbedPreview.tsx` | live iframe + device toggle |
| `apps/form-app/src/lib/embedSnippets.ts` | pure snippet generators (unit-testable) |
| `apps/form-app/src/locales/{en,ta}/embed.json` | i18n — **both**, mandatory |
| `apps/backend/prisma/migrations/…_add_embed_analytics/migration.sql` | the two columns |
| `test/e2e/features/embed.feature` + a static fixture host page | `@embed` tagged scenarios |

### Modify

| File | Change |
|---|---|
| `apps/form-viewer/src/App.tsx` | add `/embed/:shortUrl` |
| `apps/form-viewer/src/pages/FormViewer.tsx` | `embedded` prop; overlay `fixed`→`absolute` (`:504`); drop `h-screen` (`:421`) when embedded |
| `packages/ui/src/renderers/FormRenderer.tsx`, `LayoutRenderer.tsx` | thread `embedded` through |
| `packages/ui/src/layouts/L1…L9*.tsx` | content-height variant of the shell + content pane |
| `apps/form-viewer/src/hooks/useFormAnalytics.ts`, `useFormSubmissionAnalytics.ts` | send `embedContext` / `embedHost` |
| `apps/backend/src/graphql/schema.ts` | `EmbedSettings` type + input; analytics input fields |
| `apps/backend/src/services/analyticsService.ts` | persist the two columns |
| `packages/types/src/index.ts` | `EmbedSettings` on `FormSettings` |
| `apps/form-app/src/graphql/{queries,mutations}.ts` | `embed { … }` in the settings selection sets |
| `apps/form-app/src/pages/FormDashboard.tsx` | mount `CollectResponsesPanel`, drop `CollectResponsesDialog` |
| `apps/form-app/src/components/FormDashboard/FormHeader.tsx` | "Get Link" → **Collect responses** (primary); footer "Share" → **Collaborate**; "Embed" shortcut in ⋯ |
| `apps/form-app/src/components/FormDashboard/Dialogs.tsx` | delete `CollectResponsesDialog` |
| `apps/form-app/src/components/sharing/ShareModal.tsx` | ✅ **§2.6 done** — honest Internal-link card + "Who can edit this form". No further change; only its trigger is renamed |
| `apps/form-app/src/locales/{en,ta}/sharing.json` | ✅ **§2.6 done** |
| `apps/form-app/src/locales/{en,ta}/formDashboard.json` | `header.getLink` → collectResponses; `header.share` → collaborate; new `whoCanRespond.*` |
| `apps/form-app/src/components/form-builder/FormBuilderHeader.tsx` | second `ShareModal` mount (`:368`) — same rename/wiring as the dashboard |
| `apps/form-app/src/locales/index.ts` | register `embed` in `enTranslations` **and** `taTranslations` |
| `apps/form-app/src/pages/FormAnalytics.tsx` | traffic-source breakdown |

### Deliberately untouched

CORS (iframe calls originate from the viewer origin — already allowlisted) · all submission gating (server-side, unchanged) · Y.js / collaboration (viewer reads `formSchemaPublic`) · plugins, automations, exports, PDF templates (a submission is a submission).

---

## 12. Build order

| # | Task | Days | Blocks |
|---|---|---|---|
| 0 | ~~**§2 fix** — mislabelled Share link + strings (en/ta)~~ **✅ done** | 0.5 | — |
| 1 | **Spike:** `embedded` mode on `L1ClassicLayout` + `ResizeObserver`; prove height stability across page nav, validation errors, conditional reveals | 1.5 | everything |
| 2 | `EmbedSettings` type → GraphQL → selection sets | 0.5 | 6 |
| 3 | `embedded` across the remaining 8 layouts | 1.5 | 4 |
| 4 | `/embed/:shortUrl` + `embedBridge.ts` + `_headers` | 1 | 5 |
| 5 | `embed.js` — inline + lightbox + protocol + a11y | 2 | 7 |
| 6 | Collect panel: "Who can respond", Link (+QR), Embed tab, preview, snippets, warnings; header button renames | 3 | — |
| 7 | Analytics migration + capture + traffic-source view | 1.5 | — |
| 8 | i18n (en + ta), E2E `@embed` scenarios, cross-browser pass | 1.5 | — |

**Task 0 ships on its own** — it fixes a live bug and needs nothing else in this spec.
**Task 1 is a real gate.** If height jitters on one layout it will jitter on nine; find out before touching them.

---

## 13. Acceptance criteria

**Owner**
- **Collect responses** and **Collaborate** are distinct, visible, and neither is labelled "Share".
- The Collect panel opens on the tab matching its entry point.
- Changing "Who can respond" writes to the same `settings.accessControl` the Settings page reads, and the change is visible there on reload (no parallel store).
- Choosing an option that requires sign-in greys the Embed tab with the reason shown inline.
- Switching type/width/height/background updates the preview within ~200 ms, with no save.
- Copy puts a working snippet on the clipboard and persists `settings.embed`; reopening restores it.
- Draft, gated, and fixed-height warnings appear exactly when they apply and never otherwise.
- QR downloads as a PNG that resolves to `/f/:shortUrl`.
- **No surface anywhere in form-app offers a "form link" that is actually the builder URL.** Grep check: `/dashboard/form/` appears in a copy-to-clipboard path only under a string that says "builder".

**Respondent**
- Inline embed on a third-party page: renders, submits, thank-you — **no internal scrollbar, no host-page scroll jump**.
- Height tracks content within ±4 px across page navigation, validation errors, conditional reveal/hide, and the thank-you transition.
- Lightbox: opens on click, traps focus, closes on Esc/backdrop/✕, restores focus and body scroll, auto-closes 3 s after submit.
- All nine layouts are usable at 375 / 768 / 1280 px embed widths.
- Unpublished or non-embeddable form shows an explanatory card, never a raw 404.
- Gated form: the embed types are disabled in the panel and Link/Button work.

**System**
- `embed.js` ≤ 5 KB gzipped, safe when included twice, safe with multiple forms on one page.
- No answer data crosses `postMessage`; both directions validate origin.
- `/f/*` becomes `frame-ancestors 'self'` — a tightening of today's *unrestricted* framing.
- Submissions from an embed are identical downstream (plugins, automations, exports, PDFs) except for `embedContext` / `embedHost`.
- Every new string exists in `en` **and** `ta`.

**Tests**
- Unit: snippet generators; debounce/dead-band; origin validation.
- E2E (`@embed`): a static fixture host page including the real snippet; drive the form inside the frame; assert the response lands with `embedContext='inline'`; repeat for lightbox.
- Manual: Chrome / Safari / Firefox desktop, iOS Safari, Android Chrome × inline + lightbox.

---

## 14. Decisions taken here (flag if you disagree)

1. **Gated forms are excluded from embedding in v1** — warn and offer link/button, rather than ship a form that can't be signed into.
2. **Settings save on Copy**, not on every change — the snippet you took is the config that's stored.
3. **The plain-iframe option stays**, despite being the worst UX, because script-stripping CMSes are common and the alternative is those users having nothing.
4. **`embed.enabled` defaults to true** for new forms — a closed default generates support tickets on day one. `/f/*` framing gets locked down instead.
5. **The "Powered by dculus" chip ships in v1 with no removal toggle.** The plan gate is v2; shipping the chip now avoids a later "why did branding suddenly appear" moment.
6. **Lightbox creates its iframe on click**, not on page load — an embed a visitor never opens should cost them nothing.
7. **The word "Share" is retired**; surfaces are named by audience — *Collect responses* / *Collaborate* (§2.4). Following Microsoft Forms' separation, but **not** its demotion of collaboration into ⋯: co-editing is a headline feature here, unlike in MS Forms.
8. **"Who can respond" is mirrored into the Collect panel** rather than left only in Settings → Access control — set the audience where the link is made, and the embed limitation becomes visible at the moment of choosing.

---

## 15. Build notes — where the implementation diverges from this spec

Everything in §1's scope shipped: link, button, plain iframe, inline (JS,
auto-resize) and lightbox, configured from the Collect panel with a live
preview and a device toggle, QR download, platform snippet variants,
traffic-source attribution, and the host-page `onSubmit` callback.

Five things were decided differently while building, each because the spec's
version did not survive contact with the code.

### 15.1 `height` is two fields, not one

The spec's `height?: 'auto' | number` has no GraphQL representation — there is
no union of scalars — and smuggling a number through a `String` field would put
a parse at every read. It is `heightMode: 'auto' | 'fixed'` plus
`heightPx: number` instead, which is also the shape the panel's
"Fit content / Fixed [600] px" radio actually needs.

### 15.2 Embedded intro screens keep a definite height

The spec says "content-height variant of the shell" for all nine layouts. That
is right for the pages and thank-you screens, and meaningless for the intro
screens: they are full-bleed heroes whose white paper card is absolutely
positioned with percentage insets, and L8's intro has no in-flow content at all.
Asking them to fit their content collapses them.

Embedded intros are therefore a definite `560px` box, inside which the existing
absolute arrangement works untouched; the pages and thank-you screens get true
content height. The frame animates between the two on the CTA, which the resize
protocol already handles. See `packages/ui/src/layouts/shared/embedShell.ts`.

### 15.3 The embed types live in a leaf module

`@dculus/types`' index re-exports `conditions`, `validation` and
`formHookUtils`, each of which imports back from the index. Under a CommonJS
test runner that cycle leaves the barrel partially initialised, and a runtime
constant read through it comes back `undefined` — which is why
`DEFAULT_EMBED_SETTINGS` is defined in `packages/types/src/embed.ts`, a module
with no imports at all, reachable as `@dculus/types/embed.js` (the same subpath
pattern `graphql.js` already uses).

This is a workaround, not a fix. The underlying cycle predates this work and
still affects any runtime value read from the barrel in form-app's jest tests.

### 15.4 Escape is forwarded from the iframe

§5 says "Esc closes" the lightbox, and the host cannot implement that: keyboard
events raised inside a cross-origin iframe never reach the parent, and the
respondent is focused inside the form within a second of it opening. The iframe
listens for Escape and posts `dculus:closeself`; the host acts on that. Without
this, "press Esc" was true only before the respondent touched anything —
verified failing, then verified fixed.

### 15.5 The preview is untracked and inert

Not in the spec, and it should have been: the Embed tab renders the real
`/embed/:shortUrl` route, so opening it recorded a form view — inflating the
owner's own analytics and, because a view emits `FORM_VIEWED`, spending their
plan's view quota every time. The preview now passes `preview=1`, which
suppresses view and submission tracking, and the frame is `pointer-events:
none` so an owner cannot file a real response from inside their own settings
panel.

### 15.6 Framing depends on a Cloudflare zone-level change, not just `_headers`

`public/_headers` is necessary but not sufficient. Two things sit downstream of
it and both deny cross-origin framing of `/embed/*` until changed:

1. **A `_headers` self-inflicted wound (fixed in-repo).** A request matching
   both `/embed/*` and `/*` inherits the headers of both, and a repeated header
   is *combined*, not overridden. `/embed/*` was therefore emitting
   `frame-ancestors *` **and** the `frame-ancestors 'self'` from `/*`, and the
   browser enforces the intersection. `/embed/*` detaches the inherited value
   with `! Content-Security-Policy` before setting its own — but a `! Header`
   line only removes what an *earlier* block set, so `/*` must be listed
   **before** `/embed/*` in the file. #337 shipped them in the opposite order,
   which left the `!` a no-op and the double CSP header in place; the blocks are
   now ordered `/*` → `/embed.js` → `/embed/*`.

2. **A zone-level transform (fixed with Terraform).**
   Every `*.dculus.com` response — including apps with no `_headers` file at all,
   e.g. `form-app-*` — carries `X-Frame-Options: SAMEORIGIN`, added by the
   **"Add security headers" Managed Transform** on the `dculus.com` zone (no
   hand-made response-header Transform Rules exist). It runs after Pages, so
   `_headers` cannot remove it, and XFO has no "any origin" value, so inline and
   lightbox render blank until it is countered.

   `infrastructure/multi-cloud/terraform/cloudflare/embed-framing.tf` adds a
   zone-level Response Header Transform Rule that, for the viewer hosts on path
   `/embed/*`, **removes** `X-Frame-Options` and **sets**
   `Content-Security-Policy: frame-ancestors *` (custom transform rules run
   after both Managed Transforms and the Pages `_headers`, so these win). The
   zone is shared but the stack runs per-environment with separate state and a
   phase can hold one ruleset, so a `var.manage_embed_framing` flag gates the
   resource — **true for exactly one environment, false for the rest** — and
   its one rule lists every environment's viewer host. This repo owns it from
   **`dev`** (`environments/dev/terraform.tfvars`) because `main` deploys dev on
   every push while production only deploys on a `v*` tag; #339 first gated it to
   production and the rule then sat unapplied, failing the two `@embed` iframe
   scenarios on every deploy run. The flag defaults to `true`, so a
   single-environment deployment (e.g. a fork running only production) needs no
   change.

### What is still open

- **§7's platform variants**: WordPress and Webflow emit identical HTML to the
  HTML tab, with the "where to paste it" guidance as a note beside the snippet —
  that guidance was always the actual support question, not the markup.
- **`embed.enabled`** is honoured by `/embed/*` and defaults to on, but nothing
  in the UI turns it off yet. The switch belongs with the v2 domain allowlist.
- **Gated forms** remain unembeddable (§1), and a form that becomes gated after
  its snippet was pasted now renders an explanatory card with a link to the
  hosted page rather than a sign-in that cannot complete inside a frame.
- **The "Powered by dculus" chip** (decision 5) is not implemented.
