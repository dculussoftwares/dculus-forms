import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { Button, cn } from '@dculus/ui-v2';
import { SpacingType } from '@dculus/types';

/**
 * Layout Preview - Shows how the form looks with applied layout settings
 * Left panel in Layout tab
 */
export function LayoutPreview() {
  const { pages, layout } = useFormBuilderStore();

  // Calculate spacing class based on layout spacing setting
  const spacingClass = {
    [SpacingType.COMPACT]: 'space-y-3',
    [SpacingType.NORMAL]: 'space-y-4',
    [SpacingType.SPACIOUS]: 'space-y-6',
  }[layout.spacing || SpacingType.NORMAL];

  // Apply theme colors
  const formStyle = {
    backgroundColor: layout.customBackGroundColor || '#ffffff',
    color: layout.textColor || '#000000',
  };

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-sm text-muted-foreground">
            No pages in your form yet. Add pages to see the layout preview.
          </p>
        </div>
      </div>
    );
  }

  const firstPage = pages[0];
  const buttonText = layout.customCTAButtonName || 'Submit';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Preview Label */}
      <div className="mb-4 p-3 bg-muted rounded-lg">
        <p className="text-sm font-medium">Layout Preview</p>
        <p className="text-xs text-muted-foreground mt-1">
          This shows how your layout settings affect the form appearance
        </p>
      </div>

      {/* Form Preview with Applied Layout */}
      <div
        className="rounded-lg border p-8 transition-all"
        style={formStyle}
      >
        {/* Page Title */}
        {firstPage.title && (
          <h3 className="text-2xl font-bold mb-6">{firstPage.title}</h3>
        )}

        {/* Sample Fields with Layout Spacing */}
        <div className={cn(spacingClass, 'mb-8')}>
          {/* Show first 3 fields or placeholder */}
          {firstPage.fields.length > 0 ? (
            firstPage.fields.slice(0, 3).map((field, idx) => (
              <div key={field.id} className="space-y-2">
                <label className="block text-sm font-medium">
                  {'label' in field ? (field as any).label : `Field ${idx + 1}`}
                  {('validation' in field && (field as any).validation?.required) && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                <div className="w-full h-10 border rounded-md bg-background/50" />
              </div>
            ))
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Sample Field 1</label>
                <div className="w-full h-10 border rounded-md bg-background/50" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Sample Field 2</label>
                <div className="w-full h-10 border rounded-md bg-background/50" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">Sample Field 3</label>
                <div className="w-full h-10 border rounded-md bg-background/50" />
              </div>
            </>
          )}

          {firstPage.fields.length > 3 && (
            <p className="text-sm text-muted-foreground italic">
              ... and {firstPage.fields.length - 3} more field
              {firstPage.fields.length - 3 !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Submit Button Preview */}
        <div className="flex justify-end">
          <Button disabled>
            {buttonText}
          </Button>
        </div>
      </div>

      {/* Layout Info */}
      <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Theme:</span>
          <span className="font-medium capitalize">{layout.theme || 'light'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Spacing:</span>
          <span className="font-medium capitalize">{layout.spacing || 'normal'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Layout Code:</span>
          <span className="font-medium capitalize">{layout.code || 'default'}</span>
        </div>
      </div>
    </div>
  );
}
