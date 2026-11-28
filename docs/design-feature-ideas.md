# Design Feature Ideas — Form Builder & Viewer

> Status: **Idea backlog** · Companion to [design-tokens-plan.md](./design-tokens-plan.md)

## Where we are today

The current design options are:
- 9 layouts (L1–L9)
- light, dark or auto theme
- text color
- spacing (compact, normal or spacious)
- a background image or video, with a dominant-color wash
- a custom CTA button label
- a thank-you screen

**Gaps:** no brand colors, no font choice, no corner or button styling, and no per-field styling.

---

## ⭐ Top idea: Brand Kit from a URL or logo

The form owner pastes their website URL or uploads a logo. Dculus pulls out a palette (primary, accent, surface), a font pairing, a corner-radius style and a button shape. It then produces a full **design token set** that every layout reads.

- **Why:** every form is on-brand in about 5 seconds. That closes the biggest gap against Typeform and Tally, and it sells well on a pricing page.
- **Reuses:** dominant-color sampling (`apps/form-app/src/utils/dominantColor.ts`), the AI editor, and `FormLayout` (gains a `tokens` object).
- **Org-level:** save it as an Organization Brand Kit so new forms start on-brand.

### Tokens vs Brand Kit (two layers)

| | Design tokens foundation | Brand Kit |
|---|---|---|
| What | Stores design values on the form; every layout reads them as `--df-*` CSS variables | A generator that **fills in** those tokens automatically |
| User action | Set colors and fonts by hand in the Design drawer | Paste a URL or upload a logo |
| Depends on | — | The tokens foundation |
| Plan | [design-tokens-plan.md](./design-tokens-plan.md) | To be written (`brand-kit-plan.md`) |

Analogy: tokens are the paint system (every wall can take any color). The Brand Kit is the "match my brand" button that picks the paint for you.

The same foundation also powers theme presets, the AI "make it beautiful" button and the accessibility contrast checks.

### Does the Brand Kit need AI? No, AI is optional

**From a logo (no AI, client-only):**
- Extend `dominantColor.ts` to return the top 3–5 colors and skip near-white and near-black.
- Use the most saturated color as the primary and a light tint as the surface. Pick readable text colors with the contrast helpers.

**From a website URL (no AI, needs a backend):**
- Fetch the page server-side. Browsers can't read other sites because of CORS.
- Read `<meta name="theme-color">`, `manifest.json`'s `theme_color`, and the favicon or `og:image`, running the image through color extraction.
- Read CSS custom properties and Google Fonts `<link>` tags for fonts, matched to the font catalog.
- ⚠️ This is an SSRF-sensitive endpoint. Require authentication, block private and internal IPs (including after redirects), and set a timeout, a response size cap and a rate limit.

**AI as an optional add-on (paid, uses AI credits):**
- Choose the true brand color when a site has many.
- Suggest a layout, font pairing and button style that match the brand mood.
- Feed the brand mood into the AI form editor.

**Recommended order:** logo extraction first, then URL extraction, then the AI "suggest a style" button.

---

## Builder design features

1. **Theme presets gallery (shipped: 20 looks within the current token set; Glass needs new tokens):** about 20 curated looks (Editorial, Neo-brutal, Glass, Soft pastel, Terminal, Wedding serif), each a token bundle. Applying one is a single click, and it syncs over Y.js.
2. **Live device preview rail:** phone, tablet and desktop frames shown side by side while editing, plus an "embedded in a page" mock.
3. **Field style variants:** inputs as underline, outlined, filled or pill. Options as plain list, cards with icons, image tiles or chips. These are set per field, with a form-wide default.
4. **Image and emoji choice options:** radio and checkbox options with images or emoji. Great for surveys and quizzes, and they make strong template thumbnails. Route through the `new-field-generator` agent.
5. **Section blocks:** non-fillable blocks for a hero banner, divider, image with caption, video embed, testimonial and progress milestone. These are new `NonFillableFormField` types.
6. **Accessibility checker:** live contrast check of text against the background or video wash, plus missing-label and tap-target warnings, with automatic fix suggestions.
7. **AI "make it beautiful":** the AI editor proposes a layout, palette and microcopy tone, then shows a before/after toggle.

## Viewer experience features

1. **Motion personality:** a per-form setting of None, Subtle, Playful or Cinematic. It controls field entrance, page transitions in L6/L9, and a satisfying "selected" pop on choices. It respects `prefers-reduced-motion`.
2. **Smart progress:** progress shown as percent, steps, "about 2 minutes left" (from `completionTimeSeconds` analytics), or a playful filling bar.
3. **Personalised thank-you screens:** answer piping ("Thanks, Priya!"), confetti or celebration variants, conditional endings based on answers, and a social share card from the existing OG pipeline.
4. **Conversational mode:** a chat-style rendering where questions arrive as bubbles and answers appear as user replies. It's an alternate renderer over the same schema.
5. **Keyboard-first flow:** Enter to advance, A/B/C hotkeys on choices, and visible key hints (the Typeform feel) for L6 and L7.
6. **Ambient theming:** auto dark mode that follows the background video's dominant color, plus an optional respondent toggle for light/dark.
7. **Sticky "save and resume" pill:** a visible design element for the existing draft feature, showing "Saved just now" with a subtle animation.

---

## Suggested order

1. **Design tokens foundation:** see [design-tokens-plan.md](./design-tokens-plan.md). Everything else depends on it.
2. **Brand Kit:** logo first, then URL, then the optional AI step. Also theme presets.
3. **Choice styles and image options.**
4. **Motion personality and smart progress.**
5. **Conversational mode.** It's the biggest build, so it goes last.
