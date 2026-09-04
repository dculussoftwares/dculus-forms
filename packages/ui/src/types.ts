import { FormPage, FormLayout, RespondentGradeView } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import type { QuizResultScreenLabels } from './renderers/QuizResultScreen';

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
  /**
   * Present only when the server graded this submission synchronously
   * (epic #289, D3) — renders `QuizResultScreen` in place of the normal
   * thank-you content. Absent for every non-quiz form/response, so existing
   * thank-you screens are byte-for-byte unaffected.
   */
  gradeResult?: RespondentGradeView;
  /** Override the default English `QuizResultScreen` copy (e.g. a translated app). */
  quizResultLabels?: Partial<QuizResultScreenLabels>;
  /**
   * Native Quiz (epic #289, Story 16/#320, D9) — present only when this is an
   * identity-gated quiz submission with a deferred grade release
   * ('afterReview'/'scheduled'), so the respondent has somewhere to come back
   * to. Absent for every other case, leaving existing thank-you screens
   * byte-for-byte unaffected.
   */
  resultLink?: {
    href: string;
    label: string;
    description?: string;
    copyLabel?: string;
    copiedLabel?: string;
    openLabel?: string;
  };
  /**
   * Form Embed v1 — render the content-height shell instead of the viewport
   * shell, so a host page's iframe can be sized from the content. Only
   * `/embed/:shortUrl` sets this; every other surface leaves it undefined and
   * gets today's `h-full` layout byte-for-byte.
   *
   * @see layouts/shared/embedShell.ts
   */
  embedded?: boolean;
}