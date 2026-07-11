import React, { useEffect, useState } from 'react';
import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getPaperViewports, ZOOM } from './dropPlacement';

export interface ToolbarSelection {
  pageIndex: number;
  /** Selection bounds in template mm (pdfme DesignerSelectionBounds) */
  bounds: { x: number; y: number; width: number; height: number };
  /** Single selected text element eligible for the text editor */
  editableTextName: string | null;
  names: string[];
}

interface SelectionToolbarProps {
  container: HTMLElement | null;
  selection: ToolbarSelection | null;
  onDuplicate: () => void;
  onDelete: () => void;
  onEditText: () => void;
}

/**
 * JotForm-style floating quick actions under the current canvas selection
 * (duplicate / delete / edit text). pdfme reports selection bounds in
 * template mm; an rAF loop converts them to wrapper px so the toolbar
 * tracks the element through scrolling and zoom changes.
 */
export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  container,
  selection,
  onDuplicate,
  onDelete,
  onEditText,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!selection || !container) {
      setPosition(null);
      return;
    }
    let frame = 0;
    let last = { left: NaN, top: NaN };
    const track = () => {
      const paper = getPaperViewports(container).find(
        (p) => p.pageIndex === selection.pageIndex
      );
      if (paper) {
        const scale = paper.scale * ZOOM;
        const next = {
          left:
            paper.rect.left + (selection.bounds.x + selection.bounds.width / 2) * scale,
          top: paper.rect.top + (selection.bounds.y + selection.bounds.height) * scale + 10,
        };
        if (next.left !== last.left || next.top !== last.top) {
          last = next;
          setPosition(next);
        }
      }
      frame = requestAnimationFrame(track);
    };
    frame = requestAnimationFrame(track);
    return () => cancelAnimationFrame(frame);
  }, [container, selection]);

  if (!selection || !position) return null;

  const buttonClass =
    'flex items-center justify-center w-8 h-8 rounded-full text-white shadow-lg transition-transform hover:scale-105';

  return (
    <div
      className="absolute z-30 flex items-center gap-1.5 -translate-x-1/2"
      style={{ left: position.left, top: position.top }}
      data-testid="pdf-designer-selection-toolbar"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {selection.editableTextName && (
        <button
          type="button"
          className={`${buttonClass} bg-[#3c323e] hover:bg-[#2e2530]`}
          title={t('selectionToolbar.editText')}
          onClick={onEditText}
          data-testid="pdf-designer-selection-edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        className={`${buttonClass} bg-[#3c323e] hover:bg-[#2e2530]`}
        title={t('selectionToolbar.duplicate')}
        onClick={onDuplicate}
        data-testid="pdf-designer-selection-duplicate"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={`${buttonClass} bg-[#ce5d55] hover:bg-[#b84d46]`}
        title={t('selectionToolbar.delete')}
        onClick={onDelete}
        data-testid="pdf-designer-selection-delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
