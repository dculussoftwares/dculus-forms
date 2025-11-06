# Plugins GraphQL Resolver Tests

## Overview
Comprehensive unit tests for the plugins GraphQL resolver covering all Query and Mutation operations, field resolvers, and edge cases.

## Test Coverage
- **100% Line Coverage**
- **100% Branch Coverage**
- **100% Function Coverage**
- **100% Statement Coverage**
- **52 Test Cases**

## Test Structure

### Query Resolvers (12 tests)

#### `formPlugins` (4 tests)
- ✅ Returns all plugins for a form when user has viewer access
- ✅ Returns empty array when no plugins exist
- ✅ Throws error when user lacks access to form
- ✅ Throws error when user is not authenticated

#### `formPlugin` (3 tests)
- ✅ Returns plugin by ID when user has access
- ✅ Throws error when plugin not found
- ✅ Throws error when user lacks access to form

#### `pluginDeliveries` (5 tests)
- ✅ Returns plugin deliveries when user has access
- ✅ Uses custom limit when provided
- ✅ Throws error when plugin not found
- ✅ Throws error when user lacks access
- ✅ Returns empty array when no deliveries exist

### Mutation Resolvers (28 tests)

#### `createFormPlugin` (10 tests)
- ✅ Creates webhook plugin with editor access
- ✅ Creates email plugin
- ✅ Creates quiz grading plugin
- ✅ Defaults enabled to true when not provided
- ✅ Throws error when user lacks editor access
- ✅ Throws error for invalid event types
- ✅ Accepts plugin.test event
- ✅ Creates plugin with empty config object
- ✅ Creates plugin with multiple valid events
- ✅ Validates webhook configuration

#### `updateFormPlugin` (7 tests)
- ✅ Updates plugin with editor access
- ✅ Updates only provided fields
- ✅ Throws error when plugin not found
- ✅ Throws error when user lacks editor access
- ✅ Validates events when updating
- ✅ Allows updating events with valid values
- ✅ Updates plugin with null config values

#### `deleteFormPlugin` (3 tests)
- ✅ Deletes plugin with editor access
- ✅ Throws error when plugin not found
- ✅ Throws error when user lacks editor access

#### `testFormPlugin` (5 tests)
- ✅ Triggers test event for plugin
- ✅ Throws error when plugin not found
- ✅ Throws error when user lacks editor access
- ✅ Tests email plugin
- ✅ Tests quiz grading plugin

#### Additional Mutation Tests (3 tests)
- ✅ Respects limit parameter for deliveries
- ✅ Handles organization-level access control
- ✅ Creates plugin with complex nested config

### Field Resolvers (12 tests)

#### `FormPlugin.config` (3 tests)
- ✅ Parses JSON config string to object
- ✅ Returns config object as-is when already parsed
- ✅ Handles complex nested config objects

#### `PluginDelivery.payload` (2 tests)
- ✅ Parses JSON payload string to object
- ✅ Returns payload object as-is when already parsed

#### `PluginDelivery.response` (7 tests)
- ✅ Parses JSON response string to object
- ✅ Returns response object as-is when already parsed
- ✅ Returns null when response is null
- ✅ Returns undefined when response is undefined
- ✅ Handles complex response objects
- ✅ Handles error responses
- ✅ Handles webhook delivery responses

## Plugin Types Tested

### 1. Webhook Plugin
- Configuration: `url`, `method`, `headers`
- Events: `form.submitted`, `plugin.test`
- Delivery tracking
- Test event triggering

### 2. Email Plugin
- Configuration: `recipients`, `subject`, `body`
- @ mention support in body
- Email delivery tracking
- Test email sending

### 3. Quiz Grading Plugin
- Configuration: `fields`, `correctAnswer`, `marks`, `passingPercentage`
- Auto-grading on form submission
- Score calculation
- Pass/fail status
- Per-question breakdown

## Security & Authorization Tests

