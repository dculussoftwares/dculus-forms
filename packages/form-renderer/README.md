# @dculus/form-renderer

Render [Dculus Forms](https://dculus.com) schemas as interactive, read-only previews
in any React 18 or 19 app. Used by the public template gallery at
dculus.com/forms/templates.

```tsx
import { TemplatePreview } from '@dculus/form-renderer';
import '@dculus/form-renderer/style.css';

<TemplatePreview
  formSchema={template.formSchema}
  cdnEndpoint="https://cdn.example.com"
  onSubmitAttempt={() => showUseTemplateCta()}
/>
```

- Nothing is ever submitted — Submit only calls `onSubmitAttempt`.
- Styles are bundled and scoped to `.dculus-form-renderer` (plus Radix popover
  layers), so they don't leak into the host page. Tailwind's global reset is not
  included.
- A schema without pages or a layout renders nothing (`isTemplateFormSchema` checks the shape).
- `react` and `react-dom` are peer dependencies; everything else is bundled.

Build: `pnpm --filter @dculus/form-renderer build` → `dist/index.js` + `dist/style.css`.
