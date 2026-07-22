import React, { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Monitor, Smartphone } from 'lucide-react';
import { useFormBuilderStore } from '@/store/useFormBuilderStore.ts';
import { FormRenderer, toastSuccess, toastError } from '@dculus/ui';
import type { FormSchema } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { getCdnEndpoint } from '../../../lib/config';
import { SUBMIT_RESPONSE } from '../../../graphql/mutations';
import { useTranslation } from '../../../hooks/useTranslation';

type PreviewMode = 'desktop' | 'mobile';
type PreviewStep = 'form' | 'finish';

interface PreviewTabProps {
  formId?: string;
}

/**
 * Scoped CSS overrides that force sm: breakpoint classes to behave as if the
 * viewport is narrow (<640px) inside the phone preview frame.
 *
 * Two rules do the heavy lifting for all 9 form layouts:
 *  1. sm:flex-row → column (stacks two-chunk intro splits vertically)
 *  2. sm:flex     → none   (keeps decorative image chunks hidden)
 *
 * Padding overrides prevent the pages-section card from using sm: padding
 * values (which would be enormous at 1280px browser viewport).
 */
const MOBILE_PREVIEW_CSS = `
  /* Stack horizontal two-chunk layouts vertically */
  .mobile-preview .sm\\:flex-row { flex-direction: column !important; }

  /* Keep hidden-on-mobile elements hidden (hidden sm:flex / hidden sm:block) */
  .mobile-preview .sm\\:flex   { display: none !important; }
  .mobile-preview .sm\\:block  { display: none !important; }
  .mobile-preview .sm\\:inline { display: none !important; }

  /* Pages-section outer wrapper: use compact padding */
  .mobile-preview .sm\\:p-8  { padding: 0.75rem !important; }

  /* L6 wizard intro padding */
  .mobile-preview .sm\\:px-\\[10\\%\\] { padding-left:  1rem !important; padding-right:  1rem !important; }
  .mobile-preview .sm\\:py-\\[5\\%\\]  { padding-top:   1rem !important; padding-bottom: 1rem !important; }

  /* Page-size selector: stay visible in preview context */
  .mobile-preview .sm\\:flex.hidden { display: none !important; }
`;

export const PreviewTab: React.FC<PreviewTabProps> = ({ formId }) => {
  const { t } = useTranslation('previewTab');
  const { pages, layout, conditions, selectedPageId } = useFormBuilderStore();
  const cdnEndpoint = getCdnEndpoint();
  const [submitCount, setSubmitCount] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');
  const [previewStep, setPreviewStep] = useState<PreviewStep>('form');

  const [submitResponse] = useMutation(SUBMIT_RESPONSE);

  const formSchema: FormSchema = React.useMemo(
    () => ({
      pages: pages || [],
      layout: layout || {
        code: 'L1',
        theme: 'light' as const,
        textColor: '#1f2937',
        spacing: 'normal' as const,
        content: '<h1>Form Preview</h1>',
        customBackGroundColor: '',
        backgroundImageKey: '',
        pageMode: 'single_page' as const,
      },
      isShuffleEnabled: false,
      ...(conditions.length > 0 ? { conditions } : {}),
    }),
    [pages, layout, conditions]
  );

  const handlePreviewSubmit = useCallback(
    async (_formId: string, data: Record<string, any>) => {
      if (!formId) return;
      try {
        const result = await submitResponse({
          variables: { input: { formId, data, isPreview: true } },
        });
        if (result.error) {
          toastError('Submission failed', result.error.message);
          return;
        }
        toastSuccess('Preview submitted', 'Response saved with a Preview tag');
        setSubmitCount((c) => c + 1);
      } catch (err: unknown) {
        toastError(
          'Submission failed',
          err instanceof Error ? err.message : 'An error occurred'
        );
      }
    },
    [formId, submitResponse]
  );

  const content = (
    <FormRenderer
      key={`${previewMode}-${submitCount}`}
      formSchema={formSchema}
      cdnEndpoint={cdnEndpoint}
      className="preview-mode"
      mode={RendererMode.PREVIEW}
      formId={formId}
      onFormSubmit={formId ? handlePreviewSubmit : undefined}
      initialPageId={selectedPageId ?? undefined}
      screenOverride={previewStep === 'finish' ? 'thankYou' : undefined}
    />
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── Step + viewport toggle bar ── */}
      <div
        className="flex justify-center items-center gap-4 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--tf-border-medium)' }}
      >
        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--tf-border-strong)' }}
        >
          <button
            onClick={() => setPreviewStep('form')}
            title={t('stepToggle.formTooltip')}
            data-testid="preview-step-form"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: previewStep === 'form' ? 'var(--tf-faint)' : 'transparent',
              color: previewStep === 'form' ? 'var(--tf-dark)' : 'var(--tf-muted)',
              borderRight: '1px solid var(--tf-border-strong)',
            }}
          >
            {t('stepToggle.form')}
          </button>
          <button
            onClick={() => setPreviewStep('finish')}
            title={t('stepToggle.finishTooltip')}
            data-testid="preview-step-finish"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: previewStep === 'finish' ? 'var(--tf-faint)' : 'transparent',
              color: previewStep === 'finish' ? 'var(--tf-dark)' : 'var(--tf-muted)',
            }}
          >
            {t('stepToggle.finish')}
          </button>
        </div>

        <div
          className="flex items-center rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--tf-border-strong)' }}
        >
          <button
            onClick={() => setPreviewMode('desktop')}
            title="Desktop preview"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: previewMode === 'desktop' ? 'var(--tf-faint)' : 'transparent',
              color: previewMode === 'desktop' ? 'var(--tf-dark)' : 'var(--tf-muted)',
              borderRight: '1px solid var(--tf-border-strong)',
            }}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            onClick={() => setPreviewMode('mobile')}
            title="Mobile preview"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: previewMode === 'mobile' ? 'var(--tf-faint)' : 'transparent',
              color: previewMode === 'mobile' ? 'var(--tf-dark)' : 'var(--tf-muted)',
            }}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
      </div>

      {/* ── Preview area ── */}
      {previewMode === 'desktop' ? (
        <div className={`flex-1 ${previewStep === 'finish' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {content}
        </div>
      ) : (
        /* Mobile: scrollable panel with centered phone frame */
        <div
          className="flex-1 overflow-y-auto flex flex-col items-center py-8 px-4"
          style={{ background: 'var(--tf-faint)' }}
        >
          {/* Scoped CSS overrides — simulate narrow viewport inside the phone */}
          <style dangerouslySetInnerHTML={{ __html: MOBILE_PREVIEW_CSS }} />

          {/* Phone outer shell */}
          <div
            className="relative shrink-0 rounded-[44px] shadow-2xl overflow-hidden"
            style={{
              width: 390,
              height: 780,
              border: '10px solid #1c1c1e',
              background: '#1c1c1e',
            }}
          >
            {/* Notch */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 z-10 rounded-b-2xl"
              style={{ width: 90, height: 22, background: '#1c1c1e' }}
            />
            {/* Screen — scoped overrides applied via .mobile-preview wrapper */}
            <div className="mobile-preview w-full h-full overflow-y-auto bg-white">
              {content}
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">390 × 780 · iPhone 14</p>
        </div>
      )}
    </div>
  );
};
