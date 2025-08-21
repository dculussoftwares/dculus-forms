# RendererMode Implementation - Layout Component Changes

This document outlines the changes made to implement mode-specific behavior in the LayoutRenderer system.

## Overview

The RendererMode system has been implemented to provide different behaviors based on the current mode:
- **PREVIEW**: For viewing forms in a read-only state
- **BUILDER**: For editing and building forms with full interaction capabilities
- **SUBMISSION**: For users submitting forms (read-only, similar to PREVIEW)

## Mode-Specific Behavior Table

| Component Feature | BUILDER Mode | PREVIEW Mode | SUBMISSION Mode |
|------------------|--------------|--------------|-----------------|
| **Text Editor (LexicalRichTextEditor)** | ✅ Editable (when in Edit mode) | ❌ Not Editable | ❌ Not Editable |
| **View/Edit Mode Toggle Button** | ✅ Visible | ❌ Hidden | ❌ Hidden |
| **Save/Cancel Buttons** | ✅ Visible (when editing) | ❌ Hidden | ❌ Hidden |
| **Form Fields** | 🔧 Disabled/Read-only | 📝 Interactive for user input | 📝 Interactive for submission |
| **Navigation (Next/Previous)** | ❌ No Validation | ✅ Validation Required | ✅ Validation Required |
| **Field Validation Display** | ❌ Hidden | ✅ Shows validation errors | ✅ Shows validation errors |
| **Page Navigation Buttons** | ➡️ Always enabled | 🚫 Disabled until valid | 🚫 Disabled until valid |

## Technical Implementation Details

### Files Modified

| File | Changes Made |
|------|--------------|
| `LayoutRenderer.tsx` | Added mode prop passing to all layout components |
| `L1ClassicLayout.tsx` | ✅ Already had mode support |
| `L2ModernLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L3CardLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L4MinimalLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L5SplitLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L6WizardLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L7SingleLayout.tsx` | Added mode prop, conditional UI controls, text editor editability |
| `L8ImageLayout.tsx` | Added mode prop (no text editor) |
| `L9PagesLayout.tsx` | Added mode prop (no text editor) |
| `PageRenderer.tsx` | Mode prop passed to FormFieldRenderer components, validation logic, navigation control |
| `FormFieldRenderer.tsx` | Mode-aware field rendering, interactive form fields, validation display |

### Code Pattern Applied

For each layout component with text editors (L1-L7):

```typescript
// 1. Import RendererMode
import { getImageUrl, RendererMode } from '@dculus/utils';

// 2. Add mode prop to interface
interface LayoutProps {
  // ... existing props
  mode?: RendererMode;
}

// 3. Add mode parameter with default
export const Layout: React.FC<LayoutProps> = ({
  // ... existing params
  mode = RendererMode.PREVIEW
}) => {

// 4. Conditional UI controls
{mode === RendererMode.BUILDER && (
  <div className="flex justify-between items-center mb-4">
    {/* View/Edit buttons and Save/Cancel buttons */}
  </div>
)}

// 5. Mode-aware text editor
<LexicalRichTextEditor
  editable={mode === RendererMode.BUILDER ? isEditMode : false}
  // ... other props
/>

// 6. Pass mode to PageRenderer
<PageRenderer mode={mode} />
```

### Page Navigation Validation System

**PageRenderer Validation Logic:**

