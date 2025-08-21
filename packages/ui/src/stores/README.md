# Form Response Store

A Zustand-based state management solution for handling form responses mapped by page ID and field ID. This store provides centralized state management for multi-page forms with full DevTools support.

## Features

- **Page-aware responses**: Store responses organized by `pageId -> fieldId -> value`
- **DevTools integration**: Full Redux DevTools support for debugging
- **Cross-page persistence**: Values maintained when navigating between pages
- **Utility functions**: Helper functions for common operations
- **TypeScript support**: Fully typed with comprehensive interfaces

## Basic Usage

```typescript
import { useFormResponseStore, useFormResponseUtils } from '@dculus/ui';

function MyFormComponent() {
  const { setFieldValue, getFieldValue, getPageResponses } = useFormResponseStore();
  const { getFormattedResponses } = useFormResponseUtils();
  
  // Set a field value
  setFieldValue('page-1', 'email-field', 'user@example.com');
  
  // Get a specific field value
  const email = getFieldValue('page-1', 'email-field');
  
  // Get all responses for a page
  const pageResponses = getPageResponses('page-1');
  
  // Get flattened responses for form submission
  const formattedForSubmission = getFormattedResponses();
}
```

## Store API

### Core Actions

#### `setFieldValue(pageId: string, fieldId: string, value: any)`
Set a value for a specific field on a specific page.

#### `getFieldValue(pageId: string, fieldId: string): any`
Get the current value of a specific field.

#### `getPageResponses(pageId: string): Record<string, any>`
Get all field responses for a specific page.

#### `getAllResponses(): Record<string, Record<string, any>>`
Get the complete response state (all pages and fields).

### Management Actions

#### `clearPageResponses(pageId: string)`
Clear all responses for a specific page.

#### `clearAllResponses()`
Clear all responses across all pages.

#### `setPageResponses(pageId: string, responses: Record<string, any>)`
Set multiple field responses for a page at once.

### Utility Actions

#### `hasFieldValue(pageId: string, fieldId: string): boolean`
Check if a field has a non-empty value.

#### `getFieldValueCount(pageId: string): number`
Get the count of fields with non-empty values on a page.

## Utility Hook: `useFormResponseUtils`

### `getFormattedResponses()`
Returns a flattened object with all responses, suitable for form submission:
```typescript
// Instead of: { 'page-1': { 'field-1': 'value' }, 'page-2': { 'field-2': 'value2' } }
// Returns: { 'field-1': 'value', 'field-2': 'value2' }
```

### `getPageCompletionStatus(pageId: string, requiredFields?: string[])`
Returns detailed completion status for a page:
```typescript
const status = getPageCompletionStatus('page-1', ['name', 'email']);
// Returns:
// {
//   totalFields: 5,
//   completedFields: 3,
//   requiredFields: 2,
//   requiredCompleted: 1,
//   isComplete: false
// }
```

### `initializePageFromDefaults(pageId: string, defaultValues: Record<string, any>)`
Initialize a page with default values while preserving existing user input.

## Integration with FormRenderer

The store is automatically integrated with `FormRenderer`, `PageRenderer`, and `FormFieldRenderer`. 

### FormRenderer Integration
```typescript
<FormRenderer
  formSchema={schema}
  mode={RendererMode.PREVIEW}
  onResponseChange={(responses) => {
    // Receives flattened responses whenever they change
    console.log('Form responses updated:', responses);
  }}
/>
```

### Context Access
```typescript
import { useFormResponseContext } from '@dculus/ui';

function CustomFormComponent() {
  const { formSchema, mode } = useFormResponseContext();
  // Access to form context within FormRenderer
}
```

## DevTools Integration

The store is configured with Redux DevTools support:

1. Install the Redux DevTools browser extension
2. Open your browser's developer tools
3. Look for the "Redux" tab
4. Find "form-response-store" in the instances dropdown
5. Monitor state changes in real-time

### DevTools Features
- **Action tracking**: See every `setFieldValue`, `clearPageResponses`, etc.
- **State inspection**: Browse the current state tree
- **Time travel**: Jump to any previous state
- **Action replay**: Replay sequences of actions

## State Structure

```typescript
{
  responses: {
    'page-1': {
      'field-name': 'John Doe',
      'field-email': 'john@example.com',
      'field-phone': '+1234567890'
    },
    'page-2': {
      'field-message': 'Hello world!',
      'field-rating': 5
    }
  }
}
```

## Multi-Page Form Example

```typescript
function MultiPageForm() {
  const { setFieldValue, getPageResponses } = useFormResponseStore();
  const { getPageCompletionStatus } = useFormResponseUtils();
  
  const handlePageComplete = (pageId: string) => {
    const responses = getPageResponses(pageId);
    const status = getPageCompletionStatus(pageId, ['name', 'email']);
    
    if (status.isComplete) {
      // Allow navigation to next page
      console.log('Page completed with responses:', responses);
    } else {
      // Show validation errors
      console.log('Missing required fields');
    }
  };
  
  return (
    <FormRenderer
      formSchema={multiPageSchema}
      mode={RendererMode.PREVIEW}
      onResponseChange={(responses) => {
        // Handle global response changes
        console.log('All responses:', responses);
      }}
    />
  );
}
```

## Development Helpers

In development mode, the store is exposed globally for debugging:

```javascript
// In browser console
window.formResponseStore.getState() // Current state
window.formResponseStore.setState({ responses: {} }) // Manually set state
```

## Best Practices

1. **Page IDs**: Use consistent, meaningful page IDs that match your `FormPage.id`
2. **Field IDs**: Ensure field IDs are unique across the entire form (not just per page)
3. **Validation**: Use `getPageCompletionStatus` for page-level validation
4. **Submission**: Use `getFormattedResponses` for final form submission
5. **Cleanup**: Call `clearAllResponses` when switching between different forms

## Type Safety

The store is fully typed with TypeScript:

```typescript
import type { FormResponseState } from '@dculus/ui';

// Use the type for custom implementations
const customStore: FormResponseState = {
  responses: {},
  setFieldValue: (pageId, fieldId, value) => { /* implementation */ },
  // ... other methods
};
```