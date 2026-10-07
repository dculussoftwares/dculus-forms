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
import { GRID_COLUMNS_CLASS_BY_COUNT, gridTemplateColumns } from './gridLayoutClasses';

type GridNode = Extract<PageNode, { kind: 'grid' }>;

const COLUMN_CLASS = 'min-w-0 space-y-4';

export interface GridRendererProps {
  node: GridNode;
  control: Control<FieldValues>;
  fieldStyles?: React.ComponentProps<typeof FormFieldRenderer>['fieldStyles'];
  mode?: RendererMode;
  hiddenFieldIds?: ReadonlySet<string>;
  requiredOverrides?: ReadonlyMap<string, boolean>;
}

export const GridRenderer: React.FC<GridRendererProps> = ({
  node,
  control,
  fieldStyles,
  mode,
  hiddenFieldIds,
  requiredOverrides,
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

  return (
    <div className="@container w-full" data-testid={`viewer-grid-${gridId}`}>
      <div
        className={GRID_COLUMNS_CLASS_BY_COUNT[columns.length]}
        style={{ '--gc': gridTemplateColumns(columns.map((column) => column.widthPercent)) } as React.CSSProperties}
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
