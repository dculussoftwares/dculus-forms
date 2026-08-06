import fs from 'fs';
import path from 'path';
import { docDiagrams, docPages } from '../diagrams';

/**
 * Architecture docs go stale the moment someone renames a file — that's the
 * failure mode every "docs in the app" effort hits. These tests can't tell that
 * a *flow* changed shape (only a human reading the page can), but they do catch
 * the common case: a path in a diagram that no longer points at anything.
 *
 * Imports `../diagrams` rather than `../registry`-style modules on purpose:
 * anything touching `import.meta.glob` is Vite-only and cannot run under Jest.
 */

const REPO_ROOT = path.resolve(__dirname, '../../../../../..');
const DOCS_DIR = path.join(REPO_ROOT, 'docs/architecture');

describe('architecture docs', () => {
  it('resolves the repo root correctly', () => {
    // Guards the relative hop above — if the test file moves, every other
    // assertion here would pass vacuously against paths that resolve nowhere.
    expect(fs.existsSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'))).toBe(true);
  });

  describe.each(docPages.map((page) => [page.title, page] as const))('%s', (_title, page) => {
    it('has its markdown file', () => {
      expect(fs.existsSync(path.join(DOCS_DIR, page.markdownFile))).toBe(true);
    });

    it('is listed in the docs index', () => {
      const readme = fs.readFileSync(path.join(DOCS_DIR, 'README.md'), 'utf8');
      expect(readme).toContain(page.markdownFile);
    });

    if (docPages.some((p) => p.slug === page.slug && p.diagramSection)) {
      it('still contains the section the canvas replaces', () => {
        const source = fs.readFileSync(path.join(DOCS_DIR, page.markdownFile), 'utf8');
        expect(source).toMatch(new RegExp(`^##\\s+${page.diagramSection}\\s*$`, 'm'));
      });
    }
  });

  it('gives every page a unique slug', () => {
    const slugs = docPages.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('only defines diagrams for registered pages', () => {
    const slugs = new Set(docPages.map((page) => page.slug));
    for (const slug of Object.keys(docDiagrams)) {
      expect(slugs).toContain(slug);
    }
  });

  describe('diagram source references', () => {
    const references = Object.entries(docDiagrams).flatMap(([slug, diagram]) =>
      diagram.nodes
        .filter((node) => node.data.file)
        .map((node) => [`${slug} → ${node.id}`, node.data.file!] as const)
    );

    it.each(references)('%s points at a file that exists', (_label, file) => {
      expect(fs.existsSync(path.join(REPO_ROOT, file))).toBe(true);
    });
  });

  describe('diagram edges', () => {
    it.each(Object.entries(docDiagrams))('%s connects only declared nodes', (_slug, diagram) => {
      const ids = new Set(diagram.nodes.map((node) => node.id));
      for (const edge of diagram.edges) {
        expect(ids).toContain(edge.source);
        expect(ids).toContain(edge.target);
      }
    });
  });
});
