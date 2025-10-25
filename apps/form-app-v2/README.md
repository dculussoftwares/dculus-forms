# Form App V2

A modern React application built with Vite, TypeScript, and Shadcn UI components featuring a professional sidebar layout.

## Overview

Form App V2 is a React application that uses Shadcn UI's sidebar-07 block pattern for navigation. This is the first V2 application in the monorepo and uses the **shared `@dculus/ui-v2` component library** for all UI components, providing a consistent design system across V2 applications.

## Technology Stack

- **Framework**: React 18.3.1 (not using React 19)
- **Build Tool**: Vite 7.1.12
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Shadcn UI from `@dculus/ui-v2` shared package
- **Icons**: Lucide React 0.548.0
- **Component Library**: Radix UI primitives (via @dculus/ui-v2)

## Project Structure

```
apps/form-app-v2/
├── src/
│   ├── components/
│   │   ├── app-sidebar.tsx        # Main sidebar component
│   │   ├── nav-main.tsx           # Main navigation with collapsible sections
│   │   ├── nav-projects.tsx       # Projects navigation list
│   │   ├── nav-user.tsx           # User profile in sidebar footer
│   │   ├── team-switcher.tsx      # Organization/team switcher dropdown
│   │   └── login-form.tsx         # Example login form component
│   ├── App.tsx                    # Main application with sidebar layout
│   ├── main.tsx                   # Application entry point
│   └── index.css                  # Imports theme CSS from @dculus/ui-v2
├── public/                        # Static assets
├── tailwind.config.js             # Extends @dculus/ui-v2 Tailwind preset
├── tsconfig.json                  # TypeScript root config
├── tsconfig.app.json              # TypeScript app config (with path aliases)
├── tsconfig.node.json             # TypeScript node config
├── vite.config.ts                 # Vite configuration (port 3001)
├── package.json                   # Project dependencies
└── README.md                      # This file
```

**Note**: UI components (Button, Card, Sidebar, etc.) are imported from `@dculus/ui-v2` package, not stored locally.

## Dependencies

### Direct Dependencies
- `@dculus/ui-v2`: Shared UI component library with Shadcn components
- `lucide-react`: Icon library
- `react` & `react-dom`: React framework

### Shared Package Contents
The `@dculus/ui-v2` package provides:
- All Shadcn UI components (Avatar, Breadcrumb, Button, Card, Dialog, Dropdown, Input, Separator, Sidebar, etc.)
- Radix UI primitives for accessibility
- Utility functions (cn helper for className merging)
- React hooks (useIsMobile for responsive design)
- Tailwind CSS preset with theme tokens
- CSS theme file with light/dark mode variables

## Port Configuration

- **Development Port**: 3001 (configured in `vite.config.ts`)
- **Access URL**: http://localhost:3001

This avoids conflicts with other apps:
- Form App: 3000
- Admin App: 3002
- Form Viewer: 5173
- Backend: 4000

## Development Setup

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

From the **monorepo root**:
```bash
pnpm install
```

From **this directory** (`apps/form-app-v2`):
```bash
pnpm install
```

### Available Scripts

**From monorepo root:**
```bash
# Start all apps including form-app-v2
pnpm dev

# Start only form-app-v2
pnpm form-app-v2:dev

# Build form-app-v2
pnpm form-app-v2:build

# Preview production build
pnpm form-app-v2:preview
```

**From this directory:**
```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run linting
pnpm lint
```

## Using UI Components

### Importing Components

All UI components are imported from the `@dculus/ui-v2` shared package:

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Sidebar,
  SidebarProvider,
  SidebarInset,
  cn,
  useIsMobile
} from '@dculus/ui-v2'

// Application-specific components (local)
import { AppSidebar } from '@/components/app-sidebar'
import { TeamSwitcher } from '@/components/team-switcher'
```

### Adding New Shadcn Components

**IMPORTANT**: Add new UI components to the `@dculus/ui-v2` package, not to this app:

```bash
# Navigate to the ui-v2 package from monorepo root
cd packages/ui-v2

# Add a new component
npx shadcn@latest add select
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add table

# Rebuild the package
cd ../..
pnpm --filter @dculus/ui-v2 build

