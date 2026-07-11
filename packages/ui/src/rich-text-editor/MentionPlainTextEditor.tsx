import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isLineBreakNode,
  type LexicalNode,
} from 'lexical';
import {
  BeautifulMentionsPlugin,
  BeautifulMentionNode,
  $createBeautifulMentionNode,
  useBeautifulMentions,
  type BeautifulMentionsItem,
  type BeautifulMentionsItemData,
  type BeautifulMentionsMenuProps,
  type BeautifulMentionsMenuItemProps,
  type BeautifulMentionComponentProps,
  createBeautifulMentionNode,
} from 'lexical-beautiful-mentions';
import { cn } from '../utils';

/**
 * Plain-text editor with @-mention field pills — the PDF template designer's
 * text editor. Same mention UX as the thank-you page's LexicalRichTextEditor,
 * but deliberately WITHOUT rich formatting: pdfme text elements cannot render
 * inline styling (bold/lists/headings), so offering it would mislead.
 *
 * Value model matches the pdf element storage: a plain string where each
 * mention is a readable `{token}` plus a token → fieldId map (dculusFieldVars).
 * Serialization runs on every change, so the map always mirrors the pills
 * actually present in the text.
 */

const MENTION_TRIGGERS = ['@']; // stable ref — see LexicalRichTextEditor

export interface MentionFieldOption {
  fieldId: string;
  label: string;
}

export interface MentionPlainTextValue {
  content: string;
  fieldVars: Record<string, string>;
}

export interface MentionPlainTextEditorHandle {
  insertField: (fieldId: string) => void;
}

interface MentionPlainTextEditorProps {
  initialValue: MentionPlainTextValue;
  mentionFields: MentionFieldOption[];
  onChange: (value: MentionPlainTextValue) => void;
  placeholder?: string;
  className?: string;
}

function slugToken(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug || 'field';
}

/** Serialize the editor into `{token}` content + token→fieldId map. */
function serializeEditorState(): MentionPlainTextValue {
  const fieldVars: Record<string, string> = {};
  const tokenByFieldId = new Map<string, string>();

  const tokenFor = (fieldId: string, label: string): string => {
    const existing = tokenByFieldId.get(fieldId);
    if (existing) return existing;
    const base = slugToken(label);
    let token = base;
    for (let n = 2; fieldVars[token] !== undefined; n++) token = `${base}_${n}`;
    tokenByFieldId.set(fieldId, token);
    fieldVars[token] = fieldId;
    return token;
  };

  const renderNodes = (nodes: LexicalNode[]): string =>
    nodes
      .map((node) => {
        if (node instanceof BeautifulMentionNode) {
          const fieldId = node.getValue();
          const label = String(node.getData()?.label ?? fieldId);
          return `{${tokenFor(fieldId, label)}}`;
        }
        if ($isLineBreakNode(node)) return '\n';
        return node.getTextContent();
      })
      .join('');

  const content = $getRoot()
    .getChildren()
    .map((child: any) =>
      typeof child.getChildren === 'function'
        ? renderNodes(child.getChildren())
        : child.getTextContent()
    )
    .join('\n');

  return { content, fieldVars };
}

/**
 * Build the initial editor state from stored `{token}` content: known tokens
 * become mention pills (labeled from the current form fields); tokens whose
 * field no longer exists stay as literal text so the user can see and remove
 * them.
 */
function initializeEditorState(
  value: MentionPlainTextValue,
  fields: MentionFieldOption[]
): void {
  const labelByFieldId = new Map(fields.map((f) => [f.fieldId, f.label]));
  const tokens = Object.keys(value.fieldVars).filter((token) =>
    labelByFieldId.has(value.fieldVars[token])
  );
  const splitter = tokens.length
    ? new RegExp(
        `(\\{(?:${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\})`
      )
    : null;

  const paragraph = $createParagraphNode();
  const lines = value.content.split('\n');
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) paragraph.append($createLineBreakNode());
    const parts = splitter ? line.split(splitter) : [line];
    for (const part of parts) {
      if (!part) continue;
      const tokenMatch = splitter && part.startsWith('{') && part.endsWith('}')
        ? part.slice(1, -1)
        : null;
      const fieldId = tokenMatch ? value.fieldVars[tokenMatch] : undefined;
      const label = fieldId ? labelByFieldId.get(fieldId) : undefined;
      if (fieldId && label !== undefined && tokens.includes(tokenMatch!)) {
        paragraph.append(
          $createBeautifulMentionNode('@', fieldId, { label } as Record<
            string,
            BeautifulMentionsItemData
          >)
        );
      } else {
        paragraph.append($createTextNode(part));
      }
    }
  });
  $getRoot().clear().append(paragraph);
}