```typescript
// Field validation function
const isFieldValid = (field: any, value: any): boolean => {
  const isFillable = field instanceof FillableFormField || 
                    (field as any).validation !== undefined;
  
  if (!isFillable) return true; // Non-fillable fields are always valid
  
  const validation = (field as any).validation;
  if (!validation?.required) return true; // Optional fields are always valid
  
  // Check if field has a value and validate by type
  switch (field.type) {
    case FieldType.EMAIL_FIELD:
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
    case FieldType.NUMBER_FIELD:
      // Validate number range constraints
    case FieldType.CHECKBOX_FIELD:
      return Array.isArray(value) ? value.length > 0 : false;
    // ... other field type validations
  }
};

// Mode-aware navigation logic
const canGoNext = useMemo(() => {
  const hasNextPage = currentPageIndex < pages.length - 1;
  if (!hasNextPage) return false;
  
  // In BUILDER mode, always allow navigation
  if (mode === RendererMode.BUILDER) return true;
  
  // In PREVIEW and SUBMISSION modes, check validation
  if (mode === RendererMode.PREVIEW || mode === RendererMode.SUBMISSION) {
    return isPageValid(currentPageIndex);
  }
  
  return hasNextPage;
}, [currentPageIndex, pages.length, mode, formValues]);
```

**FormFieldRenderer Interactive Fields:**

```typescript
// Interactive field rendering for PREVIEW and SUBMISSION modes
// BUILDER mode fields are disabled/read-only
const isInteractive = mode === RendererMode.PREVIEW || mode === RendererMode.SUBMISSION;

<input
  type="text"
  className={styles.input}
  value={value || field.defaultValue || ''}
  onChange={isInteractive && onChange ? (e) => onChange(e.target.value) : undefined}
  readOnly={!isInteractive}
/>
```

## Usage Examples

### Builder Mode (Full Editing Capabilities)
```tsx
<LayoutRenderer 
  layoutCode="L1" 
  pages={pages} 
  layout={layout}
  mode={RendererMode.BUILDER} 
/>
```

### Preview Mode (Read-Only)
```tsx
<LayoutRenderer 
  layoutCode="L1" 
  pages={pages} 
  layout={layout}
  mode={RendererMode.PREVIEW} 
/>
```

### Submission Mode (User Filling Form)
```tsx
<LayoutRenderer 
  layoutCode="L1" 
  pages={pages} 
  layout={layout}
  mode={RendererMode.SUBMISSION} 
/>
```

## Testing Checklist

### Layout and Text Editor
- [ ] In PREVIEW mode: Text editor is not editable, buttons are hidden
- [ ] In SUBMISSION mode: Text editor is not editable, buttons are hidden
- [ ] In BUILDER mode: Text editor becomes editable when Edit mode is activated
- [ ] In BUILDER mode: View/Edit toggle button is visible and functional
- [ ] In BUILDER mode: Save/Cancel buttons appear when editing and function correctly

### Form Field Validation
- [ ] In SUBMISSION mode: Form fields are interactive and accept user input
- [ ] In PREVIEW mode: Form fields are interactive and accept user input
- [ ] In BUILDER mode: Form fields are disabled/read-only for layout preview
- [ ] Required field validation works for all field types (text, email, number, date, select, radio, checkbox)
- [ ] Validation errors display with red styling and error messages

### Page Navigation 
- [ ] In BUILDER mode: Navigation buttons always enabled regardless of validation
- [ ] In PREVIEW/SUBMISSION mode: Next button disabled until current page validation passes
- [ ] In PREVIEW/SUBMISSION mode: Previous button always enabled (no validation required)
- [ ] Validation error styling applied to Next button when validation fails
- [ ] Page dot navigation respects validation rules
- [ ] Validation errors reset when navigating to different pages

### System Integration
- [ ] Mode prop is properly passed down through the component hierarchy
- [ ] All layout components (L1-L9) respect the mode settings
- [ ] TypeScript compilation passes without errors
- [ ] No visual regressions in existing functionality
- [ ] Form state management works correctly across page navigation
- [ ] Validation logic handles edge cases (empty values, invalid formats, etc.)

## Future Enhancements

The RendererMode system is designed to be extensible. Future modes could include:
- **PREVIEW_ADMIN**: Admin preview with additional controls
- **READONLY**: Completely read-only mode for archived forms
- **TEMPLATE**: Template creation mode with specialized tools

---
**Generated for Claude Code** - This documentation helps maintain consistency and understanding of the RendererMode implementation across the dculus-forms codebase.