import React from 'react';
import { GRID_COLUMNS, ZOOM, type PaperViewport } from './dropPlacement';

export interface DragGhost {
  pageIndex: number;
  /** Snapped top-left position in mm */
  x: number;
  y: number;
  /** Element size in mm */
  width: number;
  height: number;
}

interface DropGuidesProps {
  papers: PaperViewport[];
  ghost: DragGhost | null;
}

/**
 * JotForm-style guided-drop overlay, shown only while dragging from the
 * palette: a light column grid over every page plus a live ghost rectangle
 * at the exact (snapped) position the element will land. Rendered inside
 * the canvas wrapper, pointer-events: none so pdfme underneath is untouched.
 */
export const DropGuides: React.FC<DropGuidesProps> = ({ papers, ghost }) => (
  <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
    {papers.map((paper) => {
      const columnPx = paper.rect.width / GRID_COLUMNS;
      return (
        <div
          key={paper.pageIndex}
          className="absolute"
          style={{
            left: paper.rect.left,
            top: paper.rect.top,
            width: paper.rect.width,
            height: paper.rect.height,
            outline: '1.5px dashed rgba(37,99,235,0.45)',
            outlineOffset: -1,
          }}
        >
          {Array.from({ length: GRID_COLUMNS - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{
                left: (i + 1) * columnPx,
                width: 1,
                background: 'rgba(37,99,235,0.14)',
              }}
            />
          ))}
          {ghost && ghost.pageIndex === paper.pageIndex && (
            <div
              data-testid="pdf-designer-drop-ghost"
              className="absolute rounded-sm"
              style={{
                left: ghost.x * ZOOM * paper.scale,
                top: ghost.y * ZOOM * paper.scale,
                width: ghost.width * ZOOM * paper.scale,
                height: ghost.height * ZOOM * paper.scale,
                background: 'rgba(37,99,235,0.12)',
                border: '1.5px solid rgba(37,99,235,0.8)',
              }}
            />
          )}
        </div>
      );
    })}
  </div>
);
