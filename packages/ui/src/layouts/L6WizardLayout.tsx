import React from 'react';
import { PageRenderer } from '../renderers/PageRenderer';
import { RendererMode } from '@dculus/utils';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo';
import { extractMentionFields } from '../utils/mentionFields';
import { ThankYouScreen } from './shared/ThankYouScreen';
import { LayoutProps } from '../types';
import { layoutShell } from './shared/embedShell';
import { buildOuterBackgroundStyle, BackgroundLayers, HeroMedia, SURFACE } from './shared/surface';
import { useIntroContentEditing, IntroEditToolbar, IntroEditor } from './shared/introContent';
import { useResolvedColorScheme, spacingClasses, withSpacing, textColorStyle } from './shared/theme';
import { useScrollReset } from './shared/useScrollReset';

/**
 * L6 "Steps" — no intro/pages toggle: a wide image banner, the headline, and
 * the form pages stack in one continuously-scrolling column. The thank-you
 * screen is its only alternate state.
 */
export const L6WizardLayout: React.FC<LayoutProps> = ({
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
  const scrollRef = useScrollReset<HTMLDivElement>(showThankYou);
  const paneRef = useScrollReset<HTMLDivElement>(showThankYou);
  const editing = useIntroContentEditing(
    layout,
    onLayoutChange,
    '<h1>Wizard Layout</h1><p>Step-by-step form experience with guided navigation and progress tracking.</p>'
  );
  const { hasVideoBackground, videoUrl } = useBackgroundVideo(layout, cdnEndpoint);
  const scheme = useResolvedColorScheme(layout?.theme);
  const textStyle = textColorStyle(layout?.textColor, scheme);
  const spacing = spacingClasses(layout?.spacing);
  const shell = layoutShell(embedded);
  const outerBackgroundStyle = buildOuterBackgroundStyle({
    layout,
    cdnEndpoint,
    hasVideoBackground,
    layoutCode: 'L6',
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
      <div ref={scrollRef} className={shell.scroll}>
        <div className={`${shell.screen} relative`} style={outerBackgroundStyle}>
          <BackgroundLayers
            layout={layout}
            cdnEndpoint={cdnEndpoint}
            hasVideoBackground={hasVideoBackground}
            videoUrl={videoUrl}
          />
          <div ref={paneRef} className={`${shell.screenPane} relative z-10 px-4 sm:px-8 ${spacing.screenPaddingY}`}>
            <div className={`w-full max-w-3xl mx-auto flex flex-col gap-4 sm:gap-6 ${shell.minHFull}`} style={textStyle}>
              {showThankYou ? (
                <div className={`bg-white dark:bg-gray-800 ${SURFACE.panel}`}>
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
                <>
                  <div className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden shadow-lg ring-1 ring-black/5">
                    <HeroMedia
                      layout={layout}
                      cdnEndpoint={cdnEndpoint}
                      hasVideoBackground={hasVideoBackground}
                      videoUrl={videoUrl}
                      layoutCode="L6"
                    />
                  </div>

                  <div className={`bg-white dark:bg-gray-800 ${SURFACE.panel} ${spacing.cardPadding}`}>
                    <IntroEditToolbar editing={editing} mode={mode} />
                    <div className="min-h-24">
                      <IntroEditor editing={editing} mode={mode} />
                    </div>
                  </div>

                  <div className={`bg-white dark:bg-gray-800 ${SURFACE.panel} ${spacing.cardPadding}`}>
                    <PageRenderer
                      pages={pages}
                      layoutStyles={layoutStyles}
                      className=""
                      showPageNavigation={true}
                      mode={mode}
                      initialPageId={initialPageId}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
