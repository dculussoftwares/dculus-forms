import { defineConfig, transformWithEsbuild, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const EMBED_LOADER_SOURCE = resolve(__dirname, 'src/embed/embed.js')

/**
 * Serves and builds the embed loader (`/embed.js`).
 *
 * It cannot live in `public/`: that would ship the commented source verbatim,
 * and the loader has a hard budget (≤5 KB gzipped) that the comments alone
 * eat most of. So the readable source stays in `src/embed/` and this plugin
 * minifies it into the build output.
 *
 * In dev it is served unminified — a host page debugging its embed wants
 * readable frames in the stack trace, and no budget applies locally.
 *
 * @see docs/form-embed-v1-spec.md §8
 */
function embedLoaderPlugin(): Plugin {
  return {
    name: 'dculus-embed-loader',
    apply: () => true,
    configureServer(server) {
      server.middlewares.use('/embed.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        // The loader is fetched cross-origin by every host page.
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.end(readFileSync(EMBED_LOADER_SOURCE, 'utf8'))
      })
    },
    async generateBundle() {
      const source = readFileSync(EMBED_LOADER_SOURCE, 'utf8')
      const { code } = await transformWithEsbuild(source, EMBED_LOADER_SOURCE, {
        minify: true,
        // The loader is served to arbitrary host pages, so it targets what
        // those pages support, not what our app bundle targets.
        target: 'es2018',
        legalComments: 'none',
      })
      this.emitFile({ type: 'asset', fileName: 'embed.js', source: code })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), embedLoaderPlugin()],
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
        find: '@dculus/types/graphql.js',
        replacement: resolve(__dirname, '../../packages/types/src/graphql.ts'),
      },
      {
        find: '@dculus/types',
        replacement: resolve(__dirname, '../../packages/types/src/index.ts'),
      },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@apollo') || id.includes('/graphql/')) return 'vendor-apollo';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('better-auth')) return 'vendor-auth';
        },
      },
    },
  },
})
