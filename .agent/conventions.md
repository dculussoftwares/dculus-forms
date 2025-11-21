# Coding Conventions and Standards

## TypeScript Standards

### Type Safety
- **Strict Mode**: All projects use `strict: true` in `tsconfig.json`
- **Avoid `any`**: Use proper types or `unknown` when type is truly unknown
- **Prefix Unused Variables**: Use `_` prefix for intentionally unused variables (e.g., `_req`, `_unusedParam`)
- **Type Imports**: Use `import type` for type-only imports to improve tree-shaking

### Naming Conventions

#### Files and Directories
- **Components**: PascalCase (e.g., `FormBuilder.tsx`, `ResponseTable.tsx`)
- **Utilities**: camelCase (e.g., `generateId.ts`, `apiHelpers.ts`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.ts`, `useFormData.ts`)
- **Context**: PascalCase with `Provider` suffix (e.g., `AuthProvider.tsx`)
- **Types**: PascalCase (e.g., `FormTypes.ts`, `UserTypes.ts`)

#### Code Elements
- **Variables/Functions**: camelCase (e.g., `formData`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `MAX_FILE_SIZE`)
- **Classes**: PascalCase (e.g., `FormService`, `UserRepository`)
- **Interfaces**: PascalCase, no `I` prefix (e.g., `User`, `FormField`)
- **Types**: PascalCase (e.g., `FormStatus`, `ResponseData`)
- **Enums**: PascalCase for name, UPPER_SNAKE_CASE for values

#### GraphQL Conventions
- **Queries**: Intent-first with `Query` suffix (e.g., `GetFormQuery`, `ListFormsQuery`)
- **Mutations**: Intent-first with `Mutation` suffix (e.g., `CreateFormMutation`, `UpdateFormMutation`)
- **Subscriptions**: Intent-first with `Subscription` suffix (e.g., `FormUpdatedSubscription`)
- **Input Types**: PascalCase with `Input` suffix (e.g., `CreateFormInput`, `UpdateUserInput`)

## Code Formatting

### Prettier Configuration
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 80,
  "trailingComma": "es5"
}
```

### ESLint Rules
- **No Unused Vars**: Error (except with `_` prefix)
- **No Console**: Warning (use proper logging in production)
- **Explicit Function Return Types**: Recommended for public APIs
- **No Explicit Any**: Warning

## Project Structure Conventions

### Backend Structure
```
apps/backend/src/
├── graphql/              # GraphQL layer
│   ├── resolvers/       # Resolver functions
│   ├── types/           # GraphQL type definitions
│   └── schema.ts        # Schema composition
├── services/            # Business logic
├── repositories/        # Data access layer
├── middleware/          # Express middleware
├── lib/                # Third-party configurations
├── utils/              # Utility functions
└── types/              # TypeScript types
```

**Pattern**: Controller/Resolver → Service → Repository → Prisma

### Frontend Structure
```
apps/[app-name]/src/
├── components/          # App-specific components
├── pages/              # Route components
├── contexts/           # React contexts
├── hooks/              # Custom hooks
├── graphql/            # GraphQL queries/mutations
├── services/           # API clients, utilities
├── lib/                # Third-party configurations
└── types/              # TypeScript types
```

### Shared Packages
```
packages/
├── ui/                 # UI components only
├── utils/              # Utility functions
├── types/              # Type definitions
└── plugins/            # Plugin system
```

**Rule**: Never duplicate code between apps. Extract to shared packages.

## Component Conventions

### React Components

#### Functional Components
```typescript
// Preferred: Named function with explicit return type
export function FormBuilder({ formId }: FormBuilderProps): JSX.Element {
  // Component logic
  return <div>...</div>;
}

// Alternative: Arrow function for simple components
export const SimpleButton = ({ label }: ButtonProps) => (
  <button>{label}</button>
);
```

#### Props Interface
```typescript
// Always define props interface
interface FormBuilderProps {
  formId: string;
  onSave?: (form: Form) => void;
  className?: string;
}

// Use destructuring with defaults
export function FormBuilder({ 
  formId, 
  onSave, 
  className = '' 
}: FormBuilderProps) {
  // ...
}
```

#### Hooks Order
1. State hooks (`useState`, `useReducer`)
2. Context hooks (`useContext`, custom context hooks)
3. Ref hooks (`useRef`)
4. Effect hooks (`useEffect`, `useLayoutEffect`)
5. Custom hooks
6. Memoization hooks (`useMemo`, `useCallback`)

### GraphQL Conventions

#### Query/Mutation Hooks
```typescript
// Use Apollo Client hooks
const { data, loading, error } = useQuery(GET_FORM_QUERY, {
  variables: { id: formId },
});

const [createForm, { loading: creating }] = useMutation(CREATE_FORM_MUTATION, {
  onCompleted: (data) => {
    // Handle success
  },
});
```

#### Error Handling
```typescript
// Always handle loading and error states
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data) return null;
```

## Backend Conventions

### Service Layer
```typescript
// Service methods should be async and return typed results
export class FormService {
  async createForm(input: CreateFormInput, userId: string): Promise<Form> {
    // Validation
    this.validateFormInput(input);
    
    // Business logic
    const formData = this.prepareFormData(input, userId);
    
    // Data access via repository
    return this.formRepository.create(formData);
  }
  
  private validateFormInput(input: CreateFormInput): void {
    if (!input.title?.trim()) {
      throw new Error('Form title is required');
    }
  }
}
```

### Repository Layer
```typescript
// Repository methods should be thin wrappers around Prisma
export class FormRepository {
  async create(data: Prisma.FormCreateInput): Promise<Form> {
    return prisma.form.create({ data });
  }
  
  async findById(id: string): Promise<Form | null> {
    return prisma.form.findUnique({ where: { id } });
  }
}
```

### GraphQL Resolvers
```typescript
// Resolvers should delegate to services
export const formResolvers = {
  Query: {
    form: async (_parent, { id }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return formService.getForm(id, user.id);
    },
  },
  Mutation: {
    createForm: async (_parent, { input }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return formService.createForm(input, user.id);
    },
  },
};
```

## Import Conventions

### Import Order
1. External packages (React, Apollo, etc.)
2. Shared packages (`@dculus/ui`, `@dculus/utils`)
3. Absolute imports from current app
4. Relative imports (parent directories)
5. Relative imports (same directory)
6. Type imports (at the end)

```typescript
// External
import React, { useState } from 'react';
import { useQuery } from '@apollo/client';

// Shared packages
import { Button, Card } from '@dculus/ui';
import { generateId } from '@dculus/utils';

// Absolute imports
import { AuthContext } from '@/contexts/AuthContext';

// Relative imports
import { FormField } from '../components/FormField';
import { validateForm } from './validation';

// Type imports
import type { Form, FormField as FormFieldType } from '@dculus/types';
```

### Shared Package Imports
```typescript
// ✅ Correct: Import from shared packages
import { Button, Card, Input } from '@dculus/ui';
import { generateId, cn } from '@dculus/utils';

// ❌ Wrong: Don't duplicate components in apps
import { Button } from '@/components/ui/button'; // Don't do this!
```

## Error Handling

### Frontend
```typescript
// Use try-catch for async operations
try {
  const result = await createForm(formData);
  toast.success('Form created successfully');
} catch (error) {
  console.error('Failed to create form:', error);
  toast.error('Failed to create form');
}
```

### Backend
```typescript
// Use custom error classes
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Throw meaningful errors
if (!user) {
  throw new UnauthorizedError('User must be authenticated');
}
```

## Testing Conventions

### Unit Tests
```typescript
// Use descriptive test names
describe('FormService', () => {
  describe('createForm', () => {
    it('should create a form with valid input', async () => {
      // Arrange
      const input = { title: 'Test Form' };
      
      // Act
      const result = await formService.createForm(input, userId);
      
      // Assert
      expect(result.title).toBe('Test Form');
    });
    
    it('should throw error when title is empty', async () => {
      // Arrange
      const input = { title: '' };
      
      // Act & Assert
      await expect(
        formService.createForm(input, userId)
      ).rejects.toThrow('Form title is required');
    });
  });
});
```

### Integration Tests (Cucumber)
```gherkin
# Use Given-When-Then format
Feature: Form Creation
  Scenario: User creates a new form
    Given I am authenticated as "user@example.com"
    When I create a form with title "My Form"
    Then the form should be created successfully
    And the form should have title "My Form"
```

## Git Conventions

### Commit Messages
Follow Conventional Commits:
```
feat: add quiz grading plugin
fix: resolve form submission error
chore: update dependencies
docs: add deployment guide
refactor: extract form validation logic
test: add integration tests for auth
```

### Branch Naming
```
feature/quiz-grading
fix/form-submission-error
chore/update-dependencies
refactor/extract-validation
```

## Performance Best Practices

### React
- Use `React.memo` for expensive components
- Use `useMemo` for expensive computations
- Use `useCallback` for event handlers passed to children
- Lazy load routes and heavy components

### GraphQL
- Use field selection to request only needed data
- Implement pagination for large lists
- Use DataLoader to batch and cache database queries
- Cache query results with Apollo Client

### Database
- Use proper indexes on frequently queried fields
- Use `select` to fetch only needed fields
- Use `include` carefully to avoid N+1 queries
- Implement pagination for large result sets

## Security Best Practices

### Authentication
- Always validate user session in resolvers
- Use middleware for route protection
- Never expose sensitive data in responses
- Implement rate limiting for auth endpoints

### Input Validation
- Validate all user input on both client and server
- Sanitize HTML input to prevent XSS
- Use parameterized queries (Prisma handles this)
- Implement CSRF protection for mutations

### Authorization
- Check user permissions in resolvers
- Implement organization-level access control
- Use row-level security where appropriate
- Log authorization failures

## Documentation Standards

### Code Comments
```typescript
// Use JSDoc for public APIs
/**
 * Creates a new form for the specified organization.
 * 
 * @param input - Form creation input data
 * @param userId - ID of the user creating the form
 * @returns The created form
 * @throws {ValidationError} If input is invalid
 * @throws {UnauthorizedError} If user lacks permission
 */
export async function createForm(
  input: CreateFormInput,
  userId: string
): Promise<Form> {
  // Implementation
}

// Use inline comments for complex logic
// Calculate score based on weighted average of correct answers
const score = responses.reduce((acc, r) => {
  const weight = r.field.weight || 1;
  return acc + (r.isCorrect ? weight : 0);
}, 0) / totalWeight;
```

### README Files
- Each package should have a README
- Include usage examples
- Document public APIs
- List dependencies and requirements
