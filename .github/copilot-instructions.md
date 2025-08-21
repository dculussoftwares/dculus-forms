and we are using graphql as api layer, so use graphql queries and mutations to interact with the backend always, dont create any rest api endpoints strictly except `better-auth` api's. we are using apollo server as graphql server, so use apollo server features like context, middlewares etc.

# Copilot LLM Instructions for Dculus Forms Monorepo

## General Coding Principles

1. **Functional Programming**: Always prefer functional programming paradigms (pure functions, immutability, stateless logic, composition, etc.) over imperative or OOP styles unless strictly necessary. (except FormField)
2. **Type Safety**: All code must be fully type-safe using TypeScript. Use generics, utility types, and type inference to maximize safety and developer experience.
3. **Validation**: Use `zod` for all schema validation, both on backend (GraphQL, Prisma) and frontend (form validation, API responses).
4. **Consistency**: Follow the established project structure and naming conventions. Reuse shared code and components from the appropriate packages.

## Project Structure (Monorepo)

- `apps/backend`: Express.js + Apollo GraphQL API server. Contains GraphQL schema, resolvers, services, middleware, and Prisma setup. All backend business logic and data access lives here.
- `apps/form-app`: React form builder app. Uses Apollo Client for GraphQL, shadcn/ui for UI, and imports shared components from `@dculus/ui`.
- `apps/form-viewer`: React app for viewing and submitting forms. Also uses shared UI and types.
- `packages/ui`: Shared shadcn/ui components and rich text editor components. All UI components must be imported from here for consistency.
- `packages/utils`: Shared utility functions, constants, API utilities, and helper functions.
- `packages/types`: Shared TypeScript types and interfaces for all apps.

## Folder Structure

