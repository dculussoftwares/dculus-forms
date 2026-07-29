import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_THANK_YOU_CONTENT, FormLayout, FormPage } from '@dculus/types';
import { Button, Label, RichTextEditor, ScrollArea } from '@dculus/ui';
import type { MentionFieldOption } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface EndingSettingsPanelProps {
  layout: FormLayout;
  pages: FormPage[];
  canEditLayout: boolean;
  onLayoutUpdate: (updates: Partial<FormLayout>) => void;
}

/** Same {fieldId, label} shape LexicalRichTextEditor's @-mention menu expects. */
const buildMentionFields = (pages: FormPage[]): MentionFieldOption[] => {
  const mentionFields: MentionFieldOption[] = [];
  for (const page of pages) {
    for (const field of page.fields || []) {
      const label = (field as { label?: unknown }).label;
      if (field?.id && typeof label === 'string' && label.length > 0) {
        mentionFields.push({ fieldId: field.id, label });
      }
    }
  }
  return mentionFields;
};

/**
 * EndingSettingsPanel — right-panel contents when the journey rail's Thank You
 * card is selected. Rich-text editing of `layout.thankYouContent` using the
 * same LexicalRichTextEditor + temp-state/save-cancel pattern the canvas's
 * inline ThankYouScreen editor uses. Header "Ending"; plain sections so
 * redirect/share toggles (out of scope here) can be added later without
 * restructuring. See docs/form-builder-redesign.md §2.3.
 */
export const EndingSettingsPanel: React.FC<EndingSettingsPanelProps> = ({
  layout,
  pages,
  canEditLayout,
  onLayoutUpdate,
}) => {
  const { t } = useTranslation('endingSettings');
  const content = layout.thankYouContent || DEFAULT_THANK_YOU_CONTENT;

  const [tempContent, setTempContent] = useState(content);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  // LexicalRichTextEditor fires onChange as part of its own mount-time HTML
  // round-trip (parse → nodes → re-serialize), which can differ textually from
  // the stored value even with no user input. Only trust onChange as a real
  // edit once the user has actually interacted with the editor surface —
  // otherwise simply selecting Ending would show a phantom Save/Cancel pair.
  const userInteractedRef = useRef(false);

  const mentionFields = useMemo(() => buildMentionFields(pages), [pages]);

  // Pick up collaborator edits (or the initial load) as long as this panel has
  // no pending local edit of its own — same guard ThankYouScreen uses.
  useEffect(() => {
    if (!hasUnsavedChanges) {
      setTempContent(content);
      setEditorKey((prev) => prev + 1);
      userInteractedRef.current = false;
    }
  }, [content, hasUnsavedChanges]);

  const handleChange = (next: string) => {
    setTempContent(next);
    if (userInteractedRef.current) {
      setHasUnsavedChanges(next !== content);
    }
  };

  const handleSave = () => {
    onLayoutUpdate({ thankYouContent: tempContent });
    setHasUnsavedChanges(false);
  };

  const handleCancel = () => {
    setTempContent(content);
    setHasUnsavedChanges(false);
    setEditorKey((prev) => prev + 1);
    userInteractedRef.current = false;
  };

  return (
    <ScrollArea className="flex-1" data-testid="ending-settings-panel">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-primary dark:text-white mb-1">
          {t('header.title')}
        </h3>
        <p className="text-xs text-muted-foreground dark:text-gray-400 mb-4">
          {canEditLayout ? t('header.editableDescription') : t('header.viewOnlyDescription')}
        </p>

        {/* Message section */}
        <div className="pb-4 border-b border-[var(--tf-border-medium)] dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 gap-2">
            <Label className="block text-sm font-medium text-foreground dark:text-gray-300">
              {t('message.label')}
            </Label>
            {canEditLayout && hasUnsavedChanges && (
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={handleSave} data-testid="ending-message-save">
                  {t('message.save')}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} data-testid="ending-message-cancel">
                  {t('message.cancel')}
                </Button>
              </div>
            )}
          </div>
          <div
            className="rounded-lg border border-[var(--tf-border-medium)] dark:border-gray-700 px-3 py-2"
            onKeyDownCapture={() => {
              userInteractedRef.current = true;
            }}
            onPointerDownCapture={() => {
              userInteractedRef.current = true;
            }}
          >
            <RichTextEditor
              key={`ending-editor-${editorKey}`}
              value={tempContent}
              onChange={handleChange}
              placeholder={t('message.placeholder')}
              editable={canEditLayout}
              mentionFields={mentionFields}
              className="border-none bg-transparent"
            />
          </div>
          <p className="text-xs text-muted-foreground dark:text-gray-400 mt-2">
            {t('message.helpText')}
          </p>
        </div>

        {/* Future home for redirect-after-submit / social-share toggles once those
            Ending features ship — intentionally not built here (out of scope for #229). */}
      </div>
    </ScrollArea>
  );
};

export default EndingSettingsPanel;
