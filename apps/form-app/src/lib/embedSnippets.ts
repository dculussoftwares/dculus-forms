// The leaf module, not the '@dculus/types' barrel: several of the barrel's
// re-exports import back from its index, and that cycle leaves runtime
// constants undefined under CommonJS test runners.
import {
  DEFAULT_EMBED_SETTINGS,
  type EmbedSettings,
  type EmbedType,
} from '@dculus/types/embed.js';

/**
 * The exact text an owner copies out of the Embed tab.
 *
 * Kept as pure functions with no React and no config lookups so they can be
 * unit-tested against their literal expected output — these strings end up
 * pasted into other people's websites, where a mistake is invisible to us and
 * expensive to them.
 *
 * @see docs/form-embed-v1-spec.md §7
 */

export type SnippetPlatform = 'html' | 'wordpress' | 'react' | 'webflow';

export interface SnippetContext {
  /** Origin of the form-viewer app, no trailing slash (e.g. https://forms.dculus.com). */
  viewerOrigin: string;
  shortUrl: string;
  /** Used as the iframe's accessible name. */
  formTitle: string;
  settings: ResolvedEmbedSettings;
}

export type ResolvedEmbedSettings = Required<
  Pick<
    EmbedSettings,
    'type' | 'width' | 'heightMode' | 'heightPx' | 'transparentBackground' | 'closeOnSubmit'
  >
> & { buttonLabel: string };

/** Shown on the button and lightbox trigger until the owner types their own. */
export const DEFAULT_BUTTON_LABEL = 'Open the form';

/**
 * Bounds for a pinned frame height, matching the number input's `min`/`max`.
 * Those attributes only style the spinner — they do not stop a typed or pasted
 * value — so the range is enforced here, where every persisted setting and
 * every generated snippet passes through.
 */
export const MIN_EMBED_HEIGHT_PX = 200;
export const MAX_EMBED_HEIGHT_PX = 4000;

function clampHeight(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_EMBED_SETTINGS.heightPx;
  }
  return Math.min(MAX_EMBED_HEIGHT_PX, Math.max(MIN_EMBED_HEIGHT_PX, Math.round(value)));
}

/**
 * Fills in every field from {@link DEFAULT_EMBED_SETTINGS}, so the rest of this
 * module never has to reason about `undefined`. An absent `settings.embed`
 * (every form that predates the feature) resolves to the same thing a freshly
 * opened panel shows.
 */
export function resolveEmbedSettings(settings?: EmbedSettings | null): ResolvedEmbedSettings {
  return {
    type: settings?.type ?? DEFAULT_EMBED_SETTINGS.type,
    width: settings?.width ?? DEFAULT_EMBED_SETTINGS.width,
    heightMode: settings?.heightMode ?? DEFAULT_EMBED_SETTINGS.heightMode,
    heightPx: clampHeight(settings?.heightPx),
    transparentBackground:
      settings?.transparentBackground ?? DEFAULT_EMBED_SETTINGS.transparentBackground,
    closeOnSubmit: settings?.closeOnSubmit ?? DEFAULT_EMBED_SETTINGS.closeOnSubmit,
    buttonLabel: settings?.buttonLabel?.trim() || DEFAULT_BUTTON_LABEL,
  };
}

/**
 * Escapes text that lands inside a double-quoted HTML attribute in a snippet
 * we generate. The owner controls this text, so this is not an XSS boundary —
 * it is here so that a perfectly reasonable label like `Say "hello"` produces
 * a snippet that still parses on their site.
 */
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Same, for text between tags. */
function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The public, hosted URL — what Link and the `<noscript>` fallbacks point at. */
export function buildFormUrl(ctx: Pick<SnippetContext, 'viewerOrigin' | 'shortUrl'>): string {
  return `${ctx.viewerOrigin}/f/${ctx.shortUrl}`;
}

/**
 * `/embed/:shortUrl` with the options the no-JS snippet needs baked in.
 * The JS snippets don't use this — `embed.js` builds its own URL, because only
 * it knows the host origin and the per-instance id.
 */
export function buildEmbedUrl(ctx: SnippetContext): string {
  const { settings } = ctx;
  const params = new URLSearchParams({
    mode: 'iframe',
    // The no-JS snippet has nothing to resize it, so it always passes an
    // explicit pixel height, even when the owner picked "fit content".
    h: String(settings.heightPx),
    bg: settings.transparentBackground ? 'transparent' : 'white',
  });
  return `${ctx.viewerOrigin}/embed/${ctx.shortUrl}?${params.toString()}`;
}

function noscriptFallback(ctx: SnippetContext): string {
  return `<noscript><a href="${buildFormUrl(ctx)}">${escapeText(ctx.settings.buttonLabel)}</a></noscript>`;
}

interface DataAttribute {
  name: string;
  value: string;
}

/**
 * The `data-dculus-*` attributes for a JS embed, as structured pairs.
 *
 * Structured rather than pre-rendered strings because the same set has to be
 * emitted twice — as HTML attributes and as JSX props — and re-parsing a
 * rendered attribute string breaks the moment a value contains `=` or a quote.
 *
 * Only non-default values are emitted: a snippet that spells out every default
 * is longer, harder to read, and pins settings the owner never chose.
 */
