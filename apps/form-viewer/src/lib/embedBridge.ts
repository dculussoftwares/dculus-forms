/**
 * The iframe half of the embed protocol.
 *
 * `embed.js` (the host half, in `public/embed.js`) creates an iframe pointing
 * at `/embed/:shortUrl` and then sizes it from whatever this module reports.
 * The two files are one contract; change a message name in one and you must
 * change it in the other.
 *
 * ## Trust
 *
 * Everything here crosses an origin boundary into a page we do not control, so:
 *
 * - **Outbound** messages are posted to an exact origin, never `'*'`. The
 *   origin comes from the `origin` query parameter that `embed.js` adds to the
 *   iframe URL. A host that lies about it achieves nothing — the browser
 *   refuses to deliver a message whose target origin doesn't match the real
 *   parent — so the worst case is that messaging silently does not work.
 * - **Inbound** messages must come from `window.parent` *and* from that same
 *   exact origin (scheme + host + port). A hostname comparison would accept
 *   `http://` and odd ports, so the full origin string is compared.
 * - **No response data is ever posted.** `dculus:submit` carries ids only. A
 *   host page that wants answers uses a webhook or an automation.
 *
 * @see docs/form-embed-v1-spec.md §8
 * @see apps/form-viewer/public/embed.js
 */

export type EmbedMode = 'inline' | 'lightbox' | 'iframe';

const EMBED_MODES: readonly EmbedMode[] = ['inline', 'lightbox', 'iframe'];

export interface EmbedParams {
  /** Which snippet produced this frame. */
  mode: EmbedMode;
  /** Shell background behind the form. */
  background: 'transparent' | 'white';
  /** true = report our content height to the host; false = the host fixed it. */
  autoHeight: boolean;
  /**
   * The host page's origin, as supplied by `embed.js`. Absent for the no-JS
   * `iframe` snippet, which has no script to talk to — messaging stays off.
   */
  hostOrigin: string | null;
  /** Distinguishes multiple embeds of the same form on one page. */
  instanceId: string;
  /**
   * Lightbox only — dismiss the overlay a few seconds after submission.
   *
   * The delay is owned by this side rather than the host because the
   * thank-you screen renders in here: the iframe is the only party that knows
   * when the respondent actually started reading it.
   */
  closeAfterSubmit: boolean;
  /**
   * The form owner looking at their own embed in the Collect panel, rather
   * than a respondent on a host page.
   *
   * A preview must not be counted: it would inflate the owner's view stats
   * and, because a view also emits a FORM_VIEWED usage event, spend their
   * plan's view quota every time they open the Embed tab.
   */
  isPreview: boolean;
}

export interface EmbedAttribution {
  embedContext: EmbedMode | 'direct';
  /** Host page hostname, or null when it cannot be determined. */
  embedHost: string | null;
}

/** Protocol version, echoed on every message so a future v2 can coexist. */
const PROTOCOL_VERSION = 1;

/** Ignore height changes smaller than this — sub-pixel reflow would otherwise thrash the host. */
const RESIZE_DEAD_BAND_PX = 4;

/** Coalesce bursts of layout change (fonts loading, a page transition) into one message. */
const RESIZE_DEBOUNCE_MS = 100;

/** Long enough to read "thanks", short enough not to feel stuck. */
const LIGHTBOX_CLOSE_DELAY_MS = 3000;

function isEmbedMode(value: string | null): value is EmbedMode {
  return value !== null && EMBED_MODES.includes(value as EmbedMode);
}

/**
 * An origin is only accepted in the strict `scheme://host[:port]` form, and
 * only for http/https. Parsing (rather than pattern-matching) means a value
 * like `https://evil.com/path` is normalised or rejected rather than being
 * used verbatim as a postMessage target.
 */
function parseHostOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin === raw ? url.origin : null;
  } catch {
    return null;
  }
}

