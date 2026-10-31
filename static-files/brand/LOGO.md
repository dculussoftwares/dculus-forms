# Dculus Logo Guide

Reference for the current Dculus logos: what they are, how they are built, where they are used, and how to brief a designer or AI tool to create a new one. All geometry is on a 64×64 grid.

Master files in this folder:

| File | Purpose |
|---|---|
| `dculus-forms-mark.svg` | **Product mark**: Dculus Forms (used in all apps) |
| `dculus-brand-mark.svg` | **Company mark**: Dculus brand-level use (not used in the product UI) |

Code: `packages/ui/src/logo.tsx` (`<Logo />`, exported from `@dculus/ui`).

---

## 1. Design tokens the logo is built on

Source of truth: `packages/ui/src/styles/globals.css`.

| Role | Hex | Token |
|---|---|---|
| Tile / primary | `#3c323e` (aubergine) | `--tf-dark`, `--primary` |
| Deepest surface | `#2a222b` | `--tf-darkest` (sign-in brand panels) |
| Light shapes | `#f7f7f8` | `--tf-faint` / `--background` |
| Field fill | `#dedcde` | `--border` / `--tf-icon-gray` |
| Accent leaf | `#36b59d` | lighter variant of `--tf-green` `#177767` (the dark green is too low-contrast on aubergine; `#36b59d` matches the dark-mode `--chart-2`) |
| Typeface | Inter (semibold, tight tracking) | `--font-sans` |
| Corner radius | 14/64 ≈ 22% on the tile | UI base radius is `0.5rem` |

The mark uses **four colours at most**: aubergine, off-white, light grey (forms mark only), teal.

---

## 2. Forms mark (product logo)

Concept: a form card with a label and two input fields; a teal leaf sprouts from its top-right corner. The card says "form", the leaf says growth and ties it to the Dculus family.

Construction (64×64):

| Element | Spec |
|---|---|
| Tile | rect 64×64, rx 14, `#3c323e` |
| Form card | x14 y14, 30×38, rx 6, `#f7f7f8` |
| Label bar | x20 y21, 12×3, rx 1.5, `#3c323e` |
| Input field 1 | x20 y28, 18×7, rx 3.5 (pill), `#dedcde` |
| Input field 2 | x20 y38, 18×7, rx 3.5 (pill), `#dedcde` |
| Leaf | `M40 25C40 15 46 9 55 9c1 10-6 16-15 16Z`, fill `#36b59d`, stroke `#3c323e` 2.5, round join (the stroke separates the leaf from the card) |

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <title>Dculus Forms</title>
  <rect width="64" height="64" rx="14" fill="#3c323e"/>
  <rect x="14" y="14" width="30" height="38" rx="6" fill="#f7f7f8"/>
  <rect x="20" y="21" width="12" height="3" rx="1.5" fill="#3c323e"/>
  <rect x="20" y="28" width="18" height="7" rx="3.5" fill="#dedcde"/>
  <rect x="20" y="38" width="18" height="7" rx="3.5" fill="#dedcde"/>
  <path d="M40 25C40 15 46 9 55 9c1 10-6 16-15 16Z" fill="#36b59d" stroke="#3c323e" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```

---

## 3. Brand mark (company logo)

Concept: a large cream leaf and a smaller teal leaf (a sprout) over a short input bar. Growth plus a form field. Reserved for company-level use.

Construction (64×64):

| Element | Spec |
|---|---|
| Tile | rect 64×64, rx 14, `#3c323e` |
| Large leaf | `M31 47C15 46 13 28 21 17c14 1 19 17 10 30Z`, `#f7f7f8` |
| Small leaf | `M33 47c0-9 6-15 16-16 1 10-6 16-16 16Z`, `#36b59d` |
| Input bar | x19 y50, 26×4, rx 2, `#f7f7f8` |

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <title>Dculus</title>
  <rect width="64" height="64" rx="14" fill="#3c323e"/>
  <path d="M31 47C15 46 13 28 21 17c14 1 19 17 10 30Z" fill="#f7f7f8"/>
  <path d="M33 47c0-9 6-15 16-16 1 10-6 16-16 16Z" fill="#36b59d"/>
  <rect x="19" y="50" width="26" height="4" rx="2" fill="#f7f7f8"/>
</svg>
```

---

## 4. Wordmark

- Text: **"Dculus Forms"** (product) or **"Dculus"** (brand).
- Inter, semibold, tracking-tight, `text-lg` next to a 32px mark.
- Gap between mark and text: 10px (`gap-2.5`).
- Colour: `text-primary` (aubergine) on light surfaces; `text-white` on the dark aubergine panels.

---

## 5. Usage in code

```tsx
import { Logo } from '@dculus/ui';

