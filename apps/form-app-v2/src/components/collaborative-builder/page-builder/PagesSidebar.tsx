import { Plus, FileText, GripVertical, Trash2, Settings } from 'lucide-react';
import { Button, Badge, Tabs, TabsList, TabsTrigger, TabsContent, cn } from '@dculus/ui-v2';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FormPage } from '@dculus/types';

interface DraggablePageItemProps {
  page: FormPage;
  isActive: boolean;
}

function DraggablePageItem({ page, isActive }: DraggablePageItemProps) {
  const { setSelectedPage, removePage } = useFormBuilderStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    data: {
      type: 'page',
      page,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removePage(page.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 p-3 rounded-lg border cursor-pointer',
        'hover:border-primary transition-all',
        isDragging && 'opacity-50',
        isActive && 'border-primary bg-primary/5'
      )}
      onClick={() => setSelectedPage(page.id)}
    >
      {/* Drag Handle */}
      <button
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Page Icon & Info */}
      <div className="flex-shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{page.title}</div>
        <div className="text-xs text-muted-foreground">
          {page.fields.length} field{page.fields.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Page Number Badge */}
      <Badge variant="secondary" className="flex-shrink-0">
        {page.order + 1}
      </Badge>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function PagesTab() {
  const { pages, selectedPageId, addEmptyPage } = useFormBuilderStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Pages</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => addEmptyPage()}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Pages List */}
      <div className="flex-1 overflow-auto p-4">
        {pages.length > 0 ? (
          <div className="space-y-2">
            {pages.map((page) => (
              <DraggablePageItem
                key={page.id}
                page={page}
                isActive={selectedPageId === page.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2 max-w-[200px]">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No pages yet. Click "Add" to create your first page.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JsonTab() {
  const { pages, layout } = useFormBuilderStore();

  const formSchema = {
    pages,
    layout,
    isShuffleEnabled: false,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Form JSON</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Current form structure
        </p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
          {JSON.stringify(formSchema, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function FieldSettingsTab() {
  const { selectedFieldId, getSelectedField } = useFormBuilderStore();
  const selectedField = getSelectedField();

  if (!selectedFieldId || !selectedField) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Field Settings</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center space-y-2 max-w-[200px]">
            <Settings className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Select a field to view its settings
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Field Settings</h3>
        <p className="text-xs text-muted-foreground mt-1 capitalize">
          {selectedField.type.replace('_', ' ')}
        </p>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div className="text-sm text-muted-foreground">
          Field settings panel - Coming soon
        </div>
        {/* TODO: Implement field-specific settings forms */}
      </div>
    </div>
  );
}

/**
 * Pages Sidebar - Right sidebar with Pages, JSON, and Field Settings tabs
 * Shows page list, form JSON structure, and field configuration
 */
export function PagesSidebar() {
  return (
    <div className="h-full flex flex-col border-l bg-background">
      <Tabs defaultValue="pages" className="flex flex-col h-full">
        <div className="border-b">
          <TabsList className="w-full grid grid-cols-3 rounded-none h-11 bg-transparent p-0">
            <TabsTrigger value="pages" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Pages
            </TabsTrigger>
            <TabsTrigger value="json" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              JSON
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pages" className="flex-1 m-0 overflow-hidden">
          <PagesTab />
        </TabsContent>

        <TabsContent value="json" className="flex-1 m-0 overflow-hidden">
          <JsonTab />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 m-0 overflow-hidden">
          <FieldSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
