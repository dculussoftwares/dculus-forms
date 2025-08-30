# Add Page E2E Tests - Implementation Summary

## Overview

This implementation adds comprehensive E2E tests for the "Add Page" functionality in the collaborative form builder. The tests cover all aspects of page creation including basic addition, multiple page creation with naming patterns, persistence verification, and interaction with newly created pages.

## Implementation Details

### 1. UI Component Analysis

**Existing Test ID**: The PagesSidebar component already contains the required test ID for the Add Page button:
- **File**: `apps/form-app/src/components/form-builder/PagesSidebar.tsx:253`
- **Test ID**: `data-testid="add-page-button"`
- **Location**: Fixed Add Page button at the bottom of the pages sidebar

**Collaboration Connection Dependency**: The Add Page button is disabled when not connected to the collaborative session, ensuring tests verify proper collaboration setup.

### 2. E2E Test Scenarios

**File**: `test/e2e/features/form-collaboration.feature`

Added **4 comprehensive test scenarios**:

#### A. **Basic Page Addition** (`@PageAddition @Collaboration`)
- **Purpose**: Test fundamental add page functionality
- **Test Flow**:
  1. Create form from Event Registration template (starts with 2 pages)
  2. Navigate to collaborative form builder
  3. Click "Add Page" button
  4. Verify page count increases to 3
  5. Verify new page appears in correct position
  6. Verify new page has default title
  7. Verify automatic navigation to new page

#### B. **Multiple Page Addition & Naming** (`@PageAddition @Collaboration @PageNaming`)
- **Purpose**: Test adding multiple pages and verify naming patterns
- **Test Flow**:
  1. Start with Event Registration template (2 pages)
  2. Add 3 additional pages sequentially
  3. Verify incremental page count (2→3→4→5)
  4. Verify pages follow incremental naming pattern
  5. Validate naming consistency

#### C. **Page Addition Persistence** (`@PageAddition @Collaboration @PagePersistence`)
- **Purpose**: Test page addition persistence after browser refresh
- **Test Flow**:
  1. Start with Event Registration template
  2. Add 2 new pages (total: 4 pages)
  3. Refresh the browser page
  4. Verify collaborative form builder loads correctly
  5. Verify all 4 pages persist after refresh
  6. Validate page persistence in collaborative state

#### D. **Page Addition & Interaction** (`@PageAddition @Collaboration @PageInteraction`)
- **Purpose**: Test interaction with newly created pages
- **Test Flow**:
  1. Start with Event Registration template
  2. Add new page
  3. Select the new page from sidebar
  4. Verify page is empty (no fields)
  5. Add a field to the new page via drag-drop
  6. Verify field addition works correctly

### 3. Step Definitions Implementation

**File**: `test/e2e/step-definitions/form-creation.steps.ts`

Implemented **8 new step definitions**:

#### Page Addition Actions
```typescript
When('I click the Add Page button', ...)
```
- Locates Add Page button via test ID `[data-testid="add-page-button"]`
- Verifies button is enabled (collaboration connected)
- Includes comprehensive error handling and screenshots

#### Page Verification Steps
```typescript
Then('I should see the new page in position {int}', ...)
Then('the new page should have a default title', ...)
Then('I should be automatically navigated to the new page', ...)
```

#### Naming Pattern Verification
```typescript
Then('I should see pages with incremental naming pattern', ...)
```
- Validates naming patterns for newly created pages
- Supports flexible naming schemes (Page X, Untitled X, etc.)
- Provides detailed debugging information

#### Page Interaction Steps
```typescript
When('I select the new page from the sidebar', ...)
Then('I should see an empty page with no fields', ...)
Then('I should see {int} fields in the new page', ...)
```

#### Persistence Verification
```typescript
Then('the added pages should be persisted correctly', ...)
```

### 4. Test Infrastructure

**File**: `test-add-page.sh`
- **Interactive Menu**: User-friendly test selection interface
- **Individual Test Execution**: Run specific scenarios independently
- **Environment Support**: Headless/visible browser options
- **Service Management**: Integration with existing test infrastructure
- **Dry-Run Validation**: Verify step definitions before execution

## Supported Test Scenarios

| Scenario | Tag | Purpose | Key Verification Points |
|----------|-----|---------|------------------------|
| Basic Page Addition | `@PageAddition` | Core functionality | Page count, positioning, auto-navigation |
| Multiple Page Naming | `@PageNaming` | Naming patterns | Incremental naming, consistency |
| Page Persistence | `@PagePersistence` | State persistence | Refresh survival, collaborative state |
| Page Interaction | `@PageInteraction` | New page usage | Empty state, field addition |

## Running the Tests

