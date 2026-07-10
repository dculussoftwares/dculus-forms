import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * @pdfme/converter (used internally by @pdfme/ui's Designer to render an
 * uploaded base PDF onto the canvas) builds its worker script URL as
 * `new URL('assets/clawpdf-worker-<hash>.js', import.meta.url)`. When Vite's
 * dependency optimizer pre-bundles @pdfme/ui into node_modules/.vite/deps/,
 * that relative URL resolves against the pre-bundled file's location instead
 * of @pdfme/converter's own dist/ folder, so the browser 404s requesting
 * node_modules/.vite/deps/assets/clawpdf-worker-<hash>.js and the designer
 * fails with "PDF render worker failed".
 *
 * Excluding @pdfme/converter from pre-bundling avoids the broken relative
 * URL, but drags its transitive CommonJS-only dependencies (pako@1.0.11 via
 * @pdf-lib/standard-fonts and @pdf-lib/upng) into unbundled native-ESM
 * requests, which then fail with "does not provide an export named
 * 'default'" — deep pnpm isolation makes those nested deps unresolvable via
 * optimizeDeps.include chains from the project root.
 *
 * Instead, this plugin leaves normal pre-bundling untouched (so CJS interop
 * keeps working) and only patches the one broken static-asset lookup: when
 * Vite's dep-serving middleware 404s a request for
 * /node_modules/.vite/deps/assets/<file>.js, fall back to serving the same
 * filename from @pdfme/converter's real dist/assets/ directory.
 */
export function pdfmeWorkerAssetFallbackPlugin(): Plugin {
  return {
    name: 'pdfme-worker-asset-fallback',
    configureServer(server) {
      // Registered without returning a function so this runs BEFORE Vite's
      // internal deps-serving middleware — that middleware ends the response
      // with a 404 directly (without calling next()) when the asset is
      // missing, so a post-hook middleware never gets a chance to run.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        const match = url.match(/^\/node_modules\/\.vite\/deps\/assets\/([\w.-]+\.js)(\?.*)?$/);
        if (!match) return next();

        const assetPath = findConverterAsset(match[1]);
        if (!assetPath) return next();

        res.setHeader('Content-Type', 'text/javascript');
        fs.createReadStream(assetPath).pipe(res);
      });
    },
  };
}

let cachedAssetsDir: string | null | undefined;

function findConverterAssetsDir(): string | null {
  if (cachedAssetsDir !== undefined) return cachedAssetsDir;

  const pnpmStore = path.resolve(__dirname, '../../node_modules/.pnpm');
  cachedAssetsDir = null;
  try {
    const entry = fs
      .readdirSync(pnpmStore)
      .find((name) => name.startsWith('@pdfme+converter@'));
    if (entry) {
      const dir = path.join(pnpmStore, entry, 'node_modules/@pdfme/converter/dist/assets');
      if (fs.existsSync(dir)) cachedAssetsDir = dir;
    }
  } catch {
    // pnpm store not found at the expected location — leave cachedAssetsDir null
  }
  return cachedAssetsDir;
}

function findConverterAsset(filename: string): string | null {
  const dir = findConverterAssetsDir();
  if (!dir) return null;
  const filePath = path.join(dir, filename);
  return fs.existsSync(filePath) ? filePath : null;
}
