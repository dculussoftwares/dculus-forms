# Form App V2

A modern React application built with Vite, TypeScript, and Shadcn UI components featuring a professional sidebar layout.

## Overview

Form App V2 is a standalone React application that uses Shadcn UI's sidebar-07 block pattern for navigation. Unlike the original form-app, this version **does not use shared packages** (`@dculus/ui`, `@dculus/utils`, `@dculus/types`) and implements its own local UI components.

## Technology Stack

- **Framework**: React 18.3.1 (not using React 19)
- **Build Tool**: Vite 7.1.12
- **Language**: TypeScript 5.9.3
- **Styling**: Tailwind CSS 3.4.17
- **UI Components**: Shadcn UI (local components, not from @dculus/ui)
- **Icons**: Lucide React 0.548.0
- **Component Library**: Radix UI primitives

## Project Structure

```
apps/form-app-v2/
├── src/
│   ├── components/
│   │   ├── ui/                    # Shadcn UI components (locally installed)
│   │   │   ├── avatar.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── tooltip.tsx
│   │   ├── app-sidebar.tsx        # Main sidebar component
│   │   ├── nav-main.tsx           # Main navigation with collapsible sections
│   │   ├── nav-projects.tsx       # Projects navigation list
│   │   ├── nav-user.tsx           # User profile in sidebar footer
│   │   └── team-switcher.tsx      # Organization/team switcher dropdown
│   ├── hooks/
│   │   └── use-mobile.tsx         # Mobile detection hook
│   ├── lib/
│   │   └── utils.ts               # Utility functions (cn helper)
│   ├── App.tsx                    # Main application with sidebar layout
│   ├── main.tsx                   # Application entry point
│   └── index.css                  # Global styles + Tailwind + CSS variables
├── public/                        # Static assets
├── components.json                # Shadcn UI configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── tsconfig.json                  # TypeScript root config
├── tsconfig.app.json              # TypeScript app config (with path aliases)
├── tsconfig.node.json             # TypeScript node config
├── vite.config.ts                 # Vite configuration (port 3001)
├── package.json                   # Project dependencies
└── README.md                      # This file
```

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

## Shadcn UI Configuration

### Configuration File
`components.json` contains the Shadcn UI setup:

```json
{
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Adding New Components

To add more Shadcn UI components:
```bash
npx shadcn@latest add <component-name>
```

Examples:
```bash
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add form
npx shadcn@latest add table
```

To add blocks (pre-built layouts):
```bash
npx shadcn@latest add sidebar-01  # Different sidebar style
npx shadcn@latest add login-01    # Login form
npx shadcn@latest add dashboard-01 # Dashboard layout
```

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

Theme colors are defined in `src/index.css` using CSS variables:
- Supports light and dark mode
- Color scheme: Slate
- Fully customizable via HSL values

### Dark Mode

Dark mode is configured but not yet toggled. To add dark mode toggle:

1. Install theme toggle component:
```bash
npx shadcn@latest add theme-toggle
```

2. Add to your layout or sidebar

### Customizing Colors

Edit `src/index.css` to modify color variables:
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... more variables */
}
```

Or use Tailwind's configuration in `tailwind.config.js`.

## Path Aliases

TypeScript path aliases are configured in `tsconfig.json` and `tsconfig.app.json`:

```typescript
// Import examples
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AppSidebar } from "@/components/app-sidebar"
```

Alias mapping:
- `@/*` → `./src/*`
- `@/components/*` → `./src/components/*`
- `@/lib/*` → `./src/lib/*`
- `@/hooks/*` → `./src/hooks/*`

## Key Differences from Other Apps

| Feature | form-app-v2 | form-app / admin-app |
|---------|------------|---------------------|
| **UI Components** | Local Shadcn UI | `@dculus/ui` package |
| **Utilities** | Local `@/lib/utils` | `@dculus/utils` package |
| **Types** | Local types | `@dculus/types` package |
| **Port** | 3001 | 3000 / 3002 |
| **React Version** | 18.3.1 | 18.3.1 |
| **Layout** | Sidebar-07 block | Custom layouts |
| **Dependencies** | Self-contained | Shared packages |

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
