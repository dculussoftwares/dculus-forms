import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { FieldPreview, Button, Badge, Switch, toast } from '@dculus/ui';
import { FormField, FormPage, FillableFormField, isGradableFieldType } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useConditionReferenceCounts } from '../../../hooks/useConditionReferenceCounts';
import { useTranslation } from '../../../hooks/useTranslation';
import { useQuizMode } from '../../../contexts/QuizModeContext';
import { hasAnswerKey } from '../../../utils/quizGrading';

import { useFormPermissions } from '../../../hooks/useFormPermissions';
import {
  useDraggable,
  useDndContext,
} from '@dnd-kit/core';
import {
  GripVertical,
  Trash2,
  Settings,
  Copy,
  ArrowUp,
  ArrowDown,
  Link2,
  AlertTriangle,
  Pencil,
} from 'lucide-react';
import { PageActionsSelector } from '../PageActionsSelector';

// =============================================================================
// Field Type Configuration
// =============================================================================

// Icon/colour mapping moved to shared/fieldTypeVisuals so pure consumers (and
// their tests) can use it without pulling in this component's dependency graph.
// Re-exported here because the rail, field library and Logic tab import it from
// this module today.
import { getFieldTypeConfig, getCategoryColor } from '../shared/fieldTypeVisuals';

export { getFieldTypeConfig, getCategoryColor };

// =============================================================================
// FieldCard
// =============================================================================

/**
 * FieldCard - Displays a single existing field with optional drag handle
 */
