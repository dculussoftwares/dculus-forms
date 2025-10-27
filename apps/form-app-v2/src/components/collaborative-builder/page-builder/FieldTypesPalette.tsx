import { useDraggable } from '@dnd-kit/core';
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
} from 'lucide-react';
import { cn } from '@dculus/ui-v2';
import { FieldType } from '@dculus/types';

interface FieldTypeItem {
  type: FieldType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const FIELD_TYPES: FieldTypeItem[] = [
  {
    type: FieldType.TEXT_INPUT_FIELD,
    label: 'Short Text',
    icon: Type,
    description: 'Single line text input',
  },
  {
    type: FieldType.TEXT_AREA_FIELD,
    label: 'Long Text',
    icon: AlignLeft,
    description: 'Multi-line text area',
  },
  {
    type: FieldType.EMAIL_FIELD,
    label: 'Email',
    icon: Mail,
    description: 'Email address input',
  },
  {
    type: FieldType.NUMBER_FIELD,
    label: 'Number',
    icon: Hash,
    description: 'Numeric input',
  },
  {
    type: FieldType.DATE_FIELD,
    label: 'Date',
    icon: Calendar,
    description: 'Date picker',
  },
  {
    type: FieldType.CHECKBOX_FIELD,
    label: 'Checkboxes',
    icon: CheckSquare,
    description: 'Multiple choice',
  },
  {
    type: FieldType.RADIO_FIELD,
    label: 'Radio Buttons',
    icon: Circle,
    description: 'Single choice',
  },
  {
    type: FieldType.SELECT_FIELD,
    label: 'Dropdown',
    icon: List,
    description: 'Dropdown selection',
  },
  {
    type: FieldType.RICH_TEXT_FIELD,
    label: 'Rich Text',
    icon: FileText,
    description: 'Rich text editor',
  },
];

interface DraggableFieldTypeProps {
  fieldType: FieldTypeItem;
}

function DraggableFieldType({ fieldType }: DraggableFieldTypeProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `field-type-${fieldType.type}`,
      data: {
        type: 'field-type',
        fieldType: fieldType.type,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const Icon = fieldType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg border bg-background cursor-grab active:cursor-grabbing',
        'hover:border-primary hover:bg-accent/50 transition-all',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{fieldType.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {fieldType.description}
        </div>
      </div>
    </div>
  );
}

/**
 * Field Types Palette - Shows available field types for dragging
 * Left sidebar component in Page Builder
 */
export function FieldTypesPalette() {
  return (
    <div className="h-full flex flex-col border-r bg-background">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm">Field Types</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Drag fields onto the canvas
        </p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {FIELD_TYPES.map((fieldType) => (
            <DraggableFieldType key={fieldType.type} fieldType={fieldType} />
          ))}
        </div>
      </div>
    </div>
  );
}
