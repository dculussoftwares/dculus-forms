import { FormPage, FormLayout } from '@dculus/types';
import { RendererMode } from '@dculus/utils';

export type LayoutScreen = 'intro' | 'pages' | 'thankYou';

export interface LayoutProps {
  pages: FormPage[];
  layout?: FormLayout;
  className?: string;
  onLayoutChange?: (updates: Partial<FormLayout>) => void;
  cdnEndpoint?: string;
  mode?: RendererMode;
  /** Page id to open on first render instead of the first page. Falls back to the first page if not found. */
  initialPageId?: string;
  /** Forces which screen the layout shows, overriding its own intro/pages toggle state. Used by the builder's screen preview toggle and by form-viewer to switch to the thank-you screen after a real submit. */
  screenOverride?: LayoutScreen;
  /** Resolved (mention-substituted) thank-you message. Falls back to `layout.thankYouContent` when absent, e.g. in BUILDER/PREVIEW modes. */
  thankYouMessage?: string;
  /** Present only after a real submission — renders the "Submit another response" action on the thank-you screen. */
  onSubmitAnother?: () => void;
  /** e.g. "We've sent a copy of your responses to you@example.com." shown under the thank-you message. */
  responseCopyNotice?: string;
}