export function readEmbedParams(search: string): EmbedParams {
  const params = new URLSearchParams(search);
  const rawMode = params.get('mode');

  return {
    mode: isEmbedMode(rawMode) ? rawMode : 'inline',
    background: params.get('bg') === 'white' ? 'white' : 'transparent',
    // `h=auto` opts into the resize protocol. The no-JS snippet always passes
    // an explicit pixel value, which means "the host has already decided".
    autoHeight: (params.get('h') ?? 'auto') === 'auto',
    hostOrigin: parseHostOrigin(params.get('origin')),
    instanceId: params.get('i') ?? 'default',
    closeAfterSubmit: params.get('close') === '1',
    isPreview: params.get('preview') === '1',
  };
}

/**
 * Hostname of the page framing us.
 *
 * `document.referrer` is the parent page's URL for a framed document, and we
 * keep only its hostname — never the path or query string, which can carry
 * PII. It can legitimately be empty under a strict `Referrer-Policy`, in which
 * case the `dculus:host` handshake fills it in for JS embeds.
 */
function hostnameFromReferrer(): string | null {
  try {
    if (!document.referrer) return null;
    return new URL(document.referrer).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Live attribution for the current page load.
 *
 * Read synchronously (so the very first `trackFormView` is never delayed by a
 * handshake that may never arrive) and refined in place if `dculus:host`
 * later supplies a better hostname — by which time only the submission event
 * is still outstanding, and that is the one that matters most.
 */
class EmbedAttributionStore {
  private context: EmbedMode | 'direct' = 'direct';
  private host: string | null = null;

  set(context: EmbedMode | 'direct', host: string | null) {
    this.context = context;
    this.host = host;
  }

  setHost(host: string | null) {
    if (!host) return;
    this.host = host;
  }

  get(): EmbedAttribution {
    return { embedContext: this.context, embedHost: this.host };
  }
}

/**
 * Module singleton rather than React state: the analytics hooks read this from
 * deep inside the render tree, and threading it through every layer would
 * touch a dozen components to carry one value that is constant for the life of
 * the document.
 */
export const embedAttribution = new EmbedAttributionStore();

interface OutboundBase {
  formId: string;
  instanceId: string;
}

export interface EmbedBridgeOptions extends OutboundBase {
  params: EmbedParams;
  /** The element whose height defines the frame's height. */
  getContentElement: () => HTMLElement | null;
  /** Host asked us to close — only meaningful for the lightbox. */
  onHostClose?: () => void;
}

export interface EmbedBridge {
  /** Announce readiness. Called once the form has actually rendered. */
  sendReady(): void;
  /** Report a submission — ids only, never answers. */
  sendSubmit(): void;
  /** Ask the host to scroll the frame into view (it decides whether to). */
  sendScroll(): void;
  /** Ask the host to dismiss the overlay we're inside. */
  sendCloseSelf(): void;
  /** Push the current content height immediately, bypassing the debounce. */
  measureNow(): void;
  /** Detach observers and listeners. */
  destroy(): void;
}

/**
 * Wires up the iframe side. Safe to call for `mode=iframe` (or when the host
 * origin is missing): observers still run but every send is a no-op, so the
 * caller needs no branching.
 */
export function createEmbedBridge(options: EmbedBridgeOptions): EmbedBridge {
  const { params, formId, instanceId, getContentElement, onHostClose } = options;
  const targetOrigin = params.hostOrigin;
  const canMessage = targetOrigin !== null && window.parent !== window;

  let lastSentHeight = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const post = (type: string, payload: Record<string, unknown> = {}) => {
    if (!canMessage || destroyed) return;
    window.parent.postMessage(
      { type, v: PROTOCOL_VERSION, formId, instanceId, ...payload },
      targetOrigin as string
    );
  };

  const measure = (): number => {
    const el = getContentElement();
    if (!el) return 0;
    // getBoundingClientRect keeps sub-pixel precision, which matters because
    // rounding down repeatedly is how you end up with a 1px inner scrollbar.
    return Math.ceil(el.getBoundingClientRect().height);
  };

  const sendHeight = (height: number) => {
    if (height <= 0) return;
    if (Math.abs(height - lastSentHeight) < RESIZE_DEAD_BAND_PX) return;
    lastSentHeight = height;
    post('dculus:resize', { height });
  };

  const scheduleMeasure = () => {
    if (!params.autoHeight) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      sendHeight(measure());
    }, RESIZE_DEBOUNCE_MS);
  };

  const resizeObserver =
    params.autoHeight && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleMeasure)
      : null;

  // Observation starts lazily: the content element is mounted by React, so it
  // may not exist at the moment the bridge is created.
  let observed: HTMLElement | null = null;
  const attachObserver = () => {
    if (!resizeObserver) return;
    const el = getContentElement();
    if (!el || el === observed) return;
    if (observed) resizeObserver.unobserve(observed);
    resizeObserver.observe(el);
    observed = el;
  };

  const onMessage = (event: MessageEvent) => {
    if (!canMessage) return;
    // Both checks are required: origin alone would accept a message from any
    // frame on the host's origin, source alone would accept a same-window
    // message from injected script.
    if (event.source !== window.parent) return;
    if (event.origin !== targetOrigin) return;

    const data = event.data as { type?: unknown; instanceId?: unknown; hostname?: unknown };
    if (!data || typeof data.type !== 'string') return;
    if (typeof data.instanceId === 'string' && data.instanceId !== instanceId) return;

    switch (data.type) {
      case 'dculus:host':
        if (typeof data.hostname === 'string') {
          embedAttribution.setHost(data.hostname);
        }
        break;
      case 'dculus:close':
        onHostClose?.();
        break;
      default:
        break;
    }
  };

  window.addEventListener('message', onMessage);

  // Fonts settle after first paint and change every text metric with them;
  // without this the first reported height is measured against fallback fonts.
  if (params.autoHeight && document.fonts?.ready) {
    document.fonts.ready.then(scheduleMeasure).catch(() => undefined);
  }

  const onWindowResize = () => scheduleMeasure();
  window.addEventListener('resize', onWindowResize);

  /**
   * Escape, forwarded to the host so it can dismiss the overlay.
   *
   * The host cannot do this itself: keyboard events raised inside a
   * cross-origin iframe never reach the parent document, and the respondent
   * is nearly always focused inside the form. Without this, "press Esc to
   * close" is true only in the moment before they interact with anything.
   */
  const onKeyDown = (event: KeyboardEvent) => {
    if (params.mode !== 'lightbox') return;
    if (event.key !== 'Escape') return;
    post('dculus:closeself');
  };
  window.addEventListener('keydown', onKeyDown);

  return {
    sendReady() {
      attachObserver();
      post('dculus:ready');
      // First measurement is immediate: the host is sitting on a placeholder
      // height until it arrives, and a debounce here is a visible jump.
      if (params.autoHeight) sendHeight(measure());
    },
    sendSubmit() {
      post('dculus:submit');
      scheduleMeasure();
      if (params.closeAfterSubmit) {
        closeTimer = setTimeout(() => {
          closeTimer = null;
          post('dculus:closeself');
        }, LIGHTBOX_CLOSE_DELAY_MS);
      }
    },
    sendScroll() {
      post('dculus:scroll');
    },
    sendCloseSelf() {
      post('dculus:closeself');
    },
    measureNow() {
      attachObserver();
      if (params.autoHeight) sendHeight(measure());
    },
    destroy() {
      destroyed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (closeTimer) clearTimeout(closeTimer);
      resizeObserver?.disconnect();
      window.removeEventListener('message', onMessage);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}

/**
 * Seeds attribution from the URL and the referrer, before any handshake.
 * Exported for the route to call on mount.
 *
 * `/embed/:shortUrl` can also be opened as an ordinary top-level page — someone
 * saves the iframe's `src`, or follows it from a link. That is a direct visit,
 * whatever `mode` the URL still carries, and `document.referrer` there is the
 * *linking* page rather than a host page. Counting it as embedded traffic would
 * inflate the embed stats and credit a hostname that never embedded anything,
 * so attribution is only taken from the URL when we really are in a frame.
 */
export function seedEmbedAttribution(params: EmbedParams): void {
  if (window.parent === window) {
    embedAttribution.set('direct', null);
    return;
  }
  embedAttribution.set(params.mode, hostnameFromReferrer());
}

export const __testing = { parseHostOrigin, hostnameFromReferrer, RESIZE_DEAD_BAND_PX, RESIZE_DEBOUNCE_MS };