```
dculus-forms/
├── docker-compose.yml              # MongoDB setup
├── package.json                    # Root package.json with workspace scripts
├── pnpm-lock.yaml                 # pnpm lockfile
├── pnpm-workspace.yaml            # pnpm workspace configuration
├── tsconfig.json                  # Root TypeScript config
├── README.md                      # Project documentation
├── PRISMA_SETUP_COMPLETE.md       # Database setup documentation
├── TEMPLATE_GALLERY_README.md     # Template gallery documentation
├── .github/
│   └── copilot-instructions.md    # This file - LLM instructions
├── scripts/
│   └── setup-db.sh               # Database setup script
├── apps/
│   ├── backend/                   # Express.js + Apollo GraphQL API server
│   │   ├── auth.ts               # Better-auth configuration
│   │   ├── package.json          # Backend dependencies
│   │   ├── tsconfig.json         # Backend TypeScript config
│   │   ├── DATABASE_SETUP.md     # Database setup guide
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Prisma database schema
│   │   │   └── schema.prisma.backup
│   │   └── src/
│   │       ├── index.ts          # Main server entry point
│   │       ├── graphql/          # GraphQL schema and resolvers
│   │       │   ├── schema.ts     # GraphQL schema definition
│   │       │   ├── resolvers.ts  # GraphQL resolvers
│   │       │   └── resolvers/    # Individual resolver files
│   │       ├── lib/              # Configuration and setup
│   │       │   ├── better-auth.ts # Better-auth configuration
│   │       │   └── prisma.ts     # Prisma client setup
│   │       ├── middleware/       # Express/Apollo middlewares
│   │       │   ├── better-auth-middleware.ts
│   │       │   └── errorHandler.ts
│   │       ├── routes/           # REST API routes (only for better-auth)
│   │       │   ├── forms.ts
│   │       │   ├── health.ts
│   │       │   ├── responses.ts
│   │       │   └── templates.ts
│   │       ├── services/         # Business logic services
│   │       │   ├── formService.ts
│   │       │   ├── responseService.ts
│   │       │   └── templateService.ts
│   │       ├── scripts/          # Database and migration scripts
│   │       │   ├── migrate-fields-to-schema.ts
│   │       │   ├── seed-templates.ts
│   │       │   └── seed.ts
│   │       └── utils/            # Utility functions
│   ├── form-app/                 # React form builder application
│   │   ├── components.json       # shadcn/ui configuration
│   │   ├── index.html           # HTML template
│   │   ├── package.json         # Form app dependencies
│   │   ├── postcss.config.js    # PostCSS configuration
│   │   ├── tailwind.config.js   # Tailwind CSS configuration
│   │   ├── tsconfig.json        # TypeScript configuration
│   │   ├── tsconfig.node.json   # Node TypeScript configuration
│   │   ├── vite.config.ts       # Vite configuration
│   │   ├── SHADCN_README.md     # shadcn/ui setup documentation
│   │   └── src/
│   │       ├── App.tsx          # Main app component
│   │       ├── index.css        # Global styles
│   │       ├── main.tsx         # App entry point
│   │       ├── styles.css       # Additional styles
│   │       ├── components/      # App-specific components
│   │       │   ├── app-sidebar.tsx
│   │       │   ├── CreateFormPopover.tsx
│   │       │   ├── Dashboard.tsx
│   │       │   ├── Header.tsx
│   │       │   ├── MainLayout.tsx
│   │       │   ├── ProtectedRoute.tsx
│   │       │   └── ShadcnDemo.tsx
│   │       ├── contexts/        # React contexts
│   │       │   └── AuthContext.tsx
│   │       ├── graphql/         # GraphQL queries and mutations
│   │       │   ├── mutations.ts
│   │       │   └── queries.ts
│   │       ├── hooks/           # Custom React hooks
│   │       │   ├── index.ts
│   │       │   └── useAppConfig.ts
│   │       ├── lib/             # Client configuration
│   │       │   └── auth-client.ts
│   │       ├── pages/           # Page components
│   │       │   ├── FormBuilder.tsx
│   │       │   ├── FormsList.tsx
│   │       │   ├── FormViewer.tsx
│   │       │   ├── Responses.tsx
│   │       │   ├── Settings.tsx
│   │       │   ├── SignIn.tsx
│   │       │   └── SignUp.tsx
│   │       └── services/        # Client services
│   │           └── apolloClient.ts
│   └── form-viewer/             # React form viewer application
│       ├── eslint.config.js     # ESLint configuration
│       ├── index.html          # HTML template
│       ├── package.json        # Form viewer dependencies
│       ├── postcss.config.cjs  # PostCSS configuration
│       ├── tailwind.config.js  # Tailwind CSS configuration
│       ├── tsconfig.app.json   # App TypeScript configuration
│       ├── tsconfig.json       # TypeScript configuration
│       ├── tsconfig.node.json  # Node TypeScript configuration
│       ├── vite.config.ts      # Vite configuration
│       ├── README.md           # Form viewer documentation
│       ├── public/
│       │   └── vite.svg        # Public assets
│       └── src/
│           ├── App.css         # App styles
│           ├── App.tsx         # Main app component
│           ├── index.css       # Global styles
│           ├── main.tsx        # App entry point
│           ├── vite-env.d.ts   # Vite type definitions
│           ├── assets/
│           │   └── react.svg   # Static assets
│           ├── components/     # App-specific components
│           │   ├── DemoPage.tsx
│           │   └── Header.tsx
│           └── pages/          # Page components
│               └── Home.tsx
└── packages/
    ├── ui/                     # Shared UI components
    │   ├── package.json       # UI package dependencies
    │   ├── tsconfig.json      # TypeScript configuration
    │   └── src/
    │       ├── index.ts       # Component exports
    │       ├── button.tsx     # shadcn/ui button component
    │       ├── card.tsx       # shadcn/ui card component
    │       ├── input.tsx      # shadcn/ui input component
    │       ├── sidebar.tsx    # shadcn/ui sidebar component
    │       ├── rich-text-editor/ # Lexical rich text editor components
    │       └── (all other shadcn/ui components)
    ├── utils/                  # Shared utilities and constants
    │   ├── package.json       # Utils package dependencies
    │   ├── tsconfig.json      # TypeScript configuration
    │   └── src/
    │       ├── index.ts       # Utility exports (generateId, cn, etc.)
    │       └── constants.ts   # Shared constants and API endpoints
    └── types/                 # Shared TypeScript types
        ├── package.json       # Types package dependencies
        ├── tsconfig.json      # TypeScript configuration
        ├── tsconfig.tsbuildinfo
        └── src/
            └── index.ts       # Type definitions and interfaces
```

