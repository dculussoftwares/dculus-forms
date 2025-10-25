import uiV2Config from '@dculus/ui-v2/tailwind.config.js'

/** @type {import('tailwindcss').Config} */
export default {
  ...uiV2Config,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-v2/src/**/*.{js,ts,jsx,tsx}",
  ],
}

