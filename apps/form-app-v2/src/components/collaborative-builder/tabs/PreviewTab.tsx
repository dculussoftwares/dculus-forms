import { PreviewRenderer } from '../preview/PreviewRenderer';

/**
 * Preview Tab - Shows form as respondents will see it
 * Displays real-time preview of the form
 */
export function PreviewTab() {
  return (
    <div className="h-full overflow-auto bg-muted/50 p-8">
      <div className="max-w-3xl mx-auto bg-background rounded-lg border p-8">
        <PreviewRenderer />
      </div>
    </div>
  );
}
