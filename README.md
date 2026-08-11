# Dculus Forms

A modern form builder and management system built with Express.js + GraphQL backend and React + shadcn/ui frontend applications.

[![Build Pipeline](https://github.com/dculussoftwares/dculus-forms/actions/workflows/build.yml/badge.svg)](https://github.com/dculussoftwares/dculus-forms/actions/workflows/build.yml)


## 🏗️ Architecture

This is a monorepo structure with the following components:

- **Backend**: Express.js with Apollo GraphQL (code-first approach)
- **Form App**: React form builder application with shadcn/ui components
- **Form Viewer**: React form viewer application with shared UI components
- **Shared Packages**: Common types, utilities, and UI components
- **Package Manager**: pnpm for efficient dependency management

📖 **[How Dculus Works](docs/architecture/)** — Interactive architecture documentation with 12 guides covering submission flows, integrations, storage, billing, collaboration, authorization, and more. Perfect for onboarding new developers.

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
   # Start PostgreSQL using Docker
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

### Local
- **Form App (Builder)**: http://localhost:3000
- **Form Viewer**: http://localhost:5173
- **Backend API**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health
- **Mongo Express (Database UI)**: http://localhost:8081 (admin/password123)

### Development
- **Form App (Builder)**: https://dculus-forms-app.pages.dev/
- **Form Viewer**: https://dculus-forms-viewer-app.pages.dev/
- **Backend API**: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io
- **GraphQL Playground**: https://dculus-forms-backend.reddune-e5ba9473.eastus.azurecontainerapps.io/graphql

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
Legacy REST handlers for forms, responses, and templates have been removed—GraphQL is now the only supported surface for these resources.

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
import { generateId, cn } from '@dculus/utils';

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
import { generateId, cn } from '@dculus/utils';
```

The UI package includes all shadcn/ui components:
- Core components: Button, Card, Input, Label, Textarea
- Layout components: Sidebar, SidebarProvider, SidebarInset, SidebarTrigger
- Navigation components: Breadcrumb, DropdownMenu, Avatar
- Utility components: Separator, Collapsible
- And many more...

## 📦 Deployment

### Using Pre-built Release Artifacts (Recommended)

The easiest way to deploy Dculus Forms is to use the pre-built artifacts from GitHub Releases:

1. **Download Release Artifacts**
   - Go to [GitHub Releases](https://github.com/your-org/dculus-forms/releases)
   - Download the desired application ZIP file:
     - `form-app-build-v{version}.zip` - Form Builder Application
     - `form-viewer-build-v{version}.zip` - Form Viewer Application
     - `admin-app-build-v{version}.zip` - Admin Dashboard Application

2. **Extract and Deploy**
   ```bash
   unzip form-app-build-v1.0.0.zip
   # Deploy the dist/ folder to any static hosting provider
   ```

3. **Backend Docker Image**
   ```bash
   docker pull dculus/forms-backend:v1.0.0
   docker run -d -p 4000:4000 \
     -e DATABASE_URL='your-postgresql-url' \
     -e BETTER_AUTH_SECRET='your-secret' \
     dculus/forms-backend:v1.0.0
   ```

**Supported Hosting Providers:**
- AWS S3 + CloudFront
- Azure Static Web Apps
- Cloudflare Pages
- Netlify
- Vercel
- nginx (self-hosted)
- Google Cloud Storage

**📚 For detailed deployment instructions for each platform, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

### Creating a New Release

To create a new release with build artifacts:

```bash
# Create and push a version tag (annotated tag with message)
git tag -a v1.2.0 -m "Release v1.2.0" && \
git push origin v1.2.0
```

The GitHub Actions workflow will automatically:
- Build all frontend applications
- Create ZIP archives
- Create a GitHub Release with downloadable artifacts
- Build and push the backend Docker image

### Building from Source

If you need to build with custom environment variables:

**Backend:**
```bash
pnpm backend:build
# Deploy dist/ folder or use Docker
```

**Form App:**
```bash
VITE_API_URL=https://your-api.com \
VITE_GRAPHQL_URL=https://your-api.com/graphql \
VITE_FORM_VIEWER_URL=https://your-viewer.com \
pnpm form-app:build
# Deploy apps/form-app/dist/ to static hosting
```

**Form Viewer:**
```bash
pnpm form-viewer:build
# Deploy apps/form-viewer/dist/ to static hosting
```

**Admin App:**
```bash
VITE_API_URL=https://your-api.com \
VITE_GRAPHQL_URL=https://your-api.com/graphql \
pnpm admin-app:build
# Deploy apps/admin-app/dist/ to static hosting
```

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

This project is licensed under the GNU (GENERAL PUBLIC LICENSE) License.

## 🆘 Support

For support and questions, please open an issue in the repository. 
