/**
 * useBuilderSelectionUrlSync
 *
 * Two-way sync between the builder's `selection` store state and the
 * `?screen=intro|thankyou|page:<pageId>&field=<fieldId>` search params.
 *
 * The URL is the source of truth on mount/reload/back-forward: whenever the search
 * params change to something we didn't just write ourselves, decode them and push
 * into the store. Afterwards, every store selection change is encoded back into the
 * URL via a replace-state navigation, so deep links and reloads keep working without
 * growing the browser history.
 */
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { useFormBuilderStore } from '../store/useFormBuilderStore';
import type { Selection } from '../store/types/store.types';

const decodeSelection = (searchParams: URLSearchParams): Selection | null => {
  const screen = searchParams.get('screen');
  if (!screen) return null;

  if (screen === 'intro') return { kind: 'intro' };
  if (screen === 'thankyou') return { kind: 'thankYou' };

  if (screen.startsWith('page:')) {
    const pageId = screen.slice('page:'.length);
    if (!pageId) return null;
    const fieldId = searchParams.get('field');
    return fieldId ? { kind: 'field', pageId, fieldId } : { kind: 'page', pageId };
  }

  return null;
};

const encodeSelection = (selection: Selection): { screen: string; field?: string } | null => {
  switch (selection.kind) {
    case 'intro':
      return { screen: 'intro' };
    case 'thankYou':
      return { screen: 'thankyou' };
    case 'page':
      return selection.pageId ? { screen: `page:${selection.pageId}` } : null;
    case 'field':
      return selection.pageId
        ? { screen: `page:${selection.pageId}`, field: selection.fieldId }
        : null;
    default:
      return null;
  }
};

export function useBuilderSelectionUrlSync(): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const selection = useFormBuilderStore((state) => state.selection);
  const setSelection = useFormBuilderStore((state) => state.setSelection);
  // Only re-run the URL->store effect when pages go from empty to hydrated (initial
  // Y.js load), not on every field/page edit — subscribing to the `pages` array
  // itself would re-decode the (possibly stale, pre-navigation) URL on every
  // keystroke elsewhere in the document and could stomp a just-made selection.
  const hasPages = useFormBuilderStore((state) => state.pages.length > 0);

  // Tracks the query string we last wrote ourselves, so the URL->store effect can
  // tell "the user/browser changed the URL" apart from "we just changed it".
  const lastPushedRef = useRef<string | null>(null);

  // Set right after the URL->store effect calls setSelection, so the store->URL
  // effect below can skip its very next run. Without this, that run would still
  // see this render's *stale* closed-over `selection` (captured before the
  // setSelection call above — effects in one render don't observe each other's
  // state updates mid-flush) and push that stale value back onto the URL,
  // clobbering the one we just decoded from it. See #228.
  const suppressNextPushRef = useRef(false);

  // URL -> store
  useEffect(() => {
    const raw = searchParams.toString();
    if (lastPushedRef.current === raw) return;

    const decoded = decodeSelection(searchParams);
    if (!decoded) return;

    if (decoded.kind === 'page' || decoded.kind === 'field') {
      // Pages haven't hydrated from Y.js yet — wait for the next run rather than
      // rejecting a still-valid deep link.
      if (!hasPages) return;

      const pages = useFormBuilderStore.getState().pages;
      const page = pages.find((p) => p.id === decoded.pageId);
      if (!page) return; // stale/unknown page id — ignore, keep current selection

      if (decoded.kind === 'field' && !page.fields.some((f) => f.id === decoded.fieldId)) {
        suppressNextPushRef.current = true;
        setSelection({ kind: 'page', pageId: page.id });
        return;
      }
    }

    suppressNextPushRef.current = true;
    setSelection(decoded);
  }, [searchParams, hasPages, setSelection]);

  // store -> URL
  useEffect(() => {
    if (suppressNextPushRef.current) {
      // This selection change came from the URL->store effect above (same or an
      // earlier render) — the URL already reflects it, nothing to push back.
      suppressNextPushRef.current = false;
      return;
    }

    const encoded = encodeSelection(selection);
    if (!encoded) return;

    const next = new URLSearchParams(searchParams);
    let changed = false;

    if (next.get('screen') !== encoded.screen) {
      next.set('screen', encoded.screen);
      changed = true;
    }
    if (encoded.field) {
      if (next.get('field') !== encoded.field) {
        next.set('field', encoded.field);
        changed = true;
      }
    } else if (next.has('field')) {
      next.delete('field');
      changed = true;
    }

    if (!changed) return;
    lastPushedRef.current = next.toString();
    setSearchParams(next, { replace: true });
    // Intentionally omit searchParams/setSearchParams: this effect only reacts to
    // selection changes and reads the latest searchParams via closure — including
    // them here would refire this effect on every URL change we make ourselves.
  }, [selection]);
}
