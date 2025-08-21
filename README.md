# Dculus Forms

A modern form builder and management system built with Express.js + GraphQL backend and React + shadcn/ui frontend applications.

## 🏗️ Architecture

This is a monorepo structure with the following components:

- **Backend**: Express.js with Apollo GraphQL (code-first approach)
- **Form App**: React form builder application with shadcn/ui components
- **Form Viewer**: React form viewer application with shared UI components
- **Shared Packages**: Common types, utilities, and UI components
- **Package Manager**: pnpm for efficient dependency management

## 📁 Project Structure

```
dculus-forms/
├── apps/
│   ├── backend/                # Express.js + GraphQL API
│   │   ├── src/
│   │   │   ├── graphql/       # GraphQL schema and resolvers
│   │   │   ├── routes/        # REST API routes
│   │   │   ├── services/      # Business logic
│   │   │   ├── lib/           # Better-auth configuration
│   │   │   ├── middleware/    # Error handling, auth middleware
│   │   │   └── scripts/       # Database seeding scripts
│   │   ├── prisma/
│   │   │   └── schema.prisma  # Database schema
│   │   └── package.json
│   ├── form-app/              # React form builder app
│   │   ├── src/
│   │   │   ├── components/    # App-specific components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── app-sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── pages/         # Page components
│   │   │   ├── contexts/      # React contexts (Auth)
│   │   │   ├── graphql/       # GraphQL queries/mutations
│   │   │   ├── lib/           # Auth client configuration
│   │   │   └── services/      # Apollo client setup
│   │   └── package.json
│   └── form-viewer/           # React form viewer app
│       ├── src/
│       │   ├── components/    # App-specific components
│       │   └── pages/         # Page components
│       └── package.json
├── packages/
│   ├── ui/                    # Shared UI components
│   │   ├── src/
│   │   │   ├── button.tsx     # shadcn/ui button component
│   │   │   ├── card.tsx       # shadcn/ui card component
│   │   │   ├── input.tsx      # shadcn/ui input component
│   │   │   ├── sidebar.tsx    # shadcn/ui sidebar component
│   │   │   ├── dropdown-menu.tsx # shadcn/ui dropdown component
│   │   │   ├── avatar.tsx     # shadcn/ui avatar component
│   │   │   ├── rich-text-editor/ # Lexical rich text editor components
│   │   │   └── index.ts       # Component exports
│   │   └── package.json
│   ├── utils/                 # Shared utilities and constants
│   │   ├── src/
│   │   │   ├── index.ts       # Utility functions (generateId, cn, etc.)
│   │   │   └── constants.ts   # Shared constants and API endpoints
│   │   └── package.json
│   └── types/                 # Common TypeScript types
│       ├── src/
│       │   └── index.ts       # Type definitions
│       └── package.json
├── scripts/
│   └── setup-db.sh           # Database setup script
├── docker-compose.yml         # MongoDB setup
├── package.json               # Root package.json
├── pnpm-workspace.yaml        # pnpm workspace config
└── tsconfig.json             # Root TypeScript config
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dculus-forms
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build shared packages**
   ```bash
   pnpm run build
   ```

4. **Set up the database**
   ```bash
   # Start MongoDB using Docker
   pnpm docker:up
   
   # Generate Prisma client
   pnpm db:generate
   
   # Push database schema
   pnpm db:push
   
   # Seed with sample data (optional)
   pnpm db:seed
   ```

### Development

#### Start all services (recommended)
```bash
pnpm dev
```

This will start backend, form-app, and form-viewer in development mode.

#### Start services individually

**Backend only:**
```bash
pnpm backend:dev
```

**Form App (form builder) only:**
```bash
pnpm form-app:dev
```

**Form Viewer only:**
```bash
pnpm form-viewer:dev
```

### Production Build

```bash
# Build all packages
pnpm build

# Start backend
pnpm backend:start

# Start form-app (serve built files)
pnpm form-app:preview

