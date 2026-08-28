import React, { useMemo, useState } from 'react';
import { Button } from '@dculus/ui';
import { Monitor, Smartphone, ExternalLink } from 'lucide-react';
import type { EmbedType } from '@dculus/types/embed.js';
import { useTranslation } from '../../hooks/useTranslation';
import type { ResolvedEmbedSettings } from '../../lib/embedSnippets';

export type PreviewDevice = 'desktop' | 'mobile';

/** Frame width used for the mobile preview — the narrowest phone worth designing for. */
const MOBILE_WIDTH_PX = 375;

interface EmbedPreviewProps {
  viewerOrigin: string;
  shortUrl: string;
  formTitle: string;
  settings: ResolvedEmbedSettings;
  type: EmbedType;
}

/**
 * "How it will look on your page."
 *
 * Renders the real `/embed/:shortUrl` route in a real iframe, so what the owner
 * sees is the same code path a visitor gets — not a mock-up that can drift.
 *
 * Options ride in the preview URL's query string rather than being saved
 * first, which is what makes switching width/height/background feel instant:
 * nothing round-trips.
 *
 * Link and button aren't framed at all, so they preview as themselves.
 */
export const EmbedPreview: React.FC<EmbedPreviewProps> = ({
  viewerOrigin,
  shortUrl,
  formTitle,
  settings,
  type,
}) => {
  const { t } = useTranslation('embed');
  const [device, setDevice] = useState<PreviewDevice>('desktop');

  const previewSrc = useMemo(() => {
    const params = new URLSearchParams({
      mode: type === 'lightbox' ? 'lightbox' : 'iframe',
      // The preview is not driven by embed.js, so it never gets resize
      // messages — it always needs an explicit height, including when the
      // owner picked "fit content".
      h: String(settings.heightPx),
      bg: settings.transparentBackground ? 'transparent' : 'white',
      // Keeps the owner's own preview out of their view analytics — and out of
      // their plan's view quota, which a FORM_VIEWED event would spend every
      // time this tab is opened.
      preview: '1',
    });
    return `${viewerOrigin}/embed/${shortUrl}?${params.toString()}`;
  }, [viewerOrigin, shortUrl, type, settings.heightPx, settings.transparentBackground]);

  const isFramed = type === 'iframe' || type === 'inline' || type === 'lightbox';

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('preview.label')}
        </p>
        {isFramed && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={device === 'desktop' ? 'secondary' : 'ghost'}
              onClick={() => setDevice('desktop')}
              aria-pressed={device === 'desktop'}
              aria-label={t('preview.desktop')}
              data-testid="embed-preview-desktop"
              className="h-7 px-2"
            >
              <Monitor className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={device === 'mobile' ? 'secondary' : 'ghost'}
              onClick={() => setDevice('mobile')}
              aria-pressed={device === 'mobile'}
              aria-label={t('preview.mobile')}
              data-testid="embed-preview-mobile"
              className="h-7 px-2"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* The hatched surround stands in for the host page, so the owner can see
          where their page ends and the form begins — the single most common
          question about a transparent embed. */}
      <div
        className="rounded-xl p-4 overflow-hidden"
        style={{
          border: '1px solid var(--tf-border-medium)',
          backgroundImage:
            'repeating-linear-gradient(45deg, var(--tf-overlay) 0 6px, transparent 6px 12px)',
        }}
        data-testid="embed-preview-surface"
      >
        {isFramed ? (
          <div
            className="mx-auto bg-white dark:bg-card rounded-lg overflow-hidden shadow-sm transition-all"
            style={{
              width: device === 'mobile' ? MOBILE_WIDTH_PX : '100%',
              maxWidth: '100%',
            }}
          >
            {/* Inert on purpose. This answers "how will it look", and an
                owner poking at a live form inside their own settings panel
                would file a real response against their own data. */}
            <iframe
              key={previewSrc + device}
              src={previewSrc}
              title={t('preview.frameTitle', { values: { title: formTitle } })}
              className="block w-full border-0"
              style={{ height: settings.heightPx, pointerEvents: 'none' }}
              tabIndex={-1}
              data-testid="embed-preview-frame"
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            {type === 'button' ? (
              // Rendered with the snippet's own inline styles, so this is what
              // the visitor actually sees, not a themed approximation.
              <span
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  background: '#0f172a',
                  color: '#fff',
                  borderRadius: 8,
                  font: '600 15px/1 system-ui, sans-serif',
                }}
                data-testid="embed-preview-button"
              >
                {settings.buttonLabel}
              </span>
            ) : (
              <a
                href={`${viewerOrigin}/f/${shortUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-mono text-foreground underline underline-offset-4"
                data-testid="embed-preview-link"
              >
                {`${viewerOrigin}/f/${shortUrl}`}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Every note here describes frame behaviour, so link and button — which
          have no frame — get none rather than a note about a frame that does
          not exist. Their card hint already says they open in a new tab. */}
      {isFramed && (
        <p className="text-xs text-muted-foreground">
          {type === 'lightbox'
            ? t('preview.noteLightbox')
            : settings.heightMode === 'auto' && type === 'inline'
              ? t('preview.noteAutoHeight')
              : t('preview.noteFixedHeight')}
        </p>
      )}
    </div>
  );
};

export default EmbedPreview;
