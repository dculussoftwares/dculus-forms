import React, { useRef } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  MentionPlainTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  type MentionPlainTextEditorHandle,
  type MentionPlainTextValue,
} from '@dculus/ui';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { FormFieldEntry } from './fieldBinding';

/**
 * display → element content (labels inline, what the canvas shows),
 * template → dculusTextTemplate ({token} generation source),
 * fieldVars → dculusFieldVars (token → fieldId bindings).
 */
export type TextElementDraft = MentionPlainTextValue;

interface TextElementEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TextElementDraft | null;
  fields: FormFieldEntry[];
  onSave: (draft: TextElementDraft) => void;
}

/**
 * Text editor for static text elements — the same @-mention experience as
 * the thank-you page editor: type @ (or use the picker) and the field lands
 * as a labeled pill; pills serialize to readable {token} placeholders bound
 * via dculusFieldVars. Plain text only by design: pdfme text elements can't
 * render inline formatting, so styling stays per-element in the right panel.
 */
export const TextElementEditorDialog: React.FC<TextElementEditorDialogProps> = ({
  open,
  onOpenChange,
  initial,
  fields,
  onSave,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const editorRef = useRef<MentionPlainTextEditorHandle>(null);
  const draftRef = useRef<MentionPlainTextValue | null>(null);

  const mentionFields = fields.map((field) => ({
    fieldId: field.id,
    label: field.label.trim() || t('fieldsPanel.untitledField'),
  }));

  const handleSave = () => {
    const draft = draftRef.current ?? initial;
    if (draft) onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('textEditor.title')}</DialogTitle>
          <DialogDescription>{t('textEditor.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Select value="" onValueChange={(fieldId) => editorRef.current?.insertField(fieldId)}>
            <SelectTrigger
              className="w-72 h-8 text-xs"
              data-testid="pdf-designer-text-insert-field"
            >
              <span className="flex items-center gap-1.5 text-[#655d67] dark:text-gray-400">
                <Plus className="h-3 w-3" />
                {t('textEditor.insertField')}
              </span>
            </SelectTrigger>
            <SelectContent>
              {mentionFields.map((field) => (
                <SelectItem key={field.fieldId} value={field.fieldId} className="text-xs">
                  {field.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-muted-foreground">
            {t('textEditor.mentionHint')}
          </span>
        </div>

        {/* Keyed remount per open so the editor initializes from the element */}
        {open && initial && (
          <MentionPlainTextEditor
            ref={editorRef}
            initialValue={initial}
            mentionFields={mentionFields}
            onChange={(value) => {
              draftRef.current = value;
            }}
            placeholder={t('textEditor.placeholder')}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('textEditor.cancelButton')}
          </Button>
          <Button onClick={handleSave} data-testid="pdf-designer-text-save">
            {t('textEditor.saveButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
