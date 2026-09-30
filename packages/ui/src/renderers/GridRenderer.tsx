/**
 * GridRenderer — viewer rendering of a grid layout node (docs/grid-layout-strategy.md §9.1, §9.2).
 *
 * Columns sit side by side only when the grid's own container is wide enough (container queries),
 * so the same markup stacks on phones, in the builder phone frame, in previews and in embeds.
 */
import React from 'react';
import type { Control, FieldValues } from 'react-hook-form';
import { visibleColumns, type PageNode } from '@dculus/types';
import { RendererMode } from '@dculus/utils';
import { FormFieldRenderer } from './FormFieldRenderer';

type GridNode = Extract<PageNode, { kind: 'grid' }>;

export type GridRenderMode = 'columns' | 'stack';

/** Kill switch: `VITE_GRID_RENDER=stack` renders every grid as one vertical list (§15.2). */
export const resolveGridRenderMode = (value: unknown): GridRenderMode =>
  value === 'stack' ? 'stack' : 'columns';

// `env` is missing outside Vite (plain node, some test runners); Vite inlines this expression at build.
const readGridRenderEnv = (): unknown =>
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_GRID_RENDER;

// Literal strings so Tailwind's scanner sees every class (interpolated classes are not generated).
// gap-4 also spaces columns once they stack, matching the page's space-y-4 between fields.
const GRID_CLASS_BY_COLUMN_COUNT: Record<number, string> = {
  1: 'grid grid-cols-1',
  2: 'grid grid-cols-1 gap-4 @md:[grid-template-columns:var(--gc)]',
  3: 'grid grid-cols-1 gap-4 @lg:[grid-template-columns:var(--gc)]',
  4: 'grid grid-cols-1 gap-4 @xl:[grid-template-columns:var(--gc)]',
};

const COLUMN_CLASS = 'min-w-0 space-y-4';

export interface GridRendererProps {
  node: GridNode;
  control: Control<FieldValues>;
  fieldStyles?: React.ComponentProps<typeof FormFieldRenderer>['fieldStyles'];
  mode?: RendererMode;
  hiddenFieldIds?: ReadonlySet<string>;
  requiredOverrides?: ReadonlyMap<string, boolean>;
  /** Overrides the `VITE_GRID_RENDER` kill switch. */
  renderMode?: GridRenderMode;
}

export const GridRenderer: React.FC<GridRendererProps> = ({
  node,
  control,
  fieldStyles,
  mode,
  hiddenFieldIds,
  requiredOverrides,
  renderMode,
}) => {
  const columns = visibleColumns(node, hiddenFieldIds);
  if (columns.length === 0) return null;

  const gridId = node.grid.id;
  const renderField = (field: GridNode['columns'][number]['fields'][number]) => (
    <FormFieldRenderer
      key={field.id}
      field={field}
      control={control}
      fieldStyles={fieldStyles}
      mode={mode}
      requiredOverride={requiredOverrides?.get(field.id)}
    />
  );

  if ((renderMode ?? resolveGridRenderMode(readGridRenderEnv())) === 'stack') {
    return (
      <div className="w-full" data-testid={`viewer-grid-${gridId}`}>
        <div className="grid grid-cols-1">
          <div className={COLUMN_CLASS} data-testid={`viewer-grid-column-${gridId}-0`}>
            {columns.flatMap((column) => column.fields.map(renderField))}
          </div>
        </div>
      </div>
    );
  }

  const templateColumns = columns.map((column) => `minmax(0, ${column.widthPercent}fr)`).join(' ');

  return (
    <div className="@container w-full" data-testid={`viewer-grid-${gridId}`}>
      <div
        className={GRID_CLASS_BY_COLUMN_COUNT[columns.length]}
        style={{ '--gc': templateColumns } as React.CSSProperties}
      >
        {columns.map((column, index) => (
          <div
            // Original column index: a collapsing earlier column must not remount (and unfocus) later ones
            key={column.index}
            className={COLUMN_CLASS}
            data-testid={`viewer-grid-column-${gridId}-${index}`}
          >
            {column.fields.map(renderField)}
          </div>
        ))}
      </div>
    </div>
  );
};
