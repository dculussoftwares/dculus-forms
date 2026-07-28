import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { FormField } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { getFieldTypeConfig, getCategoryColor } from '../tabs/PageBuilderFieldCard';

interface RailFieldChipProps {
  field: FormField;
  index: number;
  pageId: string;
  number: number;
  isSelected: boolean;
}

/**
 * RailFieldChip - a single numbered field row inside a rail page group. Draggable
 * (existing-field, matching PageBuilderFieldCard's DraggableFieldCard convention)
 * so it plugs into PageBuilderTab.handleDragEnd's existing reorder/cross-page-move
 * logic without any changes there.
 */
export const RailFieldChip: React.FC<RailFieldChipProps> = ({
  field,
  index,
  pageId,
  number,
  isSelected,
}) => {
  const permissions = useFormPermissions();
  const canReorder = permissions.canReorderFields();
  const setSelection = useFormBuilderStore((state) => state.setSelection);
  const { icon: Icon, category } = getFieldTypeConfig(field.type);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `rail-existing-field-${field.id}`,
    data: {
      type: 'existing-field',
      field,
      pageId,
      index,
    },
    disabled: !canReorder,
  });

  return (
    <button
      ref={setNodeRef}
      {...(canReorder ? { ...attributes, ...listeners } : {})}
      type="button"
      data-testid={`rail-field-${field.id}`}
      aria-pressed={isSelected}
      onClick={() => setSelection({ kind: 'field', fieldId: field.id, pageId })}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
        canReorder && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
        isSelected
          ? 'bg-[var(--tf-faint)] font-medium text-[var(--tf-dark)]'
          : 'text-[var(--tf-muted)] hover:bg-[var(--tf-faint)] hover:text-[var(--tf-dark)]'
      )}
    >
      <span className="w-4 shrink-0 text-center text-[10px] font-semibold text-[var(--tf-muted)]">
        {number}
      </span>
      <span
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          getCategoryColor(category)
        )}
      >
        <Icon className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {('label' in field && typeof field.label === 'string' && field.label) || field.type}
      </span>
    </button>
  );
};

export default RailFieldChip;
