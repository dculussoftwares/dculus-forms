/**
 * Preview Tab - Shows form as respondents will see it
 * Displays real-time preview of the form
 */
export function PreviewTab() {
  // const { pages, layout } = useFormBuilderStore();

  return (
    <div className="h-full overflow-auto bg-muted/50 p-8">
      <div className="max-w-3xl mx-auto bg-background rounded-lg border p-8">
        <h3 className="text-lg font-medium mb-4">Form Preview</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Live preview of your form - Coming soon
        </p>

        {/* TODO: Integrate FormRenderer from @dculus/ui */}
      </div>
    </div>
  );
}
