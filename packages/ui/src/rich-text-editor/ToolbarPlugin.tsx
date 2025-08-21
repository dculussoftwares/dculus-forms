import { useCallback, useEffect, useRef, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $createParagraphNode,
  $getNodeByKey,
} from 'lexical';
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $isHeadingNode, $createHeadingNode } from '@lexical/rich-text';
import { $setBlocksType, $patchStyleText } from '@lexical/selection';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Type,
  ChevronDown
} from 'lucide-react';
import { Button } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu';

const LowPriority = 1;


const blockTypeToBlockName = {
  code: 'Code Block',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  paragraph: 'Normal',
  quote: 'Quote',
  ul: 'Bullet List',
  ol: 'Numbered List',
};

const fontSizeOptions = [
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '20px', value: '20px' },
  { label: '24px', value: '24px' },
  { label: '28px', value: '28px' },
  { label: '32px', value: '32px' },
  { label: '36px', value: '36px' },
  { label: '48px', value: '48px' },
];

export function ToolbarPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef(null);
  const [blockType, setBlockType] = useState('paragraph');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [fontSize, setFontSize] = useState('16px');

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : anchorNode.getTopLevelElementOrThrow();
      const elementKey = element.getKey();
      const elementDOM = editor.getElementByKey(elementKey);
      if (elementDOM !== null) {
        if ($isListNode(element)) {
          const parentList = $findMatchingParent(
            anchorNode,
            (parent: any) => $isListNode(parent) && parent.getParent()?.getKey() === 'root'
          );
          const type = parentList
            ? (parentList as ListNode).getListType()
            : (element as ListNode).getListType();
          setBlockType(type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          if (type in blockTypeToBlockName) {
            setBlockType(type);
          }
        }
      }
      // Update text format
      setIsBold(selection.hasFormat('bold'));
      setIsItalic(selection.hasFormat('italic'));
      setIsUnderline(selection.hasFormat('underline'));
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          updateToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload, _newEditor) => {
          updateToolbar();
          return false;
        },
        LowPriority,
      ),
    );
  }, [editor, updateToolbar]);

  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
    }
  };

  const formatHeading = (headingSize: 'h1' | 'h2' | 'h3') => {
    if (blockType !== headingSize) {
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize));
        }
      });
    }
  };

  const formatBulletList = () => {
    if (blockType !== 'ul') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const formatNumberedList = () => {
    if (blockType !== 'ol') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    }
  };

  const applyFontSize = (size: string) => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, {
          'font-size': size,
        });
      }
    });
    setFontSize(size);
  };

  return (
    <div
      className="border-b border-gray-200 p-2 bg-gray-50 flex items-center gap-1 flex-wrap"
      ref={toolbarRef}
    >
      {/* Block Type Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Type className="h-4 w-4 mr-1" />
            <span className="text-sm">
              {blockTypeToBlockName[blockType as keyof typeof blockTypeToBlockName] || 'Normal'}
            </span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={formatParagraph}>
            Normal
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => formatHeading('h1')}>
            Heading 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => formatHeading('h2')}>
            Heading 2
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => formatHeading('h3')}>
            Heading 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Font Size Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <Type className="h-4 w-4 mr-1" />
            <span className="text-sm">{fontSize}</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {fontSizeOptions.map((option) => (
            <DropdownMenuItem 
              key={option.value} 
              onClick={() => applyFontSize(option.value)}
              className={fontSize === option.value ? 'bg-gray-100' : ''}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text Format Buttons */}
      <Button
        variant={isBold ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        type="button"
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        variant={isItalic ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        type="button"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Button
        variant={isUnderline ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        type="button"
      >
        <Underline className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* List Buttons */}
      <Button
        variant={blockType === 'ul' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={formatBulletList}
        type="button"
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant={blockType === 'ol' ? 'default' : 'ghost'}
        size="sm"
        className="h-8 w-8 p-0"
        onClick={formatNumberedList}
        type="button"
      >
        <ListOrdered className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Alignment Buttons */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
        type="button"
      >
        <AlignLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
        type="button"
      >
        <AlignCenter className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
        type="button"
      >
        <AlignRight className="h-4 w-4" />
      </Button>
    </div>
  );
}