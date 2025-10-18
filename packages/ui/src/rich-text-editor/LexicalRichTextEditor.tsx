import React, { useEffect, useState, useMemo } from 'react';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ToolbarPlugin } from './ToolbarPlugin';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $generateNodesFromDOM } from '@lexical/html';
import { $getRoot, $insertNodes, type EditorState } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListItemNode, ListNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { 
  BeautifulMentionsPlugin, 
  BeautifulMentionNode, 
  type BeautifulMentionsItem, 
  type BeautifulMentionsMenuItemProps,
  type BeautifulMentionComponentProps,
  createBeautifulMentionNode
} from 'lexical-beautiful-mentions';
import { forwardRef } from 'react';
import { cn } from '../utils';

const theme = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'editor-placeholder',
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
    h4: 'editor-heading-h4',
    h5: 'editor-heading-h5',
    h6: 'editor-heading-h6',
  },
  list: {
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
    listitem: 'editor-listitem',
  },
  image: 'editor-image',
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    overflowed: 'editor-text-overflowed',
    hashtag: 'editor-text-hashtag',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    underlineStrikethrough: 'editor-text-underlineStrikethrough',
    code: 'editor-text-code',
  },
  code: 'editor-code',
  codeHighlight: {
    atrule: 'editor-tokenAttr',
    attr: 'editor-tokenAttr',
    boolean: 'editor-tokenProperty',
    builtin: 'editor-tokenSelector',
    cdata: 'editor-tokenComment',
    char: 'editor-tokenSelector',
    class: 'editor-tokenFunction',
    'class-name': 'editor-tokenFunction',
    comment: 'editor-tokenComment',
    constant: 'editor-tokenProperty',
    deleted: 'editor-tokenProperty',
    doctype: 'editor-tokenComment',
    entity: 'editor-tokenOperator',
    function: 'editor-tokenFunction',
    important: 'editor-tokenVariable',
    inserted: 'editor-tokenSelector',
    keyword: 'editor-tokenAttr',
    namespace: 'editor-tokenVariable',
    number: 'editor-tokenProperty',
    operator: 'editor-tokenOperator',
    prolog: 'editor-tokenComment',
    property: 'editor-tokenProperty',
    punctuation: 'editor-tokenPunctuation',
    regex: 'editor-tokenVariable',
    selector: 'editor-tokenSelector',
    string: 'editor-tokenSelector',
    symbol: 'editor-tokenProperty',
    tag: 'editor-tokenProperty',
    url: 'editor-tokenOperator',
    variable: 'editor-tokenVariable',
  },
  beautifulMentions: {
    '@': 'editor-mention bg-blue-100 text-blue-800 px-2 py-1 rounded-md border border-blue-200 mx-1 inline-block',
  },
  beautifulMentionsMenu: 'bg-white border border-gray-200 rounded-lg shadow-lg py-2 max-h-48 overflow-y-auto z-50',
  beautifulMentionsMenuItem: 'px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer transition-colors duration-150',
  beautifulMentionsMenuItemFocused: 'bg-blue-50 text-blue-900',
};


function OnChangeHandler({ onChange }: { onChange?: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();

  return (
    <OnChangePlugin
      onChange={(editorState: EditorState) => {
        editorState.read(() => {
          const htmlString = $generateHtmlFromNodes(editor, null);
          onChange?.(htmlString);
        });
      }}
    />
  );
}

function InitialContentPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  const [lastLoadedValue, setLastLoadedValue] = useState<string>('');
  const [isInternalUpdate, setIsInternalUpdate] = useState(false);

  useEffect(() => {
    // Skip update if this is caused by internal editor changes
    if (isInternalUpdate) {
      setIsInternalUpdate(false);
      return;
    }

    // Only sync if the value prop is different from what we last loaded
    // AND different from current editor content
    if (value !== lastLoadedValue) {
      editor.update(() => {
        const currentHtml = $generateHtmlFromNodes(editor, null);
        
        // Only update if the external value is actually different from current content
        if (currentHtml !== value) {
          // Handle empty or default values
          if (!value || value === '<p></p>' || value === '<p class="editor-paragraph"><br></p>') {
            $getRoot().clear();
            $getRoot().append($generateNodesFromDOM(editor, new DOMParser().parseFromString('<p></p>', 'text/html'))[0]);
          } else {
            // Load new content only if it's truly different
            const parser = new DOMParser();
            const dom = parser.parseFromString(value, 'text/html');
            const nodes = $generateNodesFromDOM(editor, dom);
            $getRoot().clear();
            $insertNodes(nodes);
          }
        }
      });
      setLastLoadedValue(value);
    }
  }, [editor, value, lastLoadedValue, isInternalUpdate]);

  // Register listener to detect internal changes
  useEffect(() => {
    return editor.registerUpdateListener(() => {
      setIsInternalUpdate(true);
    });
  }, [editor]);

  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);

  return null;
}

