import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Type,
  AlignLeft,
  Hash,
  Mail,
  Calendar,
  CheckSquare,
  List,
  Circle,
  FileText,
  GripVertical,
  Settings,
  Trash2,
} from 'lucide-react';
import { Button, cn } from '@dculus/ui-v2';
import { FormField, FieldType, FillableFormField } from '@dculus/types';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';

const FIELD_ICONS: Partial<Record<FieldType, React.ComponentType<{ className?: string }>>> = {
  [FieldType.TEXT_INPUT_FIELD]: Type,
  [FieldType.TEXT_AREA_FIELD]: AlignLeft,
  [FieldType.EMAIL_FIELD]: Mail,
  [FieldType.NUMBER_FIELD]: Hash,
  [FieldType.DATE_FIELD]: Calendar,
  [FieldType.CHECKBOX_FIELD]: CheckSquare,
  [FieldType.RADIO_FIELD]: Circle,
  [FieldType.SELECT_FIELD]: List,
  [FieldType.RICH_TEXT_FIELD]: FileText,
};

interface DraggableFieldProps {
  field: FormField;
}

/**
 * Draggable Field - Individual field card on canvas
 * Can be dragged to reorder, clicked to edit, or deleted
 */
export function DraggableField({ field }: DraggableFieldProps) {
  const { setSelectedField, removeField, selectedFieldId, selectedPageId } = useFormBuilderStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: {
      type: 'field',
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = FIELD_ICONS[field.type] || Type;
  const isSelected = selectedFieldId === field.id;

  // Get field label for display
  const fieldLabel = (field as FillableFormField).label || 'Untitled Field';
  const isRequired = (field as FillableFormField).validation?.required || false;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedPageId) {
      removeField(selectedPageId, field.id);
    }
  };

  const handleEdit = () => {
    setSelectedField(field.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-3 p-4 rounded-lg border bg-background',
        'hover:border-primary transition-all',
        isDragging && 'opacity-50 cursor-grabbing',
        isSelected && 'border-primary ring-2 ring-primary/20',
        !isDragging && 'cursor-pointer'
      )}
      onClick={handleEdit}
    >
      {/* Drag Handle */}
      <button
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* Field Icon */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{fieldLabel}</span>
          {isRequired && (
            <span className="text-xs text-destructive">*</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1 capitalize">
          {field.type.replace('_', ' ')}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEdit}
          className="h-8 w-8 p-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
