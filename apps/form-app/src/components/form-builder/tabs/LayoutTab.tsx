import React, { useMemo } from 'react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { type FormSchema, LayoutCode, FormLayout } from '@dculus/types';
import { FormRenderer } from '@dculus/ui';
import { LayoutSidebar } from './layout/LayoutSidebar';
import { RendererMode } from '@dculus/utils';
import { useFormPermissions } from '../../../hooks/useFormPermissions';

interface LayoutTabProps {
  onLayoutChange?: (updates: Partial<FormLayout>) => void;
}

export const LayoutTab: React.FC<LayoutTabProps> = ({ onLayoutChange }) => {
  const { layout, updateLayout, isConnected, pages, formId } = useFormBuilderStore();
  const permissions = useFormPermissions();
  const currentLayoutCode = layout?.code || 'L1';
  const cdnEndpoint = (import.meta as any).env?.VITE_CDN_ENDPOINT;

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
      <div className="flex-1 overflow-hidden">
        <FormRenderer 
          formSchema={formSchema}
          className="h-full"
          cdnEndpoint={cdnEndpoint}
          mode={RendererMode.BUILDER}
          formId={formId || ''}
          onLayoutChange={handleLayoutChange}
        />
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