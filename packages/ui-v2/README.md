# @dculus/ui-v2

Shared UI component library for Dculus Forms V2 applications. Built with React 18, TypeScript, Radix UI primitives, and Tailwind CSS.

## Overview

`@dculus/ui-v2` is a centralized UI component package that provides all the UI components, styling, and utilities needed for V2 applications in the Dculus Forms monorepo. It includes:

- **Pre-built UI components** based on Shadcn UI design patterns
- **Radix UI primitives** for accessibility and functionality
- **Tailwind CSS configuration** with theme tokens and CSS variables
- **Dark mode support** using class-based strategy
- **Shared utilities** (cn helper, hooks)
- **Shadcn CLI integration** for adding new components

## Features

- **Self-contained**: No dependencies on other @dculus packages
- **Type-safe**: Full TypeScript support with declaration files
- **Accessible**: Built on Radix UI primitives following WAI-ARIA standards
- **Themeable**: CSS variables for easy customization
- **Tree-shakeable**: ESM module format for optimal bundle sizes
- **CLI-ready**: Configured for Shadcn CLI to add new components

## Installation

In your pnpm workspace application:

```json
{
  "dependencies": {
    "@dculus/ui-v2": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

Then install:

```bash
pnpm install
```

## Usage

### Importing Components

Import components, utilities, and hooks from the main package entry:

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  SidebarProvider,
  Sidebar,
  cn,
  useIsMobile,
} from '@dculus/ui-v2'

export function MyComponent() {
  const isMobile = useIsMobile()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  )
}
```

### Importing Styles

Import the theme CSS in your application's main CSS file:

```css
/* src/index.css */
@import '@dculus/ui-v2/styles/theme.css';
```

This includes:
- Tailwind base, components, and utilities layers
- CSS variables for light and dark themes
- Base styles for body, headings, etc.

### Tailwind Configuration

Extend the shared Tailwind configuration in your app:

```javascript
// tailwind.config.js
import uiV2Config from '@dculus/ui-v2/tailwind.config.js'

export default {
  ...uiV2Config,
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Include ui-v2 package components for Tailwind scanning
    "../../packages/ui-v2/src/**/*.{js,ts,jsx,tsx}",
  ],
}
```

## Available Components

### Layout Components
- **Sidebar**: Full-featured collapsible sidebar with mobile support
  - `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`
  - `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`
  - `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`
  - `SidebarProvider`, `useSidebar` hook
- **Separator**: Visual or semantic dividers

### Form Components
- **Button**: Primary interaction component with variants
- **Input**: Text input field
- **Label**: Form field labels
- **Textarea**: Multi-line text input

### Display Components
- **Avatar**: User profile images with fallback
- **Badge**: Status indicators and labels
- **Card**: Content containers with header, title, description, content, and footer
- **DropdownMenu**: Contextual menus with keyboard navigation
- **Tooltip**: Hover information popups

### Navigation Components
- **Breadcrumb**: Page hierarchy navigation
  - `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`
  - `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`

### Feedback Components
- **Collapsible**: Expandable content sections
- **Dialog**: Modal windows
- **Skeleton**: Loading placeholders

## Theming

The package uses CSS variables for theming, making it easy to customize colors and appearance.

### Theme Variables

All theme variables are defined in `src/styles/theme.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... and many more */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark mode overrides */
}
```

### Dark Mode

Enable dark mode by adding the `dark` class to the document root:

```tsx
// Toggle dark mode
document.documentElement.classList.toggle('dark')
```

Or use a theme provider:

```tsx
import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  return <div>{children}</div>
}
```

### Customizing Colors

Override CSS variables in your application's CSS:

```css
:root {
  --primary: 210 100% 50%; /* Custom blue primary color */
  --primary-foreground: 0 0% 100%;
}
```

## Utilities

### cn() Helper

Utility function for merging Tailwind CSS classes with conditional logic:

```tsx
import { cn } from '@dculus/ui-v2'

export function MyComponent({ className, isActive }: Props) {
  return (
    <div
      className={cn(
        "base-classes",
        isActive && "active-classes",
        className
      )}
    >
      Content
    </div>
  )
}
```

### useIsMobile() Hook

Detect mobile viewport sizes:

```tsx
import { useIsMobile } from '@dculus/ui-v2'

export function ResponsiveComponent() {
  const isMobile = useIsMobile()

  return (
    <div>
      {isMobile ? <MobileView /> : <DesktopView />}
    </div>
  )
}
```

## Adding New Components

The package is configured for the Shadcn CLI, making it easy to add new components:

```bash
# Navigate to the ui-v2 package
cd packages/ui-v2

# Add a new component
npx shadcn@latest add select

# The component will be added to:
# - src/components/select.tsx (component file)
# - src/index.ts (export added automatically if using the CLI correctly)
```

After adding a new component:

1. **Build the package**: `pnpm --filter @dculus/ui-v2 build`
2. **Export it**: Add to `src/index.ts` if not already exported
3. **Use in apps**: Import from `@dculus/ui-v2` in your applications

## Development

### Package Scripts

```bash
# Build the package (TypeScript compilation + path alias resolution)
pnpm --filter @dculus/ui-v2 build

# Type check without emitting files
pnpm --filter @dculus/ui-v2 type-check

# Clean build artifacts
pnpm --filter @dculus/ui-v2 clean

# Clean and rebuild
pnpm --filter @dculus/ui-v2 clean && pnpm --filter @dculus/ui-v2 build
```

### Making Changes

When modifying components or adding new ones:

