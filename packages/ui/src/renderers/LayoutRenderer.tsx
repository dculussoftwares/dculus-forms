import React from 'react';
import { LayoutCode } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { LayoutProps } from '../types';
import { L1ClassicLayout } from '../layouts/L1ClassicLayout';
import { L2ModernLayout } from '../layouts/L2ModernLayout';
import { L3CardLayout } from '../layouts/L3CardLayout';
import { L4MinimalLayout } from '../layouts/L4MinimalLayout';
import { L5SplitLayout } from '../layouts/L5SplitLayout';
import { L6WizardLayout } from '../layouts/L6WizardLayout';
import { L7SingleLayout } from '../layouts/L7SingleLayout';
import { L8ImageLayout } from '../layouts/L8ImageLayout';
import { L9PagesLayout } from '../layouts/L9PagesLayout';

interface LayoutRendererProps extends LayoutProps {
  layoutCode: LayoutCode;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  layoutCode,
  pages,
  layout,
  className = '',
  onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  const renderLayout = () => {
    switch (layoutCode) {
      case 'L1':
        return <L1ClassicLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L2':
        return <L2ModernLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L3':
        return <L3CardLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L4':
        return <L4MinimalLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L5':
        return <L5SplitLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L6':
        return <L6WizardLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L7':
        return <L7SingleLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L8':
        return <L8ImageLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      case 'L9':
        return <L9PagesLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
      default:
        return <L1ClassicLayout pages={pages} layout={layout} className={className} onLayoutChange={onLayoutChange} cdnEndpoint={cdnEndpoint} mode={mode} />;
    }
  };

  return (
    <div className="w-full h-full">
      {renderLayout()}
    </div>
  );
};