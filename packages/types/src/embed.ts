/**
 * Form Embed v1 — the shape of `FormSettings.embed`, its defaults, and the
 * predicates that decide which embed types a given form may use.
 *
 * **This module imports nothing, deliberately.** `index.ts` re-exports it, but
 * several of index's own re-exports (`conditions`, `validation`,
 * `formHookUtils`) import back from index, and that cycle leaves the barrel
 * partially initialised under CommonJS test runners — a runtime constant read
 * through the barrel can come back `undefined`. Importing
 * `@dculus/types/embed.js` sidesteps the cycle entirely.
 *
 * @see docs/form-embed-v1-spec.md §10.1
 */

/**
 * The five ways a form can be put in front of respondents.
 * `link` and `button` are plain anchors; `iframe` is the no-JS embed;
 * `inline` and `lightbox` are driven by `embed.js`.
 *
 * @see docs/form-embed-v1-spec.md §1
 */
export type EmbedType = 'link' | 'button' | 'iframe' | 'inline' | 'lightbox';

export interface EmbedSettings {
  /** false = `/embed/:shortUrl` refuses to render. Absent is treated as true. */
  enabled?: boolean;
  /** Last type the owner configured — restores the panel on reopen. */
  type?: EmbedType;
  /** CSS width for the generated container, e.g. '100%' or '640px'. */
  width?: string;
  /**
   * 'auto' = the host sizes the frame from the content via the resize
   * protocol; 'fixed' = pin it to {@link EmbedSettings.heightPx}.
   *
   * The spec wrote this as a single `height: 'auto' | number`. GraphQL has no
   * union of scalars, so rather than smuggle a number through a String field,
   * it is two fields here — which is also the shape the panel's
   * "Fit content / Fixed [600] px" radio actually needs.
   */
  heightMode?: 'auto' | 'fixed';
  /** Frame height in px when `heightMode === 'fixed'`. Always set for `iframe`. */
  heightPx?: number;
  transparentBackground?: boolean;
  /** Trigger label for the `button` and `lightbox` types. */
  buttonLabel?: string;
  /** Lightbox only — dismiss the overlay a few seconds after submission. */
  closeOnSubmit?: boolean;
}

/**
 * Defaults for a form that has never had its embed configured. Applied when
 * reading, never written on creation — an absent `settings.embed` has to stay
 * byte-for-byte identical to today for every existing form.
 */
export const DEFAULT_EMBED_SETTINGS: Required<
  Pick<
    EmbedSettings,
    'enabled' | 'type' | 'width' | 'heightMode' | 'heightPx' | 'transparentBackground' | 'closeOnSubmit'
  >
> = {
  enabled: true,
  type: 'inline',
  width: '100%',
  heightMode: 'auto',
  /** Also the placeholder height `embed.js` uses before the first resize message. */
  heightPx: 600,
  transparentBackground: true,
  closeOnSubmit: true,
};

/**
 * Embed types that put the form inside a frame on someone else's page, as
 * opposed to sending the respondent to the hosted page.
 */
export const FRAMED_EMBED_TYPES: readonly EmbedType[] = ['iframe', 'inline', 'lightbox'];

export function isFramedEmbedType(type: EmbedType): boolean {
  return FRAMED_EMBED_TYPES.includes(type);
}

/**
 * v1 boundary: a form that makes respondents sign in cannot be framed.
 * Google OAuth frame-busts out of an iframe (form-viewer's `SignInGate` uses a
 * redirect) and `sameSite: 'lax'` session cookies aren't sent cross-site, so a
 * framed gated form is a dead end for the respondent. Link and button still
 * work, because they leave the host page.
 *
 * Takes booleans rather than the settings objects so this module can stay
 * import-free; the caller reads them off `FormSettings`. It is the same
 * condition `requiresRespondentIdentity` expresses in index.ts, negated.
 *
 * @see docs/form-embed-v1-spec.md §1 ("the one v1 boundary that needs stating")
 */
export function canFrameEmbed(
  accessControlEnabled: boolean | undefined | null,
  collectRespondentEmail: boolean | undefined | null
): boolean {
  return !accessControlEnabled && !collectRespondentEmail;
}

