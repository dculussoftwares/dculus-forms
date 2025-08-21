import React from 'react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { LayoutCode } from '@dculus/types';
import { LayoutRenderer } from '@dculus/ui';
import { LayoutSidebar } from './layout/LayoutSidebar';
import { RendererMode } from '@dculus/utils';


export const LayoutTab: React.FC = () => {
  const { layout, updateLayout, isConnected, pages, formId } = useFormBuilderStore();
  const currentLayoutCode = layout?.code || 'L1';
  const cdnEndpoint = (import.meta as any).env?.VITE_CDN_ENDPOINT;

  const handleLayoutSelect = (layoutCode: LayoutCode) => {
    updateLayout({ code: layoutCode });
  };

  return (
    <div className="h-full flex">
      {/* Main Content Area - Layout Renderer */}
      <div className="flex-1 overflow-hidden">
        <LayoutRenderer 
          layoutCode={currentLayoutCode}
          pages={pages}
          layout={layout}
          className="h-full"
          onLayoutChange={updateLayout}
          cdnEndpoint={cdnEndpoint}
          mode={RendererMode.BUILDER}
        />
      </div>

      <LayoutSidebar
        layout={layout}
        currentLayoutCode={currentLayoutCode}
        isConnected={isConnected}
        formId={formId || ''}
        onLayoutSelect={handleLayoutSelect}
        onLayoutUpdate={updateLayout}
      />
    </div>
  );
};