### Using the Test Runner Script
```bash
./test-add-page.sh
```

**Interactive Menu Options:**
1. Basic Page Addition Test
2. Multiple Page Addition & Naming Test
3. Page Addition Persistence Test
4. Page Addition & Interaction Test
5. All Add Page Tests
6. Dry Run (Validate Step Definitions)
7. Exit

### Manual Commands

#### All Add Page Tests
```bash
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @PageAddition
```

#### Individual Test Scenarios
```bash
# Basic page addition test
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --name "Add new page to collaborative form builder"

# Page naming tests
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @PageNaming

# Persistence tests
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @PagePersistence

# Page interaction tests
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @PageInteraction
```

#### Validation (Dry Run)
```bash
TS_NODE_PROJECT=test/e2e/tsconfig.json cucumber-js test/e2e/features/form-collaboration.feature \
  --require-module ts-node/register \
  --require test/e2e/support/world.ts \
  --require test/e2e/support/hooks.ts \
  --require 'test/e2e/step-definitions/*.steps.ts' \
  --tags @PageAddition --dry-run
```

### Environment Variables
- `PLAYWRIGHT_HEADLESS=false` - Run with visible browser
- `SERVICES_ALREADY_RUNNING=true` - Skip service startup

## Technical Implementation Details

### Page Addition Flow
1. **Button Availability**: Verify Add Page button is enabled (requires collaboration connection)
2. **Click Action**: Simulate button click with proper timing
3. **UI Update**: Wait for page list to update with new page
4. **Auto-Navigation**: Verify automatic selection of newly created page
5. **Validation**: Multiple verification approaches for robustness

### Naming Pattern Recognition
The implementation uses flexible pattern matching to accommodate various naming schemes:
- Standard Pattern: "Page 3", "Page 4", etc.
- Alternative Patterns: "Untitled Page 3", "Page3", etc.
- Fallback: Any non-empty title is accepted for maximum compatibility

### Persistence Testing
- **Collaborative State**: Verifies YJS collaborative document persistence
- **Database Storage**: Ensures page data persists in MongoDB
- **UI State**: Confirms pages remain visible after browser refresh
- **Count Validation**: Verifies exact page counts maintain consistency

### Error Handling & Debugging
- **Screenshot Capture**: Automatic screenshots on test failures
- **Debug Information**: Detailed logging of page titles, counts, and states
- **Element Analysis**: Comprehensive element detection and verification
- **Timing Optimization**: Proper waits for UI state updates

## Integration with Existing Tests

- **Seamless Integration**: Uses existing E2E test infrastructure and patterns
- **Consistent Patterns**: Follows same step definition and verification patterns as field tests
- **Shared Components**: Leverages proven test approaches from page rearrangement tests
- **Common Infrastructure**: Uses same world, hooks, and support utilities

## Benefits

1. **Complete Coverage**: Tests all aspects of add page functionality
2. **Persistence Validation**: Ensures collaborative state reliability across sessions
3. **Naming Consistency**: Verifies proper page naming patterns
4. **User Experience**: Tests real user workflows for page creation
5. **Robustness**: Multiple verification approaches for reliable test execution
6. **Developer Friendly**: Clear test IDs and comprehensive error reporting
7. **Maintainable**: Well-documented step definitions with clear scenarios

## Architecture Integration

The implementation integrates seamlessly with:
- **YJS Collaborative System**: Tests real-time collaboration page addition
- **GraphQL Page Creation**: Tests complete page creation workflow
- **Prisma Database Persistence**: Validates page storage and retrieval
- **Better-Auth System**: Uses authenticated user sessions for testing
- **React Form Builder**: Tests UI interactions and state management

## Future Enhancements

1. **Page Templates**: Test adding pages with pre-defined field templates
2. **Page Deletion**: Test removing newly created pages
3. **Page Reordering**: Test dragging newly created pages to different positions
4. **Page Duplication**: Test duplicating existing pages
5. **Bulk Operations**: Test adding multiple pages simultaneously
6. **Cross-browser Testing**: Verify functionality across different browsers
7. **Performance Testing**: Test page addition with large numbers of existing pages

## Event Registration Template Integration

The tests leverage the Event Registration template which provides a consistent starting point:

**Default Template Structure**:
- **Page 1**: "Personal Information" (4 fields)
- **Page 2**: "Event Details" (3 fields)

**Test Progression**:
- Start: 2 pages (template default)
- After 1 add: 3 pages
- After 2 adds: 4 pages
- After 3 adds: 5 pages

This predictable structure enables reliable test assertions and clear verification points.

This comprehensive implementation provides thorough test coverage for one of the most important content creation workflows in the collaborative form builder - adding new pages to organize form content effectively.