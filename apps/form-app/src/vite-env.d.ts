/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_GRAPHQL_URL: string
  readonly VITE_PIXABAY_API_KEY: string
  readonly VITE_CDN_ENDPOINT: string
  readonly VITE_FORM_VIEWER_URL: string
  readonly VITE_GOOGLE_PICKER_API_KEY: string
  readonly VITE_GOOGLE_APP_ID: string
  readonly VITE_MICROSOFT_CLIENT_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
