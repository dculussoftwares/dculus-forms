import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { Button, Badge, Separator } from '@dculus/ui-v2';
import {
  FormField,
  FillableFormField,
  FieldType,
  NumberField,
  SelectField,
  RadioField,
  CheckboxField,
} from '@dculus/types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

/**
 * Simple field preview component - shows how each field will look to respondents
 * This is a read-only preview, not an interactive form
 */
function FieldPreview({ field }: { field: FormField }) {
  const isFillable = field instanceof FillableFormField ||
                     'label' in field;

  if (!isFillable) return null;

  const fillableField = field as FillableFormField;
  const label = fillableField.label || 'Untitled Field';
  const required = fillableField.validation?.required || false;
  const hint = fillableField.hint;
  const placeholder = fillableField.placeholder;

  // Common label component
  const FieldLabel = () => (
    <label className="block text-sm font-medium mb-2">
      {label}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );

  const FieldHint = () => hint ? (
    <p className="text-xs text-muted-foreground mt-1">{hint}</p>
  ) : null;

  // Render based on field type
  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
      return (
        <div className="space-y-1">
          <FieldLabel />
          <input
            type="text"
            placeholder={placeholder || 'Enter text...'}
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled
          />
          <FieldHint />
        </div>
      );

    case FieldType.TEXT_AREA_FIELD:
      return (
        <div className="space-y-1">
          <FieldLabel />
          <textarea
            placeholder={placeholder || 'Enter long text...'}
            className="w-full px-3 py-2 border rounded-md bg-background min-h-[100px]"
            disabled
          />
          <FieldHint />
        </div>
      );

    case FieldType.EMAIL_FIELD:
      return (
        <div className="space-y-1">
          <FieldLabel />
          <input
            type="email"
            placeholder={placeholder || 'email@example.com'}
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled
          />
          <FieldHint />
        </div>
      );

    case FieldType.NUMBER_FIELD:
      const numberField = field as NumberField;
      return (
        <div className="space-y-1">
          <FieldLabel />
          <input
            type="number"
            placeholder={placeholder || 'Enter number...'}
            min={numberField.min}
            max={numberField.max}
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled
          />
          <FieldHint />
        </div>
      );

    case FieldType.DATE_FIELD:
      return (
        <div className="space-y-1">
          <FieldLabel />
          <input
            type="date"
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled
          />
          <FieldHint />
        </div>
      );

    case FieldType.SELECT_FIELD:
      const selectField = field as SelectField;
      return (
        <div className="space-y-1">
          <FieldLabel />
          <select
            className="w-full px-3 py-2 border rounded-md bg-background"
            disabled
          >
            <option>Select an option...</option>
            {selectField.options?.map((opt, idx) => (
              <option key={idx}>{opt}</option>
            ))}
          </select>
          <FieldHint />
        </div>
      );

    case FieldType.RADIO_FIELD:
      const radioField = field as RadioField;
      return (
        <div className="space-y-2">
          <FieldLabel />
          <div className="space-y-2">
            {radioField.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2">
                <input type="radio" name={field.id} disabled />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
          <FieldHint />
        </div>
      );

    case FieldType.CHECKBOX_FIELD:
      const checkboxField = field as CheckboxField;
      return (
        <div className="space-y-2">
          <FieldLabel />
          <div className="space-y-2">
            {checkboxField.options?.map((opt, idx) => (
              <label key={idx} className="flex items-center gap-2">
                <input type="checkbox" disabled />
                <span className="text-sm">{opt}</span>
              </label>
            ))}
          </div>
          <FieldHint />
        </div>
      );

    case FieldType.RICH_TEXT_FIELD:
      return (
        <div className="space-y-1">
          <FieldLabel />
          <div className="border rounded-md p-3 bg-muted/30 min-h-[150px]">
            <p className="text-sm text-muted-foreground italic">
              Rich text editor (preview)
            </p>
          </div>
          <FieldHint />
        </div>
      );

    default:
      return (
        <div className="p-3 border rounded-md bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Unsupported field type: {field.type}
          </p>
        </div>
      );
  }
}

/**
 * Preview Renderer - Shows how the form will look to respondents
 * Includes multi-page navigation if form has multiple pages
 */
export function PreviewRenderer() {
  const { pages } = useFormBuilderStore();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  if (pages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2 max-w-md">
          <p className="text-sm text-muted-foreground">
            No pages in your form yet. Add a page in the Page Builder to see the preview.
          </p>
        </div>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const hasMultiplePages = pages.length > 1;
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === pages.length - 1;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Form Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Form Preview</h2>
          {hasMultiplePages && (
            <Badge variant="secondary">
              Page {currentPageIndex + 1} of {pages.length}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          This is how your form will appear to respondents
        </p>
      </div>

      <Separator className="mb-8" />

      {/* Page Title */}
      {currentPage.title && (
        <div className="mb-6">
          <h3 className="text-xl font-semibold">{currentPage.title}</h3>
        </div>
      )}

      {/* Fields */}
      {currentPage.fields.length > 0 ? (
        <div className="space-y-6 mb-8">
          {currentPage.fields.map((field) => (
            <FieldPreview key={field.id} field={field} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center border-2 border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">
            No fields on this page yet. Add fields in the Page Builder.
          </p>
        </div>
      )}

      {/* Navigation for multi-page forms */}
      {hasMultiplePages && (
        <>
          <Separator className="my-8" />
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentPageIndex(currentPageIndex - 1)}
              disabled={isFirstPage}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="text-sm text-muted-foreground">
              Page {currentPageIndex + 1} of {pages.length}
            </div>

            <Button
              onClick={() => setCurrentPageIndex(currentPageIndex + 1)}
              disabled={isLastPage}
            >
              {isLastPage ? 'Submit' : 'Next'}
              {!isLastPage && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </>
      )}

      {/* Single page submit button */}
      {!hasMultiplePages && currentPage.fields.length > 0 && (
        <>
          <Separator className="my-8" />
          <div className="flex justify-end">
            <Button>Submit</Button>
          </div>
        </>
      )}
    </div>
  );
}
