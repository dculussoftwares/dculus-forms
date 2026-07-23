import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { RendererMode } from '@dculus/utils';
import { LexicalRichTextEditor } from '../../rich-text-editor/LexicalRichTextEditor';
import type { MentionFieldOption } from '../../utils/mentionFields';

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
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempContent, setTempContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

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

      <div className="mb-6 prose prose-lg max-w-none mx-auto" data-testid="thank-you-message">
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

      {responseCopyNotice && (
        <p className="text-sm text-muted-foreground mb-4" data-testid="thank-you-copy-notice">
          {responseCopyNotice}
        </p>
      )}

      {onSubmitAnother && (
        <button
          onClick={onSubmitAnother}
          data-testid="thank-you-submit-another-button"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-md"
        >
          Submit another response
        </button>
      )}
    </div>
  );
};
