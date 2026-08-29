import React from 'react';
import { RendererMode } from '@dculus/utils';
import type { FormLayout } from '@dculus/types';
import { LexicalRichTextEditor } from '../../rich-text-editor/LexicalRichTextEditor';
import { RICH_TEXT_DARK_FIX } from './theme';

/**
 * The intro screen's editable rich-text headline + the builder's edit / save /
 * cancel toolbar. Every intro layout carried its own byte-identical copy of
 * this temp-state dance; it now lives here once.
 */

export interface IntroContentEditing {
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  hasUnsavedChanges: boolean;
  tempContent: string;
  editorKey: number;
  handleContentChange: (content: string) => void;
  handleSave: () => void;
  handleCancel: () => void;
}

export function useIntroContentEditing(
  layout: FormLayout | undefined,
  onLayoutChange: ((updates: Partial<FormLayout>) => void) | undefined,
  defaultContent: string
): IntroContentEditing {
  const resolved = layout?.content || defaultContent;
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [tempContent, setTempContent] = React.useState(resolved);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [editorKey, setEditorKey] = React.useState(0);

  const handleContentChange = (content: string) => {
    setTempContent(content);
    setHasUnsavedChanges(content !== resolved);
  };

  const handleSave = () => {
    onLayoutChange?.({ content: tempContent });
    setHasUnsavedChanges(false);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setTempContent(resolved);
    setHasUnsavedChanges(false);
    setEditorKey((k) => k + 1);
  };

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(resolved);
      setEditorKey((k) => k + 1);
    }
  }, [resolved, hasUnsavedChanges]);

  return {
    isEditMode,
    setIsEditMode,
    hasUnsavedChanges,
    tempContent,
    editorKey,
    handleContentChange,
    handleSave,
    handleCancel,
  };
}

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

export const IntroEditToolbar: React.FC<{
  editing: IntroContentEditing;
  mode: RendererMode;
}> = ({ editing, mode }) => {
  if (mode !== RendererMode.BUILDER) return null;
  const { isEditMode, setIsEditMode, hasUnsavedChanges, handleSave, handleCancel } = editing;
  return (
    <div className="flex justify-end items-center gap-2 mb-4">
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
      <button
        onClick={() => setIsEditMode(!isEditMode)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
      >
        {isEditMode ? <EyeIcon /> : <PencilIcon />}
        {isEditMode ? 'View' : 'Edit'}
      </button>
    </div>
  );
};

/**
 * Heading scale-up scoped to the intro hero. The shared rich-text styles render
 * `h1` at a modest 16px, which is fine for a form field label but too quiet for
 * a cover headline — bump it here without touching the global editor CSS (which
 * the builder's field editors also use).
 */
const INTRO_TYPO =
  '[&_.editor-heading-h1]:text-[1.9rem] [&_.editor-heading-h1]:leading-tight [&_.editor-heading-h1]:font-bold [&_.editor-heading-h1]:tracking-tight ' +
  '[&_.editor-heading-h2]:text-xl [&_.editor-heading-h2]:font-semibold ' +
  '[&_p]:text-[0.95rem] [&_p]:leading-relaxed [&_p]:mt-2';

export const IntroEditor: React.FC<{
  editing: IntroContentEditing;
  mode: RendererMode;
  className?: string;
}> = ({ editing, mode, className = '' }) => (
  <LexicalRichTextEditor
    key={`editor-${editing.editorKey}`}
    value={editing.tempContent}
    onChange={editing.handleContentChange}
    placeholder="Enter your content..."
    className={`border-none bg-transparent ${INTRO_TYPO} ${RICH_TEXT_DARK_FIX} ${className}`}
    editable={mode === RendererMode.BUILDER ? editing.isEditMode : false}
  />
);

/** Themed intro call-to-action. Colour follows the app's `primary` token so it
 *  matches the in-form Submit button instead of a per-layout hardcode. */
export const IntroCta: React.FC<{
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ label, onClick, className = '' }) => (
  <button
    onClick={onClick}
    data-testid="viewer-cta-button"
    className={`inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 px-7 rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.99] ${className}`}
  >
    {label}
  </button>
);
