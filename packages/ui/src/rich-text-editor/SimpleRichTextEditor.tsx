import React, { useState, useRef } from 'react';
import { cn } from '../utils';
import { Bold, Italic, List, Link } from 'lucide-react';
import { Button } from '../button';

interface SimpleRichTextEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  className,
  editable = true,
}) => {
  const [content, setContent] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = (e.target as HTMLTextAreaElement).value;
    setContent(newContent);
    onChange?.(newContent);
  };

  const insertFormat = (prefix: string, suffix?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      // Fallback: append if no textarea ref
      const newText = `${content}${prefix}text${suffix ?? ''}`;
      setContent(newText);
      onChange?.(newText);
      return;
    }
    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const selected = content.substring(start, end) || 'text';
    const newText =
      content.substring(0, start) +
      prefix +
      selected +
      (suffix ?? '') +
      content.substring(end);
    setContent(newText);
    onChange?.(newText);
    // Restore focus and move cursor after the inserted format
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + prefix.length + selected.length + (suffix?.length ?? 0);
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {editable && (
        <div className="border-b border-gray-200 p-2 bg-gray-50 flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => insertFormat('**', '**')}
            type="button"
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => insertFormat('*', '*')}
            type="button"
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => insertFormat('- ', '')}
            type="button"
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => insertFormat('[', '](url)')}
            type="button"
          >
            <Link className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full min-h-32 p-4 outline-none resize-y border-none"
          style={{ minHeight: '128px' }}
          value={content}
          onChange={handleChange}
          placeholder={placeholder}
          readOnly={!editable}
        />
      </div>
    </div>
  );
};