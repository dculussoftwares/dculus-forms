/**
 * Loads the architecture Markdown at build time.
 *
 * The source of truth is `docs/architecture/*.md` at the repo root rather than
 * somewhere under `src/`, so the same files stay readable on GitHub and show up
 * as prose in PR diffs. Vite inlines them here as strings — `?raw` needs no
 * plugin, and `eager` keeps the docs in the route's own lazy chunk instead of
 * adding a second async hop once the page is already open.
 */
const modules = import.meta.glob('../../../../../docs/architecture/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Keyed by basename, e.g. `01-submission-lifecycle.md`. */
export const docMarkdown: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, source]) => [path.split('/').pop() ?? path, source])
);

/**
 * Strips the leading `# Title` heading. The page renders the title itself in the
 * app header, and repeating it immediately below looks like a mistake — but it
 * has to stay in the file, because on GitHub the heading is the only title there
 * is.
 */
export function stripLeadingHeading(markdown: string): string {
  return markdown.replace(/^\s*#\s+.*\r?\n/, '').trimStart();
}

/**
 * Splits a doc around the `## <heading>` section that holds its ASCII diagram,
 * so the page can render the interactive canvas in that slot instead.
 *
 * Returns the whole document as `before` when the heading isn't found — a
 * renamed section should degrade to "ASCII diagram plus canvas below", never to
 * a page that silently loses half its prose.
 */
export function splitAroundSection(
  markdown: string,
  heading?: string
): { before: string; after: string } {
  if (!heading) return { before: markdown, after: '' };

  const start = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(markdown);
  if (!start) return { before: markdown, after: '' };

  const sectionStart = start.index;
  const rest = markdown.slice(sectionStart + start[0].length);
  const next = /^##\s+/m.exec(rest);

  return {
    before: markdown.slice(0, sectionStart),
    after: next ? rest.slice(next.index) : '',
  };
}
