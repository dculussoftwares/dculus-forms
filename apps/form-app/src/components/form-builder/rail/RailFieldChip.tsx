import React, { useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useNavigate, useParams } from 'react-router';
import { Zap } from 'lucide-react';
import { FormField } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { getRulesForField } from '../../../utils/getRulesForField';
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
  const { t } = useTranslation('journeyRail');
  const navigate = useNavigate();
  const { formId } = useParams<{ formId: string }>();
  const permissions = useFormPermissions();
  const canReorder = permissions.canReorderFields();
  const setSelection = useFormBuilderStore((state) => state.setSelection);
  const conditions = useFormBuilderStore((state) => state.conditions);
  const { icon: Icon, category } = getFieldTypeConfig(field.type);

  const ruleCount = useMemo(
    () => getRulesForField(conditions, field.id).length,
    [conditions, field.id]
  );

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
    <div
      ref={setNodeRef}
      {...(canReorder
        ? { ...attributes, ...listeners }
        : {
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelection({ kind: 'field', fieldId: field.id, pageId });
              }
            },
          })}
      role="button"
      tabIndex={0}
      data-testid={`rail-field-${field.id}`}
      aria-pressed={isSelected}
      onClick={() => setSelection({ kind: 'field', fieldId: field.id, pageId })}
      className={cn(
        'group flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
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
      {ruleCount > 0 && (
        <button
          type="button"
          data-testid={`rail-field-logic-badge-${field.id}`}
          title={t(ruleCount === 1 ? 'logicBadge.single' : 'logicBadge.multiple', {
            values: { count: ruleCount },
          })}
          aria-label={t(ruleCount === 1 ? 'logicBadge.single' : 'logicBadge.multiple', {
            values: { count: ruleCount },
          })}
          onClick={(e) => {
            e.stopPropagation();
            if (formId) navigate(`/dashboard/form/${formId}/builder/logic?ruleField=${field.id}`);
          }}
          onKeyDown={(e) => {
            // Stop Enter/Space from bubbling to the row's own onKeyDown (field
            // selection) or dnd-kit's keyboard-drag listener — this badge is a
            // separate, non-draggable control nested in the draggable row.
            e.stopPropagation();
          }}
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30"
        >
          <Zap className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default RailFieldChip;
