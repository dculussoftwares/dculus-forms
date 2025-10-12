import React from 'react';
import { FormPage, FormLayout } from '@dculus/types';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { LayoutProps } from '../types';

export const L9PagesLayout: React.FC<LayoutProps> = ({
  pages,
  layout,
  className = '',
  onLayoutChange: _onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  // L9 Pages layout styles - using modern page-focused styles
  const getLayoutStyles = () => ({
    field: {
      container: 'mb-6',
      label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
      input: 'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
      textarea: 'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100',
      select: 'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
    },
    submitButton: 'w-full h-12 bg-slate-800 rounded-lg flex items-center justify-center'
  });



  // Create outer background - custom color when enabled, otherwise background image with minimal blur
  const outerBackgroundStyle = layout?.isCustomBackgroundColorEnabled && layout?.customBackGroundColor
    ? {
        backgroundColor: layout.customBackGroundColor,
        transition: 'background-color 0.5s ease-in-out'
      }
    : layout?.backgroundImageKey && cdnEndpoint
    ? {
        backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'all 0.5s ease-in-out'
      }
    : { 
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)',
        transition: 'background 0.5s ease-in-out'
      };

  return (
    <div className={`w-full h-full bg-white dark:bg-gray-900 flex flex-col ${className}`}>
      {/* Content - Pages Only */}
      <div className="flex-1 overflow-y-auto">
        {/* Pages Section - Direct display without intro */}
        <div 
          className="h-full relative"
          style={outerBackgroundStyle}
        >
          {/* Minimal backdrop blur overlay on top of background image in outer area - only when not using custom color */}
          {!layout?.isCustomBackgroundColorEnabled && layout?.backgroundImageKey && cdnEndpoint && (
            <div 
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(50px)',
                WebkitBackdropFilter: 'blur(50px)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)'
              }}
            ></div>
          )}
          
          {/* Pages content with white background container */}
          <div className="h-full relative z-10 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-light text-gray-900 dark:text-white mb-8 tracking-wide">
                Form
              </h2>
              
              <PageRenderer
                pages={pages}
                layoutStyles={getLayoutStyles()}
                mode={mode}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};