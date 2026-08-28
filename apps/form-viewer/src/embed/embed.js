/*!
 * dculus forms — embed loader (v1)
 *
 * Finds every [data-dculus-form] on the page and turns it into either an
 * auto-resizing inline iframe or a button that opens the form in a lightbox.
 *
 * Constraints this file is written to, deliberately:
 *   - No dependencies, no build step, ES2018 — it is served verbatim.
 *   - Touches exactly one global (window.dculusForms) and injects no page-wide
 *     CSS; every style is inline or inside a <style> element it owns.
 *   - Safe to include twice, and safe with many forms on one page.
 *   - Never receives answer data. The only inbound messages are ready/resize/
 *     submit/scroll/closeself, all of which carry ids and a height at most.
 *
 * The iframe half of this contract lives in src/lib/embedBridge.ts. Change a
 * message name here and you must change it there.
 *
 * @see docs/form-embed-v1-spec.md §8
 */
(function () {
  'use strict';

  // Including the script twice must not double-bind anything. The second copy
  // still resolves window.dculusForms, so a host calling refresh() works
  // regardless of which tag won.
  if (window.__dculusEmbedLoaded) return;
  window.__dculusEmbedLoaded = true;

  var PROTOCOL_VERSION = 1;

  /**
   * Height an inline frame occupies until the first resize message lands. The
   * same value everywhere (here, and as the fallback if a message never
   * arrives) so the worst case is a usable frame that scrolls internally,
   * rather than a sliver.
   */
  var PLACEHOLDER_HEIGHT = 400;

  /**
   * Origin serving this script — and therefore the only origin whose messages
   * are trusted. Derived at load time rather than baked in at build time, so
   * the same file works in local, preview and production without a rebuild.
   */
  var VIEWER_ORIGIN = (function () {
    var script = document.currentScript;
    if (!script) {
      // Fall back to the last <script> whose src looks like ours; only needed
      // when the script is injected in a way that clears currentScript.
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (all[i].src && all[i].src.indexOf('/embed.js') !== -1) {
          script = all[i];
          break;
        }
      }
    }
    try {
      return new URL(script.src).origin;
    } catch (e) {
      return null;
    }
  })();

  if (!VIEWER_ORIGIN) return;

  var instanceCount = 0;
  /** instanceId -> instance record, so a message can be routed to one frame. */
  var instances = Object.create(null);

  function nextInstanceId() {
    instanceCount += 1;
    return 'd' + Date.now().toString(36) + '-' + instanceCount;
  }

  function attr(el, name, fallback) {
    var value = el.getAttribute('data-dculus-' + name);
    return value === null || value === '' ? fallback : value;
  }

  function buildSrc(config) {
    var query =
      'mode=' + encodeURIComponent(config.mode) +
      '&bg=' + encodeURIComponent(config.background) +
      '&h=' + encodeURIComponent(config.height) +
      '&i=' + encodeURIComponent(config.instanceId) +
      // The iframe posts back to exactly this origin and to nothing else. A
      // forged value simply means the browser drops the message.
      '&origin=' + encodeURIComponent(window.location.origin);
    if (config.mode === 'lightbox' && config.closeOnSubmit) query += '&close=1';
    return VIEWER_ORIGIN + '/embed/' + encodeURIComponent(config.formId) + '?' + query;
  }

  function createIframe(config) {
    var iframe = document.createElement('iframe');
    iframe.src = buildSrc(config);
    iframe.title = config.title;
    iframe.loading = 'lazy';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.height =
      (config.height === 'auto' ? PLACEHOLDER_HEIGHT : parseInt(config.height, 10) || PLACEHOLDER_HEIGHT) + 'px';
    // Only meaningful when the frame is transparent; harmless otherwise.
    iframe.style.background = 'transparent';
    iframe.allowTransparency = true;
    return iframe;
  }

  function readConfig(el) {
    var formId = attr(el, 'form', null);
    if (!formId) return null;

    var mode = attr(el, 'mode', 'inline');
    if (mode !== 'inline' && mode !== 'lightbox') mode = 'inline';

    return {
      el: el,
      formId: formId,
      mode: mode,
      height: attr(el, 'height', 'auto'),
      width: attr(el, 'width', '100%'),
      background: attr(el, 'bg', 'transparent') === 'white' ? 'white' : 'transparent',
      label: attr(el, 'label', 'Open form'),
      title: attr(el, 'title', 'Form'),
      closeOnSubmit: attr(el, 'close-on-submit', 'true') !== 'false',
      instanceId: nextInstanceId(),
    };
  }

  /* ---------------------------------------------------------------- inline */

  function mountInline(config) {
    var iframe = createIframe(config);
    config.el.style.width = config.width;
    config.el.style.maxWidth = '100%';
    config.el.appendChild(iframe);

    instances[config.instanceId] = {
      config: config,
      iframe: iframe,
      mode: 'inline',
      setHeight: function (height) {
        iframe.style.height = height + 'px';
      },
      close: function () {},
    };
  }

  /* -------------------------------------------------------------- lightbox */

  var FOCUSABLE =
    'a[href],button:not([disabled]),textarea,input,select,iframe,[tabindex]:not([tabindex="-1"])';

  function lockBodyScroll() {
    var scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    var previous = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    document.body.style.overflow = 'hidden';
    // Compensating for the scrollbar keeps the page behind from shifting
    // sideways as the overlay opens.
    if (scrollbarWidth > 0) {
      var current = parseInt(window.getComputedStyle(document.body).paddingRight, 10) || 0;
      document.body.style.paddingRight = current + scrollbarWidth + 'px';
    }
    return function restore() {
      document.body.style.overflow = previous.overflow;
      document.body.style.paddingRight = previous.paddingRight;
    };
  }

  function mountLightbox(config) {
    // A real <button>, not a styled div: it is focusable, activates on Enter
    // and Space, and announces itself correctly, all for free.
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = config.label;
    trigger.setAttribute('data-dculus-trigger', config.instanceId);
    trigger.style.cssText =
      'display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;' +
      'border:0;border-radius:8px;cursor:pointer;font:600 15px/1 inherit;font-family:inherit';
    config.el.appendChild(trigger);

    var record = {
      config: config,
      iframe: null,
      mode: 'lightbox',
      overlay: null,
      restoreScroll: null,
      setHeight: function (height) {
        if (!record.iframe) return;
        // Bounded by the viewport: an overlay taller than the screen would put
        // its own close button off-screen.
        var max = Math.floor(window.innerHeight * 0.9) - 16;
        record.iframe.style.height = Math.min(height, max) + 'px';
      },
      close: function () {
        if (!record.overlay) return;
        record.overlay.parentNode.removeChild(record.overlay);
        record.overlay = null;
        record.iframe = null;
        if (record.restoreScroll) record.restoreScroll();
        record.restoreScroll = null;
        document.removeEventListener('keydown', onKeydown, true);
        trigger.focus();
      },
    };

    function onKeydown(event) {
      if (!record.overlay) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        record.close();
        return;
      }
      if (event.key !== 'Tab') return;

      // Focus trap. The iframe is cross-origin, so its internals are opaque to
      // us: we can only keep Tab cycling between the panel's own focusables,
      // one of which is the iframe itself — inside which the browser handles
      // the sequence natively.
      var focusable = record.overlay.querySelectorAll(FOCUSABLE);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open() {
      if (record.overlay) return;

      var reducedMotion =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      var overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', config.title);
      overlay.style.cssText =
        'position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.6);' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        (reducedMotion ? '' : 'animation:dculus-fade .15s ease-out;');

      var panel = document.createElement('div');
      panel.style.cssText =
        'position:relative;width:100%;max-width:720px;max-height:90vh;overflow:hidden;' +
        'background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3)';

      var closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', 'Close');
      closeButton.innerHTML = '&times;';
      closeButton.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:1;width:32px;height:32px;' +
        'border:0;border-radius:16px;background:rgba(255,255,255,.9);color:#0f172a;' +
        'font:400 22px/1 system-ui,sans-serif;cursor:pointer';
      closeButton.addEventListener('click', record.close);

      // Created here rather than at page load: an embed nobody opens should
      // cost the visitor nothing.
      var iframe = createIframe(config);
      iframe.style.height = Math.min(PLACEHOLDER_HEIGHT, Math.floor(window.innerHeight * 0.9) - 16) + 'px';

      panel.appendChild(closeButton);
      panel.appendChild(iframe);
      overlay.appendChild(panel);

      overlay.addEventListener('mousedown', function (event) {
        // Only a click on the backdrop itself, so a drag that ends outside the
        // panel (selecting text, for instance) doesn't dismiss the form.
        if (event.target === overlay) record.close();
      });

      document.body.appendChild(overlay);
      record.overlay = overlay;
      record.iframe = iframe;
      record.restoreScroll = lockBodyScroll();
      document.addEventListener('keydown', onKeydown, true);
      closeButton.focus();
    }

    trigger.addEventListener('click', open);
    instances[config.instanceId] = record;
  }

  /* --------------------------------------------------------------- styling */

  function injectKeyframes() {
    if (document.getElementById('dculus-embed-style')) return;
    var style = document.createElement('style');
    style.id = 'dculus-embed-style';
    // Scoped to one animation name we own; nothing here selects host elements.
    style.textContent = '@keyframes dculus-fade{from{opacity:0}to{opacity:1}}';
    document.head.appendChild(style);
  }

  /* -------------------------------------------------------------- protocol */

  function onMessage(event) {
    if (event.origin !== VIEWER_ORIGIN) return;

    var data = event.data;
    if (!data || typeof data.type !== 'string' || data.v !== PROTOCOL_VERSION) return;

    var record = instances[data.instanceId];
    if (!record) return;
    // Origin alone is not enough — any frame from the viewer origin shares it.
    // This pins the message to the specific frame we created.
    if (!record.iframe || event.source !== record.iframe.contentWindow) return;

    switch (data.type) {
      case 'dculus:ready':
        record.iframe.contentWindow.postMessage(
          {
            type: 'dculus:host',
            v: PROTOCOL_VERSION,
            instanceId: data.instanceId,
            // Hostname only. The full URL's query string can carry PII and is
            // never sent.
            hostname: window.location.hostname,
            viewportWidth: window.innerWidth,
          },
          VIEWER_ORIGIN
        );
        break;

      case 'dculus:resize':
        if (typeof data.height === 'number' && data.height > 0) {
          record.setHeight(Math.ceil(data.height));
        }
        break;

      case 'dculus:scroll':
        // Only when the frame has actually scrolled out of view above — an
        // unconditional scrollIntoView yanks the page around for no reason.
        if (record.iframe.getBoundingClientRect().top < 0) {
          record.iframe.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;

      case 'dculus:submit':
        if (typeof window.dculusForms.onSubmit === 'function') {
          try {
            window.dculusForms.onSubmit(record.config.formId);
          } catch (e) {
            // A throwing host callback must not take the embed down with it.
            if (window.console && console.error) console.error(e);
          }
        }
        break;

      case 'dculus:closeself':
        record.close();
        break;

      default:
        break;
    }
  }

  /* ----------------------------------------------------------------- mount */

  function mountAll() {
    injectKeyframes();
    // Drop records whose container the host has since removed. `refresh()`
    // exists for SPA hosts that replace the container on a route change, and
    // the replacement carries no `data-dculus-mounted` marker — so without
    // this, every navigation would leave behind a record still holding a
    // detached iframe (and, for a lightbox, an overlay parented to <body>).
    for (var id in instances) {
      var stale = instances[id];
      if (document.contains(stale.config.el)) continue;
      if (stale.close) stale.close();
      delete instances[id];
    }

    var nodes = document.querySelectorAll('[data-dculus-form]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      // Idempotent per element, so refresh() on an SPA host re-scans without
      // duplicating anything already mounted.
      if (el.getAttribute('data-dculus-mounted') === 'true') continue;

      var config = readConfig(el);
      if (!config) continue;
      el.setAttribute('data-dculus-mounted', 'true');

      if (config.mode === 'lightbox') mountLightbox(config);
      else mountInline(config);
    }
  }

  window.dculusForms = window.dculusForms || {};
  /** Re-scan the DOM. For SPA hosts that inject the container after load. */
  window.dculusForms.refresh = mountAll;

  window.addEventListener('message', onMessage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }
})();