### Authentication (4 tests)
- ✅ Requires authentication for all operations
- ✅ Validates user session
- ✅ Handles missing auth context
- ✅ Handles missing session

### Permission Levels (8 tests)
- ✅ VIEWER access for viewing plugins and deliveries
- ✅ EDITOR access for creating, updating, deleting, and testing plugins
- ✅ Organization-level access control
- ✅ Cross-organization access denial

## Validation Tests (6 tests)

### Event Validation
- ✅ Rejects invalid event types
- ✅ Accepts `form.submitted` event
- ✅ Accepts `plugin.test` event
- ✅ Validates multiple events
- ✅ Provides helpful error messages with supported events

### Configuration Validation
- ✅ Handles empty config objects
- ✅ Handles null config values
- ✅ Validates complex nested configurations

## Edge Cases (8 tests)

### Data Parsing
- ✅ Parses JSON strings to objects
- ✅ Handles already-parsed objects
- ✅ Handles null/undefined values
- ✅ Handles complex nested structures

### Empty States
- ✅ Empty plugin list
- ✅ Empty deliveries list
- ✅ Empty config objects

### Error States
- ✅ Plugin not found
- ✅ Form not found
- ✅ Access denied
- ✅ Invalid event types

## Test Implementation Details

### Mocked Dependencies
- `prisma` - Database operations
- `betterAuthMiddleware` - Authentication and authorization
- `formSharingResolvers` - Form access control
- `pluginEvents` - Event emission system
- `@dculus/utils` - ID generation
- `logger` - Logging system

### Test Data
- Mock users with authentication context
- Mock forms with organization association
- Mock plugins (webhook, email, quiz grading)
- Mock plugin deliveries with success/failure states
- Mock form responses for plugin execution

### Assertion Patterns
- Proper dependency injection
- Correct permission checks
- Expected database queries
- Proper error messages
- Return value validation
- Side effect verification

## Running Tests

```bash
# Run plugin resolver tests
cd apps/backend
pnpm test src/graphql/resolvers/__tests__/plugins.test.ts

# Run with coverage
pnpm test -- --coverage src/graphql/resolvers/__tests__/plugins.test.ts
```

## Test Output
```
✓ src/graphql/resolvers/__tests__/plugins.test.ts (52 tests) 1321ms

Test Files  1 passed (1)
     Tests  52 passed (52)
```

## Code Coverage
```
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
graphql/resolvers  |     100 |      100 |     100 |     100 |
  plugins.ts       |     100 |      100 |     100 |     100 |
```

## Related Files
- Source: `/apps/backend/src/graphql/resolvers/plugins.ts`
- Tests: `/apps/backend/src/graphql/resolvers/__tests__/plugins.test.ts`
- Events: `/apps/backend/src/plugins/events.ts`
- Schema: `/apps/backend/src/graphql/schema.graphql`

## Maintenance Notes

### Adding New Plugin Types
When adding a new plugin type:
1. Add test cases for create/update/delete operations
2. Add test cases for plugin configuration validation
3. Add test cases for test event triggering
4. Add test cases for delivery tracking
5. Follow the existing pattern for webhook/email/quiz plugins

### Adding New Events
When adding new supported events:
1. Update the `supportedEvents` array expectation in tests
2. Add test cases for the new event type
3. Ensure validation tests cover the new event
4. Test event emission and plugin execution

### Updating Permission Levels
When modifying permission requirements:
1. Update tests for all affected resolvers
2. Ensure proper error messages
3. Test both positive and negative cases
4. Verify organization-level access control

## Best Practices Demonstrated

1. **Comprehensive Mocking**: All external dependencies are properly mocked
2. **Edge Case Testing**: Null, undefined, empty states covered
3. **Error Handling**: All error paths tested with proper messages
4. **Permission Testing**: Complete authorization matrix tested
5. **Data Validation**: Input validation and event validation covered
6. **Field Resolvers**: JSON parsing and data transformation tested
7. **Integration Points**: Plugin event emission verified
8. **Type Safety**: TypeScript types properly used throughout
