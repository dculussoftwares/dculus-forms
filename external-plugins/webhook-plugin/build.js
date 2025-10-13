/**
 * Build script for Webhook Notifier Plugin
 */

import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function build() {
  console.log('🔨 Building Webhook Notifier Plugin...\n');

  const distDir = join(__dirname, 'dist');
  await mkdir(distDir, { recursive: true });

  // Build backend bundle (ESM for Node.js)
  console.log('📦 Building backend bundle (ESM)...');
  try {
    await esbuild.build({
      entryPoints: [join(__dirname, 'src', 'backend', 'index.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      outfile: join(distDir, 'plugin.backend.js'),
      external: [],
      minify: false,
      sourcemap: false,
      banner: {
        js: '// Webhook Notifier Plugin - Backend Bundle\n// Generated: ' + new Date().toISOString(),
      },
    });
    console.log('✅ Backend bundle created: dist/plugin.backend.js\n');
  } catch (error) {
    console.error('❌ Backend build failed:', error);
    process.exit(1);
  }

  // Build frontend bundle (UMD for browser)
  console.log('📦 Building frontend bundle (UMD)...');
  try {
    await esbuild.build({
      entryPoints: [join(__dirname, 'src', 'frontend', 'ConfigUI.tsx')],
      bundle: true,
      platform: 'browser',
      format: 'iife',
      globalName: 'WebhookPluginConfig',
      target: 'es2020',
      outfile: join(distDir, 'plugin.config.js'),
      external: ['react', 'react-dom'],
      minify: false,
      sourcemap: false,
      jsx: 'automatic',
      banner: {
        js: `// Webhook Notifier Plugin - Frontend Bundle
// Generated: ${new Date().toISOString()}
`,
      },
    });
    console.log('✅ Frontend bundle created: dist/plugin.config.js\n');
  } catch (error) {
    console.error('❌ Frontend build failed:', error);
    process.exit(1);
  }

  // Copy manifest.json
  console.log('📄 Copying manifest.json...');
  try {
    await copyFile(
      join(__dirname, 'manifest.json'),
      join(distDir, 'manifest.json')
    );
    console.log('✅ Manifest copied: dist/manifest.json\n');
  } catch (error) {
    console.error('❌ Failed to copy manifest:', error);
    process.exit(1);
  }

  console.log('✨ Build complete!\n');
  console.log('📂 Output directory: dist/');
  console.log('   - plugin.backend.js  (Backend logic)');
  console.log('   - plugin.config.js   (Config UI)');
  console.log('   - manifest.json      (Plugin metadata)\n');
  console.log('🚀 Next steps:');
  console.log('   1. Serve the plugin: npm run serve');
  console.log('   2. Install in dculus-forms: http://localhost:3002');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
