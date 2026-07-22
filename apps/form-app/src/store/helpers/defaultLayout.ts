import { FormLayout, ThemeType, SpacingType, LayoutCode, PageModeType, DEFAULT_THANK_YOU_CONTENT } from '@dculus/types';

/**
 * Single source of truth for the default form layout.
 * Imported by layoutSlice.ts and CollaborationManager.ts to ensure they stay in sync.
 */
export const DEFAULT_LAYOUT: FormLayout = {
  theme: ThemeType.LIGHT,
  textColor: '#1f2937',
  spacing: SpacingType.NORMAL,
  code: 'L1' as LayoutCode,
  content: '',
  thankYouContent: DEFAULT_THANK_YOU_CONTENT,
  customBackGroundColor: '#ffffff',
  customCTAButtonName: 'Get Started',
  backgroundImageKey: '',
  backgroundVideoKey: '',
  backgroundDominantColor: '',
  pageMode: PageModeType.MULTIPAGE,
  isCustomBackgroundColorEnabled: false,
};
