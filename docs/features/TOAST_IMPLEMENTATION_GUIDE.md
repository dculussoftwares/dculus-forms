# Toast Notification Implementation Guide

This document outlines the standardized approach for implementing Sonner toast notifications in the Dculus Forms application.

## Overview

The application uses Sonner for toast notifications to provide user feedback for various operations. All toast notifications are centralized through the `@dculus/ui` package and follow consistent patterns.

## Import Pattern

Always import toast functions from the centralized UI package:

```typescript
import { toastSuccess, toastError, toastInfo } from '@dculus/ui';
```

## Implementation Patterns

### 1. GraphQL Mutation Callbacks

For Apollo Client mutations, implement toasts in the `onCompleted` and `onError` callbacks:

```typescript
const [mutationName, { loading }] = useMutation(MUTATION, {
  onCompleted: (data) => {
    toastSuccess('Operation completed successfully', `Additional context: ${data.result.name}`);
    // Other success logic...
  },
  onError: (error) => {
    toastError('Operation failed', error.message);
    // Other error handling...
  }
});
```

### 2. Permission-Based Operations

For operations that require specific permissions, show contextual error messages:

```typescript
const handlePermissionViolation = (action: string) => {
  toastError(
    'Permission denied', 
    `You don't have permission to ${action.toLowerCase()}. You need ${requiredPermission} access.`
  );
};
```

### 3. Form Operations

#### Create Operations
```typescript
// Success pattern
toastSuccess('Form created successfully', `"${formTitle}" is ready for editing`);

// Error pattern
toastError('Failed to create form', error.message);
```

#### Update Operations
```typescript
// Success pattern
toastSuccess('Settings saved successfully');

// Error pattern
toastError('Failed to save settings', error.message);
```

#### Delete Operations
```typescript
// Success pattern
toastSuccess('Item deleted successfully');

// Error pattern
toastError('Failed to delete item', error.message);
```

### 4. Sharing and Permissions

#### Share Modal Operations
```typescript
// Sharing settings update
toastSuccess('Form sharing settings updated successfully');
toastError('Failed to update sharing settings', error.message);

// Permission updates
toastSuccess('User permission updated successfully');
toastError('Failed to update user permission', error.message);

// Access removal
toastSuccess('User access removed successfully');
toastError('Failed to remove user access', error.message);
```

#### Copy to Clipboard
```typescript
try {
  await navigator.clipboard.writeText(textToCopy);
  toastSuccess('Copied to clipboard', 'Content has been copied successfully');
} catch (error) {
  toastError('Failed to copy', 'Unable to access clipboard');
}
```

### 5. Authentication Operations

```typescript
// Sign out success
toastSuccess('Signed out successfully', 'You have been signed out of your account');

// Sign out error
toastError('Sign out failed', 'There was an error signing you out. Please try again.');
```

### 6. Organization Management

#### Invitations
```typescript
// Send invitation
toastSuccess('Invitation sent successfully', `An invitation has been sent to ${email}`);
toastError('Error sending invitation', error.message);

// Cancel invitation
toastSuccess('Invitation cancelled', 'The invitation has been cancelled successfully');
toastError('Error cancelling invitation', error.message);
```

## Message Structure

### Success Messages
- **Title**: Brief, positive action confirmation
- **Description**: Additional context or next steps (optional)

```typescript
toastSuccess('Action completed', 'Optional additional context');
```

### Error Messages
- **Title**: Clear error description
- **Description**: Detailed error message or troubleshooting hint

```typescript
toastError('Action failed', 'Detailed error message from server or context');
```

### Information Messages
- **Title**: Informational headline
- **Description**: Additional details

```typescript
toastInfo('Information title', 'Additional details');
```

## Common Implementation Locations

### 1. React Components
Add toasts for user-triggered actions:
- Form submissions
- Button clicks
- Menu item selections

### 2. Custom Hooks
Add toasts for:
- Permission violations
- Data fetching errors
- State update confirmations

### 3. GraphQL Operations
Add toasts for:
- Mutation success/failure
- Network errors
- Data validation errors

## Files Already Implementing Toast Notifications

### Core Components
- `/apps/form-app/src/components/sharing/ShareModal.tsx`
- `/apps/form-app/src/components/CreateFormPopover.tsx` 
- `/apps/form-app/src/components/UseTemplatePopover.tsx`
- `/apps/form-app/src/components/app-sidebar.tsx`

### Organization Management
- `/apps/form-app/src/components/organization/InviteUserDialog.tsx`
- `/apps/form-app/src/components/organization/InvitationsList.tsx`

### Hooks and Utilities
- `/apps/form-app/src/hooks/usePermissionAwareFormBuilder.ts`
- `/apps/form-app/src/hooks/useFormSettings.ts`

### Form Builder Components
- `/apps/form-app/src/components/form-settings/SubmissionLimitsSettings.tsx`
- `/apps/form-app/src/pages/FormSettings.tsx`

## Best Practices

### 1. Consistency
- Use the same toast function imports across all components
- Follow the same message structure patterns
- Maintain consistent terminology

### 2. User Experience
- Provide immediate feedback for all user actions
- Include context-specific information in messages
- Use appropriate toast types (success, error, info)

### 3. Error Handling
- Always include server error messages in error toasts
- Provide actionable guidance when possible
- Don't expose technical details to end users

### 4. Permission-Aware Messages
- Include current and required permission levels
- Explain what action was blocked and why
- Guide users toward appropriate next steps

## Integration with Existing Systems

### Apollo Client Integration
Toast notifications work seamlessly with Apollo Client's mutation callbacks and error handling.

### Permission System Integration  
Toast notifications are integrated with the permission-aware form builder to provide contextual feedback when users attempt unauthorized actions.

### Better-Auth Integration
Authentication operations include appropriate toast feedback for sign-in, sign-out, and session management.

## Future Implementation Guidelines

When adding new features that require user feedback:

1. **Identify the operation type** (create, update, delete, permission-based)
2. **Choose appropriate message patterns** from this guide
3. **Import toast functions** from `@dculus/ui`
4. **Implement in mutation callbacks** or action handlers
5. **Test both success and error scenarios**
6. **Ensure message consistency** with existing implementations

## Testing Toast Notifications

### Manual Testing
- Trigger success scenarios and verify toast appearance
- Trigger error scenarios and verify error message display
- Test permission violations for appropriate messaging
- Verify toast auto-dismiss functionality

### Error Scenarios to Test
- Network failures
- Permission violations  
- Validation errors
- Server errors
- Clipboard access failures

This guide ensures consistent, user-friendly toast notification implementation across the entire Dculus Forms application.