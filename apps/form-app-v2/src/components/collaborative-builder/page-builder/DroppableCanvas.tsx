import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@dculus/ui-v2';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { DraggableField } from './DraggableField';

/**
 * Droppable Canvas - Main drop zone for form fields
 * Center panel in Page Builder showing current page's fields
 */
export function DroppableCanvas() {
  const { pages, selectedPageId } = useFormBuilderStore();
  const currentPage = pages.find((p) => p.id === selectedPageId);

  const { setNodeRef, isOver } = useDroppable({
    id: 'canvas-droppable',
    data: {
      type: 'canvas',
    },
  });

  const fieldIds = currentPage?.fields.map((f) => f.id) || [];

  if (!currentPage) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center space-y-2 max-w-md px-4">
          <p className="text-sm text-muted-foreground">
            No page selected. Create a page to start building your form.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-muted/20">
      <div className="max-w-4xl mx-auto p-8">
        <div
          ref={setNodeRef}
          className={cn(
            'bg-background rounded-lg border-2 border-dashed p-8 min-h-[600px] transition-colors',
            isOver && 'border-primary bg-primary/5',
            !isOver && 'border-muted-foreground/20'
          )}
        >
          {/* Page Title */}
          <div className="mb-6">
            <h3 className="text-lg font-medium">{currentPage.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Page {currentPage.order + 1}
            </p>
          </div>

          {/* Fields List */}
          {fieldIds.length > 0 ? (
            <SortableContext
              items={fieldIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {currentPage.fields.map((field) => (
                  <DraggableField key={field.id} field={field} />
                ))}
              </div>
            </SortableContext>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Drop fields here
                </p>
                <p className="text-xs text-muted-foreground">
                  Drag field types from the left sidebar to add them to this
                  page
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
