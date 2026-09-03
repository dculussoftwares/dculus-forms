import React, { useRef } from 'react';
import { PageRenderer, type LayoutStyles } from '../../renderers/PageRenderer';
import { RendererMode } from '@dculus/utils';
import { DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';
import { useBackgroundVideo } from '../../hooks/useBackgroundVideo';
import { extractMentionFields } from '../../utils/mentionFields';
import { ThankYouScreen } from './ThankYouScreen';
import { LayoutProps, LayoutScreen } from '../../types';
import { layoutShell } from './embedShell';
import { buildOuterBackgroundStyle, SURFACE } from './surface';
import { IntroHero, type IntroDesktopVariant } from './IntroHero';
import { useIntroContentEditing } from './introContent';
import { LayoutScreenShell, BackToIntro } from './ScreenShell';
import { useResolvedColorScheme, spacingClasses, withSpacing, textColorStyle } from './theme';
import { useScrollReset } from './useScrollReset';

/**
 * The shared body of the seven intro layouts (L1–L5, L7, L8). Each of those
 * files is now just a call to this with its identity — layout code, desktop
 * `IntroHero` variant, default headline / CTA copy, and form-field styling.
 * Everything else (screen state, rich-text editing, background, theme +
 * spacing + textColor wiring, the pages and thank-you screens) is identical
 * and lives here once.
 */
export interface StandardIntroLayoutProps extends LayoutProps {
  layoutCode: string;
  variant: IntroDesktopVariant;
  defaultContent: string;
  defaultCtaLabel: string;
  /** Field styles before spacing is applied (spacing is layered on here). */
  fieldStyles: LayoutStyles;
}

export const StandardIntroLayout: React.FC<StandardIntroLayoutProps> = ({
  layoutCode,
  variant,
  defaultContent,
  defaultCtaLabel,
  fieldStyles,
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = React.useState<LayoutScreen>(
    () => screenOverride ?? (initialPageId ? 'pages' : 'intro')
  );
  React.useEffect(() => {
    setScreen(screenOverride ?? (initialPageId ? 'pages' : 'intro'));
  }, [screenOverride, initialPageId]);

  const scrollRef = useScrollReset<HTMLDivElement>(screen);
  const paneRef = useScrollReset<HTMLDivElement>(screen);
  const editing = useIntroContentEditing(layout, onLayoutChange, defaultContent);
  const { hasVideoBackground, videoUrl } = useBackgroundVideo(layout, cdnEndpoint);
  const scheme = useResolvedColorScheme(layout?.theme);
  const textStyle = textColorStyle(layout?.textColor, scheme);
  const spacing = spacingClasses(layout?.spacing);
  const shell = layoutShell(embedded);
  const outerBackgroundStyle = buildOuterBackgroundStyle({
    layout,
    cdnEndpoint,
    hasVideoBackground,
    layoutCode,
  });
  const layoutStyles = withSpacing(fieldStyles, layout?.spacing);

  return (
    <div
      ref={rootRef}
      className={`w-full ${shell.root} bg-white dark:bg-gray-900 flex flex-col ${className}`}
    >
      <div ref={scrollRef} className={shell.scroll}>
        {screen === 'intro' ? (
          <IntroHero
            containerRef={rootRef}
            variant={variant}
            layoutCode={layoutCode}
            layout={layout}
            cdnEndpoint={cdnEndpoint}
            mode={mode}
            hasVideoBackground={hasVideoBackground}
            videoUrl={videoUrl}
            outerBackgroundStyle={outerBackgroundStyle}
            textStyle={textStyle}
            editing={editing}
            ctaLabel={layout?.customCTAButtonName || defaultCtaLabel}
            onCta={() => setScreen('pages')}
            fixedClass={shell.introScreen}
            growClass={shell.introScreenGrow}
          />
        ) : screen === 'pages' ? (
          <LayoutScreenShell
            layout={layout}
            cdnEndpoint={cdnEndpoint}
            hasVideoBackground={hasVideoBackground}
            videoUrl={videoUrl}
            outerBackgroundStyle={outerBackgroundStyle}
            screenClass={shell.screen}
            paneClass={shell.screenPane}
            paddingY={spacing.screenPaddingY}
            paneRef={paneRef}
          >
            <div
              className={`max-w-2xl mx-auto bg-white dark:bg-gray-800 ${SURFACE.panel} ${spacing.cardPadding}`}
              style={textStyle}
            >
              <BackToIntro onClick={() => setScreen('intro')} />
              <PageRenderer
                pages={pages}
                layoutStyles={layoutStyles}
                mode={mode}
                initialPageId={initialPageId}
              />
            </div>
          </LayoutScreenShell>
        ) : (
          <LayoutScreenShell
            center
            layout={layout}
            cdnEndpoint={cdnEndpoint}
            hasVideoBackground={hasVideoBackground}
            videoUrl={videoUrl}
            outerBackgroundStyle={outerBackgroundStyle}
            screenClass={shell.screen}
            paneClass={shell.screenPane}
            paddingY={spacing.screenPaddingY}
            paneRef={paneRef}
          >
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
          </LayoutScreenShell>
        )}
      </div>
    </div>
  );
};