<Logo />                                   {/* forms mark, 32px */}
<Logo size={28} />                         {/* smaller mark */}
<Logo variant="full" />                    {/* mark + "Dculus Forms" */}
<Logo variant="full" textClassName="text-white" />   {/* on dark panels */}
<Logo mark="brand" variant="full" />       {/* company mark + "Dculus" */}
```

Props: `mark: 'forms' | 'brand'` (default `forms`), `variant: 'mark' | 'full'`, `size` (px), `textClassName`, `className`.

Where it is applied:

| App | Location |
|---|---|
| form-app | Favicon (`public/favicon.svg`); `SignIn`, `SignUp`, `ForgotPassword`, `EmailVerification`, `InviteAcceptance` |
| admin-app | Favicon; `AdminLayout` sidebar; `LoginPage` |
| form-viewer | Favicon; demo `Header` |

Intentionally **not** branded: respondent-facing public forms (that space belongs to the form owner). Emails do not include the logo yet (needs a hosted PNG, since many mail clients ignore SVG).

---

## 6. Usage rules

- Minimum size: 16px (favicon) – the two input fields are the finest detail; if they blur, simplify to one field.
- Clear space: at least 25% of the tile width around the mark.
- Keep the tile aubergine `#3c323e`. Do not recolour, stretch, add gradients, shadows or outlines.
- On dark backgrounds the aubergine tile is low-contrast against `#2a222b`. Keep a subtle border or use the white-on-dark treatment if it gets lost.
- No dark-mode variant or PNG/apple-touch-icon exports exist yet.

---

## 7. Earlier assets (history)

- `static-files/dculus-high-resolution-logo.png`: older lockup, cream two-leaf mark, thin divider and "Dcul.us" wordmark on forest green. Its green is not part of the current palette.
- `static-files/company-logo.jpg`: a stock kestrel photograph, not a logo.

---

## 8. Brief for creating a new logo

Give this to a designer or an AI image tool. It keeps the design system and leaves the concept open.

```
Design a logo for "Dculus Forms", a modern SaaS product for building and
sharing online forms, surveys and quizzes, with real-time collaboration
and response analytics. Audience: teams, educators, small businesses.
Personality: calm, trustworthy, friendly, quietly premium
(Typeform / Linear / Notion level polish, not corporate clipart).

BRAND SYSTEM:
- Palette: aubergine #3c323e (primary), near-black aubergine #2a222b,
  off-white #f7f7f8, teal-green #177767 (single accent), neutral grey
  #dedcde. Optional tints: salmon #f8cdd8, mint #c9ece3, lavender #ddd6fa.
- Max 3 colours in the mark.
- Soft rounded geometry (~8px radius feel), consistent stroke weight,
  generous negative space.
- Wordmark "Dculus Forms" in Inter or similar geometric sans,
  medium–semibold, slightly tight tracking.

REQUIREMENTS:
- Flat vector, solid fills; no gradients, shadows, 3D or glow.
- One memorable symbol that communicates forms / structured input /
  collecting answers in an original way. Avoid clichés: generic
  folded-corner document, clipboard, checkbox-in-circle, pencil on paper.
- Legible at 16x16 px; works as a rounded-square app icon.
- Works monochrome and reversed on dark aubergine #1f1a21.

DELIVERABLES: symbol, app-icon (aubergine tile), horizontal lockup,
monochrome, reversed dark. No mockups, texture or watermark.

NEGATIVE: gradient, glow, drop shadow, bevel, photorealism, mascot,
cartoon, stock-icon look, hairlines, >3 colours, gibberish text.
```

Concept angles to append (one per generation): a "D" built from form-field geometry; stacked rounded bars that read as both a form and a bar chart; a chat bubble that doubles as an input; a caret entering a rounded field; a grid with one selected cell; a bold "D" monogram with a "submitted" tick.

### Rolling out a new logo

1. Vectorise to a clean SVG on a 64×64 viewBox (flat fills, no embedded raster).
2. Replace the SVGs in this folder and the three `apps/*/public/favicon.svg` files.
3. Update the inline SVG in `packages/ui/src/logo.tsx`. All apps pick it up from there.
4. Rebuild `@dculus/ui`, then check the sign-in pages, admin sidebar, and the favicon at 16px in light and dark browser themes.