const onError = (error: Error) => {
  console.error(error);
};

interface MentionField {
  fieldId: string;
  label: string;
}

// Custom menu item component that shows the label instead of field ID
const CustomMentionMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  ({ selected, item: { value, data }, ...props }, ref) => {
    // Access label from nested data object
    const displayText = (data as any)?.data?.label || (data as any)?.label || value;
    
    return (
      <li
        {...props}
        ref={ref}
        className={`mention-menu-item ${selected ? 'selected' : ''}`}
      >
        <span className="mention-prefix">@</span>
        {displayText}
      </li>
    );
  }
);

CustomMentionMenuItem.displayName = 'CustomMentionMenuItem';

// Custom mention component that displays labels in the editor but stores field IDs
const CustomMentionComponent = forwardRef<HTMLSpanElement, BeautifulMentionComponentProps>(
  ({ value, data, trigger, ...props }, ref) => {
    // Display the label to users, but the value (field ID) is still stored
    const displayText = (data as any)?.data?.label || (data as any)?.label || value;
    
    return (
      <span
        {...props}
        ref={ref}
        className="editor-mention bg-blue-100 text-blue-800 px-2 py-1 rounded-md border border-blue-200 mx-1 inline-block"
        data-field-id={value} // Store the field ID in a data attribute
      >
        {trigger}{displayText}
      </span>
    );
  }
);

CustomMentionComponent.displayName = 'CustomMentionComponent';

interface LexicalRichTextEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
  mentionFields?: MentionField[];
}

