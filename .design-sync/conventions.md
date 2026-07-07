# @dculus/ui conventions

## Wrapping and setup

There is **no React context/theme provider component** to wrap your app in.
Theming is pure CSS: every token is a CSS custom property defined in a
`:root { ... }` block (light mode) and mirrored in a `.dark { ... }` block,
both already shipped in this bundle's `styles.css`. To switch to dark mode,
toggle the `dark` class on a root/ancestor element:

```js
document.documentElement.classList.toggle('dark', isDarkMode);
```

`TooltipProvider` and `SidebarProvider` exist, but those are feature-scoped
(required only if you use `Tooltip`/`Sidebar` components respectively) — they
are not a global theme wrapper. No other component needs a provider.

## Styling idiom

Tailwind utility classes throughout, shadcn/ui-style (`class-variance-authority`
for variants, `cn()` for merging). Never invent ad hoc class names — compose
from the tokens below. Key variable families (all consumed via Tailwind's
`hsl(var(--x))` / `var(--x)` pattern, defined in `styles.css`):

| Family | Variables | Use |
|---|---|---|
| Surfaces | `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground` | page/panel backgrounds and their text |
| Brand | `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground` | CTAs, brand accents |
| State | `--muted`, `--accent`, `--destructive` (+ `-foreground` pairs) | disabled/hover/error states |
| Structure | `--border`, `--input`, `--ring`, `--radius` | borders, focus rings, corner radius |
| Charts | `--chart-1` … `--chart-5` | data visualization only |
| Sidebar | `--sidebar*` | sidebar-specific surface only |
| Typeform palette | `--tf-*` (e.g. `--tf-icon-salmon`, `--tf-border`, `--tf-green`) | exact-match accents/overlays lifted from the reference design; use for fine-grained opacity/overlay tints Tailwind's default palette can't express |
| Elevation | `--shadow-2xs` … `--shadow-2xl` | box-shadow scale |
| Type | `--font-sans` ("DM Sans"), `--font-mono` ("JetBrains Mono") | do not hardcode font-family |

Use Tailwind utilities that resolve to these (`bg-primary`, `text-muted-foreground`,
`border-border`, `shadow-md`, `rounded-[--radius]`, etc.) rather than raw hex
values — matching hardcoded colors will drift from the design system the
moment its tokens change.

**Known gap (do not chase):** `tracking-tight`/`tracking-wide`/`tracking-widest`
utilities are declared in the Tailwind config but their backing CSS variables
(`--tracking-tight` etc.) are not defined in the shipped stylesheet — using
them is harmless (falls back to normal letter-spacing) but won't visibly
tighten/loosen tracking.

## Where the truth lives

- `styles.css` (this bundle) — the full token set + component CSS via its
  `@import` of `_ds_bundle.css`. Read this before styling anything.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage example
  and prop reference, generated from this package's own `.d.ts` and Storybook
  stories.

## Example

```tsx
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@dculus/ui';

<Card>
  <CardHeader>
    <CardTitle>Stay Updated</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Input placeholder="you@example.com" />
    <Button className="w-full">Submit</Button>
  </CardContent>
</Card>
```
