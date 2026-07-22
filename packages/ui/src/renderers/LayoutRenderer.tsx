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
  mode = RendererMode.PREVIEW,
  initialPageId,
  screenOverride,
  thankYouMessage,
  onSubmitAnother,
  responseCopyNotice,
}) => {
  const commonProps: LayoutProps = {
    pages,
    layout,
    className,
    onLayoutChange,
    cdnEndpoint,
    mode,
    initialPageId,
    screenOverride,
    thankYouMessage,
    onSubmitAnother,
    responseCopyNotice,
  };

  const renderLayout = () => {
    switch (layoutCode) {
      case 'L1':
        return <L1ClassicLayout {...commonProps} />;
      case 'L2':
        return <L2ModernLayout {...commonProps} />;
      case 'L3':
        return <L3CardLayout {...commonProps} />;
      case 'L4':
        return <L4MinimalLayout {...commonProps} />;
      case 'L5':
        return <L5SplitLayout {...commonProps} />;
      case 'L6':
        return <L6WizardLayout {...commonProps} />;
      case 'L7':
        return <L7SingleLayout {...commonProps} />;
      case 'L8':
        return <L8ImageLayout {...commonProps} />;
      case 'L9':
        return <L9PagesLayout {...commonProps} />;
      default:
        return <L1ClassicLayout {...commonProps} />;
    }
  };

  return (
    <div className="w-full h-full">
      {renderLayout()}
    </div>
  );
};
