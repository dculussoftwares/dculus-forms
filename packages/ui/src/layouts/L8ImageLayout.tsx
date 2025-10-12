import React, { useState } from 'react';
import { FormPage, FormLayout } from '@dculus/types';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { LayoutProps } from '../types';

export const L8ImageLayout: React.FC<LayoutProps> = ({
  pages,
  layout,
  className = '',
  onLayoutChange: _onLayoutChange,
  cdnEndpoint,
  mode = RendererMode.PREVIEW
}) => {
  // L8 Image layout styles - using minimal/image-friendly styles
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
  const [showPages, setShowPages] = useState(false);



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
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!showPages ? (
          /* Intro Section - Full image showcase */
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
            
            {/* Background image container with padding */}
            <div className="h-full flex items-center justify-center relative z-10" style={{ padding: '5% 10%' }}>
              {/* Background image area with IMAGE CHUNK only - full width showcase */}
              <div className="w-full h-full relative rounded-lg overflow-hidden shadow-xl">
                {/* Default minimal gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100"></div>
                
                {/* Single chunk layout - IMAGE CHUNK only (100%) */}
                <div className="relative z-10 h-full flex">
                  {/* IMAGE CHUNK - Background image display area (100%) */}
                  <div className="w-full flex items-center justify-center relative">
                    {/* Background image showcase in full area */}
                    {layout?.backgroundImageKey && cdnEndpoint ? (
                      <div 
                        className="absolute inset-0 bg-center bg-no-repeat bg-cover"
                        style={{ backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})` }}
                      ></div>
                    ) : (
                      /* Default minimal gradient when no image */
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-gray-100 to-stone-100"></div>
                    )}
                    
                    {/* Custom CTA Button overlay positioned at bottom center */}
                    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
                      <button 
                        onClick={() => setShowPages(true)}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-light py-3 px-8 rounded-lg transition-colors shadow-lg tracking-wide"
                      >
                        {layout?.customCTAButtonName || 'Continue'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Pages Section - Full height without center background */
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
                {/* Back button */}
                <button
                  onClick={() => setShowPages(false)}
                  className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white mb-6 transition-colors font-light"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Intro
                </button>
                
                <h2 className="text-2xl font-light text-gray-900 dark:text-white mb-8 tracking-wide">
                  Form Pages
                </h2>
                
                <PageRenderer
                  pages={pages}
                  layoutStyles={getLayoutStyles()}
                  mode={mode}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};