# The component is now available in form-app-v2:
import { Select } from '@dculus/ui-v2'
```

**Why add to the package?**
- Ensures consistency across all V2 applications
- Single source of truth for UI components
- Automatic availability in future V2 apps
- Centralized theme and styling

**Complete documentation**: See `packages/ui-v2/README.md` for:
- Full list of available components
- Adding new components
- Theming and customization
- Troubleshooting

## Sidebar Architecture (sidebar-07)

### Main Components

1. **AppSidebar** (`src/components/app-sidebar.tsx`)
   - Main sidebar container with collapsible icon mode
   - Three sections: Header, Content, Footer
   - Fully customizable navigation structure

2. **TeamSwitcher** (`src/components/team-switcher.tsx`)
   - Dropdown for switching between organizations/teams
   - Located in sidebar header
   - Shows team logo, name, and plan

3. **NavMain** (`src/components/nav-main.tsx`)
   - Main navigation with collapsible sections
   - Supports icons from lucide-react
   - Active state highlighting

4. **NavProjects** (`src/components/nav-projects.tsx`)
   - Project list navigation
   - Simple list with icons

5. **NavUser** (`src/components/nav-user.tsx`)
   - User profile section in sidebar footer
   - Avatar, name, email display
   - Dropdown menu for user actions

### Layout Structure

```tsx
<SidebarProvider>
  <AppSidebar />
  <SidebarInset>
    <header>
      <SidebarTrigger />  {/* Toggle button */}
      <Breadcrumb />      {/* Page breadcrumb */}
    </header>
    <main>
      {/* Page content */}
    </main>
  </SidebarInset>
</SidebarProvider>
```

## Customizing the Sidebar

### Modify Navigation Items

Edit `src/components/app-sidebar.tsx` and update the `data` object:

```typescript
const data = {
  user: {
    name: "Your Name",
    email: "your@email.com",
    avatar: "/path/to/avatar.jpg",
  },
  teams: [
    {
      name: "Team Name",
      logo: IconComponent,
      plan: "Plan Type",
    },
  ],
  navMain: [
    {
      title: "Section Title",
      url: "#",
      icon: IconComponent,
      isActive: true,
      items: [
        { title: "Sub Item", url: "#" },
      ],
    },
  ],
  projects: [
    {
      name: "Project Name",
      url: "#",
      icon: IconComponent,
    },
  ],
}
```

### Available Icons

All icons from `lucide-react` are available. Import them:
```typescript
import {
  Home,
  Settings,
  User,
  FileText,
  // ... any lucide icon
} from "lucide-react"
```

Browse icons at: https://lucide.dev/icons

## Theme & Styling

### CSS Variables

Theme colors are imported from `@dculus/ui-v2/styles/theme.css`:
- Supports light and dark mode
- Color scheme: Slate
- CSS variables for all theme tokens
- Fully customizable via HSL values

The `src/index.css` file imports the shared theme:
```css
@import '@dculus/ui-v2/styles/theme.css';
```

### Dark Mode

Dark mode is configured in the shared theme. To add dark mode toggle:

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')

// Check current theme
const isDark = document.documentElement.classList.contains('dark')
```

For a complete theme toggle component, see the `@dculus/ui-v2` package documentation.

### Customizing Colors

**Option 1: Override CSS variables** in your app's CSS:
```css
/* Add to src/index.css after the import */
@import '@dculus/ui-v2/styles/theme.css';

:root {
  --primary: 210 100% 50%; /* Custom blue primary */
  --primary-foreground: 0 0% 100%;
}
```

**Option 2: Extend Tailwind config**:
```javascript
// tailwind.config.js
import uiV2Config from '@dculus/ui-v2/tailwind.config.js'

export default {
  ...uiV2Config,
  theme: {
    extend: {
      colors: {
        // Add custom colors
      }
    }
  }
}
```

## Import Patterns

### UI Components from Shared Package

All UI components, utilities, and hooks come from `@dculus/ui-v2`:

```typescript
import {
  Button,
  Card,
  Input,
  Label,
  Sidebar,
  SidebarProvider,
  cn,
  useIsMobile
} from '@dculus/ui-v2'
```

### Application-Specific Components

Use path aliases for local components:

```typescript
import { AppSidebar } from '@/components/app-sidebar'
import { TeamSwitcher } from '@/components/team-switcher'
import { NavMain } from '@/components/nav-main'
```

**Path alias mapping**:
- `@/*` → `./src/*`
- `@/components/*` → `./src/components/*` (application-specific only)

## Architecture Comparison

| Feature | form-app-v2 (V2) | form-app / admin-app (V1) |
|---------|------------------|---------------------------|
| **UI Components** | `@dculus/ui-v2` package | `@dculus/ui` package |
| **Utilities** | `@dculus/ui-v2` (cn, hooks) | `@dculus/utils` package |
| **Types** | Local or `@dculus/types` | `@dculus/types` package |
| **Port** | 3001 | 3000 / 3002 |
| **React Version** | 18.3.1 | 18.3.1 |
| **Design Pattern** | Shadcn sidebar-07 | Custom layouts |
| **Theme System** | CSS variables from ui-v2 | Local theme files |
| **Tailwind Config** | Extends ui-v2 preset | Custom configuration |

