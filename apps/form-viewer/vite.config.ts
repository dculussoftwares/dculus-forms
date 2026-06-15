import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@shared', replacement: resolve(__dirname, '../../packages/shared/src') },
      { find: '@dculus/ui', replacement: resolve(__dirname, '../../packages/ui/src') },
      { find: '@dculus/utils', replacement: resolve(__dirname, '../../packages/utils/src') },
      {
        find: '@dculus/types/graphql',
        replacement: resolve(__dirname, '../../packages/types/src/graphql.ts'),
      },
      {
        find: '@dculus/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    ],
  },
})
