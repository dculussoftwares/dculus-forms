const viewerConfig = require('../../apps/form-viewer/tailwind.config.js');

// Same theme as the public form viewer, so previews look exactly like live forms.
//
// Scoping: every utility is emitted under SCOPE, and preflight (Tailwind's global
// reset) is off — a host site keeps its own styles. Radix renders dropdowns,
// popovers and date pickers into a portal on <body>, outside our wrapper, so the
// popper wrapper Radix puts around that content is part of the scope as well.
const SCOPE = ':is(.dculus-form-renderer, [data-radix-popper-content-wrapper])';

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...viewerConfig,
  content: [
    './src/**/*.{ts,tsx}',
    '../ui/src/**/*.{ts,tsx}',
    '../utils/src/**/*.{ts,tsx}',
  ],
  important: SCOPE,
  // container is a component class Tailwind can't scope; the renderer doesn't use it.
  corePlugins: { preflight: false, container: false },
};
