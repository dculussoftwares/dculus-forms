import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@dculus/ui-v2';

/**
 * Layout Tab - Form design and theming
 * Layout: Preview (left) | Settings sidebar (right)
 */
export function LayoutTab() {
  // const { pages, layout } = useFormBuilderStore();

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left: Live Preview */}
      <ResizablePanel defaultSize={65} minSize={50}>
        <div className="h-full overflow-auto bg-muted/50 p-8">
          <div className="max-w-3xl mx-auto bg-background rounded-lg border p-8">
            <h3 className="text-lg font-medium mb-4">Layout Preview</h3>
            <p className="text-sm text-muted-foreground">
              Form with applied layout - Coming soon
            </p>
            {/* TODO: Integrate FormRenderer with layout */}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right: Layout Settings */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={45}>
        <div className="h-full flex flex-col border-l">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Layout Settings</h2>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Layout Code</h3>
              <p className="text-xs text-muted-foreground">
                Select layout - Coming soon
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Theme</h3>
              <p className="text-xs text-muted-foreground">
                Light/Dark/Auto - Coming soon
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Colors</h3>
              <p className="text-xs text-muted-foreground">
                Color pickers - Coming soon
              </p>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
