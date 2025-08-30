# Field Settings Components

This directory contains the refactored components from the original `FieldSettings.tsx` component, organized for better maintainability and reusability.

## Overview

The field settings components provide a modular interface for configuring form field properties, validation rules, and type-specific options in the collaborative form builder.

**Original Component**: `FieldSettings.tsx` (727 lines) → **Refactored**: 14 focused components (~50 lines each)

## Architecture

### Component Hierarchy

```
FieldSettings (Main Container)
├── FieldSettingsHeader          # Field type display & dirty state
├── ValidationSummary            # Error summary display
├── BasicSettings                # Common field properties
├── FieldTypeSpecificSettings    # Type-based configuration
└── FieldSettingsFooter          # Actions & keyboard shortcuts
```

### Component Categories

#### **1. Layout Components**
- `FieldSettingsHeader.tsx` - Header with field type and unsaved changes indicator
- `FieldSettingsFooter.tsx` - Action buttons and keyboard shortcut hints

#### **2. Form Sections**
- `BasicSettings.tsx` - Label, hint text, and default value inputs
- `ValidationSettings.tsx` - Required field checkbox
- `FieldTypeSpecificSettings.tsx` - Router for field-type specific settings

#### **3. Field-Type Specific**
- `TextInputSettings.tsx` - Placeholder text configuration
- `PrefixSettings.tsx` - Field prefix (e.g., "$", "@") configuration
- `OptionsSettings.tsx` - Options management for select/radio/checkbox fields
- `MultipleSelectionSettings.tsx` - Allow multiple selections checkbox
- `NumberRangeSettings.tsx` - Min/max constraints for number fields
- `DateRangeSettings.tsx` - Date range constraints for date fields

#### **4. UI Utilities**
- `ErrorMessage.tsx` - Reusable error message display
- `ValidationSummary.tsx` - Form-wide validation error summary
- `DefaultValueInput.tsx` - Default value input with type-specific handling

## Component Details

### Main Container: FieldSettings

**File**: `../FieldSettings.tsx`
**Purpose**: Orchestrates all field settings components and handles business logic

**Key Responsibilities**:
- Auto-save logic when switching between fields
- Keyboard shortcuts (Cmd/Ctrl+S, Escape)
- Form state management via `useFieldEditor` hook
- Component composition and layout

**Props**:
```typescript
interface FieldSettingsProps {
  field: FormField | null;           // Current field being edited
  isConnected: boolean;              // Real-time collaboration status
  onUpdate?: (updates: Record<string, any>) => void;
  onFieldSwitch?: () => void;
}
```

### Layout Components

#### FieldSettingsHeader

**Purpose**: Displays field type information and dirty state indicator

**Features**:
- Field type icon and label display
- Animated "unsaved changes" indicator
- Responsive background color changes based on dirty state

**Props**:
```typescript
interface FieldSettingsHeaderProps {
  field: FormField;    // Field to display type info for
  isDirty: boolean;    // Whether form has unsaved changes
}
```

#### FieldSettingsFooter

**Purpose**: Action buttons and user guidance

**Features**:
- Reset, Cancel, Save buttons with proper disabled states
- Connection status indicator
- Keyboard shortcut hints
- Save button tooltip for validation errors

**Props**:
```typescript
interface FieldSettingsFooterProps {
  isDirty: boolean;
  isValid: boolean;
  isConnected: boolean;
  isSaving: boolean;
  errors: Record<string, any>;
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}
```

### Form Section Components

#### BasicSettings

**Purpose**: Common field properties shared across all field types

**Fields Included**:
- **Label**: Display name for the field
- **Help Text**: Additional guidance for users
- **Default Value**: Pre-filled value (type-aware via `DefaultValueInput`)

**Props**:
```typescript
interface BasicSettingsProps {
  control: Control<any>;           // React Hook Form control
  errors: Record<string, any>;     // Form validation errors
  isConnected: boolean;            // Collaboration connection status
  field: FormField | null;         // Current field for type-specific logic
  watch: (name: string) => any;    // React Hook Form watch function
}
```

#### ValidationSettings

**Purpose**: Field validation configuration

**Fields Included**:
- **Required Field**: Checkbox to make field mandatory

**Note**: Expandable for future validation rules (min length, regex patterns, etc.)

#### FieldTypeSpecificSettings

**Purpose**: Routes to appropriate field-type specific components

**Supported Field Types**:
- `TEXT_INPUT_FIELD` → TextInputSettings + PrefixSettings
- `TEXT_AREA_FIELD` → TextInputSettings + PrefixSettings  
- `EMAIL_FIELD` → TextInputSettings
- `NUMBER_FIELD` → TextInputSettings + PrefixSettings + NumberRangeSettings
- `SELECT_FIELD` → OptionsSettings + MultipleSelectionSettings
- `RADIO_FIELD` → OptionsSettings
- `CHECKBOX_FIELD` → OptionsSettings
- `DATE_FIELD` → DateRangeSettings

### Field-Type Specific Components

#### TextInputSettings

**Purpose**: Placeholder text configuration for text-based fields

**Fields**: Placeholder text input

#### PrefixSettings

**Purpose**: Field prefix configuration (e.g., "$" for currency, "@" for mentions)

**Fields**: Prefix text input

#### OptionsSettings

**Purpose**: Manage options for select, radio, and checkbox fields

**Features**:
- Add new options
- Edit existing options
- Remove options
- Dynamic placeholder text (`Option 1`, `Option 2`, etc.)

**Props**:
```typescript
interface OptionsSettingsProps {
  options: string[];                          // Current options array
  isConnected: boolean;                      // Connection status
  errors: Record<string, any>;               // Validation errors
  addOption: () => void;                     // Add new option
  updateOption: (index: number, value: string) => void;  // Update option
  removeOption: (index: number) => void;     // Remove option
}
```

