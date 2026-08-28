import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button, toastError } from '@dculus/ui';
import { Download } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Rendered size. Large enough that the downloaded PNG survives being put on a
 * poster, small enough to preview inside the panel (it is scaled down in CSS).
 */
const QR_SIZE_PX = 512;

/** On-screen size inside the panel. The download keeps the full QR_SIZE_PX bitmap. */
const DISPLAY_SIZE_PX = 192;

interface QrTabProps {
  /** The hosted form URL — the same one the Link tab copies. */
  formUrl: string;
  formTitle: string;
}

/**
 * The form's link as a scannable code, downloadable as a PNG.
 *
 * Drawn to a canvas rather than fetched as a data URL so the download is the
 * exact pixels on screen, and so nothing leaves the browser.
 */
export const QrTab: React.FC<QrTabProps> = ({ formUrl, formTitle }) => {
  const { t } = useTranslation('embed');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    QRCode.toCanvas(canvas, formUrl, {
      width: QR_SIZE_PX,
      // A quiet zone below 2 modules makes codes unreliable for some scanners.
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(() => {
        if (cancelled) return;
        // qrcode writes its own inline width/height onto the canvas, and an
        // inline style beats a class — so the displayed size has to be
        // re-asserted here. The backing bitmap stays at QR_SIZE_PX, which is
        // what the PNG download uses.
        canvas.style.width = `${DISPLAY_SIZE_PX}px`;
        canvas.style.height = `${DISPLAY_SIZE_PX}px`;
        setError(false);
      })
      .catch((err) => {
        console.error('Failed to render QR code', err);
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [formUrl]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      // Slugified title, so a folder of downloads is still navigable.
      const slug =
        formTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 40) || 'form';
      link.download = `${slug}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download QR code', err);
      toastError(t('qr.downloadFailed'));
    }
  };

  return (
    <div className="space-y-4" data-testid="qr-tab">
      <div className="flex justify-center">
        <div
          className="rounded-xl bg-white p-4"
          style={{ border: '1px solid var(--tf-border-medium)' }}
        >
          <canvas
            ref={canvasRef}
            className="block"
            aria-label={t('qr.alt', { values: { title: formTitle } })}
            data-testid="qr-canvas"
          />
        </div>
      </div>

      {error ? (
        <p className="text-center text-xs text-destructive">{t('qr.renderFailed')}</p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">{t('qr.help')}</p>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={handleDownload} disabled={error} data-testid="qr-download">
          <Download className="mr-2 h-4 w-4" />
          {t('qr.download')}
        </Button>
      </div>
    </div>
  );
};

export default QrTab;
