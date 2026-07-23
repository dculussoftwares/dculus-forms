import React from 'react';
import { PageRenderer } from '../renderers/PageRenderer';
import { getImageUrl, RendererMode } from '@dculus/utils';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo';
import { extractMentionFields } from '../utils/mentionFields';
import { ThankYouScreen } from './shared/ThankYouScreen';
import { LayoutProps } from '../types';

export const L9PagesLayout: React.FC<LayoutProps> = ({
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
  // L9 has no intro screen — the thank-you screen is its only alternate state.
  const showThankYou = screenOverride === 'thankYou';
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



  const { hasVideoBackground, videoUrl } = useBackgroundVideo(layout, cdnEndpoint);

  // Create outer background - custom color when enabled, video/image next, otherwise gradient
  const outerBackgroundStyle = layout?.isCustomBackgroundColorEnabled && layout?.customBackGroundColor
    ? {
        backgroundColor: layout.customBackGroundColor,
        transition: 'background-color 0.5s ease-in-out'
      }
    : hasVideoBackground
    ? { transition: 'all 0.5s ease-in-out' }
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
          {/* Video background layer - fills the outer area, no blur (unlike images) */}
          {hasVideoBackground && !layout?.isCustomBackgroundColorEnabled && (
            <video
              key={videoUrl}
              autoPlay
              muted
              loop
              playsInline
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover"
              src={videoUrl}
            />
          )}

          {/* Minimal backdrop blur overlay on top of background image in outer area - only when not using custom color */}
          {!layout?.isCustomBackgroundColorEnabled && (hasVideoBackground || (layout?.backgroundImageKey && cdnEndpoint)) && (
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: hasVideoBackground ? undefined : 'blur(50px)',
                WebkitBackdropFilter: hasVideoBackground ? undefined : 'blur(50px)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                transition: 'background-color 0.5s ease-in-out'
              }}
            ></div>
          )}

          {/* Pages content with white background container */}
          <div className="h-full relative z-10 p-3 sm:p-8 overflow-y-auto">
            {showThankYou ? (
              <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <ThankYouScreen
                  content={thankYouMessage || layout?.thankYouContent || DEFAULT_THANK_YOU_CONTENT}
                  mode={mode}
                  onSave={(content) => onLayoutChange?.({ thankYouContent: content })}
                  mentionFields={extractMentionFields(pages)}
                  onSubmitAnother={onSubmitAnother}
                  responseCopyNotice={responseCopyNotice}
                />
              </div>
            ) : (
              <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-8">
                <PageRenderer
                  pages={pages}
                  layoutStyles={getLayoutStyles()}
                  mode={mode}
                  initialPageId={initialPageId}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};