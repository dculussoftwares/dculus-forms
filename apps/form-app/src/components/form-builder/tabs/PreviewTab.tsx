import React, { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { Monitor, Smartphone } from 'lucide-react';
import { useFormBuilderStore } from '@/store/useFormBuilderStore.ts';
import { FormRenderer, toastSuccess, toastError } from '@dculus/ui';
import type { FormSchema } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { getCdnEndpoint, getFormViewerUrl } from '../../../lib/config';
import { SUBMIT_RESPONSE } from '../../../graphql/mutations';

type PreviewMode = 'desktop' | 'mobile';

interface PreviewTabProps {
  formId?: string;
  shortUrl?: string;
}

export const PreviewTab: React.FC<PreviewTabProps> = ({ formId, shortUrl }) => {
  const { pages, layout } = useFormBuilderStore();
  const cdnEndpoint = getCdnEndpoint();
  const [submitCount, setSubmitCount] = useState(0);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('desktop');

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
    }),
    [pages, layout]
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

  const mobileUrl = shortUrl ? getFormViewerUrl(shortUrl) : null;

  return (
    <div className="flex flex-col h-full">
      {/* ── Viewport toggle bar ── */}
      <div className="flex justify-center items-center py-2.5 shrink-0 border-b border-[var(--tf-border-medium)]">
        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--tf-border-strong)' }}>
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
        <div className="flex-1 overflow-hidden">
          <FormRenderer
            key={`desktop-${submitCount}`}
            formSchema={formSchema}
            cdnEndpoint={cdnEndpoint}
            className="preview-mode"
            mode={RendererMode.PREVIEW}
            formId={formId}
            onFormSubmit={formId ? handlePreviewSubmit : undefined}
          />
        </div>
      ) : (
        /* Mobile: centered phone frame panel */
        <div
          className="flex-1 overflow-y-auto flex flex-col items-center py-8 px-4"
          style={{ background: 'var(--tf-faint)' }}
        >
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

            {/* Screen */}
            {mobileUrl ? (
              /* iframe gives the form its own 390px viewport — media queries fire correctly */
              <iframe
                key={mobileUrl}
                src={mobileUrl}
                title="Mobile preview"
                className="w-full h-full border-0 bg-white"
                style={{ display: 'block' }}
              />
            ) : (
              /* Fallback when form has no shortUrl yet (unsaved / draft) */
              <div className="w-full h-full overflow-y-auto bg-white">
                <FormRenderer
                  key={`mobile-${submitCount}`}
                  formSchema={formSchema}
                  cdnEndpoint={cdnEndpoint}
                  className="preview-mode"
                  mode={RendererMode.PREVIEW}
                  formId={formId}
                  onFormSubmit={formId ? handlePreviewSubmit : undefined}
                />
              </div>
            )}
          </div>

          {/* Label */}
          <p className="mt-4 text-xs text-muted-foreground">390 × 780 · iPhone 14</p>
        </div>
      )}
    </div>
  );
};
