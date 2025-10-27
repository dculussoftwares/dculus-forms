import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@dculus/ui-v2';

/**
 * Page Builder Tab - Main form editing interface
 * Layout: Left sidebar (fields) | Canvas (drop zone) | Right sidebar (pages/settings)
 */
export function PageBuilderTab() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left Sidebar: Field Types */}
      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} collapsible>
        <div className="h-full flex flex-col border-r">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Field Types</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <p className="text-sm text-muted-foreground">
              Field types panel - Coming soon
            </p>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Center: Canvas */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="h-full overflow-auto bg-muted/20">
          <div className="max-w-4xl mx-auto p-8">
            <div className="bg-background rounded-lg border p-8 min-h-[400px]">
              <h3 className="text-lg font-medium mb-4">
                Page Builder Canvas
              </h3>
              <p className="text-sm text-muted-foreground">
                Drop zone for fields - Coming soon
              </p>
            </div>
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Sidebar: Pages/JSON/Settings */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={40} collapsible>
        <div className="h-full flex flex-col border-l">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Pages & Settings</h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <p className="text-sm text-muted-foreground">
              Pages sidebar - Coming soon
            </p>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