## Backend (API Layer)

- **GraphQL Only**: All business logic must be exposed via GraphQL queries and mutations (Apollo Server). Do not create REST endpoints except for `better-auth` APIs.
- **Prisma + MongoDB**: Use Prisma Client for all DB access. Leverage MongoDB features (aggregation, transactions) via Prisma when needed.
- **Authentication/Authorization**: Use `better-auth` (with PrismaAdapter, JWT or cookie-based) for all user/org/auth logic. Refer to `better_auth_llm_instructions.md` for details.
- **Context/Middleware**: Use Apollo Server context for passing user/org info, and middlewares for auth, error handling, etc.
- **Type Safety**: All resolvers, services, and DB logic must be fully typed. Use zod for input/output validation.

## Frontend (React Apps)

- **Apollo Client**: Use Apollo Client for all data fetching/mutations. Leverage cache, optimistic updates, and type-safe hooks.
- **shadcn/ui**: Use only shadcn/ui components, imported from `@dculus/ui`. Do not duplicate UI code in app folders.
- **Shared Components**: Place all reusable UI in `packages/ui/src/`. App-specific UI stays in the app's own `components` folder.
- **Shared Utils**: Use utility functions and constants from `@dculus/utils`.
- **Type Safety**: All React code must be typed. Use zod schemas for form validation and API data.
- **Global Theme**: Follow the global theme and design system as defined in shared components.

## Shared Code

- **Types**: All shared types/interfaces go in `packages/types` and are imported as `@dculus/types`.
- **UI Components**: All reusable UI (Button, Card, Sidebar, etc.) in `@dculus/ui`.
- **Utils/Constants**: Common utility functions and constants in `@dculus/utils`.

## Code Properties & Best Practices

- **Functional, Pure, and Composable**: Write pure functions, avoid side effects, and compose logic.
- **Type-Driven Development**: Start with types/zod schemas, then implement logic.
- **No Duplication**: Never duplicate code or UI. Always import from shared packages.
- **GraphQL-First**: All backend/frontend data flow is via GraphQL. No REST except for `better-auth`.
- **Prisma/MongoDB**: Use Prisma for all DB access. Use MongoDB features via Prisma when needed.
- **Auth**: All user/org/auth logic must use `better-auth` and follow its LLM instructions.
- **Validation**: All input/output must be validated with zod.
- **Error Handling**: Use functional error handling (Result/Either types, never throw unless necessary).
- **Testing**: (When implemented) Use type-safe, functional tests.

## LLM-Specific Guidance

- **Deeply Understand Project Structure**: Always reason about where code should live (app, shared, types, etc.).
- **Follow Monorepo Conventions**: Use pnpm workspaces, import paths, and shared build scripts.
- **Use Modern TypeScript**: Use latest TS features (as supported by project config).
- **No Unnecessary Boilerplate**: Be concise, DRY, and idiomatic.
- **Documentation**: Add JSDoc/type comments for all exported functions/types.

## Development Commands

### App Running Commands
- **Start All Services**: `pnpm dev` - Starts backend, form-app, and form-viewer concurrently
- **Backend Only**: `pnpm backend:dev` - Start backend in development mode
- **Form App Only**: `pnpm form-app:dev` - Start form builder app in development mode
- **Form Viewer Only**: `pnpm form-viewer:dev` - Start form viewer app in development mode

