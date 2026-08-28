import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@apollo/client/react';
import FormViewer from './FormViewer';
import { GET_FORM_BY_SHORT_URL } from '../graphql/queries';
import {
  createEmbedBridge,
  readEmbedParams,
  seedEmbedAttribution,
  type EmbedBridge,
} from '../lib/embedBridge';

/**
 * `/embed/:shortUrl` — the form as it appears inside someone else's page.
 *
 * Deliberately thin. All the gating (published, access control, time window,
 * submission limits) already happens server-side in `formByShortUrl`, and
 * `FormViewer` already renders every one of those states. Only what is unique
 * to being framed belongs here:
 *
 * 1. the owner's embed opt-out,
 * 2. the shell background,
 * 3. the bridge that lets the host size the frame,
 * 4. the escape hatch for a form that has since become sign-in gated.
 *
 * This runs the same query as the `FormViewer` it renders, with the same
 * variables — Apollo serves the child from cache, so it costs one round trip.
 *
 * @see docs/form-embed-v1-spec.md §9
 */

interface EmbedCardProps {
  title: string;
  body: string;
  action?: { href: string; label: string };
  testId: string;
  contentRef: React.RefObject<HTMLDivElement>;
}

/** Every non-form state renders at the same compact height, so the host frame never lurches. */
const EmbedCard: React.FC<EmbedCardProps> = ({ title, body, action, testId, contentRef }) => (
  <div
    ref={contentRef}
    className="w-full min-h-[200px] flex items-center justify-center p-8"
    data-testid={testId}
  >
    <div className="text-center">
      <h1 className="text-lg font-semibold text-foreground mb-1">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background no-underline"
        >
          {action.label}
        </a>
      )}
    </div>
  </div>
);

const EmbedFormViewer: React.FC = () => {
  const { shortUrl } = useParams<{ shortUrl: string }>();
  const params = useMemo(() => readEmbedParams(window.location.search), []);
  const contentRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<EmbedBridge | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  const { data, loading } = useQuery(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl: shortUrl || '' },
    skip: !shortUrl,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = (data as any)?.formByShortUrl;
  const formId: string = form?.id ?? '';
  const embedDisabled = form?.settings?.embed?.enabled === false;
  // A form can acquire access control *after* its snippet was pasted somewhere.
  // Inside a frame that is a dead end — Google OAuth frame-busts and the
  // session cookie is `sameSite: 'lax'`, so it isn't sent cross-site — so the
  // respondent is sent to the hosted page instead of into a broken sign-in.
  const requiresSignIn =
    form?.accessStatus === 'SIGN_IN_REQUIRED' || form?.accessStatus === 'DOMAIN_REJECTED';
  const hostedUrl = `${window.location.origin}/f/${shortUrl ?? ''}`;

  const blocked = embedDisabled || requiresSignIn;

  // Seeded before FormViewer mounts, so the very first `trackFormView` is
  // already attributed rather than corrected afterwards.
  useLayoutEffect(() => {
    seedEmbedAttribution(params);
  }, [params]);

  // Painted on the document rather than a wrapper: the iframe's own backdrop
  // is what shows through around and outside the layout's content box.
  useLayoutEffect(() => {
    const previous = document.body.style.background;
    document.body.style.background = params.background === 'white' ? '#ffffff' : 'transparent';
    return () => {
      document.body.style.background = previous;
    };
  }, [params.background]);

  // The bridge is created even for the blocked states: the host still has to
  // be told how tall the explanatory card is, or it sits on the placeholder
  // height with a card floating in the middle of it.
  useEffect(() => {
    if (loading) return;

    const bridge = createEmbedBridge({
      params,
      formId: formId || (shortUrl ?? 'unknown'),
      instanceId: params.instanceId,
      getContentElement: () => contentRef.current,
    });
    bridgeRef.current = bridge;
    bridge.sendReady();
    setBridgeReady(true);

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [formId, loading, params, shortUrl]);

  // Covers the gap between `sendReady` and the form's first paint; the
  // ResizeObserver takes over from there.
  useEffect(() => {
    if (!bridgeReady) return;
    bridgeRef.current?.measureNow();
  }, [bridgeReady, blocked]);

  if (!loading && embedDisabled) {
    return (
      <EmbedCard
        contentRef={contentRef}
        testId="embed-disabled"
        title="This form isn't available for embedding"
        body="The form owner has turned off embedding for this form."
      />
    );
  }

  if (!loading && requiresSignIn) {
    return (
      <EmbedCard
        contentRef={contentRef}
        testId="embed-requires-sign-in"
        title="This form asks you to sign in"
        body="Signing in doesn't work inside an embedded frame. Open the form to continue."
        action={{ href: hostedUrl, label: 'Open the form' }}
      />
    );
  }

  return (
    <div ref={contentRef} className="w-full" data-testid="embed-form-viewer">
      <FormViewer
        embedded
        trackAnalytics={!params.isPreview}
        // The bridge also schedules the lightbox's delayed self-dismiss from
        // here, when the host asked for one (`close=1`).
        onSubmitted={() => bridgeRef.current?.sendSubmit()}
      />
    </div>
  );
};

export default EmbedFormViewer;
