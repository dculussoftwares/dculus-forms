import React, { useMemo, useState } from 'react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { type FormSchema, LayoutCode, FormLayout, DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { FormRenderer } from '@dculus/ui';
import type { LayoutScreen } from '@dculus/ui';
import { LayoutSidebar } from './layout/LayoutSidebar';
import { RendererMode, cn } from '@dculus/utils';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { getCdnEndpoint } from '../../../lib/config';
import { useTranslation } from '../../../hooks/useTranslation';

interface LayoutTabProps {
  onLayoutChange?: (updates: Partial<FormLayout>) => void;
}

const SCREEN_OPTIONS: LayoutScreen[] = ['intro', 'pages', 'thankYou'];

export const LayoutTab: React.FC<LayoutTabProps> = ({ onLayoutChange }) => {
  const { layout, updateLayout, isConnected, pages, formId } = useFormBuilderStore();
  const permissions = useFormPermissions();
  const currentLayoutCode = layout?.code || 'L1';
  const cdnEndpoint = getCdnEndpoint();
  const { t } = useTranslation('layoutSidebar');
  const [previewScreen, setPreviewScreen] = useState<LayoutScreen>('intro');

  const handleLayoutSelect = (layoutCode: LayoutCode) => {
    if (permissions.canEditLayout()) {
      updateLayout({ code: layoutCode });
    }
  };

  const handleLayoutChange = (updates: Partial<FormLayout>) => {
    if (!permissions.canEditLayout()) {
      return;
    }
    
    if (onLayoutChange) {
      onLayoutChange(updates);
    } else {
      updateLayout(updates);
    }
  };

  const formSchema: FormSchema = useMemo(
    () => ({
      pages: pages || [],
      layout: layout || {
        code: 'L1',
        theme: 'light' as const,
        textColor: '#1f2937',
        spacing: 'normal' as const,
        content: '<h1>Form Preview</h1>',
        thankYouContent: DEFAULT_THANK_YOU_CONTENT,
        customBackGroundColor: '',
        backgroundImageKey: '',
        pageMode: 'multipage' as const,
      },
      isShuffleEnabled: false,
    }),
    [pages, layout]
  );

  return (
    <div className="h-full flex">
      {/* Main Content Area - Form Renderer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Screen preview toggle - lets the builder jump straight to editing the
            intro, pages, or thank-you screen without clicking through the CTA. */}
        <div className="flex justify-center py-2 shrink-0 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--tf-border-strong)' }}
          >
            {SCREEN_OPTIONS.map((screen, index) => (
              <button
                key={screen}
                onClick={() => setPreviewScreen(screen)}
                data-testid={`layout-screen-toggle-${screen}`}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  index > 0 && 'border-l border-[var(--tf-border-strong)]',
                  previewScreen === screen
                    ? 'bg-[var(--tf-faint)] text-[var(--tf-dark)]'
                    : 'text-[var(--tf-muted)]'
                )}
              >
                {t(`screenToggle.${screen}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <FormRenderer
            formSchema={formSchema}
            className="h-full"
            cdnEndpoint={cdnEndpoint}
            mode={RendererMode.BUILDER}
            formId={formId || ''}
            onLayoutChange={handleLayoutChange}
            screenOverride={previewScreen}
          />
        </div>
      </div>

      <LayoutSidebar
        layout={layout}
        currentLayoutCode={currentLayoutCode}
        isConnected={isConnected}
        formId={formId || ''}
        onLayoutSelect={handleLayoutSelect}
        onLayoutUpdate={handleLayoutChange}
        canEditLayout={permissions.canEditLayout()}
      />
    </div>
  );
};