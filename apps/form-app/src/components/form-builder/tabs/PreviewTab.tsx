import React, { useMemo } from 'react';
import { useFormBuilderStore } from '@/store/useFormBuilderStore.ts';
import { FormRenderer } from '@dculus/ui';
import type { FormSchema } from '@dculus/types';
import { RendererMode } from '@dculus/utils';

interface PreviewTabProps {
  formId?: string;
}

export const PreviewTab: React.FC<PreviewTabProps> = () => {
  const { pages, layout } = useFormBuilderStore();
  const cdnEndpoint = (import.meta as any).env?.VITE_CDN_ENDPOINT;

  // Create form schema from current builder state
  const formSchema: FormSchema = useMemo(
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

  return (
    <div className="h-full">
      <FormRenderer
        formSchema={formSchema}
        cdnEndpoint={cdnEndpoint}
        className="preview-mode"
        mode={RendererMode.PREVIEW}
      />
    </div>
  );
};
