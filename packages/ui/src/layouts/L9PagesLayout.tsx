import React from 'react';
import { PageRenderer } from '../renderers/PageRenderer';
import { RendererMode } from '@dculus/utils';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo';
import { extractMentionFields } from '../utils/mentionFields';
import { ThankYouScreen } from './shared/ThankYouScreen';
import { LayoutProps } from '../types';
import { layoutShell } from './shared/embedShell';
import { buildOuterBackgroundStyle, SURFACE } from './shared/surface';
import { LayoutScreenShell } from './shared/ScreenShell';
import { useResolvedColorScheme, spacingClasses, withSpacing, textColorStyle } from './shared/theme';

/**
 * L9 "Direct" — no intro screen: the form pages render immediately on a card
 * over a soft background wash. The thank-you screen is its only alternate state.
 */
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
  gradeResult,
  quizResultLabels,
  resultLink,
  embedded,
}) => {
  const showThankYou = screenOverride === 'thankYou';
  const { hasVideoBackground, videoUrl } = useBackgroundVideo(layout, cdnEndpoint);
  const scheme = useResolvedColorScheme(layout?.theme);
  const textStyle = textColorStyle(layout?.textColor, scheme);
  const spacing = spacingClasses(layout?.spacing);
  const shell = layoutShell(embedded);
  const outerBackgroundStyle = buildOuterBackgroundStyle({
    layout,
    cdnEndpoint,
    hasVideoBackground,
    layoutCode: 'L9',
  });

  const layoutStyles = withSpacing(
    {
      field: {
        container: 'mb-6',
        label: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2',
        input:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
        textarea:
          'w-full h-24 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100',
        select:
          'w-full h-12 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 text-gray-900 dark:text-gray-100',
      },
      submitButton: 'w-full h-12 bg-primary rounded-lg flex items-center justify-center',
    },
    layout?.spacing
  );

  return (
    <div className={`w-full ${shell.root} bg-white dark:bg-gray-900 flex flex-col ${className}`}>
      <div className={shell.scroll}>
        <LayoutScreenShell
          layout={layout}
          cdnEndpoint={cdnEndpoint}
          hasVideoBackground={hasVideoBackground}
          videoUrl={videoUrl}
          outerBackgroundStyle={outerBackgroundStyle}
          screenClass={shell.screen}
          paneClass={shell.screenPane}
          paddingY={spacing.screenPaddingY}
          center={showThankYou}
        >
          {showThankYou ? (
            <div
              className={`max-w-2xl w-full mx-auto bg-white dark:bg-gray-800 ${SURFACE.panel}`}
              style={textStyle}
            >
              <ThankYouScreen
                content={thankYouMessage || layout?.thankYouContent || DEFAULT_THANK_YOU_CONTENT}
                mode={mode}
                onSave={(content) => onLayoutChange?.({ thankYouContent: content })}
                mentionFields={extractMentionFields(pages)}
                onSubmitAnother={onSubmitAnother}
                responseCopyNotice={responseCopyNotice}
                gradeResult={gradeResult}
                quizResultLabels={quizResultLabels}
                resultLink={resultLink}
              />
            </div>
          ) : (
            <div
              className={`max-w-2xl mx-auto bg-white dark:bg-gray-800 ${SURFACE.panel} ${spacing.cardPadding}`}
              style={textStyle}
            >
              <PageRenderer
                pages={pages}
                layoutStyles={layoutStyles}
                mode={mode}
                initialPageId={initialPageId}
              />
            </div>
          )}
        </LayoutScreenShell>
      </div>
    </div>
  );
};
