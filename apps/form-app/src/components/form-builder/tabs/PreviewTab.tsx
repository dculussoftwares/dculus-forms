import React, { useCallback, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useFormBuilderStore } from '@/store/useFormBuilderStore.ts';
import { FormRenderer, toastSuccess, toastError } from '@dculus/ui';
import type { FormSchema } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { getCdnEndpoint } from '../../../lib/config';
import { SUBMIT_RESPONSE } from '../../../graphql/mutations';

interface PreviewTabProps {
  formId?: string;
}

export const PreviewTab: React.FC<PreviewTabProps> = ({ formId }) => {
  const { pages, layout } = useFormBuilderStore();
  const cdnEndpoint = getCdnEndpoint();
  const [submitCount, setSubmitCount] = useState(0);

  const [submitResponse] = useMutation<any, any>(SUBMIT_RESPONSE);

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
        await submitResponse({
          variables: { input: { formId, data, isPreview: true } },
        });
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

  return (
    <div className="h-full">
      <FormRenderer
        key={submitCount}
        formSchema={formSchema}
        cdnEndpoint={cdnEndpoint}
        className="preview-mode"
        mode={RendererMode.PREVIEW}
        formId={formId}
        onFormSubmit={formId ? handlePreviewSubmit : undefined}
      />
    </div>
  );
};