const MentionMenu = forwardRef<HTMLUListElement, BeautifulMentionsMenuProps>(
  ({ loading: _loading, ...props }, ref) => (
    <ul
      {...props}
      ref={ref}
      className="absolute z-[9999] min-w-56 max-h-48 overflow-y-auto rounded-lg border border-[rgba(81,76,84,0.15)] bg-white dark:bg-neutral-900 dark:border-white/10 shadow-lg py-1 m-0 list-none"
    />
  )
);
MentionMenu.displayName = 'MentionMenu';

const MentionMenuItem = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  // itemValue must not reach the DOM element (React unknown-prop warning)
  ({ selected, item, itemValue: _itemValue, ...props }, ref) => (
    <li
      {...props}
      ref={ref}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer list-none text-[#4c414e] dark:text-gray-200',
        selected && 'bg-[rgba(87,84,91,0.08)] dark:bg-white/10'
      )}
    >
      <span className="font-semibold text-[#655d67] dark:text-gray-400">@</span>
      {String((item?.data as any)?.label ?? item?.value ?? '')}
    </li>
  )
);
MentionMenuItem.displayName = 'MentionMenuItem';

const MentionPill = forwardRef<HTMLSpanElement, BeautifulMentionComponentProps>(
  ({ value, data, trigger: _trigger, ...props }, ref) => (
    <span
      {...props}
      ref={ref}
      data-field-id={value}
      className="inline-block mx-0.5 px-1.5 py-0.5 rounded-md text-[0.85em] font-medium bg-[#ddd6fa] text-[#5c2e6b] border border-[#c6b8fe] dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800"
    >
      {String((data as any)?.label ?? value)}
    </span>
  )
);
MentionPill.displayName = 'MentionPill';

/** Exposes programmatic mention insertion (for an "Insert field" button). */
const InsertFieldBridge = forwardRef<
  MentionPlainTextEditorHandle,
  { fields: MentionFieldOption[] }
>(({ fields }, ref) => {
  const { insertMention } = useBeautifulMentions();
  useImperativeHandle(
    ref,
    () => ({
      insertField: (fieldId: string) => {
        const field = fields.find((f) => f.fieldId === fieldId);
        if (!field) return;
        insertMention({
          trigger: '@',
          value: field.fieldId,
          data: { label: field.label },
        });
      },
    }),
    [fields, insertMention]
  );
  return null;
});
InsertFieldBridge.displayName = 'InsertFieldBridge';

export const MentionPlainTextEditor = forwardRef<
  MentionPlainTextEditorHandle,
  MentionPlainTextEditorProps
>(({ initialValue, mentionFields, onChange, placeholder, className }, ref) => {
  const initialValueRef = useRef(initialValue);

  const mentionItems = useMemo(
    () =>
      mentionFields.map((field) => ({
        value: field.fieldId,
        label: field.label,
      })),
    [mentionFields]
  );

  // Search by label, ranked by match position (mirrors LexicalRichTextEditor)
  const handleMentionSearch = useCallback(
    async (_trigger: string, queryString?: string | null): Promise<BeautifulMentionsItem[]> => {
      if (!queryString) return mentionItems;
      const query = queryString.toLowerCase();
      return mentionItems
        .map((item) => ({ item, index: item.label.toLowerCase().indexOf(query) }))
        .filter(({ index }) => index !== -1)
        .sort((a, b) => (a.index !== b.index ? a.index - b.index : a.item.label.localeCompare(b.item.label)))
        .map(({ item }) => item);
    },
    [mentionItems]
  );

  const initialConfig = {
    namespace: 'PdfTextElementEditor',
    theme: {},
    onError: (error: Error) => console.error(error),
    nodes: [...createBeautifulMentionNode(MentionPill)],
    editorState: () => initializeEditorState(initialValueRef.current, mentionFields),
  };

  return (
    <div
      className={cn(
        'relative rounded-lg border border-[rgba(81,76,84,0.15)] dark:border-white/10 bg-white/80 dark:bg-white/5',
        className
      )}
      style={{ overflow: 'visible' }}
    >
      <LexicalComposer initialConfig={initialConfig}>
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className="min-h-40 max-h-72 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-[#4c414e] dark:text-gray-200 outline-none whitespace-pre-wrap"
              data-testid="pdf-designer-text-content"
            />
          }
          placeholder={
            <div className="absolute top-2.5 left-3 text-sm text-[#655d67]/70 dark:text-gray-500 pointer-events-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin
          onChange={(editorState) => {
            editorState.read(() => onChange(serializeEditorState()));
          }}
        />
        <HistoryPlugin />
        <AutoFocusPlugin />
        <InsertFieldBridge ref={ref} fields={mentionFields} />
        {mentionFields.length > 0 && (
          <BeautifulMentionsPlugin
            triggers={MENTION_TRIGGERS}
            onSearch={handleMentionSearch}
            searchDelay={0}
            menuComponent={MentionMenu}
            menuItemComponent={MentionMenuItem}
          />
        )}
      </LexicalComposer>
    </div>
  );
});
MentionPlainTextEditor.displayName = 'MentionPlainTextEditor';
