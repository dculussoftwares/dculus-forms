import React from 'react';
import DOMPurify from 'dompurify';
import { RichTextEditor } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface ThankYouPreviewProps {
  enabled: boolean;
  message: string;
}

/**
 * Static, submission-free preview of the Thank You screen shown to respondents.
 * Mirrors apps/form-viewer's ThankYouDisplay visually, but is driven directly by
 * saved settings.thankYou instead of a real SUBMIT_RESPONSE mutation result —
 * apps don't share components across bundles, so this is a builder-local twin.
 */
export const ThankYouPreview: React.FC<ThankYouPreviewProps> = ({ enabled, message }) => {
  const { t } = useTranslation('previewTab');

  const successIcon = (
    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
      <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );

  if (enabled && message) {
    const safeMessage = DOMPurify.sanitize(message);
    return (
      <div className="text-center p-4 sm:p-8 max-w-2xl mx-auto" data-testid="thank-you-preview">
        {successIcon}
        <div className="mb-6 prose prose-lg max-w-none mx-auto" data-testid="thank-you-preview-custom-message">
          <RichTextEditor
            value={safeMessage}
            editable={false}
            onChange={() => {}}
            className="border-none shadow-none"
            placeholder=""
          />
        </div>
      </div>
    );
  }

  return (
    <div className="text-center p-4 sm:p-8 max-w-md mx-auto" data-testid="thank-you-preview">
      {successIcon}
      <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="thank-you-preview-default-title">
        {t('finishPreview.defaultTitle')}
      </h1>
      <p className="text-muted-foreground mb-6" data-testid="thank-you-preview-default-message">
        {t('finishPreview.defaultMessage')}
      </p>
    </div>
  );
};
