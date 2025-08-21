import React, { useEffect, useState } from 'react';
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
};

interface UpdateHtmlPluginProps {
  value?: string;
  onChange?: (html: string) => void;
}

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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!isLoaded && value && value !== '<p></p>') {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(value, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        $getRoot().clear();
        $insertNodes(nodes);
      });
      setIsLoaded(true);
    }
  }, [editor, value, isLoaded]);

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

interface LexicalRichTextEditorProps {
  value?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

export const LexicalRichTextEditor: React.FC<LexicalRichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Enter content...',
  className,
  editable = true,
}) => {
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
    ],
  };


  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      <LexicalComposer initialConfig={initialConfig}>
        {editable && <ToolbarPlugin />}
        <div className="relative">
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
      </LexicalComposer>
    </div>
  );
};