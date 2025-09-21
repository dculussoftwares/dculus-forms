# Form Response Edit Feature Implementation Plan

## Overview
This document outlines the implementation plan for adding form response editing capabilities to the dculus-forms application. The feature will allow users to edit submitted responses directly from the Table View by reusing the existing Form Viewer architecture.

## Current Architecture Analysis

### Table View Implementation (`ResponsesTable.tsx`)
- **Location**: `apps/form-app/src/pages/ResponsesTable.tsx:418-449`
- **Current State**: Has placeholder edit action buttons in the actions column
- **Table Library**: Uses TanStack table with actions dropdown menu
- **Current Behavior**: Logs `'Edit response: ${responseId}'` on edit button click
- **Actions Available**: View Details, Delete (placeholder)

### Form Viewer Architecture (`FormViewer.tsx`)
- **Location**: `apps/form-viewer/src/pages/FormViewer.tsx`
- **Core Component**: Uses `FormRenderer` from `@dculus/ui`
- **Current Modes**: `RendererMode.SUBMISSION` for new form submissions
- **Capabilities**:
  - Form schema deserialization
  - Form submission handling with validation
  - Analytics tracking
  - Thank you message display
- **Integration**: Works with GraphQL mutations for form submission

### Data Structure Analysis
```typescript
// Current FormResponse structure
interface FormResponse {
  id: string;
  formId: string;
  data: JSON; // Key-value pairs of field responses
  submittedAt: string;
  thankYouMessage: string;
}

// Current submission input
interface SubmitResponseInput {
  formId: ID!;
  data: JSON!;
  sessionId?: string;
  userAgent?: string;
  timezone?: string;
  language?: string;
  completionTimeSeconds?: number;
}
```

## Implementation Plan

### Phase 1: Backend Infrastructure

#### 1.1 GraphQL Schema Extensions
**File**: `apps/backend/src/graphql/schema.ts`

```graphql
# Add new input type for response updates
input UpdateResponseInput {
  responseId: ID!
  data: JSON!
}

# Add new mutation
type Mutation {
  updateResponse(input: UpdateResponseInput!): FormResponse!
}

# Optionally add edit tracking
type FormResponse {
  id: ID!
  formId: ID!
  data: JSON!
  submittedAt: String!
  lastEditedAt: String
  editCount: Int
}
```

#### 1.2 Backend Resolver Implementation
**File**: `apps/backend/src/graphql/resolvers/responses.ts`

```typescript
// Add to Mutation resolvers
updateResponse: async (
  _: any,
  { input }: { input: UpdateResponseInput },
  context: { auth: BetterAuthContext }
) => {
  requireAuth(context.auth);

  // 1. Validate response exists
  const existingResponse = await getResponseById(input.responseId);
  if (!existingResponse) {
    throw new Error("Response not found");
  }

  // 2. Check user permissions (form owner/editor access)
  const form = await getFormById(existingResponse.formId);
  const userSession = context.auth.session;
  if (!userSession || userSession.activeOrganizationId !== form.organizationId) {
    throw new Error("Access denied: You do not have permission to edit this response");
  }

  // 3. Update response data
  return await updateResponse(input.responseId, input.data);
}
```

#### 1.3 Database Service Updates
**File**: `apps/backend/src/services/responseService.ts`

```typescript
export const updateResponse = async (responseId: string, data: any) => {
  return await prisma.formResponse.update({
    where: { id: responseId },
    data: {
      data: data,
      lastEditedAt: new Date(),
      editCount: { increment: 1 }
    }
  });
};
```

### Phase 2: Form Renderer Enhancement

#### 2.1 Extend RendererMode
**File**: `packages/utils/src/constants.ts`

```typescript
export enum RendererMode {
  SUBMISSION = 'submission',
  EDIT = 'edit',        // Add new edit mode
  PREVIEW = 'preview'
}
```

#### 2.2 FormRenderer Updates
**File**: `packages/ui/src/renderers/FormRenderer.tsx`

