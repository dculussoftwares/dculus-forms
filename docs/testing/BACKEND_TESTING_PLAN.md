# Backend Unit Testing Implementation Plan

## Overview

This document outlines the comprehensive plan for implementing unit tests across the backend application. The goal is to achieve **80% code coverage** with fast, isolated unit tests using an in-memory database for realistic testing.

**Testing Approach:** Unit tests only (fast, isolated)
**Database Strategy:** In-memory MongoDB (mongodb-memory-server)
**Coverage Target:** 80% code coverage
**Estimated Test Count:** ~340 meaningful test cases across 63 test files

---

## Phase 1: Testing Infrastructure Setup

### 1.1 Install Testing Dependencies

Install the following npm packages in `apps/backend/`:

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
pnpm add -D mongodb-memory-server
pnpm add -D @faker-js/faker
pnpm add -D vitest-mock-extended
pnpm add -D supertest @types/supertest
```

**Package Purposes:**
- **vitest** - Modern, fast test runner with excellent ESM support (better than Jest)
- **@vitest/ui** - Visual test interface for debugging
- **@vitest/coverage-v8** - Code coverage reporting with V8 engine
- **mongodb-memory-server** - In-memory MongoDB instance for realistic database testing
- **@faker-js/faker** - Generate realistic test data (names, emails, dates)
- **vitest-mock-extended** - Enhanced mocking utilities for TypeScript
- **supertest** - HTTP assertions for testing GraphQL API endpoints

### 1.2 Create Vitest Configuration

**File:** `apps/backend/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/generated/**',
        'prisma/**',
        'src/index.ts', // Entry point
        'src/lib/better-auth.ts', // External library config
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Key Configuration:**
- **globals: true** - No need to import `describe`, `it`, `expect`
- **setupFiles** - Run setup code before all tests
- **coverage thresholds** - Enforce 80% coverage on all metrics
- **testTimeout** - 10s timeout for tests with database operations
- **exclude patterns** - Skip generated files, configs, and external library setup

### 1.3 Create Test Setup File

**File:** `apps/backend/test/setup.ts`

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, afterEach } from 'vitest';

let mongoServer: MongoMemoryServer;
let prisma: PrismaClient;

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Set environment variable for Prisma
  process.env.DATABASE_URL = mongoUri;

  // Initialize Prisma client
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: mongoUri,
      },
    },
  });

  // Apply migrations/schema
  await prisma.$connect();
});

// Clean up database after each test
afterEach(async () => {
  if (prisma) {
    const collections = await prisma.$runCommandRaw({
      listCollections: 1,
    });

    // Clear all collections
    for (const collection of collections.cursor.firstBatch) {
      await prisma.$runCommandRaw({
        delete: collection.name,
        deletes: [{ q: {}, limit: 0 }],
      });
    }
  }
});

// Stop MongoDB and close connections after all tests
afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Export prisma client for use in tests
export { prisma };
```

**Setup Flow:**
1. Start in-memory MongoDB instance
2. Configure Prisma to use in-memory database
3. Connect Prisma client
4. Clean database after each test (isolation)
5. Stop MongoDB after all tests complete

### 1.4 Add Test Scripts to package.json

**File:** `apps/backend/package.json`

Add these scripts to the `"scripts"` section:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest watch --coverage"
  }
}
```

**Script Purposes:**
- **test** - Run all tests once (CI/CD)
- **test:watch** - Run tests in watch mode during development
- **test:ui** - Open visual test interface in browser
- **test:coverage** - Generate full coverage report
- **test:coverage:watch** - Watch mode with live coverage updates

### 1.5 Update TypeScript Configuration

Ensure `apps/backend/tsconfig.json` includes vitest types:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "node"]
  }
}
```

---

## Phase 2: Test Utilities & Mocks

### 2.1 Directory Structure

Create the following test utilities directory structure:

```
apps/backend/
├── test/
│   ├── setup.ts                      # Global setup (created in Phase 1)
│   ├── helpers/
│   │   ├── mockPrisma.ts             # Prisma client mocking utilities
│   │   ├── mockAuth.ts               # Authentication context mocking
│   │   ├── mockGraphQLContext.ts     # GraphQL resolver context
│   │   ├── testDataFactory.ts        # Test data generation
│   │   └── dbSeeder.ts               # Database seeding utilities
│   ├── fixtures/
│   │   ├── formSchemas.ts            # Sample FormSchema objects
│   │   ├── users.ts                  # User test data
│   │   ├── organizations.ts          # Organization test data
│   │   ├── responses.ts              # Response test data
│   │   └── plugins.ts                # Plugin configuration samples
│   └── mocks/
│       ├── emailService.mock.ts      # Mock email service
│       ├── s3Service.mock.ts         # Mock S3 operations
│       └── chargebeeService.mock.ts  # Mock Chargebee API
```

### 2.2 Mock Prisma Client

**File:** `apps/backend/test/helpers/mockPrisma.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'vitest-mock-extended';
import { beforeEach } from 'vitest';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>() as MockPrismaClient;

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// Helper to create mock transaction context
export const createMockTransaction = () => {
  return mockDeep<PrismaClient>();
};
```

**Usage in tests:**
```typescript
import { prismaMock } from '../../../test/helpers/mockPrisma';

// Mock a Prisma query
prismaMock.form.findUnique.mockResolvedValue(mockForm);
```

### 2.3 Mock Authentication Context

**File:** `apps/backend/test/helpers/mockAuth.ts`

```typescript
import { User, Organization, Member } from '@prisma/client';

export interface MockAuthContext {
  user: User | null;
  session: any | null;
  organization: Organization | null;
  membership: Member | null;
}

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  banned: false,
  banReason: null,
  banExpires: null,
  ...overrides,
});

export const createMockOrganization = (
  overrides?: Partial<Organization>
): Organization => ({
  id: 'org-123',
  name: 'Test Organization',
  slug: 'test-org',
  logo: null,
  createdAt: new Date(),
  metadata: null,
  ...overrides,
});

export const createMockMember = (overrides?: Partial<Member>): Member => ({
  id: 'member-123',
  organizationId: 'org-123',
  userId: 'user-123',
  role: 'owner',
  createdAt: new Date(),
  ...overrides,
});

export const createMockAuthContext = (
  overrides?: Partial<MockAuthContext>
): MockAuthContext => ({
  user: createMockUser(),
  session: { id: 'session-123', userId: 'user-123' },
  organization: createMockOrganization(),
  membership: createMockMember(),
  ...overrides,
});

// Helper for unauthenticated context
export const createUnauthenticatedContext = (): MockAuthContext => ({
  user: null,
  session: null,
  organization: null,
  membership: null,
});

// Helper for different roles
export const createAdminAuthContext = () =>
  createMockAuthContext({
    user: createMockUser({ role: 'admin' }),
  });

export const createSuperAdminAuthContext = () =>
  createMockAuthContext({
    user: createMockUser({ role: 'superAdmin' }),
  });

export const createEditorAuthContext = () =>
  createMockAuthContext({
    membership: createMockMember({ role: 'member' }),
  });
```

### 2.4 Mock GraphQL Context

**File:** `apps/backend/test/helpers/mockGraphQLContext.ts`

```typescript
import { MockAuthContext } from './mockAuth';
import { PrismaClient } from '@prisma/client';
import { prismaMock } from './mockPrisma';

export interface MockGraphQLContext extends MockAuthContext {
  prisma: PrismaClient;
  req: any;
  res: any;
}

export const createMockGraphQLContext = (
  authContext: MockAuthContext
): MockGraphQLContext => ({
  ...authContext,
  prisma: prismaMock as unknown as PrismaClient,
  req: {
    headers: {},
    ip: '127.0.0.1',
  },
  res: {
    setHeader: vi.fn(),
  },
});
```

### 2.5 Test Data Factory

**File:** `apps/backend/test/helpers/testDataFactory.ts`

```typescript
import { faker } from '@faker-js/faker';
import { Form, Response, FormPermission } from '@prisma/client';

export class TestDataFactory {
  // Generate realistic form data
  static createForm(overrides?: Partial<Form>): Form {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.words(3),
      description: faker.lorem.sentence(),
      organizationId: faker.string.uuid(),
      createdById: faker.string.uuid(),
      isPublished: false,
      shortUrl: faker.string.alphanumeric(8),
      schema: JSON.stringify({
        pages: [],
        layout: { theme: 'light' },
        isShuffleEnabled: false,
      }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    } as Form;
  }

  // Generate form response
  static createResponse(overrides?: Partial<Response>): Response {
    return {
      id: faker.string.uuid(),
      formId: faker.string.uuid(),
      data: JSON.stringify({ field1: 'value1' }),
      submittedAt: faker.date.recent(),
      metadata: null,
      editedAt: null,
      ...overrides,
    } as Response;
  }

  // Generate form permission
  static createPermission(
    overrides?: Partial<FormPermission>
  ): FormPermission {
    return {
      id: faker.string.uuid(),
      formId: faker.string.uuid(),
      userId: faker.string.uuid(),
      accessLevel: 'VIEWER',
      createdAt: faker.date.past(),
      ...overrides,
    } as FormPermission;
  }

  // Generate multiple items
  static createForms(count: number, overrides?: Partial<Form>): Form[] {
    return Array.from({ length: count }, () => this.createForm(overrides));
  }

  static createResponses(
    count: number,
    overrides?: Partial<Response>
  ): Response[] {
    return Array.from({ length: count }, () => this.createResponse(overrides));
  }
}
```

### 2.6 Database Seeder

**File:** `apps/backend/test/helpers/dbSeeder.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { TestDataFactory } from './testDataFactory';

export class DatabaseSeeder {
  constructor(private prisma: PrismaClient) {}

  // Seed a complete test scenario
  async seedBasicFormScenario() {
    const user = await this.prisma.user.create({
      data: {
        email: 'testuser@example.com',
        name: 'Test User',
        role: 'user',
        emailVerified: true,
      },
    });

    const org = await this.prisma.organization.create({
      data: {
        name: 'Test Organization',
        slug: 'test-org',
      },
    });

    const member = await this.prisma.member.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'owner',
      },
    });

    const form = await this.prisma.form.create({
      data: {
        ...TestDataFactory.createForm({
          organizationId: org.id,
          createdById: user.id,
        }),
      },
    });

    return { user, org, member, form };
  }

  // Seed form with responses
  async seedFormWithResponses(formId: string, responseCount: number) {
    const responses = TestDataFactory.createResponses(responseCount, {
      formId,
    });

    return await this.prisma.response.createMany({
      data: responses,
    });
  }
}
```

### 2.7 Test Fixtures

**File:** `apps/backend/test/fixtures/formSchemas.ts`

```typescript
import { FormSchema, FormPage, TextInputField, EmailField } from '@dculus/types';

export const basicFormSchema: FormSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Contact Information',
      fields: [
        new TextInputField({
          id: 'field-1',
          label: 'Full Name',
          validation: { required: true },
        }),
        new EmailField({
          id: 'field-2',
          label: 'Email Address',
          validation: { required: true },
        }),
      ],
      order: 0,
    },
  ],
  layout: {
    theme: 'light',
    textColor: '#000000',
    spacing: 'normal',
    code: '',
    content: '',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
  },
  isShuffleEnabled: false,
};

export const multiPageFormSchema: FormSchema = {
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      fields: [],
      order: 0,
    },
    {
      id: 'page-2',
      title: 'Page 2',
      fields: [],
      order: 1,
    },
  ],
  layout: basicFormSchema.layout,
  isShuffleEnabled: false,
};
```

### 2.8 Mock External Services

**File:** `apps/backend/test/mocks/emailService.mock.ts`

```typescript
import { vi } from 'vitest';

export const mockEmailService = {
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  sendFormPublishedEmail: vi.fn().mockResolvedValue(true),
  sendOTPEmail: vi.fn().mockResolvedValue(true),
  sendInvitationEmail: vi.fn().mockResolvedValue(true),
};
```

**File:** `apps/backend/test/mocks/s3Service.mock.ts`

```typescript
import { vi } from 'vitest';

export const mockS3Service = {
  generatePresignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/file'),
  uploadFile: vi.fn().mockResolvedValue({ key: 'test-file-key' }),
  copyFile: vi.fn().mockResolvedValue({ success: true }),
  deleteFile: vi.fn().mockResolvedValue({ success: true }),
};
```

---

## Phase 3: Core Module Tests

### 3.1 Authentication & Authorization Tests (~12 test files, ~40 tests)

#### Priority Areas:
1. **Auth utility functions** (`utils/auth.test.ts`)
2. **Authentication middleware** (`middleware/better-auth-middleware.test.ts`)
3. **Permission validation in resolvers**

#### Example Test Structure:

**File:** `apps/backend/src/utils/__tests__/auth.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { requireAdminRole, requireAuthentication, requireSuperAdminRole } from '../auth';
import { createMockAuthContext, createUnauthenticatedContext } from '../../../test/helpers/mockAuth';
import { GraphQLError } from 'graphql';

describe('Auth Utilities', () => {
  describe('requireAuthentication', () => {
    it('should return user when authenticated', () => {
      const context = createMockAuthContext();
      const user = requireAuthentication(context);
      expect(user).toEqual(context.user);
    });

    it('should throw GraphQLError when not authenticated', () => {
      const context = createUnauthenticatedContext();
      expect(() => requireAuthentication(context)).toThrow(GraphQLError);
      expect(() => requireAuthentication(context)).toThrow('Authentication required');
    });
  });

  describe('requireAdminRole', () => {
    it('should return user when user is admin', () => {
      const context = createMockAuthContext({ user: { role: 'admin' } });
      const user = requireAdminRole(context);
      expect(user.role).toBe('admin');
    });

    it('should return user when user is superAdmin', () => {
      const context = createMockAuthContext({ user: { role: 'superAdmin' } });
      const user = requireAdminRole(context);
      expect(user.role).toBe('superAdmin');
    });

    it('should throw GraphQLError when user is regular user', () => {
      const context = createMockAuthContext({ user: { role: 'user' } });
      expect(() => requireAdminRole(context)).toThrow('Admin privileges required');
    });

    it('should throw GraphQLError when not authenticated', () => {
      const context = createUnauthenticatedContext();
      expect(() => requireAdminRole(context)).toThrow('Authentication required');
    });
  });

  describe('requireSuperAdminRole', () => {
    it('should return user when user is superAdmin', () => {
      const context = createMockAuthContext({ user: { role: 'superAdmin' } });
      const user = requireSuperAdminRole(context);
      expect(user.role).toBe('superAdmin');
    });

    it('should throw GraphQLError when user is admin', () => {
      const context = createMockAuthContext({ user: { role: 'admin' } });
      expect(() => requireSuperAdminRole(context)).toThrow('Super admin privileges required');
    });

    it('should throw GraphQLError when user is regular user', () => {
      const context = createMockAuthContext({ user: { role: 'user' } });
      expect(() => requireSuperAdminRole(context)).toThrow('Super admin privileges required');
    });
  });
});
```

**Test Coverage:**
- ✅ Valid authentication scenarios
- ✅ Unauthenticated access attempts
- ✅ Role-based authorization checks
- ✅ Error message validation
- ✅ Edge cases (null user, missing role)

### 3.2 Form Operations Tests (~15 test files, ~80 tests)

#### Priority Areas:
1. **Form service** (`services/formService.test.ts`)
2. **Form resolvers** (`graphql/resolvers/forms.test.ts`)
3. **Form sharing** (`graphql/resolvers/formSharing.test.ts`)
4. **Form repository** (`repositories/formRepository.test.ts`)

#### Example Test Structure:

**File:** `apps/backend/src/services/__tests__/formService.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormService } from '../formService';
import { prismaMock } from '../../../test/helpers/mockPrisma';
import { TestDataFactory } from '../../../test/helpers/testDataFactory';
import { basicFormSchema } from '../../../test/fixtures/formSchemas';

describe('FormService', () => {
  let formService: FormService;

  beforeEach(() => {
    formService = new FormService();
  });

  describe('generateUniqueShortUrl', () => {
    it('should generate a unique 8-character URL', async () => {
      prismaMock.form.findUnique.mockResolvedValue(null); // No collision

      const shortUrl = await formService.generateUniqueShortUrl();

      expect(shortUrl).toHaveLength(8);
      expect(shortUrl).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it('should retry on collision until finding unique URL', async () => {
      // First two attempts collide, third succeeds
      prismaMock.form.findUnique
        .mockResolvedValueOnce(TestDataFactory.createForm()) // Collision
        .mockResolvedValueOnce(TestDataFactory.createForm()) // Collision
        .mockResolvedValueOnce(null); // Success

      const shortUrl = await formService.generateUniqueShortUrl();

      expect(prismaMock.form.findUnique).toHaveBeenCalledTimes(3);
      expect(shortUrl).toBeDefined();
    });

    it('should throw error after max retry attempts', async () => {
      // Always return collision
      prismaMock.form.findUnique.mockResolvedValue(
        TestDataFactory.createForm()
      );

      await expect(formService.generateUniqueShortUrl()).rejects.toThrow(
        'Failed to generate unique short URL'
      );
    });
  });

  describe('createForm', () => {
    it('should create form with valid data', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';
      const input = {
        title: 'Test Form',
        description: 'Test Description',
        schema: basicFormSchema,
      };

      const expectedForm = TestDataFactory.createForm({
        ...input,
        organizationId: orgId,
        createdById: userId,
        schema: JSON.stringify(basicFormSchema),
      });

      prismaMock.form.findUnique.mockResolvedValue(null); // Unique URL
      prismaMock.form.create.mockResolvedValue(expectedForm);

      const result = await formService.createForm(input, userId, orgId);

      expect(result).toEqual(expectedForm);
      expect(prismaMock.form.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: input.title,
            organizationId: orgId,
            createdById: userId,
          }),
        })
      );
    });

    it('should create OWNER permission for creator', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';

      prismaMock.form.findUnique.mockResolvedValue(null);
      prismaMock.form.create.mockResolvedValue(TestDataFactory.createForm());

      await formService.createForm(
        { title: 'Test', schema: basicFormSchema },
        userId,
        orgId
      );

      expect(prismaMock.formPermission.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          accessLevel: 'OWNER',
        }),
      });
    });
  });

  describe('duplicateForm', () => {
    it('should create deep copy of form with new ID', async () => {
      const originalForm = TestDataFactory.createForm({
        id: 'original-123',
        title: 'Original Form',
      });

      prismaMock.form.findUnique
        .mockResolvedValueOnce(originalForm) // Find original
        .mockResolvedValueOnce(null); // Unique URL check

      const duplicatedForm = TestDataFactory.createForm({
        id: 'duplicate-456',
        title: 'Original Form (Copy)',
      });

      prismaMock.form.create.mockResolvedValue(duplicatedForm);

      const result = await formService.duplicateForm('original-123', 'user-123');

      expect(result.id).not.toBe(originalForm.id);
      expect(result.title).toContain('(Copy)');
      expect(prismaMock.form.create).toHaveBeenCalled();
    });

    it('should copy background images to new form', async () => {
      const formWithBackground = TestDataFactory.createForm({
        schema: JSON.stringify({
          ...basicFormSchema,
          layout: {
            ...basicFormSchema.layout,
            backgroundImageKey: 'original-bg.jpg',
          },
        }),
      });

      prismaMock.form.findUnique.mockResolvedValue(formWithBackground);

      // Mock S3 copy operation
      const mockCopyFile = vi.fn().mockResolvedValue({
        key: 'duplicate-bg.jpg',
      });

      await formService.duplicateForm('form-123', 'user-123', mockCopyFile);

      expect(mockCopyFile).toHaveBeenCalledWith('original-bg.jpg', expect.any(String));
    });

    it('should throw error if form not found', async () => {
      prismaMock.form.findUnique.mockResolvedValue(null);

      await expect(
        formService.duplicateForm('nonexistent-123', 'user-123')
      ).rejects.toThrow('Form not found');
    });
  });

  describe('updateForm', () => {
    it('should update form with valid permissions', async () => {
      const form = TestDataFactory.createForm({ id: 'form-123' });
      const updates = { title: 'Updated Title' };

      prismaMock.form.findUnique.mockResolvedValue(form);
      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );
      prismaMock.form.update.mockResolvedValue({ ...form, ...updates });

      const result = await formService.updateForm('form-123', updates, 'user-123');

      expect(result.title).toBe('Updated Title');
    });

    it('should throw error with insufficient permissions', async () => {
      prismaMock.form.findUnique.mockResolvedValue(TestDataFactory.createForm());
      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'VIEWER' })
      );

      await expect(
        formService.updateForm('form-123', { title: 'New Title' }, 'user-123')
      ).rejects.toThrow('Permission denied');
    });

    it('should trigger email when publishing form', async () => {
      const unpublishedForm = TestDataFactory.createForm({ isPublished: false });

      prismaMock.form.findUnique.mockResolvedValue(unpublishedForm);
      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );

      const mockSendEmail = vi.fn();

      await formService.updateForm(
        'form-123',
        { isPublished: true },
        'user-123',
        mockSendEmail
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'form-published',
        })
      );
    });
  });

  describe('deleteForm', () => {
    it('should delete form with OWNER permission', async () => {
      prismaMock.form.findUnique.mockResolvedValue(TestDataFactory.createForm());
      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );
      prismaMock.form.delete.mockResolvedValue(TestDataFactory.createForm());

      await formService.deleteForm('form-123', 'user-123');

      expect(prismaMock.form.delete).toHaveBeenCalledWith({
        where: { id: 'form-123' },
      });
    });

    it('should throw error with non-OWNER permission', async () => {
      prismaMock.form.findUnique.mockResolvedValue(TestDataFactory.createForm());
      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'EDITOR' })
      );

      await expect(
        formService.deleteForm('form-123', 'user-123')
      ).rejects.toThrow('Only form owners can delete forms');
    });
  });
});
```

**Test Coverage:**
- ✅ Form CRUD operations
- ✅ URL collision handling with retry logic
- ✅ Permission validation (OWNER/EDITOR/VIEWER)
- ✅ Form duplication with file copying
- ✅ Publishing workflow with email triggers
- ✅ Error handling for invalid inputs
- ✅ Edge cases (non-existent forms, insufficient permissions)

### 3.3 Response Handling & Analytics Tests (~18 test files, ~90 tests)

#### Priority Areas:
1. **Response service** (`services/responseService.test.ts`)
2. **Analytics service** (`services/analyticsService.test.ts`)
3. **Field analytics service** (`services/fieldAnalyticsService.test.ts`)
4. **Response filter service** (`services/responseFilterService.test.ts`)
5. **Response resolvers** (`graphql/resolvers/responses.test.ts`)
6. **Analytics resolvers** (`graphql/resolvers/analytics.test.ts`)

#### Example Test Structure:

**File:** `apps/backend/src/services/__tests__/responseService.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ResponseService } from '../responseService';
import { prismaMock } from '../../../test/helpers/mockPrisma';
import { TestDataFactory } from '../../../test/helpers/testDataFactory';

describe('ResponseService', () => {
  let responseService: ResponseService;

  beforeEach(() => {
    responseService = new ResponseService();
  });

  describe('getResponsesByFormId', () => {
    it('should return paginated responses', async () => {
      const responses = TestDataFactory.createResponses(5);

      prismaMock.response.findMany.mockResolvedValue(responses);
      prismaMock.response.count.mockResolvedValue(5);

      const result = await responseService.getResponsesByFormId('form-123', {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
    });

    it('should apply sorting by submittedAt DESC', async () => {
      await responseService.getResponsesByFormId('form-123', {
        sortBy: 'submittedAt',
        sortOrder: 'desc',
      });

      expect(prismaMock.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: 'desc' },
        })
      );
    });

    it('should apply sorting by form field values', async () => {
      const responses = [
        TestDataFactory.createResponse({
          data: JSON.stringify({ fieldId: 'Alice' }),
        }),
        TestDataFactory.createResponse({
          data: JSON.stringify({ fieldId: 'Bob' }),
        }),
      ];

      prismaMock.response.findMany.mockResolvedValue(responses);

      const result = await responseService.getResponsesByFormId('form-123', {
        sortBy: 'field:fieldId',
        sortOrder: 'asc',
      });

      // Should sort responses by field value
      expect(result.items[0].data).toContain('Alice');
      expect(result.items[1].data).toContain('Bob');
    });

    it('should apply response filters', async () => {
      const filters = [
        { fieldId: 'field-1', operator: 'equals', value: 'test' },
      ];

      await responseService.getResponsesByFormId('form-123', {
        filters,
      });

      // Should use filter service to apply filters
      expect(prismaMock.response.findMany).toHaveBeenCalled();
    });
  });

  describe('updateResponse', () => {
    it('should update response and create edit snapshot', async () => {
      const originalResponse = TestDataFactory.createResponse({
        id: 'response-123',
        data: JSON.stringify({ field1: 'old value' }),
      });

      const updatedData = { field1: 'new value' };

      prismaMock.response.findUnique.mockResolvedValue(originalResponse);
      prismaMock.response.update.mockResolvedValue({
        ...originalResponse,
        data: JSON.stringify(updatedData),
        editedAt: new Date(),
      });

      const result = await responseService.updateResponse(
        'response-123',
        updatedData
      );

      expect(result.editedAt).toBeDefined();
      expect(prismaMock.responseEditSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          responseId: 'response-123',
          previousData: originalResponse.data,
        }),
      });
    });

    it('should handle legacy mode without snapshots', async () => {
      const originalResponse = TestDataFactory.createResponse();

      prismaMock.response.findUnique.mockResolvedValue(originalResponse);
      prismaMock.response.update.mockResolvedValue(originalResponse);

      await responseService.updateResponse(
        'response-123',
        { field1: 'new' },
        { enableSnapshots: false }
      );

      expect(prismaMock.responseEditSnapshot.create).not.toHaveBeenCalled();
    });

    it('should throw error if response not found', async () => {
      prismaMock.response.findUnique.mockResolvedValue(null);

      await expect(
        responseService.updateResponse('nonexistent', { field: 'value' })
      ).rejects.toThrow('Response not found');
    });
  });

  describe('applyResponseFilters', () => {
    it('should filter responses by equals operator', () => {
      const responses = [
        { data: JSON.stringify({ field1: 'test' }) },
        { data: JSON.stringify({ field1: 'other' }) },
      ];

      const filtered = responseService.applyResponseFilters(responses, [
        { fieldId: 'field1', operator: 'equals', value: 'test' },
      ]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].data).toContain('test');
    });

    it('should filter responses by contains operator', () => {
      const responses = [
        { data: JSON.stringify({ field1: 'hello world' }) },
        { data: JSON.stringify({ field1: 'goodbye' }) },
      ];

      const filtered = responseService.applyResponseFilters(responses, [
        { fieldId: 'field1', operator: 'contains', value: 'world' },
      ]);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].data).toContain('hello world');
    });

    it('should handle multiple filters with AND logic', () => {
      const responses = [
        { data: JSON.stringify({ field1: 'test', field2: 'value' }) },
        { data: JSON.stringify({ field1: 'test', field2: 'other' }) },
        { data: JSON.stringify({ field1: 'other', field2: 'value' }) },
      ];

      const filtered = responseService.applyResponseFilters(responses, [
        { fieldId: 'field1', operator: 'equals', value: 'test' },
        { fieldId: 'field2', operator: 'equals', value: 'value' },
      ]);

      expect(filtered).toHaveLength(1);
    });
  });
});
```

**File:** `apps/backend/src/services/__tests__/analyticsService.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { AnalyticsService } from '../analyticsService';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService();
  });

  describe('detectCountryCode', () => {
    it('should detect country from IP geolocation', () => {
      const result = analyticsService.detectCountryCode({
        ip: '8.8.8.8', // Google DNS (USA)
      });

      expect(result).toBe('USA');
    });

    it('should fallback to language detection when IP unavailable', () => {
      const result = analyticsService.detectCountryCode({
        language: 'en-US',
      });

      expect(result).toBe('USA');
    });

    it('should fallback to timezone detection', () => {
      const result = analyticsService.detectCountryCode({
        timezone: 'America/New_York',
      });

      expect(result).toBe('USA');
    });

    it('should handle multiple fallback attempts', () => {
      const result = analyticsService.detectCountryCode({
        ip: null,
        language: 'fr-CA',
      });

      expect(result).toBe('CAN'); // Canada
    });

    it('should return null when all methods fail', () => {
      const result = analyticsService.detectCountryCode({
        ip: null,
        language: null,
        timezone: null,
      });

      expect(result).toBeNull();
    });
  });

  describe('parseUserAgent', () => {
    it('should parse Chrome user agent', () => {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      const result = analyticsService.parseUserAgent(ua);

      expect(result.browser).toBe('Chrome');
      expect(result.browserVersion).toBe('120.0.0.0');
      expect(result.os).toBe('Windows');
    });

    it('should parse Safari user agent', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

      const result = analyticsService.parseUserAgent(ua);

      expect(result.browser).toBe('Safari');
      expect(result.os).toBe('macOS');
    });

    it('should handle unknown user agent', () => {
      const result = analyticsService.parseUserAgent('Unknown Browser/1.0');

      expect(result.browser).toBe('Unknown');
      expect(result.os).toBe('Unknown');
    });
  });

  describe('getFormAnalytics', () => {
    it('should aggregate analytics with time range', async () => {
      const mockViews = [
        { countryCode: 'USA', browser: 'Chrome', operatingSystem: 'Windows' },
        { countryCode: 'USA', browser: 'Chrome', operatingSystem: 'Windows' },
        { countryCode: 'CAN', browser: 'Safari', operatingSystem: 'macOS' },
      ];

      prismaMock.formViewAnalytics.findMany.mockResolvedValue(mockViews);
      prismaMock.formViewAnalytics.count.mockResolvedValue(3);
      prismaMock.formViewAnalytics.groupBy.mockResolvedValue([
        { sessionId: 'session-1', _count: 1 },
        { sessionId: 'session-2', _count: 1 },
      ]);

      const result = await analyticsService.getFormAnalytics('form-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      });

      expect(result.totalViews).toBe(3);
      expect(result.uniqueSessions).toBe(2);
      expect(result.topCountries).toContainEqual(
        expect.objectContaining({ code: 'USA', count: 2 })
      );
      expect(result.topBrowsers).toContainEqual(
        expect.objectContaining({ name: 'Chrome', count: 2 })
      );
    });

    it('should calculate percentages correctly', async () => {
      const mockViews = [
        { countryCode: 'USA' },
        { countryCode: 'USA' },
        { countryCode: 'CAN' },
        { countryCode: 'GBR' },
      ];

      prismaMock.formViewAnalytics.findMany.mockResolvedValue(mockViews);
      prismaMock.formViewAnalytics.count.mockResolvedValue(4);

      const result = await analyticsService.getFormAnalytics('form-123');

      const usaEntry = result.topCountries.find((c) => c.code === 'USA');
      expect(usaEntry?.percentage).toBe(50); // 2/4 = 50%
    });
  });

  describe('createCompletionTimeDistribution', () => {
    it('should create time buckets', () => {
      const completionTimes = [30, 60, 90, 120, 180, 300, 600];

      const distribution = analyticsService.createCompletionTimeDistribution(
        completionTimes
      );

      expect(distribution).toContainEqual(
        expect.objectContaining({ bucket: '0-60s', count: 2 })
      );
      expect(distribution).toContainEqual(
        expect.objectContaining({ bucket: '60-120s', count: 2 })
      );
    });

    it('should handle empty completion times', () => {
      const distribution = analyticsService.createCompletionTimeDistribution([]);

      expect(distribution).toEqual([]);
    });
  });
});
```

**Test Coverage:**
- ✅ Response pagination and sorting
- ✅ Field-based sorting logic
- ✅ Complex filter application (equals, contains, greater than, etc.)
- ✅ Edit tracking with snapshots
- ✅ Country detection fallback chain
- ✅ User agent parsing for multiple browsers
- ✅ Analytics aggregation with time ranges
- ✅ Statistical calculations (percentages, distributions)
- ✅ Edge cases (empty data, invalid inputs)

### 3.4 Plugin System Tests (~8 test files, ~35 tests)

#### Priority Areas:
1. **Plugin resolvers** (`graphql/resolvers/plugins.test.ts`)
2. **Webhook plugin logic**
3. **Email plugin with @ mention parsing**
4. **Quiz grading plugin**

#### Example Test Structure:

**File:** `apps/backend/src/graphql/resolvers/__tests__/plugins.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { pluginResolvers } from '../plugins';
import { createMockGraphQLContext } from '../../../../test/helpers/mockGraphQLContext';
import { createMockAuthContext } from '../../../../test/helpers/mockAuth';
import { TestDataFactory } from '../../../../test/helpers/testDataFactory';

describe('Plugin Resolvers', () => {
  describe('Mutation.createPlugin', () => {
    it('should create webhook plugin with valid config', async () => {
      const context = createMockGraphQLContext(createMockAuthContext());

      const input = {
        formId: 'form-123',
        type: 'webhook',
        config: {
          url: 'https://example.com/webhook',
          method: 'POST',
        },
        eventTriggers: ['form.submitted'],
      };

      const expectedPlugin = {
        id: 'plugin-123',
        ...input,
      };

      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );
      prismaMock.plugin.create.mockResolvedValue(expectedPlugin);

      const result = await pluginResolvers.Mutation.createPlugin(
        null,
        { input },
        context
      );

      expect(result).toEqual(expectedPlugin);
      expect(prismaMock.plugin.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'webhook',
          config: expect.any(String),
        }),
      });
    });

    it('should create email plugin with @ mention support', async () => {
      const context = createMockGraphQLContext(createMockAuthContext());

      const input = {
        formId: 'form-123',
        type: 'email',
        config: {
          recipients: ['admin@example.com'],
          subject: 'New submission from @{field-name}',
          body: 'User @{field-email} submitted the form',
        },
        eventTriggers: ['form.submitted'],
      };

      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );
      prismaMock.plugin.create.mockResolvedValue({ id: 'plugin-123', ...input });

      const result = await pluginResolvers.Mutation.createPlugin(
        null,
        { input },
        context
      );

      expect(result.config).toContain('@{field-name}');
    });

    it('should create quiz-grading plugin with question config', async () => {
      const context = createMockGraphQLContext(createMockAuthContext());

      const input = {
        formId: 'form-123',
        type: 'quiz-grading',
        config: {
          questions: [
            {
              fieldId: 'field-1',
              correctAnswer: 'Option A',
              marks: 10,
            },
          ],
          passPercentage: 60,
        },
        eventTriggers: ['form.submitted'],
      };

      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'OWNER' })
      );
      prismaMock.plugin.create.mockResolvedValue({ id: 'plugin-123', ...input });

      const result = await pluginResolvers.Mutation.createPlugin(
        null,
        { input },
        context
      );

      expect(result.config.questions).toHaveLength(1);
      expect(result.config.passPercentage).toBe(60);
    });

    it('should throw error with insufficient permissions', async () => {
      const context = createMockGraphQLContext(createMockAuthContext());

      prismaMock.formPermission.findFirst.mockResolvedValue(
        TestDataFactory.createPermission({ accessLevel: 'VIEWER' })
      );

      await expect(
        pluginResolvers.Mutation.createPlugin(
          null,
          { input: { formId: 'form-123', type: 'webhook' } },
          context
        )
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Plugin Execution', () => {
    it('should execute webhook plugin on form submission', async () => {
      const webhookPlugin = {
        type: 'webhook',
        config: JSON.stringify({
          url: 'https://example.com/webhook',
          method: 'POST',
        }),
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      global.fetch = mockFetch;

      await pluginResolvers.executePlugin(webhookPlugin, {
        event: 'form.submitted',
        data: { formId: 'form-123', responseId: 'response-123' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      );
    });

    it('should execute quiz-grading plugin and store results', async () => {
      const quizPlugin = {
        type: 'quiz-grading',
        config: JSON.stringify({
          questions: [
            { fieldId: 'q1', correctAnswer: 'A', marks: 10 },
            { fieldId: 'q2', correctAnswer: 'B', marks: 10 },
          ],
          passPercentage: 60,
        }),
      };

      const response = TestDataFactory.createResponse({
        data: JSON.stringify({ q1: 'A', q2: 'C' }),
      });

      prismaMock.response.findUnique.mockResolvedValue(response);
      prismaMock.response.update.mockResolvedValue({
        ...response,
        metadata: {
          'quiz-grading': {
            quizScore: 10,
            totalMarks: 20,
            percentage: 50,
            passed: false,
            results: [
              { fieldId: 'q1', correct: true, marks: 10 },
              { fieldId: 'q2', correct: false, marks: 0 },
            ],
          },
        },
      });

      await pluginResolvers.executePlugin(quizPlugin, {
        event: 'form.submitted',
        responseId: 'response-123',
      });

      expect(prismaMock.response.update).toHaveBeenCalledWith({
        where: { id: 'response-123' },
        data: {
          metadata: expect.objectContaining({
            'quiz-grading': expect.objectContaining({
              quizScore: 10,
              percentage: 50,
              passed: false,
            }),
          }),
        },
      });
    });

    it('should handle plugin execution errors gracefully', async () => {
      const webhookPlugin = {
        type: 'webhook',
        config: JSON.stringify({
          url: 'https://invalid-url',
        }),
      };

      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;

      // Should not throw, but log error
      await expect(
        pluginResolvers.executePlugin(webhookPlugin, {
          event: 'form.submitted',
        })
      ).resolves.not.toThrow();
    });
  });
});
```

**Test Coverage:**
- ✅ Plugin CRUD operations with permission checks
- ✅ Webhook plugin execution with HTTP requests
- ✅ Email plugin with @ mention field substitution
- ✅ Quiz grading logic with correct/incorrect scoring
- ✅ Plugin metadata storage in Response.metadata
- ✅ Error handling for failed plugin execution
- ✅ Event trigger validation

---

## Phase 4: Supporting Services Tests (~10 test files, ~45 tests)

### Priority Areas:
1. **Email service** (`services/emailService.test.ts`)
2. **File upload service** (`services/fileUploadService.test.ts`)
3. **Template service** (`services/templateService.test.ts`)
4. **CDN utilities** (`utils/cdn.test.ts`)
5. **Date helpers** (`utils/dateHelpers.test.ts`)

#### Example Test Structure:

**File:** `apps/backend/src/services/__tests__/emailService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../emailService';
import { mockEmailService } from '../../../test/mocks/emailService.mock';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
  });

  describe('sendEmail', () => {
    it('should send email with correct parameters', async () => {
      const emailData = {
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      };

      const result = await emailService.sendEmail(emailData);

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(emailData);
    });

    it('should retry on failure', async () => {
      mockEmailService.sendEmail
        .mockRejectedValueOnce(new Error('SMTP error'))
        .mockResolvedValueOnce({ success: true });

      const result = await emailService.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: 'Content',
      });

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      mockEmailService.sendEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        emailService.sendEmail({
          to: 'user@example.com',
          subject: 'Test',
          html: 'Content',
        })
      ).rejects.toThrow('Failed to send email after 3 attempts');
    });
  });

  describe('sendFormPublishedEmail', () => {
    it('should send notification with form details', async () => {
      const form = TestDataFactory.createForm({
        title: 'Customer Survey',
        shortUrl: 'abc123',
      });

      await emailService.sendFormPublishedEmail(form, 'owner@example.com');

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Customer Survey'),
          html: expect.stringContaining('abc123'),
        })
      );
    });
  });

  describe('sendInvitationEmail', () => {
    it('should send org invitation with accept link', async () => {
      const invitation = {
        email: 'newuser@example.com',
        organizationName: 'Acme Corp',
        inviterName: 'John Doe',
        token: 'invitation-token-123',
      };

      await emailService.sendInvitationEmail(invitation);

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@example.com',
          html: expect.stringContaining('invitation-token-123'),
        })
      );
    });
  });
});
```

**File:** `apps/backend/src/utils/__tests__/cdn.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { constructCdnUrl, getFileExtension, generateFileKey } from '../cdn';

describe('CDN Utilities', () => {
  describe('constructCdnUrl', () => {
    it('should construct valid CDN URL', () => {
      const url = constructCdnUrl('uploads/image.jpg');

      expect(url).toContain('uploads/image.jpg');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should handle keys with leading slash', () => {
      const url = constructCdnUrl('/uploads/image.jpg');

      expect(url).not.toContain('//uploads');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      expect(getFileExtension('image.jpg')).toBe('jpg');
      expect(getFileExtension('document.pdf')).toBe('pdf');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('README')).toBe('');
    });
  });

  describe('generateFileKey', () => {
    it('should generate unique file key with timestamp', () => {
      const key1 = generateFileKey('test.jpg', 'user-123');
      const key2 = generateFileKey('test.jpg', 'user-123');

      expect(key1).not.toBe(key2);
      expect(key1).toContain('.jpg');
    });

    it('should include user ID in key', () => {
      const key = generateFileKey('avatar.png', 'user-456');

      expect(key).toContain('user-456');
    });
  });
});
```

**Test Coverage:**
- ✅ Email sending with retry logic
- ✅ Template generation for different email types
- ✅ S3 file upload with pre-signed URLs
- ✅ File copying for form duplication
- ✅ CDN URL construction
- ✅ Date manipulation utilities
- ✅ Error handling for external service failures

---

## Test Coverage Metrics

### Expected Coverage by Module:

| Module | Target Coverage | Test Files | Test Cases |
|--------|----------------|------------|------------|
| **Authentication/Authorization** | 85% | 12 | 40 |
| **Form Operations** | 80% | 15 | 80 |
| **Response Handling** | 80% | 10 | 50 |
| **Analytics** | 75% | 8 | 40 |
| **Plugins** | 80% | 8 | 35 |
| **Supporting Services** | 75% | 10 | 45 |
| **Utilities** | 90% | 6 | 30 |
| **Repositories** | 70% | 10 | 20 |
| **TOTAL** | **80%+** | **~63** | **~340** |

### Coverage Reports:

After running tests, coverage reports will be generated in:
- **Text**: Console output with summary
- **HTML**: `apps/backend/coverage/index.html` (open in browser)
- **LCOV**: `apps/backend/coverage/lcov.info` (for CI/CD integration)
- **JSON**: `apps/backend/coverage/coverage.json` (programmatic access)

### CI/CD Integration:

Add to GitHub Actions workflow:

```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Run tests with coverage
        run: pnpm --filter backend test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/backend/coverage/lcov.info
          flags: backend
```

---

## Running Tests

### Development Workflow:

```bash
# Run all tests once
cd apps/backend
pnpm test

# Watch mode (auto-rerun on file changes)
pnpm test:watch

# Visual test UI in browser
pnpm test:ui

# Generate coverage report
pnpm test:coverage

# Run specific test file
pnpm test formService.test.ts

# Run tests matching pattern
pnpm test --grep "FormService"

# Run tests for specific module
pnpm test src/services/__tests__/
```

### Debugging Tests:

```typescript
// Add .only to run single test
it.only('should create form', async () => {
  // This test will run exclusively
});

// Add .skip to skip test
it.skip('should handle edge case', async () => {
  // This test will be skipped
});

// Use console.log for debugging
it('should process data', () => {
  console.log('Debug value:', result);
  expect(result).toBe(expected);
});
```

### Coverage Thresholds:

The test suite will **fail** if coverage drops below 80% for:
- Line coverage
- Function coverage
- Branch coverage
- Statement coverage

This ensures consistent code quality and test coverage maintenance.

---

## Best Practices

### 1. Test Naming Conventions

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => {
      // Test implementation
    });
  });
});
```

**Example:**
```typescript
describe('FormService', () => {
  describe('createForm', () => {
    it('should create form with valid data', () => {});
    it('should throw error when title is missing', () => {});
    it('should assign OWNER permission to creator', () => {});
  });
});
```

### 2. Test Structure (AAA Pattern)

```typescript
it('should update form with valid permissions', async () => {
  // Arrange - Set up test data and mocks
  const form = TestDataFactory.createForm();
  prismaMock.form.findUnique.mockResolvedValue(form);

  // Act - Execute the code being tested
  const result = await formService.updateForm('form-123', { title: 'New Title' });

  // Assert - Verify the results
  expect(result.title).toBe('New Title');
  expect(prismaMock.form.update).toHaveBeenCalled();
});
```

### 3. Mock Management

```typescript
// Reset mocks before each test (automatic with setup)
beforeEach(() => {
  vi.clearAllMocks();
});

// Spy on specific methods
const spy = vi.spyOn(emailService, 'sendEmail');
expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));

// Mock return values
prismaMock.form.findUnique.mockResolvedValue(mockForm);
prismaMock.form.create.mockRejectedValue(new Error('Database error'));
```

### 4. Async Testing

```typescript
// Use async/await
it('should fetch data', async () => {
  const result = await service.getData();
  expect(result).toBeDefined();
});

// Test promises
it('should reject with error', async () => {
  await expect(service.invalidOperation()).rejects.toThrow('Error message');
});

// Test resolved values
it('should resolve with data', async () => {
  await expect(service.getData()).resolves.toEqual({ success: true });
});
```

### 5. Edge Cases & Error Handling

```typescript
describe('edge cases', () => {
  it('should handle null values', () => {});
  it('should handle empty arrays', () => {});
  it('should handle undefined input', () => {});
  it('should handle very long strings', () => {});
  it('should handle concurrent requests', () => {});
});

describe('error handling', () => {
  it('should throw error for invalid input', () => {});
  it('should return error message on failure', () => {});
  it('should handle database errors gracefully', () => {});
});
```

### 6. Test Data Isolation

```typescript
// Use factories for consistent test data
const form = TestDataFactory.createForm({ title: 'Custom Title' });

// Clean database after each test (automatic with setup)
afterEach(async () => {
  await prisma.form.deleteMany();
  await prisma.response.deleteMany();
});

// Use unique IDs to prevent collisions
const uniqueId = `test-${Date.now()}-${Math.random()}`;
```

---

## Timeline & Milestones

### Week 1: Infrastructure Setup
- **Day 1-2**: Install dependencies, configure Vitest, create setup files
- **Day 3-4**: Build test utilities, mocks, and factories
- **Day 5**: Create test fixtures and documentation

### Week 2-3: Core Module Tests
- **Week 2**: Authentication, authorization, form operations
- **Week 3**: Response handling, analytics, filtering

### Week 4: Plugin & Supporting Tests
- **Day 1-2**: Plugin system tests (webhook, email, quiz)
- **Day 3-4**: Supporting services (email, file upload, templates)
- **Day 5**: Utilities and final coverage improvements

### Week 5: Review & Optimization
- **Day 1-2**: Review test coverage reports, add missing tests
- **Day 3**: Optimize test performance, reduce duplication
- **Day 4**: Documentation and CI/CD integration
- **Day 5**: Final testing and handoff

---

## Success Criteria

✅ **80%+ code coverage** across all modules
✅ **~340 meaningful test cases** covering business logic
✅ **Fast test execution** (<30 seconds for full suite)
✅ **Realistic database testing** with in-memory MongoDB
✅ **CI/CD integration** with automated test runs
✅ **Clear documentation** with examples and best practices
✅ **No false positives** - tests accurately validate behavior
✅ **Maintainable tests** - easy to update as code evolves

---

## Conclusion

This comprehensive testing plan will provide robust test coverage for the backend application while maintaining fast test execution through isolated unit tests and in-memory database testing. The 80% coverage target focuses on critical business logic while avoiding over-testing trivial code paths.

The modular structure allows for incremental implementation, making it easy to prioritize high-value tests first and add additional coverage over time. The use of modern testing tools (Vitest, mongodb-memory-server) ensures a great developer experience with fast feedback loops.
