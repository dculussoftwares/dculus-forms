/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_GRAPHQL_URL: string
  readonly VITE_PIXABAY_API_KEY: string
  readonly VITE_CDN_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}