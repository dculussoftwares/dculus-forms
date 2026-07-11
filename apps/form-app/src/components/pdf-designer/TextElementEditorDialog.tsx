import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@dculus/ui';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  displayLabel,
  uniqueSchemaName,
  type FormFieldEntry,
} from './fieldBinding';

export interface TextElementDraft {
  content: string;
  /** token → fieldId map stored on the element as dculusFieldVars */
  fieldVars: Record<string, string>;
}

interface TextElementEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: TextElementDraft | null;
  fields: FormFieldEntry[];
  onSave: (draft: TextElementDraft) => void;
}

/**
 * JotForm-style text editor for static text elements: comfortable multi-line
 * editing plus an "Insert field" picker that drops a readable {token} at the
 * caret. Tokens are slugs of the field label; the token → fieldId binding is
 * stored on the element (dculusFieldVars), so renaming the form field never
 * breaks the substitution. Per-element styling (font, size, color, align)
 * stays in the designer's right-hand panel — pdfme text has no inline mixed
 * formatting.
 */
export const TextElementEditorDialog: React.FC<TextElementEditorDialogProps> = ({
  open,
  onOpenChange,
  initial,
  fields,
  onSave,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState('');
  const [fieldVars, setFieldVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && initial) {
      setContent(initial.content);
      setFieldVars(initial.fieldVars);
    }
  }, [open, initial]);

  const insertField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    const textarea = textareaRef.current;
    if (!field || !textarea) return;

    // Reuse an existing token bound to this field, else mint a unique one
    let token = Object.keys(fieldVars).find((key) => fieldVars[key] === field.id);
    if (!token) {
      token = uniqueSchemaName(
        displayLabel(field.label, t('fieldsPanel.untitledField')),
        new Set(Object.keys(fieldVars))
      );
    }

    const caret = textarea.selectionStart ?? content.length;
    const next = `${content.slice(0, caret)}{${token}}${content.slice(
      textarea.selectionEnd ?? caret
    )}`;
    setContent(next);
    setFieldVars((vars) => ({ ...vars, [token!]: field.id }));

    const cursor = caret + token.length + 2;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSave = () => {
    // Drop bindings whose token no longer appears in the text
    const usedVars = Object.fromEntries(
      Object.entries(fieldVars).filter(([token]) => content.includes(`{${token}}`))
    );
    onSave({ content, fieldVars: usedVars });
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
          <Select value="" onValueChange={insertField}>
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
              {fields.map((field) => (
                <SelectItem key={field.id} value={field.id} className="text-xs">
                  {field.label.trim() || t('fieldsPanel.untitledField')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder={t('textEditor.placeholder')}
          data-testid="pdf-designer-text-content"
          className="w-full rounded-lg border border-[rgba(81,76,84,0.15)] dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-2.5 text-sm text-[#4c414e] dark:text-gray-200 font-mono leading-relaxed focus:outline-none focus:border-[rgba(81,76,84,0.35)] resize-y"
        />

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
