import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';
import { MainLayout } from '../../components/MainLayout';
import { docDiagrams, docPages } from './diagrams';
import { docMarkdown, splitAroundSection, stripLeadingHeading } from './content';
import { DocsMarkdown } from './components/DocsMarkdown';
import { DocsCanvas } from './components/DocsCanvas';

/** `/docs/:slug` — one architecture page: prose, with the canvas spliced in. */
export const DocPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const ordered = useMemo(() => [...docPages].sort((a, b) => a.order - b.order), []);
  const index = ordered.findIndex((page) => page.slug === slug);
  const page = index >= 0 ? ordered[index] : undefined;
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;

  const sections = useMemo(() => {
    if (!page) return null;
    const source = docMarkdown[page.markdownFile];
    if (!source) return null;
    return splitAroundSection(stripLeadingHeading(source), page.diagramSection);
  }, [page]);

  if (!page || !sections) {
    return (
      <MainLayout title="Not found" breadcrumbs={[{ label: 'Docs', href: '/docs' }]}>
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <FileText className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            There is no architecture page at <code className="font-mono">{slug}</code>.
          </p>
          <Link to="/docs" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline">
            Back to all pages
          </Link>
        </div>
      </MainLayout>
    );
  }

  const diagram = docDiagrams[page.slug];

  return (
    <MainLayout
      title={page.title}
      subtitle={page.summary}
      breadcrumbs={[{ label: 'Docs', href: '/docs' }, { label: page.title, isActive: true }]}
    >
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <DocsMarkdown source={sections.before} />
        </div>

        {/* The canvas breaks out of the prose column. A fit-to-view graph inside
            a 900px measure shrinks node labels past the point of being readable,
            which defeats the whole point of having one. */}
        {diagram && (
          <div className="mx-auto my-8 max-w-7xl">
            <DocsCanvas diagram={diagram} />
          </div>
        )}

        <div className="mx-auto max-w-4xl">
          {sections.after && <DocsMarkdown source={sections.after} />}

          <nav className="mt-12 flex items-stretch justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-6">
          {previous ? (
            <Link
              to={`/docs/${previous.slug}`}
              className="group flex max-w-[45%] items-center gap-2 text-left"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-500" />
              <span>
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">
                  Previous
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600">
                  {previous.title}
                </span>
              </span>
            </Link>
          ) : (
            <span />
          )}

          {next && (
            <Link
              to={`/docs/${next.slug}`}
              className="group flex max-w-[45%] items-center gap-2 text-right"
            >
              <span>
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">Next</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-600">
                  {next.title}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-blue-500" />
            </Link>
          )}
          </nav>
        </div>
      </div>
    </MainLayout>
  );
};

export default DocPage;