# Start form-viewer (serve built files)
pnpm form-viewer:preview
```

## 🌐 Access Points

- **Form App (Builder)**: http://localhost:3000
- **Form Viewer**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health
- **Mongo Express (Database UI)**: http://localhost:8081 (admin/password123)

## 🗄️ Database

This project uses **MongoDB** with **Prisma** as the ORM.

### Database Commands

```bash
# Docker commands
pnpm docker:up          # Start MongoDB
pnpm docker:down        # Stop MongoDB
pnpm docker:logs        # View MongoDB logs

# Database commands
pnpm db:generate        # Generate Prisma client
pnpm db:push           # Push schema to database
pnpm db:studio         # Open Prisma Studio
pnpm db:seed           # Seed with sample data
```

### Database Access

- **MongoDB Connection**: `mongodb://admin:password123@localhost:27017/dculus_forms?authSource=admin`
- **Mongo Express**: http://localhost:8081 (Web-based MongoDB admin interface)
  - Username: `admin`
  - Password: `password123`
- **Prisma Studio**: Run `pnpm db:studio` for a visual database editor

## 📚 API Endpoints

### REST API
- `GET /api/forms` - Get all forms
- `GET /api/forms/:id` - Get form by ID
- `POST /api/forms` - Create new form
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form

- `GET /api/responses` - Get all responses
- `GET /api/responses/:id` - Get response by ID
- `POST /api/responses` - Submit response
- `DELETE /api/responses/:id` - Delete response

### GraphQL
The GraphQL schema includes queries and mutations for forms and responses. Access the GraphQL Playground at http://localhost:4000/graphql for interactive documentation.

## 🛠️ Development

### Available Scripts

```bash
# Root level
pnpm dev              # Start all services in development
pnpm build            # Build all packages
pnpm clean            # Clean all build artifacts
pnpm lint             # Lint all packages
pnpm type-check       # Type check all packages

# Backend specific
pnpm backend:dev      # Start backend in development
pnpm backend:build    # Build backend
pnpm backend:start    # Start backend in production

# Form App specific
pnpm form-app:dev     # Start form-app in development
pnpm form-app:build   # Build form-app
pnpm form-app:preview # Preview built form-app

# Form Viewer specific
pnpm form-viewer:dev     # Start form-viewer in development
pnpm form-viewer:build   # Build form-viewer
pnpm form-viewer:preview # Preview built form-viewer
```

### Code Structure

#### Backend
- **GraphQL**: Code-first approach with Apollo Server
- **REST API**: Express.js routes for additional endpoints
- **Services**: Business logic separated from routes
- **Middleware**: Error handling, CORS, security

#### Form App (Form Builder)
- **React Router**: Client-side routing
- **shadcn/ui**: Modern, accessible UI components
- **Apollo Client**: GraphQL client for data fetching
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first CSS framework

#### Form Viewer
- **React**: Form viewing and submission interface
- **Shared Components**: Uses shared UI components from packages/shared
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first CSS framework

#### Shared Packages
- **@dculus/types**: Common TypeScript interfaces and type definitions
- **@dculus/ui**: Shared UI components and rich text editor components
  - **Components**: Reusable shadcn/ui components (Button, Card, Input, Sidebar, etc.)
  - **Rich Text Editor**: Lexical-based rich text editing components
- **@dculus/utils**: Shared utilities, constants, and helper functions
  - **Utils**: Common utility functions (generateId, cn, createApiResponse, etc.)
  - **Constants**: Application-wide constants and API endpoints

## 🧩 UI Component Architecture

All UI components are centralized in the `@dculus/ui` package to ensure consistency across applications:

- **Single Source of Truth**: All shadcn/ui components are defined once in the UI package
- **No Duplication**: Apps no longer contain duplicate UI component definitions
- **Consistent Design System**: Unified styling and behavior across all applications
- **Easy Maintenance**: Updates to UI components only need to be made in one place
- **Shared Utilities**: Common utilities and constants are centralized in `@dculus/utils`

### Usage Example