export const FieldCard: React.FC<{
  field: FormField;
  pageId: string;
  index: number;
  totalFields: number;
  pages: FormPage[];
  isDragging?: boolean;
  isSelected?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onClick?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToPage?: (targetPageId: string) => void;
  onCopyToPage?: (targetPageId: string) => void;
  onUpdateLabel?: (newLabel: string) => void;
  onToggleRequired?: (required: boolean) => void;
  onUpdateContent?: (newContent: string) => void;
  isAnyDragActive?: boolean;
  isRecentlyDropped?: boolean;
  isDelayingExpansion?: boolean;
}> = ({
  field,
  pageId,
  index,
  totalFields,
  pages,
  isDragging = false,
  isSelected = false,
  dragHandleProps,
  onClick,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onMoveToPage,
  onCopyToPage,
  onUpdateLabel,
  onToggleRequired,
  onUpdateContent,
  isAnyDragActive = false,
  isRecentlyDropped = false,
  isDelayingExpansion = false,
}) => {
  // Get label for fillable fields, or use type name for others
  const typeConfig = getFieldTypeConfig(field.type);
  const label: string =
    'label' in field && typeof field.label === 'string' && field.label
      ? field.label
      : typeConfig.label;

  const isFillable = 'validation' in field;
  const isRequired = isFillable && Boolean((field as FillableFormField).validation?.required);
  const hasLabel = 'label' in field;

  const [isEditingLabel, setIsEditingLabel] = React.useState(false);
  const [draftLabel, setDraftLabel] = React.useState(label);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraftLabel(label);
  }, [label]);

  React.useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  const handleSaveLabel = () => {
    setIsEditingLabel(false);
    const trimmed = draftLabel.trim();
    if (trimmed && trimmed !== label && onUpdateLabel) {
      onUpdateLabel(trimmed);
    } else {
      setDraftLabel(label);
    }
  };

  const handleCancelLabel = () => {
    setIsEditingLabel(false);
    setDraftLabel(label);
  };

  // Debounced rich text content updates
  const pendingContentRef = React.useRef<string | null>(null);
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushContentChange = React.useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingContentRef.current !== null && onUpdateContent) {
      const contentToSave = pendingContentRef.current;
      pendingContentRef.current = null;
      onUpdateContent(contentToSave);
    }
  }, [onUpdateContent]);

  const handleContentChange = React.useCallback(
    (newContent: string) => {
      pendingContentRef.current = newContent;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        flushContentChange();
      }, 300);
    },
    [flushContentChange]
  );

  React.useEffect(() => {
    return () => {
      flushContentChange();
    };
  }, [flushContentChange]);

  // Get field type config for icon and category
  const Icon = typeConfig.icon;
  const categoryColor = getCategoryColor(typeConfig.category);

  // Show compact view when any drag is active OR during expansion delay
  const shouldShowCompact = isAnyDragActive || isDelayingExpansion;

  // AI highlight ring + auto-scroll
  const aiHighlightedFieldId = useFormBuilderStore((s) => s.aiHighlightedFieldId);
  const isAIHighlighted = aiHighlightedFieldId === field.id;
  const cardRef = React.useRef<HTMLDivElement>(null);

  // Logic cross-reference chip — see issue #168
  const { t } = useTranslation('pageBuilderTab');
  const { t: tQuiz } = useTranslation('quizGrading');
  const navigate = useNavigate();
  const location = useLocation();
  const { formId } = useParams<{ formId: string }>();
  const conditions = useFormBuilderStore((s) => s.conditions);
  const { fieldRuleCounts } = useConditionReferenceCounts(conditions);
  const fieldRuleCount = fieldRuleCounts.get(field.id) ?? 0;

  // Quiz points badge / "no answer key" marker — only when quiz mode is on for
  // this form (additive guarantee, GitHub epic #289): with no QuizModeProvider,
  // or `settings.quiz?.enabled` false, `isQuizModeEnabled` is false and this
  // block renders nothing, same as before Story 08 shipped.
  const { enabled: isQuizModeEnabled } = useQuizMode();
  const isGradable = isQuizModeEnabled && isGradableFieldType(field.type);
  const grading = isGradable ? (field as FillableFormField).grading : undefined;
  const isKeyed = isGradable && hasAnswerKey(grading);

  const handleRuleCountClick = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (formId) {
      navigate(`/dashboard/form/${formId}/builder/conditions${location.search}`);
    }
  };

  const handleRuleCountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRuleCountClick(e);
    }
  };

  React.useEffect(() => {
    if (isAIHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isAIHighlighted]);

  // Scroll the field into view when it becomes selected (e.g. clicked from the
  // rail's page/field list) — without this, selecting a field below the fold
  // (or above it) only shows the selection ring once the user manually scrolls.
  React.useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`
        px-4 py-3.5 bg-white dark:bg-card rounded-xl transition-all duration-150 group
        ${
          isDragging
            ? 'opacity-40'
            : isRecentlyDropped
              ? 'shadow-md'
              : isSelected
                ? ''
                : 'cursor-pointer hover:shadow-sm'
        }
        ${isAIHighlighted ? 'ring-2 ring-primary ring-offset-2 transition-all duration-300' : ''}
      `}
      style={{
        border: isDragging
          ? '1px solid rgba(81,76,84,0.25)'
          : isRecentlyDropped
            ? '1px solid rgba(60,50,62,0.30)'
            : isSelected
              ? '1.5px solid #3c323e'
              : '1px solid rgba(81,76,84,0.10)',
        boxShadow: isSelected
          ? '0 0 0 3px rgba(60,50,62,0.08), 0 1px 4px rgba(60,50,62,0.06)'
          : isRecentlyDropped
            ? '0 4px 12px rgba(60,50,62,0.10)'
            : '0 1px 3px rgba(60,50,62,0.05)',
      }}
      data-testid={`draggable-field-${field.id}`}
    >
      {/* Header row — always visible in both compact and expanded states */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {dragHandleProps && (
            <div
              {...dragHandleProps}
              className="flex-shrink-0 p-1 -ml-1 cursor-grab rounded-md transition-colors hover:bg-[var(--tf-tab-bg)]"
              title="Drag to reorder"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground dark:text-gray-500" />
            </div>
          )}

          <div
            className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${categoryColor}`}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-[#3c323e] dark:text-white">
              {typeConfig.label}
            </span>

            {/* In compact / dragging mode, show truncated label so reordering is identifiable */}
            {shouldShowCompact && (
              <>
                <span className="text-xs text-[#655d67] dark:text-gray-400">·</span>
                <span className="text-xs text-[#655d67] dark:text-gray-400 truncate max-w-[200px]">
                  {label}
                </span>
              </>
            )}

            {isGradable && isKeyed && (
              <Badge
                variant="outline"
                data-testid={`field-points-badge-${field.id}`}
                title={tQuiz('fieldCard.pointsBadgeTooltip', {
                  values: { count: grading?.pointValue ?? 0 },
                })}
                className="gap-1 px-1.5 py-0 text-[10px] leading-4"
              >
                {tQuiz('fieldCard.pointsBadge', { values: { count: grading?.pointValue ?? 0 } })}
              </Badge>
            )}
            {isGradable && !isKeyed && (
              <Badge
                variant="outline"
                data-testid={`field-no-key-badge-${field.id}`}
                title={tQuiz('fieldCard.noKeyBadgeTooltip')}
                className="gap-1 px-1.5 py-0 text-[10px] leading-4 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                {tQuiz('fieldCard.noKeyBadge')}
              </Badge>
            )}
            {fieldRuleCount > 0 && (
              <Badge
                variant="outline"
                role="button"
                tabIndex={0}
                onClick={handleRuleCountClick}
                onKeyDown={handleRuleCountKeyDown}
                data-testid={`field-rule-count-${field.id}`}
                title={t('ruleReferences.tooltip', { values: { count: fieldRuleCount } })}
                className="gap-1 px-1.5 py-0 text-[10px] leading-4 cursor-pointer hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Link2 className="w-2.5 h-2.5" />
                {t(
                  fieldRuleCount === 1 ? 'ruleReferences.single' : 'ruleReferences.multiple',
                  { values: { count: fieldRuleCount } }
                )}
              </Badge>
            )}
          </div>
        </div>

        {/* Right side of header: Required Toggle */}
        {isFillable && onToggleRequired && (
          <div
            className="flex-shrink-0 flex items-center gap-1.5 select-none"
            onClick={(e) => e.stopPropagation()}
            data-testid={`field-required-toggle-${field.id}`}
          >
            <span
              onClick={() => onToggleRequired(!isRequired)}
              className={cn(
                'text-xs cursor-pointer transition-colors',
                isRequired
                  ? 'text-[#3c323e] dark:text-white font-medium'
                  : 'text-[#655d67] dark:text-gray-400 hover:text-[#3c323e] dark:hover:text-white'
              )}
            >
              {t('fieldCard.required', { defaultValue: 'Required' })}
              {isRequired && <span className="text-[#ce5d55] font-semibold ml-0.5">*</span>}
            </span>
            <Switch
              checked={isRequired}
              onCheckedChange={onToggleRequired}
              className="scale-75 origin-right cursor-pointer"
              aria-label={t('fieldCard.required', { defaultValue: 'Required' })}
            />
          </div>
        )}
      </div>

      {/* Animated expansion panel — collapses to zero height during drag */}
      <div
        className="grid"
        style={{
          gridTemplateRows: shouldShowCompact ? '0fr' : '1fr',
          transition: 'grid-template-rows 300ms ease-out',
        }}
      >
        <div className="overflow-hidden">
          <div className="pt-3 space-y-2.5">
            {/* Field Preview & In-place Question Title */}
            <div className="pl-9 pr-1" data-testid={`field-content-${index + 1}`}>
              <div
                className="px-3 py-2.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--tf-faint)',
                  border: '1px solid var(--tf-border-faint)',
                }}
              >
                {/* Single Question Title - In-place editing */}
                {hasLabel && (
                  isEditingLabel ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={draftLabel}
                      onChange={(e) => setDraftLabel(e.target.value)}
                      onBlur={handleSaveLabel}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveLabel();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCancelLabel();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-sm font-medium px-2 py-1 mb-2 rounded border border-[var(--tf-border-strong)] bg-white dark:bg-gray-800 text-[#3c323e] dark:text-white focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={cn(
                        'text-sm font-medium flex items-center gap-1.5 text-[#4c414e] dark:text-white group/label cursor-text mb-2',
                        onUpdateLabel && 'hover:underline decoration-dashed decoration-gray-400 underline-offset-2'
                      )}
                      onClick={(e) => {
                        if (onUpdateLabel) {
                          e.stopPropagation();
                          setIsEditingLabel(true);
                        }
                      }}
                      title={
                        onUpdateLabel
                          ? t('fieldCard.clickToEdit', { defaultValue: 'Click to edit label' })
                          : undefined
                      }
                    >
                      <span className="truncate">{label}</span>
                      {isRequired && (
                        <span className="text-[#ce5d55] text-sm flex-shrink-0" title="Required field">
                          *
                        </span>
                      )}
                      {onUpdateLabel && (
                        <Pencil className="w-3 h-3 text-[#655d67] opacity-0 group-hover/label:opacity-100 transition-opacity ml-0.5" />
                      )}
                    </div>
                  )
                )}

                {/* Field Input (label suppressed if hasLabel to eliminate duplicate) */}
                <div
                  onBlur={() => {
                    flushContentChange();
                  }}
                >
                  <FieldPreview
                    field={field}
                    disabled={true}
                    showValidation={false}
                    hideLabel={hasLabel}
                    editableRichText={isSelected && Boolean(onUpdateContent)}
                    onContentChange={onUpdateContent ? handleContentChange : undefined}
                  />
                </div>
              </div>
            </div>

            {/* Actions — fade in on hover */}
            <div className="pl-9 pr-1">
              <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                {onClick && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Field settings"
                    data-testid={`field-settings-button-${index + 1}`}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
                {onMoveUp && index > 0 && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                )}
                {onMoveDown && index < totalFields - 1 && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                )}
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                    className="p-1.5 rounded-lg h-auto"
                    title="Duplicate Field"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                )}
                {pages.length > 1 && onMoveToPage && onCopyToPage && (
                  <PageActionsSelector
                    pages={pages}
                    currentPageId={pageId}
                    triggerElement={
                      <Button
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg h-auto"
                        title="Move/Copy to another page"
                      >
                        <ArrowUp className="w-4 h-4 rotate-90" />
                      </Button>
                    }
                    onMoveToPage={onMoveToPage}
                    onCopyToPage={onCopyToPage}
                  />
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-[var(--tf-error-bg)] dark:hover:bg-red-950/30 rounded-lg h-auto"
                    title="Delete field"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// DraggableFieldCard
// =============================================================================

/**
 * DraggableFieldCard - Wrapper that makes FieldCard draggable via grip handle
 */
export const DraggableFieldCard: React.FC<{
  field: FormField;
  index: number;
  pageId: string;
  totalFields: number;
  isRecentlyDropped?: boolean;
  isDelayingExpansion?: boolean;
}> = ({
  field,
  index,
  pageId,
  totalFields,
  isRecentlyDropped = false,
  isDelayingExpansion = false,
}) => {
  const permissions = useFormPermissions();
  const canEdit = permissions.canEditFields();
  const canReorder = permissions.canReorderFields();
  const {
    selectedFieldId,
    setSelectedField,
    removeField,
    restoreField,
    duplicateField,
    reorderFields,
    moveFieldBetweenPages,
    copyFieldToPage,
    updateField,
    pages,
  } = useFormBuilderStore();
  const { t } = useTranslation('pageBuilderTab');

  // Detect if ANY drag is active
  const { active } = useDndContext();
  const isAnyDragActive = !!active;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `existing-field-${field.id}`,
    data: {
      type: 'existing-field',
      field,
      pageId,
      index,
    },
    disabled: !canReorder,
  });

  const isSelected = selectedFieldId === field.id;

  const handleClick = () => {
    setSelectedField(field.id);
  };

  const handleDelete = () => {
    const deletedField = field;
    const deletedIndex = index;
    removeField(pageId, field.id);
    if (isSelected) {
      setSelectedField(null);
    }
    toast({
      title: t('notifications.fieldDeleted', { defaultValue: 'Question deleted' }),
      action: {
        label: t('notifications.undo', { defaultValue: 'Undo' }),
        onClick: () => {
          restoreField(pageId, deletedField, deletedIndex);
          setSelectedField(deletedField.id);
        },
      },
    });
  };

  const handleUpdateLabel = (newLabel: string) => {
    updateField(pageId, field.id, { label: newLabel });
  };

  const handleDuplicate = () => {
    duplicateField(pageId, field.id);
  };

  const handleMoveUp = () => {
    if (index > 0) {
      reorderFields(pageId, index, index - 1);
    }
  };

  const handleMoveDown = () => {
    if (index < totalFields - 1) {
      reorderFields(pageId, index, index + 1);
    }
  };

  const handleMoveToPage = (targetPageId: string) => {
    moveFieldBetweenPages(pageId, targetPageId, field.id);
  };

  const handleCopyToPage = (targetPageId: string) => {
    copyFieldToPage(pageId, targetPageId, field.id);
  };

  const isFillable = 'validation' in field;

  const handleToggleRequired = (newRequired: boolean) => {
    if (!canEdit || !isFillable) return;
    const currentValidation = (field as FillableFormField).validation || {};
    updateField(pageId, field.id, {
      validation: {
        ...currentValidation,
        required: newRequired,
      },
    });
  };

  return (
    <div ref={setNodeRef}>
      <FieldCard
        field={field}
        pageId={pageId}
        index={index}
        totalFields={totalFields}
        pages={pages}
        isDragging={isDragging}
        isSelected={isSelected}
        isAnyDragActive={isAnyDragActive}
        isRecentlyDropped={isRecentlyDropped}
        isDelayingExpansion={isDelayingExpansion}
        dragHandleProps={
          canReorder ? { ...attributes, ...listeners } : undefined
        }
        onClick={handleClick}
        onDelete={canEdit ? handleDelete : undefined}
        onDuplicate={canEdit ? handleDuplicate : undefined}
        onMoveUp={canReorder && index > 0 ? handleMoveUp : undefined}
        onMoveDown={
          canReorder && index < totalFields - 1 ? handleMoveDown : undefined
        }
        onMoveToPage={canEdit ? handleMoveToPage : undefined}
        onCopyToPage={canEdit ? handleCopyToPage : undefined}
        onUpdateLabel={canEdit ? handleUpdateLabel : undefined}
        onToggleRequired={canEdit && isFillable ? handleToggleRequired : undefined}
        onUpdateContent={canEdit ? (newContent: string) => updateField(pageId, field.id, { content: newContent }) : undefined}
      />
    </div>
  );
};