#### NumberRangeSettings

**Purpose**: Min/max constraints for number fields

**Fields**:
- **Minimum**: Lower bound for number input
- **Maximum**: Upper bound for number input

**Validation**: Ensures min ≤ max

#### DateRangeSettings

**Purpose**: Date range constraints for date fields

**Fields**:
- **Minimum Date**: Earliest selectable date
- **Maximum Date**: Latest selectable date

**Integration**: Default value input respects these constraints

### UI Utility Components

#### ErrorMessage

**Purpose**: Reusable error message display with consistent styling

**Features**:
- Consistent error styling across all components
- Icon + message layout
- Animation support
- Handles both string and object error formats

#### ValidationSummary

**Purpose**: Display all form validation errors in a summary format

**Features**:
- Categorizes errors into global vs field-specific
- User-friendly error formatting
- Prominent styling to draw attention

#### DefaultValueInput

**Purpose**: Type-aware default value input component

**Features**:
- **Date Fields**: Renders date input with min/max constraints
- **Other Fields**: Standard text input
- Proper validation error styling
- Real-time constraint checking

## Usage Patterns

### Adding New Field Types

1. **Add to FieldTypeSpecificSettings**: Add new case in switch statement
2. **Create Type Component**: Follow existing component patterns
3. **Update Types**: Add field type to `@dculus/types` package
4. **Add Validation**: Include validation rules in `useFieldEditor`

### Creating New Setting Components

```typescript
// Template for new field settings component
import React from 'react';
import { Controller, Control } from 'react-hook-form';
import { Input, Label } from '@dculus/ui';
import { ErrorMessage } from './ErrorMessage';

interface NewSettingsProps {
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
  // Add other props as needed
}

export const NewSettings: React.FC<NewSettingsProps> = ({
  control,
  errors,
  isConnected
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
        Setting Category Name
      </h4>
      
      <div className="space-y-2">
        <Label htmlFor="field-name" className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Field Label
        </Label>
        <Controller
          name="fieldName"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              id="field-name"
              placeholder="Placeholder text"
              disabled={!isConnected}
              className={`text-sm ${errors.fieldName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              value={field.value || ''}
            />
          )}
        />
        <ErrorMessage error={errors.fieldName?.message} />
      </div>
    </div>
  );
};
```

### Integration with Main Component

```typescript
// In FieldSettings.tsx
import { NewSettings } from './field-settings';

// Add to FieldTypeSpecificSettings or create new section
<NewSettings
  control={control}
  errors={errors}
  isConnected={isConnected}
/>
```

## Styling Conventions

### CSS Classes
- **Container**: `space-y-4` for sections, `space-y-2` for fields
- **Labels**: `text-xs font-medium text-gray-700 dark:text-gray-300`
- **Inputs**: `text-sm` + error styling when applicable
- **Errors**: Consistent via `ErrorMessage` component
- **Headings**: `text-sm font-medium text-gray-900 dark:text-white`

### Error Styling
```typescript
className={`text-sm ${errors.fieldName ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
```

### Dark Mode
All components support dark mode via Tailwind's `dark:` prefix classes.

## State Management

### React Hook Form Integration
- All form inputs use `Controller` from react-hook-form
- Validation errors passed down from parent `useFieldEditor` hook
- Form state (`isDirty`, `isValid`) managed at parent level

### Real-time Collaboration
- `isConnected` prop disables inputs when offline
- Auto-save logic handled in main `FieldSettings` component
- YJS synchronization handled at form builder level

## Testing Strategy

### Unit Testing
Each component is isolated and easily testable:

```typescript
// Example test structure
describe('TextInputSettings', () => {
  it('renders placeholder input', () => {
    // Test placeholder input rendering
  });
  
  it('shows error message when invalid', () => {
    // Test error state
  });
  
  it('disables input when not connected', () => {
    // Test offline state
  });
});
```

### Integration Testing
- Test component interaction within `FieldSettings`
- Verify field type switching
- Test auto-save behavior

## Performance Considerations

### Memoization
Consider wrapping components in `React.memo` for expensive renders:

```typescript
export const TextInputSettings = React.memo<TextInputSettingsProps>(({
  control,
  errors,
  isConnected
}) => {
  // Component implementation
});
```

### Bundle Size
- Components are tree-shakeable via barrel exports in `index.ts`
- Only import what's needed for specific field types

## Future Enhancements

### Planned Features
1. **Advanced Validation Rules**: Pattern matching, custom validators
2. **Conditional Logic**: Show/hide fields based on other field values  
3. **Field Templates**: Pre-configured field settings
4. **Bulk Operations**: Apply settings to multiple fields
5. **Field Groups**: Organize related fields together

### Architecture Improvements
1. **Context API**: Share common state across components
2. **Custom Hooks**: Extract reusable logic (e.g., `useFieldValidation`)
3. **Async Validation**: Server-side validation for complex rules
4. **Accessibility**: Enhanced ARIA labels and keyboard navigation

## Dependencies

### Internal Dependencies
- `@dculus/ui` - UI components (Button, Input, Label, Textarea)
- `@dculus/types` - TypeScript definitions (FormField, FieldType)
- `react-hook-form` - Form state management
- `lucide-react` - Icons

### External Dependencies  
- `react` - Component framework
- `typescript` - Type safety

## Related Files

- `../FieldSettings.tsx` - Main container component
- `../../hooks/useFieldEditor.ts` - Form state management hook
- `../../../types/` - Type definitions
- `../../../../packages/types/` - Shared type definitions

This modular architecture enables easier maintenance, testing, and future feature development while maintaining the same user experience as the original monolithic component.