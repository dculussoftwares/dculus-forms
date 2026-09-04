import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Check, Copy } from 'lucide-react';
import type { RespondentGradeView } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../../rich-text-editor/LexicalRichTextEditor';
import type { MentionFieldOption } from '../../utils/mentionFields';
import { QuizResultScreen, type QuizResultScreenLabels } from '../../renderers/QuizResultScreen';

export interface ThankYouScreenProps {
  /** Resolved (mention-substituted) message when available, else the raw layout.thankYouContent template. */
  content: string;
  mode: RendererMode;
  onSave?: (content: string) => void;
  mentionFields?: MentionFieldOption[];
  /** Present only after a real submission. */
  onSubmitAnother?: () => void;
  /** e.g. "We've sent a copy of your responses to you@example.com." */
  responseCopyNotice?: string;
  /**
   * Present only when the server graded this submission synchronously
   * (epic #289, D3). When set, `QuizResultScreen` renders in place of the
   * normal thank-you message — absent for every non-quiz response, leaving
   * this screen byte-for-byte unchanged.
   */
  gradeResult?: RespondentGradeView;
  quizResultLabels?: Partial<QuizResultScreenLabels>;
  /**
   * Native Quiz (epic #289, Story 16/#320, D9) — present only for an
   * identity-gated quiz submission with a deferred grade release
   * ('afterReview'/'scheduled'), so the respondent has somewhere to come
   * back to once the grade releases. Absent for every other case.
   *
   * `href` should be an absolute URL — it is shown verbatim in a copyable
   * field so the respondent can save it before leaving the page.
   */
  resultLink?: { href: string; label: string; description?: string };
}

const SuccessIcon: React.FC = () => (
  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  </div>
);

/**
 * Shared thank-you screen content rendered inside every layout's own background/video
 * wrapper. In BUILDER mode it's live-editable (same temp-state + save/cancel pattern
 * used for the intro screen's `layout.content`); otherwise it's a sanitized read-only
 * render of `content`.
 */
export const ThankYouScreen: React.FC<ThankYouScreenProps> = ({
  content,
  mode,
  onSave,
  mentionFields = [],
  onSubmitAnother,
  responseCopyNotice,
  gradeResult,
  quizResultLabels,
  resultLink,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempContent, setTempContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [resultLinkCopied, setResultLinkCopied] = useState(false);

  const handleCopyResultLink = async () => {
    if (!resultLink) return;
    try {
      await navigator.clipboard.writeText(resultLink.href);
      setResultLinkCopied(true);
      window.setTimeout(() => setResultLinkCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — the URL is
      // still visible and selectable in the field, so this is non-fatal.
    }
  };

  const handleContentChange = (next: string) => {
    setTempContent(next);
    setHasUnsavedChanges(next !== content);
  };

  const handleSave = () => {
    onSave?.(tempContent);
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setTempContent(content);
    setHasUnsavedChanges(false);
    setEditorKey((prev) => prev + 1);
  };

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(content);
      setEditorKey((prev) => prev + 1);
    }
  }, [content, hasUnsavedChanges]);

  const isBuilder = mode === RendererMode.BUILDER;

  return (
    <div className="text-center p-4 sm:p-8 max-w-2xl mx-auto" data-testid="thank-you-display">
      {gradeResult ? (
        <QuizResultScreen gradeResult={gradeResult} labels={quizResultLabels} className="mb-6" />
      ) : (
        <>
          <SuccessIcon />

          {isBuilder && (
            <div className="flex justify-between items-center mb-4 max-w-md mx-auto">
              <div className="flex gap-2">
                {isEditMode && hasUnsavedChanges && (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {isEditMode ? 'View Mode' : 'Edit Mode'}
              </button>
            </div>
          )}

          <div
            className="mb-6 prose prose-lg dark:prose-invert max-w-none mx-auto dark:[&_.editor-heading-h1]:text-white dark:[&_.editor-heading-h2]:text-gray-100 dark:[&_.editor-paragraph]:text-gray-300 dark:[&_p]:text-gray-300"
            data-testid="thank-you-message"
          >
            {isBuilder ? (
              <LexicalRichTextEditor
                key={`thank-you-editor-${editorKey}`}
                value={tempContent}
                onChange={handleContentChange}
                placeholder="Enter your thank-you message..."
                className="border-none bg-transparent"
                editable={isEditMode}
                mentionFields={mentionFields}
              />
            ) : (
              <LexicalRichTextEditor
                value={DOMPurify.sanitize(content)}
                editable={false}
                onChange={() => {}}
                className="border-none shadow-none"
                placeholder=""
              />
            )}
          </div>
        </>
      )}

      {/* Native Quiz (epic #289, Story 16/#320, D9): rendered regardless of
          whether `gradeResult` is present — e.g. under a D7 grading-failure
          fallback, the response still saves and the deferred link is still
          the respondent's only way back to a grade a reviewer finishes later. */}
      {resultLink && (
        <div
          className="mb-6 max-w-md mx-auto rounded-lg border border-border bg-muted/40 p-4 text-left"
          data-testid="thank-you-result-link"
        >
          <p className="text-sm font-semibold text-foreground">{resultLink.label}</p>
          {resultLink.description && (
            <p className="mt-1 text-xs text-muted-foreground">{resultLink.description}</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={resultLink.href}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={resultLink.label}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-muted-foreground"
              data-testid="thank-you-result-link-url"
            />
            <button
              type="button"
              onClick={handleCopyResultLink}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              data-testid="thank-you-result-link-copy"
            >
              {resultLinkCopied ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {resultLinkCopied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <a
            href={resultLink.href}
            className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
            data-testid="thank-you-result-link-open"
          >
            Open results page
          </a>
        </div>
      )}

      {responseCopyNotice && (
        <p className="text-sm text-muted-foreground mb-4" data-testid="thank-you-copy-notice">
          {responseCopyNotice}
        </p>
      )}

      {onSubmitAnother && (
        <button
          onClick={onSubmitAnother}
          data-testid="thank-you-submit-another-button"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 px-6 rounded-lg transition-colors shadow-md"
        >
          Submit another response
        </button>
      )}
    </div>
  );
};
