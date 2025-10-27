import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@dculus/ui-v2';
import { LayoutPreview } from '../layout/LayoutPreview';
import { LayoutSettings } from '../layout/LayoutSettings';

/**
 * Layout Tab - Form design and theming
 * Layout: Preview (left) | Settings sidebar (right)
 */
export function LayoutTab() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left: Live Preview */}
      <ResizablePanel defaultSize={65} minSize={50}>
        <div className="h-full overflow-auto bg-muted/50 p-8">
          <LayoutPreview />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right: Layout Settings */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={45}>
        <div className="h-full flex flex-col border-l">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Layout Settings</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Customize your form's appearance
            </p>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <LayoutSettings />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
