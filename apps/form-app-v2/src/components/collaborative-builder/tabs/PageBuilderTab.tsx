import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@dculus/ui-v2';
import { FieldTypesPalette } from '../page-builder/FieldTypesPalette';
import { DroppableCanvas } from '../page-builder/DroppableCanvas';
import { PagesSidebar } from '../page-builder/PagesSidebar';

/**
 * Page Builder Tab - Main form editing interface
 * Layout: Left sidebar (fields) | Canvas (drop zone) | Right sidebar (pages/settings)
 */
export function PageBuilderTab() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left Sidebar: Field Types */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} collapsible>
        <FieldTypesPalette />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Center: Canvas */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <DroppableCanvas />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Sidebar: Pages/JSON/Settings */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={40} collapsible>
        <PagesSidebar />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
