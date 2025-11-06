# ✅ Backend Unit Testing - Quick Reference

## Run Tests From Root Directory

**No need to `cd apps/backend` anymore!** All commands work from the project root.

---

## 🚀 Test Commands

### Run All Unit Tests
```bash
pnpm test:unit
```
**Output:**
```
✓ 23 tests passing
Duration: ~1.7s
```

### Run Tests with Coverage
```bash
pnpm test:unit:coverage
```
**Output:**
```
Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 auth.ts  |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
```

### Watch Mode (Auto-rerun on Changes)
```bash
pnpm test:unit:watch
```
- Automatically reruns tests when files change
- Press `q` to quit
- Press `a` to run all tests
- Press `f` to run only failed tests

### Visual Test UI
```bash
pnpm test:unit:ui
```
- Opens interactive test interface in browser
- View test results visually
- Explore code coverage
- Debug tests interactively

---

## 📊 Current Test Status

| Metric | Status |
|--------|--------|
| **Test Files** | 1 passing ✅ |
| **Total Tests** | 23 passing ✅ |
| **Code Coverage** | 100% ✅ |
| **Execution Time** | ~1.7 seconds ⚡ |

---

## 📁 Test File Location

**Test File:** `apps/backend/src/utils/__tests__/auth.test.ts`
**Source File:** `apps/backend/src/utils/auth.ts`
**Coverage Report:** `apps/backend/coverage/index.html`

---

## 🎯 Quick Test Examples

### View Test Output
```bash
pnpm test:unit
```

### Generate & View Coverage Report
```bash
pnpm test:unit:coverage
open apps/backend/coverage/index.html
```

### Run Tests in Watch Mode During Development
```bash
pnpm test:unit:watch
# Make changes to files
# Tests auto-rerun
```

---

## 📚 Test Utilities Available

### Location: `apps/backend/test/helpers/`

- **mockAuth.ts** - Authentication context mocks
- **mockPrisma.ts** - Prisma client mocking
- **mockGraphQLContext.ts** - GraphQL resolver context
- **testDataFactory.ts** - Generate test data with Faker
- **dbSeeder.ts** - Seed database for tests

### Location: `apps/backend/test/fixtures/`

- **formSchemas.ts** - Sample form schemas

### Location: `apps/backend/test/mocks/`

- **emailService.mock.ts** - Mock email service
- **s3Service.mock.ts** - Mock S3 operations
- **chargebeeService.mock.ts** - Mock Chargebee API

---

## ✍️ Writing New Tests

### 1. Create Test File
```bash
# Create __tests__ directory next to source file
mkdir -p apps/backend/src/services/__tests__

# Create test file
touch apps/backend/src/services/__tests__/myService.test.ts
```

### 2. Basic Test Template
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../myFile';

describe('MyFunction', () => {
  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### 3. Using Test Utilities
```typescript
import { TestDataFactory } from '../../../test/helpers/testDataFactory';
import { createMockAuthContext } from '../../../test/helpers/mockAuth';
import { prismaMock } from '../../../test/helpers/mockPrisma';

it('should create form with valid data', async () => {
  // Arrange
  const context = createMockAuthContext();
  const formData = TestDataFactory.createForm();
  prismaMock.form.create.mockResolvedValue(formData);

  // Act
  const result = await formService.createForm(input, context);

  // Assert
  expect(result).toBeDefined();
});
```

### 4. Run Your New Tests
```bash
# From project root
pnpm test:unit

# Or watch mode
pnpm test:unit:watch
```

---

## 🔧 Troubleshooting

### Tests Not Found
**Issue:** New test files not detected
**Solution:** Make sure file name matches pattern: `*.test.ts` or `*.spec.ts` and is inside `src/` directory

### MongoDB Timeout
**Issue:** MongoDB taking too long to start
**Solution:** Increase timeout in `test/setup.ts` (currently 60 seconds)

### Coverage Not Updating
**Issue:** Code changes not reflecting in coverage
**Solution:** Run `pnpm test:unit:coverage` to regenerate coverage report

### Watch Mode Not Working
**Issue:** Tests not auto-running on file changes
**Solution:** Make sure you're saving files with actual changes

---

## 📖 Full Documentation

- **[BACKEND_TESTING_PLAN.md](./BACKEND_TESTING_PLAN.md)** - Detailed implementation plan
- **[BACKEND_TESTING_IMPLEMENTATION_SUMMARY.md](./BACKEND_TESTING_IMPLEMENTATION_SUMMARY.md)** - Complete overview
- **[TESTING_SUCCESS_SUMMARY.md](./TESTING_SUCCESS_SUMMARY.md)** - Success verification & examples

---

## ✅ All Commands Summary

| Command | Description | Works From Root |
|---------|-------------|----------------|
| `pnpm test:unit` | Run all unit tests | ✅ Yes |
| `pnpm test:unit:watch` | Watch mode | ✅ Yes |
| `pnpm test:unit:ui` | Visual test interface | ✅ Yes |
| `pnpm test:unit:coverage` | Generate coverage report | ✅ Yes |

---

**No need to change directories! All commands work from project root.** 🎉
