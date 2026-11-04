// Cloudflare Pages "advanced mode" worker for form-viewer — link previews for shared forms.
//
// The viewer is a single-page app, so a crawler (WhatsApp, Slack, LinkedIn, X, iMessage,
// Google…) fetching /f/<shortUrl> would only ever see the generic index.html. This worker
// adds the form's own title, description and generated share image (backend
// /og/forms/<shortUrl>.png) as og:/twitter: tags, then serves the page as usual.
//
// Scope: _routes.json limits it to /f/*; every other path never reaches this code and is
// served statically with _headers applied. Cloudflare does NOT apply _headers to responses
// a worker returns, so the /* security headers are re-applied here (SECURITY_HEADERS must
// match the /* block in _headers — a unit test checks that).
//
// Failure is always safe: if the API is slow or the form is missing/unpublished, the
// untouched page is returned.
//
// Shipped as-is (public/ is copied verbatim into dist), so plain JS, no imports.

const SECURITY_HEADERS = {
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};

const META_TIMEOUT_MS = 1500;
const SHORT_URL = /^\/f\/([A-Za-z0-9_-]{1,64})\/?$/;

/** "/f/abc123" → "abc123"; anything else (e.g. /f/abc/result) → null. */
function shortUrlFromPath(pathname) {
  const match = SHORT_URL.exec(pathname);
  return match ? match[1] : null;
}

/** VITE_API_URL from the deploy-time config.js ("window.__APP_CONFIG__ = {...};"). */
function apiUrlFromConfig(configJs) {
  const start = configJs.indexOf('{');
  const end = configJs.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  try {
    const config = JSON.parse(configJs.slice(start, end + 1));
    const url = config.VITE_API_URL;
    return typeof url === 'string' && /^https?:\/\//.test(url) ? url.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Insert share tags and the form's title into the SPA shell. */
function injectMeta(html, meta, pageUrl) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.imageUrl);
  const tags = [
    `<meta name="description" content="${description}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="Dculus Forms">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${escapeHtml(pageUrl)}">`,
    `<meta property="og:image" content="${image}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt || meta.title)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join('\n    ');

  // Function replacers: a replacement *string* would interpret "$$", "$&", "$'" in
  // owner-controlled titles and splice page markup into the head.
  const withTitle = /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    : html;
  return withTitle.includes('</head>') ? withTitle.replace('</head>', () => `    ${tags}\n  </head>`) : withTitle;
}

function withSecurityHeaders(response, extra) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (extra) for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

let cachedApiUrl = null;

async function getApiUrl(request, env) {
  if (cachedApiUrl) return cachedApiUrl;
  const res = await env.ASSETS.fetch(new Request(new URL('/config.js', request.url)));
  if (!res.ok) return null;
  cachedApiUrl = apiUrlFromConfig(await res.text());
  return cachedApiUrl;
}

async function fetchMeta(apiUrl, shortUrl, fetchImpl) {
  const res = await fetchImpl(`${apiUrl}/og/forms/${encodeURIComponent(shortUrl)}.json`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(META_TIMEOUT_MS),
    // Edge-cache successful lookups so a burst of unfurls hits the API once; a 404 (link
    // shared just before publishing) briefly, errors never.
    cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 300, '404': 30, '500-599': 0 } },
  });
  if (!res.ok) return null;
  const meta = await res.json();
  return meta && typeof meta.title === 'string' && typeof meta.imageUrl === 'string' ? meta : null;
}

async function handle(request, env, fetchImpl = fetch) {
  const page = await env.ASSETS.fetch(request);
  const url = new URL(request.url);
  const shortUrl = shortUrlFromPath(url.pathname);
  const isHtml = (page.headers.get('content-type') || '').includes('text/html');
  if (!shortUrl || request.method !== 'GET' || !page.ok || !isHtml) return withSecurityHeaders(page);

  try {
    const apiUrl = await getApiUrl(request, env);
    const meta = apiUrl ? await fetchMeta(apiUrl, shortUrl, fetchImpl) : null;
    if (!meta) return withSecurityHeaders(page);
    const html = injectMeta(await page.text(), meta, `${url.origin}${url.pathname}`);
    const headers = new Headers(page.headers);
    headers.delete('content-length');
    headers.delete('etag');
    return withSecurityHeaders(new Response(html, { status: 200, headers }), {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
    });
  } catch {
    return withSecurityHeaders(page);
  }
}

export default {
  fetch: (request, env) => handle(request, env),
  // Exposed for unit tests (src/__tests__/shareWorker.test.ts); not used by the runtime.
  _test: { SECURITY_HEADERS, shortUrlFromPath, apiUrlFromConfig, injectMeta, handle, reset: () => (cachedApiUrl = null) },
};