export const LexicalRichTextEditor: React.FC<LexicalRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  className,
  editable = true,
  mentionFields = [],
}) => {
  const mentionItems = useMemo((): Record<string, BeautifulMentionsItem[]> => {
    if (mentionFields.length === 0) return {};
    
    return {
      '@': mentionFields.map((field) => ({
        value: field.fieldId, // This gets saved to HTML as the mention value
        data: {
          label: field.label, // This gets displayed to users  
          fieldId: field.fieldId, // Additional property for access
        }
      } as unknown as BeautifulMentionsItem)),
    };
  }, [mentionFields]);

  const initialConfig = {
    namespace: 'LayoutEditor',
    theme,
    onError,
    editable,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
      AutoLinkNode,
      ...createBeautifulMentionNode(CustomMentionComponent),
    ],
  };


  return (
    <div className={cn('border border-gray-200 rounded-lg relative mention-editor-container', className)} style={{ overflow: 'visible' }}>
      <LexicalComposer initialConfig={initialConfig}>
        {editable && <ToolbarPlugin />}
        <div className="relative" style={{ overflow: 'visible' }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="editor-input min-h-32 p-4 outline-none resize-y"
                style={{ minHeight: '128px' }}
              />
            }
            placeholder={
              <div className="editor-placeholder absolute top-4 left-4 text-gray-400 pointer-events-none">
                {placeholder}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <InitialContentPlugin value={value} />
        <OnChangeHandler onChange={onChange} />
        <EditablePlugin editable={editable} />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <ListPlugin />
        <LinkPlugin />
        {editable && mentionFields.length > 0 && (
          <>
            <style>{`
              .beautiful-mentions-menu {
                background: white !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 8px !important;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                padding: 4px 0 !important;
                max-height: 200px !important;
                overflow-y: auto !important;
                z-index: 9999 !important;
                min-width: 220px !important;
                backdrop-filter: blur(8px) !important;
                animation: fadeInUp 0.15s ease-out !important;
                position: fixed !important;
              }
              
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(4px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .beautiful-mentions-menu-item {
                padding: 10px 14px !important;
                font-size: 14px !important;
                color: #374151 !important;
                cursor: pointer !important;
                transition: all 0.12s ease-in-out !important;
                display: flex !important;
                align-items: center !important;
                border: none !important;
                background: transparent !important;
                width: 100% !important;
                text-align: left !important;
                position: relative !important;
                line-height: 1.4 !important;
              }
              
              .beautiful-mentions-menu-item .mention-prefix,
              .beautiful-mentions-menu-item::before {
                content: '@' !important;
                font-weight: 600 !important;
                color: #6b7280 !important;
                margin-right: 8px !important;
                font-size: 14px !important;
                flex-shrink: 0 !important;
              }
              
              .mention-menu-item {
                padding: 10px 14px !important;
                font-size: 14px !important;
                color: #374151 !important;
                cursor: pointer !important;
                transition: all 0.12s ease-in-out !important;
                display: flex !important;
                align-items: center !important;
                border: none !important;
                background: transparent !important;
                width: 100% !important;
                text-align: left !important;
                position: relative !important;
                line-height: 1.4 !important;
                list-style: none !important;
              }
              
              .mention-menu-item .mention-prefix {
                font-weight: 600 !important;
                color: #6b7280 !important;
                margin-right: 8px !important;
                font-size: 14px !important;
                flex-shrink: 0 !important;
              }
              
              .beautiful-mentions-menu-item:hover,
              .mention-menu-item:hover {
                background-color: #f8fafc !important;
                color: #1e293b !important;
                transform: translateX(2px) !important;
              }
              
              .beautiful-mentions-menu-item:hover::before,
              .mention-menu-item:hover .mention-prefix {
                color: #475569 !important;
              }
              
              .beautiful-mentions-menu-item[data-focused="true"],
              .beautiful-mentions-menu-item[aria-selected="true"],
              .mention-menu-item.selected {
                background-color: #eff6ff !important;
                color: #1e40af !important;
                border-left: 3px solid #3b82f6 !important;
                padding-left: 11px !important;
              }
              
              .beautiful-mentions-menu-item[data-focused="true"]::before,
              .beautiful-mentions-menu-item[aria-selected="true"]::before,
              .mention-menu-item.selected .mention-prefix {
                color: #2563eb !important;
              }
              
              .beautiful-mentions-menu-item:active {
                background-color: #dbeafe !important;
                transform: scale(0.98) !important;
              }
              
              /* Scrollbar styling */
              .beautiful-mentions-menu::-webkit-scrollbar {
                width: 4px !important;
              }
              
              .beautiful-mentions-menu::-webkit-scrollbar-track {
                background: transparent !important;
              }
              
              .beautiful-mentions-menu::-webkit-scrollbar-thumb {
                background: #d1d5db !important;
                border-radius: 2px !important;
              }
              
              .beautiful-mentions-menu::-webkit-scrollbar-thumb:hover {
                background: #9ca3af !important;
              }
              
              /* Empty state or loading state */
              .beautiful-mentions-menu-empty {
                padding: 16px 14px !important;
                color: #6b7280 !important;
                font-size: 13px !important;
                text-align: center !important;
                font-style: italic !important;
              }
              
              /* Ensure proper positioning */
              .beautiful-mentions-menu-container {
                position: relative !important;
                z-index: 9999 !important;
              }

              /* Ensure parent containers don't clip the menu */
              .mention-editor-container {
                position: relative !important;
              }
            `}</style>
            <BeautifulMentionsPlugin 
              items={mentionItems}
              menuItemComponent={CustomMentionMenuItem}
            />
          </>
        )}
      </LexicalComposer>
    </div>
  );
};