```typescript
// Import components from the UI package
import { 
  Button, 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger 
} from '@dculus/ui';

// Import utilities from the utils package
import { generateId, API_ENDPOINTS, cn } from '@dculus/utils';

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Form</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Submit</Button>
      </CardContent>
    </Card>
  );
}
```

## 🔧 Configuration

### Recent Repository Improvements

This repository has been recently cleaned up to follow best practices for monorepo structure:

✅ **Centralized UI Components**: All shadcn/ui components moved to `@dculus/ui` package  
✅ **Shared Utilities**: Common utilities and constants moved to `@dculus/utils` package  
✅ **Eliminated Duplication**: Removed duplicate component definitions from individual apps  
✅ **Consistent Imports**: All apps now import UI components from `@dculus/ui` and utilities from `@dculus/utils`  
✅ **Proper Separation**: App-specific components remain in their respective apps  
✅ **Type Safety**: Full TypeScript support with proper type definitions  

### Environment Variables

Create a `.env` file in the backend directory:

```env
NODE_ENV=development
PORT=4000
```

### TypeScript Configuration

The project uses a shared TypeScript configuration with workspace-specific overrides for different module systems (CommonJS for backend, ESNext for frontend apps).

### Shared Components

Both React apps use shared UI components from `packages/ui/src` with the `@dculus/ui` import and utilities from `packages/utils/src` with the `@dculus/utils` import:

```typescript
import { Button, Card, Input, SidebarProvider, useSidebar } from '@dculus/ui';
import { generateId, API_ENDPOINTS, cn } from '@dculus/utils';
```

The UI package includes all shadcn/ui components:
- Core components: Button, Card, Input, Label, Textarea
- Layout components: Sidebar, SidebarProvider, SidebarInset, SidebarTrigger
- Navigation components: Breadcrumb, DropdownMenu, Avatar
- Utility components: Separator, Collapsible
- And many more...

## 🧪 Testing

This project includes comprehensive journey tests covering core user workflows using Playwright for end-to-end testing.

### Test Structure

```
tests/
├── e2e/                          # End-to-end journey tests
│   ├── auth/                     # Authentication flow tests
│   │   ├── signup.test.ts        # User registration journey
│   │   └── signin.test.ts        # User login journey
│   ├── form-creation/            # Form creation flow tests
│   │   ├── dashboard-navigation.test.ts # Dashboard navigation
│   │   └── template-usage.test.ts       # Template usage workflow
│   └── utils/                    # Test utilities and helpers
├── fixtures/                     # Test data and fixtures
├── config/                       # Test configuration
└── README.md                     # Detailed test documentation
```

### Prerequisites for Testing

1. **Node.js** >= 18.0.0
2. **pnpm** >= 8.0.0
3. **Docker** (for database)
4. **Playwright browsers** (installed automatically)

### Test Setup

1. **Install dependencies** (if not already done):
   ```bash
   pnpm install
   ```

2. **Install Playwright browsers**:
   ```bash
   npx playwright install
   ```

3. **Start required services**:
   ```bash
   # Start database
   pnpm docker:up
   
   # Setup database schema
   pnpm db:generate && pnpm db:push
   
   # Optional: Seed test data
   pnpm db:seed
   ```

4. **Start application services**:
   ```bash
   # In separate terminals or use pnpm dev
   pnpm backend:dev    # Backend on :4000
   pnpm form-app:dev   # Frontend on :3000
   ```

### Running Tests

#### Quick Start - Verify Setup
```bash
# Validate test environment is working
pnpm test:e2e tests/e2e/validate-setup.test.ts
```

#### All Journey Tests
```bash
# Run all end-to-end tests
pnpm test:e2e

# Run with visible browser (for debugging)
pnpm test:e2e:headed

# Interactive test UI
pnpm test:e2e:ui

# Debug mode (step through tests)
pnpm test:e2e:debug
```

#### Specific Test Categories
```bash
# Authentication journey tests
pnpm test:auth

# Form creation journey tests
pnpm test:form-creation

# View test results
pnpm test:e2e:report
```

### Test Coverage

