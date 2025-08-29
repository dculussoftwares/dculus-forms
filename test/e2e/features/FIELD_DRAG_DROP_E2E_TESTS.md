# Form Field Drag & Drop E2E Tests

## Overview

This implementation adds comprehensive E2E tests for dragging and dropping form fields within pages in the collaborative form builder, following the same pattern as the existing page drag-and-drop tests.

## Changes Made

### 1. UI Component Test ID Enhancements

**File: `apps/form-app/src/components/form-builder/DraggableField.tsx`**
- Added `data-testid="field-drag-handle-{index + 1}"` to the field drag handle
- Added `data-testid="field-content-{index + 1}"` to the field preview container
- Made `index` prop required (was previously optional and unused) for proper test ID generation

**File: `apps/form-app/src/components/form-builder/DraggablePageItem.tsx`**
- Added `data-testid="select-page-{page-title-kebab-case}"` to page selection card for easier page selection by name

### 2. E2E Test Scenarios

**File: `test/e2e/features/form-collaboration.feature`**

Added two new comprehensive test scenarios:

#### Scenario 1: Basic Field Rearrangement
- **Tag**: `@FieldRearrangement @Collaboration`
- **Purpose**: Test basic drag-and-drop of form fields within a page
- **Steps**:
  1. Create form from Event Registration template
  2. Navigate to collaborative form builder
  3. Select "Personal Information" page from sidebar
  4. Verify 4 fields are present in expected order
  5. Drag field 2 (Last Name) to position 1
  6. Verify new field order: "Last Name, First Name, Email, Phone Number"

#### Scenario 2: Field Position Persistence
- **Tags**: `@FieldRearrangement @Collaboration @FieldPersistence`  
- **Purpose**: Test field order persistence after page refresh
- **Steps**:
  1. Create form and navigate to collaborative builder
  2. Select "Personal Information" page
  3. Drag field 2 to position 4 (end)
  4. Refresh the page
  5. Verify field order persists: "First Name, Email, Phone Number, Last Name"

### 3. Step Definitions Implementation

**File: `test/e2e/step-definitions/form-creation.steps.ts`**

Added comprehensive step definitions:

#### Page Selection Steps
- `When I select the "{string}" page from the sidebar`
  - Uses dynamic test ID generation based on page name
  - Handles "Personal Information" → "select-page-personal-information"

#### Field Verification Steps
- `Then I should see {int} fields in the Personal Information page`
- `Then I should see field {int} with label "{string}" in position {int}`
- `Then I should see fields in order: "{string}"`

#### Drag-and-Drop Steps
- `When I drag field {int} to position {int}`
  - Uses same mouse simulation approach as page drag-drop
  - Calculates precise drop positions based on movement direction
  - Includes proper timing and multi-step movement for @dnd-kit compatibility

#### Persistence Verification
- `Then the field order should be persisted correctly`

### 4. Test Infrastructure

**File: `test-field-rearrangement.sh`**
- Created test runner script with example commands
- Provides easy way to run specific field rearrangement tests
- Includes dry-run validation

## Event Registration Template Structure

The tests leverage the Event Registration template which has a well-defined structure:

**Personal Information Page (4 fields):**
1. First Name (TextInputField)
2. Last Name (TextInputField) 
3. Email (EmailField)
4. Phone Number (TextInputField)

**Event Details Page (3 fields):**
1. Session Preference (SelectField)
2. Dietary Restrictions (CheckboxField)
3. Special Requirements (TextAreaField)

## Test ID Schema

### Field Test IDs
- **Drag Handle**: `field-drag-handle-{position}` (e.g., "field-drag-handle-1")
- **Field Container**: `draggable-field-{field.id}` (existing)
- **Field Content**: `field-content-{position}` (e.g., "field-content-1")

### Page Selection Test IDs
- **Page Selection**: `select-page-{page-title-kebab-case}` (e.g., "select-page-personal-information")

## Running the Tests

### Individual Test Commands

```bash
# Basic field rearrangement test
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @FieldRearrangement \
  --name "Select Personal Information page and rearrange form fields"

# Field persistence test  
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @FieldPersistence

# All field rearrangement tests
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @FieldRearrangement
```

### Using the Test Script

```bash
./test-field-rearrangement.sh
```

## Technical Implementation Details

### Drag-and-Drop Algorithm
The field drag implementation uses the same proven approach as page drag-and-drop:

1. **Precise Element Targeting**: Uses specific test IDs for drag handles
2. **Manual Mouse Simulation**: Direct mouse events for @dnd-kit compatibility
3. **Multi-step Movement**: 5-step interpolated movement for smooth dragging
4. **Direction-aware Positioning**: Drops above/below target based on movement direction
5. **Timing Optimization**: Proper delays for UI state updates

### Field Position Calculation
```typescript
// Drop positioning logic
const targetCenter = {
  x: targetBox.x + targetBox.width / 2,
  y: fromPosition < toPosition 
    ? targetBox.y + targetBox.height - 10  // Drop below when moving down
    : targetBox.y + 10                     // Drop above when moving up
};
```

### Label Extraction
The field verification uses regex-based label extraction to handle various field preview formats:
```typescript
const labelMatch = fieldText.match(/([A-Za-z\s]+)/);
```

## Benefits

1. **Comprehensive Coverage**: Tests both basic functionality and persistence
2. **Reusable Infrastructure**: Leverages existing page drag-drop patterns
3. **Robust Verification**: Multiple verification points with detailed error reporting
4. **Easy Maintenance**: Clear test IDs and well-documented step definitions
5. **Development Ready**: Dry-run validation ensures all step definitions are properly implemented

## Future Enhancements

1. **Cross-page Field Movement**: Test moving fields between different pages
2. **Field Type Validation**: Verify field types are preserved during drag-drop  
3. **Multi-field Selection**: Test dragging multiple fields simultaneously
4. **Accessibility Testing**: Verify keyboard navigation for drag-drop operations
5. **Performance Testing**: Test field rearrangement with large numbers of fields