function dataAttributes(ctx: SnippetContext, mode: 'inline' | 'lightbox'): DataAttribute[] {
  const { settings } = ctx;
  const attrs: DataAttribute[] = [
    { name: 'data-dculus-form', value: ctx.shortUrl },
    { name: 'data-dculus-mode', value: mode },
  ];

  if (settings.width !== DEFAULT_EMBED_SETTINGS.width) {
    attrs.push({ name: 'data-dculus-width', value: settings.width });
  }
  if (settings.heightMode === 'fixed') {
    attrs.push({ name: 'data-dculus-height', value: String(settings.heightPx) });
  }
  if (!settings.transparentBackground) {
    attrs.push({ name: 'data-dculus-bg', value: 'white' });
  }
  if (mode === 'lightbox') {
    attrs.push({ name: 'data-dculus-label', value: settings.buttonLabel });
    // The overlay's accessible name. Without it the dialog announces as the
    // generic "Form", which tells a screen-reader user nothing about which
    // form just opened over the page they were reading.
    attrs.push({ name: 'data-dculus-title', value: ctx.formTitle });
    if (!settings.closeOnSubmit) {
      attrs.push({ name: 'data-dculus-close-on-submit', value: 'false' });
    }
  }
  return attrs;
}

function renderHtmlAttribute(attr: DataAttribute): string {
  return `${attr.name}="${escapeAttribute(attr.value)}"`;
}

function scriptTag(ctx: SnippetContext): string {
  return `<script src="${ctx.viewerOrigin}/embed.js" async></script>`;
}

function buildLink(ctx: SnippetContext): string {
  return buildFormUrl(ctx);
}

function buildButton(ctx: SnippetContext): string {
  return [
    `<a href="${buildFormUrl(ctx)}" target="_blank" rel="noopener"`,
    `   style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;`,
    `          border-radius:8px;text-decoration:none;font:600 15px/1 system-ui,sans-serif">`,
    `  ${escapeText(ctx.settings.buttonLabel)}`,
    `</a>`,
  ].join('\n');
}

function buildIframe(ctx: SnippetContext): string {
  const { settings } = ctx;
  return [
    `<iframe src="${escapeAttribute(buildEmbedUrl(ctx))}"`,
    `        style="width:${escapeAttribute(settings.width)};height:${settings.heightPx}px;border:0"`,
    `        loading="lazy" title="${escapeAttribute(ctx.formTitle)}"></iframe>`,
  ].join('\n');
}

function buildJsEmbed(ctx: SnippetContext, mode: 'inline' | 'lightbox'): string {
  const attrs = dataAttributes(ctx, mode).map(renderHtmlAttribute);
  // Two attributes fit on one line; more get their own, so a long label
  // doesn't produce a snippet nobody can read.
  const div =
    attrs.length <= 2
      ? `<div ${attrs.join(' ')}></div>`
      : `<div ${attrs[0]}\n${attrs.slice(1).map((a) => `     ${a}`).join('\n')}></div>`;

  return [div, scriptTag(ctx), noscriptFallback(ctx)].join('\n');
}

/** The canonical HTML snippet for a given embed type. */
export function buildSnippet(ctx: SnippetContext, type: EmbedType = ctx.settings.type): string {
  switch (type) {
    case 'link':
      return buildLink(ctx);
    case 'button':
      return buildButton(ctx);
    case 'iframe':
      return buildIframe(ctx);
    case 'lightbox':
      return buildJsEmbed(ctx, 'lightbox');
    case 'inline':
    default:
      return buildJsEmbed(ctx, 'inline');
  }
}

/**
 * The React variant, for hosts whose "paste HTML here" box is a JSX file.
 * Injects the loader once and calls `refresh()`, because a React host mounts
 * its container after the script has already scanned the document.
 */
function buildReactSnippet(ctx: SnippetContext, type: EmbedType): string {
  const mode = type === 'lightbox' ? 'lightbox' : 'inline';
  const attrs = dataAttributes(ctx, mode)
    .map((attr) => `      ${attr.name}={${JSON.stringify(attr.value)}}`)
    .join('\n');

  return [
    `import { useEffect, useRef } from 'react';`,
    ``,
    `export function DculusForm() {`,
    `  const ref = useRef(null);`,
    ``,
    `  useEffect(() => {`,
    `    const SRC = '${ctx.viewerOrigin}/embed.js';`,
    `    if (document.querySelector(\`script[src="\${SRC}"]\`)) {`,
    `      // Already loaded (e.g. a second form, or a client-side navigation).`,
    `      window.dculusForms?.refresh();`,
    `      return;`,
    `    }`,
    `    const script = document.createElement('script');`,
    `    script.src = SRC;`,
    `    script.async = true;`,
    `    document.body.appendChild(script);`,
    `  }, []);`,
    ``,
    `  return (`,
    `    <div`,
    `      ref={ref}`,
    attrs,
    `    />`,
    `  );`,
    `}`,
  ].join('\n');
}

/**
 * Same configuration, rendered for the place it is being pasted into.
 * WordPress and Webflow take the identical HTML — what differs is *where* it
 * goes, which is the actual support question, so that guidance ships as the
 * note beside the snippet rather than as a different snippet.
 */
export function buildPlatformSnippet(
  ctx: SnippetContext,
  platform: SnippetPlatform,
  type: EmbedType = ctx.settings.type
): string {
  if (platform === 'react') return buildReactSnippet(ctx, type);
  return buildSnippet(ctx, type);
}

/** Platforms worth offering for a given type — a bare link needs no variants. */
export function platformsForType(type: EmbedType): SnippetPlatform[] {
  if (type === 'link') return [];
  if (type === 'button' || type === 'iframe') return ['html', 'wordpress', 'webflow'];
  return ['html', 'wordpress', 'react', 'webflow'];
}