## Adding Features

### 1. Adding a New Page

1. Create component in `src/pages/` (create folder if needed)
2. Import and use in `App.tsx` or set up routing

### 2. Adding Routing

Install React Router:
```bash
pnpm add react-router-dom
pnpm add -D @types/react-router-dom
```

### 3. Adding Forms

Install form libraries:
```bash
npx shadcn@latest add form
pnpm add react-hook-form zod @hookform/resolvers
```

### 4. Adding State Management

Install your preferred state library:
```bash
# Zustand
pnpm add zustand

# Redux Toolkit
pnpm add @reduxjs/toolkit react-redux

# Jotai
pnpm add jotai
```

## Responsive Design

The sidebar is fully responsive:
- **Desktop**: Collapsible sidebar with icon mode
- **Mobile**: Sidebar converts to sheet/drawer overlay
- **Tablet**: Adaptive behavior

The `use-mobile` hook detects screen size:
```typescript
import { useMobile } from "@/hooks/use-mobile"

const isMobile = useMobile()
```

## ESLint Configuration

The project uses ESLint 9 with flat config (`eslint.config.js`):
- React hooks rules
- React refresh rules
- TypeScript ESLint
- Modern flat config format

## TypeScript Configuration

Three TypeScript configs:
- `tsconfig.json`: Root configuration with path aliases
- `tsconfig.app.json`: App-specific settings
- `tsconfig.node.json`: Node/Vite config settings

Strict mode enabled for type safety.

## Production Build

To build for production:
```bash
pnpm build
```

Output will be in `dist/` folder.

To preview production build:
```bash
pnpm preview
```

## Common Tasks

### Change Sidebar Collapsible Behavior

Edit `src/components/app-sidebar.tsx`:
```tsx
<Sidebar collapsible="icon" {...props}>
// Options: "icon", "offcanvas", "none"
```

### Add New Navigation Section

Edit the `data.navMain` array in `app-sidebar.tsx`:
```typescript
navMain: [
  {
    title: "New Section",
    url: "/new-section",
    icon: NewIcon,
    isActive: false,
    items: [
      { title: "Sub Page", url: "/new-section/sub" },
    ],
  },
  // ... existing sections
]
```

### Modify Breadcrumb

Edit `src/App.tsx` in the header section:
```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/your-path">
        Your Section
      </BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Current Page</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

## Troubleshooting

### Port Already in Use

If port 3001 is already in use, change it in `vite.config.ts`:
```typescript
server: {
  port: 3005, // or any available port
}
```

### Tailwind Styles Not Working

1. Check that `src/index.css` is imported in `src/main.tsx`
2. Verify Tailwind is watching the correct paths in `tailwind.config.js`
3. Restart the dev server

### Import Aliases Not Working

1. Check `tsconfig.json` and `tsconfig.app.json` have baseUrl and paths configured
2. Check `vite.config.ts` has alias resolution configured
3. Restart TypeScript server in your editor

### Component Not Found

Make sure you're importing from the correct path:
```typescript
// ✅ Correct
import { Button } from "@/components/ui/button"

// ❌ Wrong (this is for other apps)
import { Button } from "@dculus/ui"
```

## Resources

- **Shadcn UI**: https://ui.shadcn.com
- **Shadcn Blocks**: https://ui.shadcn.com/blocks
- **Lucide Icons**: https://lucide.dev/icons
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/primitives
- **Vite**: https://vite.dev
- **React**: https://react.dev

## Next Steps

1. **Add Authentication**: Integrate with backend auth system (better-auth)
2. **Add Routing**: Set up React Router for multi-page navigation
3. **Connect to GraphQL**: Add Apollo Client for backend communication
4. **Build Forms**: Create form pages using Shadcn form components
5. **Add Dark Mode Toggle**: Implement theme switching
6. **Customize Branding**: Update logos, colors, and styling
7. **Add More Pages**: Create dashboard, settings, profile pages

## Contributing

When adding new features:
1. Follow the existing component structure
2. Use TypeScript strict mode
3. Leverage Shadcn UI components when possible
4. Add JSDoc comments for complex functions
5. Test responsive behavior
6. Update this README if adding significant features

---

**Created**: October 25, 2025
**Last Updated**: October 25, 2025
**Maintainer**: Development Team