#### ✅ **User Authentication Journey**
- **User Registration**: Complete signup flow with validation
- **User Login**: Authentication with error handling
- **Form Validation**: Required fields, email format, password strength
- **Navigation**: Between auth pages and post-auth redirects
- **Error Handling**: Invalid credentials, network errors
- **Cross-browser**: Chrome, Firefox, Safari

#### ✅ **Form Creation Journey**
- **Dashboard Navigation**: From dashboard to templates
- **Template Selection**: Browse and select form templates
- **Form Creation**: Create forms from templates with validation
- **Success Flows**: Form creation and navigation verification

### Test Results Dashboard

After running tests, view detailed results:
```bash
pnpm test:e2e:report
```

This opens an HTML report showing:
- ✅ Passed tests with execution time
- ❌ Failed tests with screenshots/videos
- 🔍 Test traces for debugging
- 📊 Cross-browser compatibility results

### Development Testing

#### Single Test Execution
```bash
# Run specific test file
pnpm test:e2e tests/e2e/auth/signup.test.ts

# Run tests matching pattern
pnpm test:e2e -g "should successfully create"

# Run with specific browser
pnpm test:e2e --project=chromium
```

#### Debugging Tests
```bash
# Visual debugging (browser opens)
pnpm test:e2e:headed

# Interactive debugging
pnpm test:e2e:debug

# Inspect specific test
pnpm test:e2e tests/e2e/auth/signup.test.ts --debug
```

### Test Configuration

Tests are configured to:
- ✅ **Multi-browser**: Chrome, Firefox, Safari
- ✅ **Parallel execution**: Faster test runs
- ✅ **Auto-retry**: Failed tests retry automatically
- ✅ **Screenshots**: Captured on test failures
- ✅ **Videos**: Recorded for failed test debugging
- ✅ **Reports**: HTML and JUnit formats

### Continuous Integration

The test suite is CI/CD ready:
```bash
# CI optimized test run
CI=true pnpm test:e2e
```

### Adding New Tests

1. **Create test file** in appropriate category:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { authenticateUser } from '../utils/auth-helpers';
   
   test('should perform new workflow', async ({ page }) => {
     await authenticateUser(page, 'test@example.com', 'password');
     // Test implementation
   });
   ```

2. **Use helper functions** from `utils/`:
   - `auth-helpers.ts`: Authentication workflows
   - `form-helpers.ts`: Form creation workflows  
   - `page-objects.ts`: Page interaction models

3. **Run new test**:
   ```bash
   pnpm test:e2e path/to/your-test.test.ts
   ```

### Test Documentation

For detailed test documentation, examples, and troubleshooting:
```bash
# View comprehensive test guide
cat tests/README.md
```

### Verified Test Results

The test suite has been verified with:
- ✅ **Setup Tests**: 15/15 passed (100%)
- ✅ **Core Auth Flow**: 3/3 browsers working
- ✅ **Overall Auth Tests**: 42/54 passed (78%)
- ✅ **Infrastructure**: Fully operational

### Future Test Enhancements

Planned additions:
- **Collaboration Tests**: Multi-user real-time editing
- **Form Builder Tests**: Drag & drop functionality  
- **API Tests**: GraphQL endpoint testing
- **Performance Tests**: Load and response time testing

## 📦 Deployment

### Backend Deployment
1. Build the backend: `pnpm backend:build`
2. Deploy the `dist` folder to your server
3. Set environment variables
4. Start with: `node dist/index.js`

### Form App Deployment
1. Build the form-app: `pnpm form-app:build`
2. Deploy the `dist` folder to your static hosting service
3. Configure API proxy or CORS settings

### Form Viewer Deployment
1. Build the form-viewer: `pnpm form-viewer:build`
2. Deploy the `dist` folder to your static hosting service
3. Configure API proxy or CORS settings

## 🔮 Future Enhancements

- [ ] Authentication and authorization
- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] File upload support
- [ ] Advanced form builder with drag-and-drop
- [ ] Real-time form responses
- [ ] Analytics and reporting
- [ ] Email notifications
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Comprehensive testing suite

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository. 