```typescript
interface FormRendererProps {
  // ... existing props
  mode: RendererMode;
  existingResponseData?: Record<string, any>; // Pre-fill data for edit mode
  responseId?: string; // For edit mode
  onResponseUpdate?: (responseId: string, data: Record<string, any>) => Promise<void>;
}

// In FormRenderer component:
// 1. Pre-populate form fields when mode === 'edit' and existingResponseData provided
// 2. Change submit button text based on mode
// 3. Call onResponseUpdate instead of onFormSubmit when in edit mode
```

#### 2.3 Form State Initialization
**File**: `packages/ui/src/stores/useFormResponseStore.ts`

```typescript
// Add method to initialize store with existing response data
const initializeFromResponse = (responseData: Record<string, any>) => {
  // Populate form state with existing response values
};
```

### Phase 3: Frontend Page and Routing

#### 3.1 Create Response Edit Page
**File**: `apps/form-app/src/pages/ResponseEdit.tsx`

```typescript
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { FormRenderer } from '@dculus/ui';
import { RendererMode } from '@dculus/utils';
import { GET_FORM_BY_ID, GET_RESPONSE_BY_ID, UPDATE_RESPONSE } from '../graphql/queries';

const ResponseEdit: React.FC = () => {
  const { formId, responseId } = useParams();
  const navigate = useNavigate();

  // Fetch form and response data
  const { data: formData, loading: formLoading } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId }
  });

  const { data: responseData, loading: responseLoading } = useQuery(GET_RESPONSE_BY_ID, {
    variables: { id: responseId }
  });

  const [updateResponse] = useMutation(UPDATE_RESPONSE);

  const handleResponseUpdate = async (responseId: string, data: Record<string, any>) => {
    try {
      await updateResponse({
        variables: {
          input: { responseId, data }
        }
      });

      // Success handling
      navigate(`/dashboard/form/${formId}/responses/table`);
    } catch (error) {
      // Error handling
    }
  };

  if (formLoading || responseLoading) return <LoadingSpinner />;

  return (
    <FormRenderer
      formSchema={deserializeFormSchema(formData.form.formSchema)}
      mode={RendererMode.EDIT}
      existingResponseData={responseData.response.data}
      responseId={responseId}
      onResponseUpdate={handleResponseUpdate}
      className="h-full w-full"
    />
  );
};
```

#### 3.2 Add Route Configuration
**File**: `apps/form-app/src/App.tsx`

```typescript
// Add new route
<Route
  path="/dashboard/form/:formId/responses/:responseId/edit"
  element={<ResponseEdit />}
/>
```

#### 3.3 Update Table View Navigation
**File**: `apps/form-app/src/pages/ResponsesTable.tsx:439`

```typescript
// Replace the placeholder console.log with navigation
<DropdownMenuItem
  onClick={() => navigate(`/dashboard/form/${actualFormId}/responses/${row.original.id}/edit`)}
>
  <Edit className="mr-2 h-4 w-4" />
  Edit Response
</DropdownMenuItem>
```

### Phase 4: GraphQL Integration

#### 4.1 Add GraphQL Queries and Mutations
**File**: `apps/form-app/src/graphql/queries.ts`

```typescript
export const GET_RESPONSE_BY_ID = gql`
  query GetResponseById($id: ID!) {
    response(id: $id) {
      id
      formId
      data
      submittedAt
      lastEditedAt
      editCount
    }
  }
`;

export const UPDATE_RESPONSE = gql`
  mutation UpdateResponse($input: UpdateResponseInput!) {
    updateResponse(input: $input) {
      id
      formId
      data
      submittedAt
      lastEditedAt
      editCount
    }
  }
`;
```

#### 4.2 Create Update Hook
**File**: `apps/form-app/src/hooks/useUpdateResponse.ts`