1. **Edit source files** in `packages/ui-v2/src/`
2. **Rebuild the package**: `pnpm --filter @dculus/ui-v2 build`
3. **Test in consuming apps**: Changes will be reflected immediately due to workspace linking

### Build Process

The package uses a two-step build process:

1. **TypeScript compilation** (`tsc`): Compiles `.ts`/`.tsx` files to `.js` with type definitions
2. **Path alias resolution** (`tsc-alias`): Resolves `@/*` aliases to relative paths in compiled output

This ensures the compiled package has proper relative imports that work in consuming applications.

## Architecture

### Directory Structure

```
packages/ui-v2/
├── src/
│   ├── components/       # UI components
│   │   ├── avatar.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── sidebar.tsx
│   │   └── ...
│   ├── hooks/            # React hooks
│   │   └── use-mobile.tsx
│   ├── lib/              # Utilities
│   │   └── utils.ts
│   ├── styles/           # CSS files
│   │   └── theme.css
│   └── index.ts          # Main export file
├── dist/                 # Compiled output (generated)
├── components.json       # Shadcn CLI configuration
├── package.json          # Package metadata
├── tailwind.config.js    # Tailwind preset
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

### Technology Stack

- **React**: ^18.3.1 (peer dependency)
- **TypeScript**: ^5.9.3
- **Radix UI**: 1.x (avatar, collapsible, dialog, dropdown-menu, separator, slot, tooltip)
- **Lucide React**: ^0.548.0 (icons)
- **Tailwind CSS**: ^3.4.0
- **Class Variance Authority**: ^0.7.1 (component variants)
- **clsx**: ^2.1.1 + **tailwind-merge**: ^3.3.1 (className utilities)

### Path Aliases

The package uses TypeScript path aliases for cleaner imports:

```typescript
// Instead of: import { cn } from '../../lib/utils'
import { cn } from '@/lib/utils'
```

These are resolved during build time by `tsc-alias`, so the compiled output uses proper relative paths.

## Integration Examples

### Basic Application Setup

```tsx
// App.tsx
import { SidebarProvider, Sidebar, SidebarInset } from '@dculus/ui-v2'

export function App() {
  return (
    <SidebarProvider defaultOpen={false}>
      <Sidebar>
        {/* Sidebar content */}
      </Sidebar>
      <SidebarInset>
        <main>
          {/* Main content */}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

### Form Example

```tsx
import { Button, Input, Label, Card, CardHeader, CardTitle, CardContent } from '@dculus/ui-v2'

export function LoginForm() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" />
          </div>
          <Button type="submit" className="w-full">
            Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

## Best Practices

### Component Usage

- **Always use the cn() utility** when combining className props
- **Import only what you need** for better tree-shaking
- **Use semantic HTML** - components render proper HTML elements
- **Follow Radix UI patterns** for accessibility

### Styling

- **Use Tailwind classes** for component-specific styling
- **Use CSS variables** for theme-related values
- **Avoid inline styles** unless absolutely necessary
- **Respect the design system** - use predefined colors, spacing, etc.

### Performance

- **Import from package root**: `import { Button } from '@dculus/ui-v2'`
- **Don't import from dist**: Avoid `import { Button } from '@dculus/ui-v2/dist/...'`
- **Rebuild after changes**: Always rebuild the package after modifications

## Troubleshooting

### Components not updating

**Issue**: Changes to ui-v2 components don't appear in consuming apps

**Solution**:
```bash
# Rebuild the package
pnpm --filter @dculus/ui-v2 build

# Restart the consuming app's dev server
pnpm --filter form-app-v2 dev
```

### Build errors with path aliases

**Issue**: Build fails with "Cannot find module '@/...'"

**Solution**: Ensure `tsc-alias` is installed and included in the build script:
```json
{
  "scripts": {
    "build": "tsc && tsc-alias"
  },
  "devDependencies": {
    "tsc-alias": "1.8.16"
  }
}
```

### Styles not applying

**Issue**: Components render but have no styles

**Solution**: Make sure you're importing the theme CSS:
```css
/* In your app's index.css or main.css */
@import '@dculus/ui-v2/styles/theme.css';
```

And include the package in your Tailwind content:
```javascript
// tailwind.config.js
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-v2/src/**/*.{js,ts,jsx,tsx}", // Include this
  ],
}
```

### TypeScript errors

**Issue**: Type errors when using components

**Solution**: Ensure peer dependencies match:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

Run type check in the package:
```bash
pnpm --filter @dculus/ui-v2 type-check
```

## Contributing

When adding new components to this package:

1. **Use Shadcn CLI** when possible: `npx shadcn@latest add <component>`
2. **Follow existing patterns** for component structure
3. **Export from index.ts** to make components available
4. **Update this README** with new component documentation
5. **Build and test** before committing changes
6. **Maintain TypeScript types** for all public APIs

## Version History

### 0.1.0 (Initial Release)

- Initial package setup with core Shadcn UI components
- Sidebar-07 block components
- Tailwind CSS preset with theme variables
- Dark mode support
- Shadcn CLI integration
- TypeScript path alias resolution with tsc-alias

## License

Internal package for Dculus Forms - not published to npm registry.

## Related Packages

- **@dculus/ui**: Original UI package for V1 applications
- **@dculus/types**: Shared TypeScript types
- **@dculus/utils**: Shared utilities and constants

## Support

For issues or questions about this package:

1. Check the troubleshooting section above
2. Review the Shadcn UI documentation: https://ui.shadcn.com
3. Review the Radix UI documentation: https://www.radix-ui.com
4. Check the form-app-v2 README for integration examples
