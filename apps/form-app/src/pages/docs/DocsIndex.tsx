import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, Compass } from 'lucide-react';
import { MainLayout } from '../../components/MainLayout';
import { docDiagrams, docPages, TIER_ORDER } from './diagrams';
import type { DocTier } from './types';

/**
 * `/docs` — the index for the architecture docs.
 *
 * Grouped by tier and ordered, because these are meant to be read in sequence by
 * someone new to the codebase, not searched by someone who already knows what
 * they're looking for.
 */
export const DocsIndex: React.FC = () => {
  const byTier = useMemo(() => {
    const groups = new Map<DocTier, typeof docPages>();
    for (const page of [...docPages].sort((a, b) => a.order - b.order)) {
      groups.set(page.tier, [...(groups.get(page.tier) ?? []), page]);
    }
    return TIER_ORDER.filter((tier) => groups.has(tier)).map((tier) => ({
      tier,
      pages: groups.get(tier)!,
    }));
  }, []);

  return (
    <MainLayout
      title="How Dculus Works"
      subtitle="Architecture documentation for developers"
      breadcrumbs={[{ label: 'Docs', isActive: true }]}
    >
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <div className="mb-8 flex gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4">
          <div className="h-fit rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3">
            <Compass className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            <p>
              Every page here answers one question:{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                “what actually happens when …?”
              </span>{' '}
              Each has a diagram you can click through, and every box names the
              file it describes.
            </p>
            <p className="mt-2">
              New to the codebase? Read them in order. The same pages live as
              Markdown in{' '}
              <code className="rounded bg-slate-200/70 dark:bg-slate-800 px-1 py-0.5 font-mono text-xs">
                docs/architecture/
              </code>{' '}
              if you would rather read them in your editor.
            </p>
          </div>
        </div>

        {byTier.map(({ tier, pages }) => (
          <section key={tier} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {tier}
            </h2>
            <div className="space-y-3">
              {pages.map((page) => (
                <Link
                  key={page.slug}
                  to={`/docs/${page.slug}`}
                  className="group flex items-start gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors hover:border-blue-300 dark:hover:border-blue-800"
                >
                  <div className="h-fit rounded-xl bg-blue-50 dark:bg-blue-950/50 p-3">
                    <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {page.title}
                      </h3>
                      {docDiagrams[page.slug] && (
                        <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                          interactive diagram
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {page.summary}
                    </p>
                  </div>
                  <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-slate-600" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </MainLayout>
  );
};

export default DocsIndex;
