import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';

/**
 * Renders an architecture doc.
 *
 * Styling is an explicit component map rather than a `prose` class because this
 * app has no Tailwind typography plugin — and the map is what these docs want
 * anyway: tables scroll on their own, ASCII flow diagrams keep their alignment,
 * and cross-links between pages become client-side navigations.
 */

/** `./02-event-fanout.md` in the file → `/docs/event-fanout` in the app. */
function toAppHref(href: string): string | null {
  const match = /^\.?\/?(?:\d+-)?([a-z0-9-]+)\.md(#.*)?$/i.exec(href);
  return match ? `/docs/${match[1]}${match[2] ?? ''}` : null;
}

const components: Components = {
  h2: ({ children }) => (
    <h2 className="mt-10 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-7 mb-2 text-[15px] font-semibold text-slate-900 dark:text-slate-100">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-3 text-[15px] leading-7 text-slate-700 dark:text-slate-300">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r-lg border-l-4 border-blue-400 dark:border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 py-1 pl-4 pr-3 text-[15px] text-slate-700 dark:text-slate-300">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const internal = href ? toAppHref(href) : null;
    if (internal) {
      return (
        <Link to={internal} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {children}
      </a>
    );
  },
  code: ({ className, children }) => {
    // react-markdown gives fenced blocks a `language-*` class and inline code
    // none — but the ASCII diagrams in these docs are fenced with no language,
    // so fall back to "has newlines means block".
    const isBlock = Boolean(className) || String(children).includes('\n');
    if (isBlock) {
      return (
        <code className="block font-mono text-[12.5px] leading-relaxed text-slate-800 dark:text-slate-200">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[13px] text-slate-800 dark:text-slate-200">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4">
      {children}
    </pre>
  ),
  // Tables carry the "Shared surfaces" content and are the widest thing on the
  // page — they scroll inside their own container so the page body never does.
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-left text-[13.5px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-slate-50 dark:bg-slate-900">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-slate-200 dark:border-slate-800 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 dark:border-slate-800/60 px-3 py-2 align-top text-slate-600 dark:text-slate-400">
      {children}
    </td>
  ),
  hr: () => <hr className="my-8 border-slate-200 dark:border-slate-800" />,
};

export const DocsMarkdown: React.FC<{ source: string }> = ({ source }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
    {source}
  </ReactMarkdown>
);