### Database Commands
- **Start Database**: `pnpm docker:up` - Start MongoDB container
- **Stop Database**: `pnpm docker:down` - Stop MongoDB container
- **Generate Prisma Client**: `pnpm db:generate` - Generate Prisma client from schema
- **Push Schema**: `pnpm db:push` - Push schema changes to database
- **Database Studio**: `pnpm db:studio` - Open Prisma Studio (visual DB editor)
- **Seed Database**: `pnpm db:seed` - Seed database with sample data

### Build Commands
- **Build All**: `pnpm build` - Build all packages and apps
- **Build Backend**: `pnpm backend:build` - Build backend for production
- **Build Form App**: `pnpm form-app:build` - Build form app for production
- **Build Form Viewer**: `pnpm form-viewer:build` - Build form viewer for production

### Quick Setup for New Development Environment
1. Install dependencies: `pnpm install`
2. Build shared packages: `pnpm build`
3. Start database: `pnpm docker:up`
4. Generate Prisma client: `pnpm db:generate`
5. Push schema: `pnpm db:push`
6. Start all apps: `pnpm dev`

## Example Imports

```typescript
// Shared UI
import { Button, Card, SidebarProvider } from '@dculus/ui';

// Shared utilities and constants
import { generateId, API_ENDPOINTS, cn } from '@dculus/utils';

// Shared Types
import type { Form, User, Organisation } from '@dculus/types';

// Apollo Client
import { useQuery, useMutation } from '@apollo/client';
```

## Collaborative Form Builder Implementation

### Architecture Overview
The collaborative form builder uses **YJS (Yjs)** for real-time collaborative editing with **y-mongodb-provider** for persistence and **y-websocket** for communication. The implementation follows a standard client-server architecture where multiple users can simultaneously edit form schemas, with changes being broadcasted in real-time and persisted to a MongoDB database.

### Core Technologies
- **YJS**: A CRDT implementation for real-time collaborative editing.
- **y-websocket**: A WebSocket provider for YJS that handles real-time communication.
- **y-mongodb-provider**: A persistence provider for YJS that stores documents in MongoDB.
- **MongoDB**: A NoSQL database used to store the YJS documents.
- **Express.js**: The backend server that hosts the WebSocket server.
- **React Hooks**: The frontend uses a custom hook (`useCollaboration`) to integrate with the YJS backend.

### Backend Implementation

#### Collaboration Server (`/apps/backend/src/services/collaboration.ts`)
The backend consists of a single file that sets up a WebSocket server and handles YJS document synchronization and persistence.

**Key Features:**
- **WebSocket Server**: A WebSocket server is created and attached to the main HTTP server. It listens for connections on the `/collaboration` path.
- **YJS Document Management**: A map of YJS documents is maintained in memory. When a client connects, the corresponding document is either retrieved from the map or created and loaded from MongoDB.
- **Persistence**: The `y-mongodb-provider` is used to persist YJS documents to a separate MongoDB database (`dculus_forms_yjs`).
- **Synchronization**: The server uses `y-protocols` to handle the YJS synchronization protocol, broadcasting updates to all connected clients.

### Frontend Implementation

**Key Features:**
- **`WebsocketProvider`**: The hook uses the `WebsocketProvider` from `y-websocket` to handle the WebSocket connection and synchronization.
- **State Management**: The hook manages the connection status and the list of pages, which are synchronized with the YJS document.
- **Real-time Updates**: The UI is automatically updated when the YJS document changes.

### File Organization

#### Backend Files
```
/apps/backend/src/
├── services/
│   └── collaboration.ts      # The main collaboration server
├── index.ts                  # Initializes the collaboration server
└── package.json              # Includes y-websocket, y-mongodb-provider, etc.
```

#### Frontend Files
```
/apps/form-app/src/
├── pages/
│   └── CollaborativeFormBuilder.tsx # The collaborative editing UI
└── package.json              # Includes y-websocket
```

## Reference

- See `README.md` for architecture, scripts, and conventions.
- See `better_auth_llm_instructions.md` for all authentication/authorization logic.