```typescript
import { useMutation } from '@apollo/client';
import { UPDATE_RESPONSE } from '../graphql/queries';
import { toastSuccess, toastError } from '@dculus/ui';

export const useUpdateResponse = () => {
  const [updateResponseMutation, { loading, error }] = useMutation(UPDATE_RESPONSE);

  const updateResponse = async (responseId: string, data: Record<string, any>) => {
    try {
      const result = await updateResponseMutation({
        variables: {
          input: { responseId, data }
        }
      });

      toastSuccess('Response updated successfully', 'Your changes have been saved');
      return result.data.updateResponse;
    } catch (error) {
      toastError('Failed to update response', error.message);
      throw error;
    }
  };

  return { updateResponse, loading, error };
};
```

### Phase 5: UI/UX Enhancements

#### 5.1 Visual Indicators in Table
**File**: `apps/form-app/src/pages/ResponsesTable.tsx`

```typescript
// Add edit indicators to table columns
{
  accessorKey: 'lastEditedAt',
  header: ({ column }) => (
    <DataTableColumnHeader column={column} title="Last Modified" />
  ),
  cell: ({ row }) => {
    const lastEdited = row.getValue('lastEditedAt');
    const submitted = row.getValue('submittedAt');

    if (lastEdited && lastEdited !== submitted) {
      return (
        <div className="flex items-center space-x-1">
          <Edit className="h-3 w-3 text-orange-500" />
          <span className="text-xs text-orange-600">Edited</span>
        </div>
      );
    }

    return <span className="text-xs text-gray-500">Original</span>;
  }
}
```

#### 5.2 Edit History Tracking (Optional Future Enhancement)
- Track edit timestamps and user information
- Show edit history in response detail view
- Implement version comparison functionality

## Implementation Checklist

### Backend Tasks
- [ ] Add `UpdateResponseInput` to GraphQL schema
- [ ] Add `updateResponse` mutation to schema
- [ ] Implement `updateResponse` resolver with authorization
- [ ] Add `updateResponse` service method
- [ ] Add database fields for edit tracking (`lastEditedAt`, `editCount`)
- [ ] Write unit tests for update functionality

### Frontend Tasks
- [ ] Add `EDIT` mode to `RendererMode` enum
- [ ] Extend `FormRenderer` to support edit mode and pre-filling
- [ ] Create `ResponseEdit.tsx` page component
- [ ] Add edit route to application routing
- [ ] Update table view edit button to navigate to edit page
- [ ] Add `GET_RESPONSE_BY_ID` and `UPDATE_RESPONSE` GraphQL operations
- [ ] Create `useUpdateResponse` custom hook
- [ ] Add edit indicators to response table
- [ ] Implement proper error handling and loading states

### Testing Tasks
- [ ] Unit tests for GraphQL resolvers
- [ ] Integration tests for response update flow
- [ ] E2E tests for complete edit workflow
- [ ] Permission boundary testing
- [ ] Form validation testing in edit mode

## Technical Considerations

### Security & Permissions
- Only form owners and users with EDITOR permission can edit responses
- Validate that the response belongs to a form in the user's active organization
- Preserve original submission metadata (submittedAt, original submitter info)

### Data Integrity
- Maintain form validation rules during editing
- Preserve response ID and form association
- Track edit history for audit purposes

### Performance
- Efficient loading of form schema and response data
- Optimistic updates for better user experience
- Proper caching strategies for edited responses

### User Experience
- Clear visual distinction between original and edited responses
- Informative success/error messages using existing toast system
- Seamless navigation between table view and edit mode
- Responsive design for edit interface

## Future Enhancements

### Advanced Features
1. **Real-time Collaboration**: Use YJS for concurrent editing of responses
2. **Bulk Editing**: Allow editing multiple responses simultaneously
3. **Response Versioning**: Full version history with rollback capabilities
4. **Advanced Permissions**: Field-level edit permissions
5. **Edit Notifications**: Notify form owners when responses are edited
6. **Audit Logging**: Comprehensive logging of all edit operations

### Analytics Integration
- Track response edit events in analytics system
- Measure edit frequency and patterns
- Include edit metrics in form dashboard

This implementation plan provides a comprehensive roadmap for adding form response editing capabilities while maintaining the existing architecture and ensuring proper security, validation, and user experience standards.