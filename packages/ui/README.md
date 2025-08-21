# @dculus/ui

UI components and layouts for Dculus Forms, built with React, TypeScript, and Tailwind CSS.

## Overview

This package provides a comprehensive set of UI components and form layouts used across the Dculus Forms application. It includes:

- **Form Renderers**: Components for rendering forms, pages, and individual fields
- **Layout Components**: 9 different form layout designs (L1-L9)
- **Rich Text Editor**: Lexical-based rich text editing components
- **UI Components**: Radix UI-based components following shadcn/ui patterns

## Storybook Documentation

This package includes comprehensive Storybook documentation showcasing all components, layouts, and their various configurations.

### Running Storybook

To start the Storybook development server:

```bash
# From the UI package directory
cd packages/ui
pnpm storybook

# Or from the project root
pnpm ui:storybook
```

This will start Storybook at `http://localhost:6006`

### Building Storybook

To build a static version of Storybook:

```bash
# From the UI package directory
cd packages/ui
pnpm build-storybook

# Or from the project root
pnpm ui:build-storybook
```

The built Storybook will be available in the `storybook-static` directory.

## Available Components

### Form Renderers

#### LayoutRenderer
The main component for rendering different form layouts. Supports all 9 layout types with customizable themes and configurations.

**Usage:**
```tsx
import { LayoutRenderer } from '@dculus/ui';

<LayoutRenderer
  layoutCode="L1"
  pages={formPages}
  layout={layoutConfig}
  mode={RendererMode.PREVIEW}
/>
```

#### PageRenderer
Handles rendering of form pages in both single page and multipage modes with navigation and validation.

**Usage:**
```tsx
import { PageRenderer } from '@dculus/ui';

<PageRenderer
  pages={formPages}
  pageMode="multipage"
  showPageNavigation={true}
  mode={RendererMode.PREVIEW}
/>
```

### Layout Components

The package includes 9 different layout components, each optimized for different use cases:

- **L1ClassicLayout**: Traditional, clean form design
- **L2ModernLayout**: Contemporary design with modern typography
- **L3CardLayout**: Card-based organization for complex forms
- **L4MinimalLayout**: Clean, minimal design with reduced visual clutter
- **L5SplitLayout**: Two-column layout for space optimization
- **L6WizardLayout**: Step-by-step wizard with progress tracking
- **L7SingleLayout**: Traditional single-column layout
- **L8ImageLayout**: Layout with background image support
- **L9PagesLayout**: Advanced multi-page layout with navigation

### Rich Text Editor Components

- **LexicalRichTextEditor**: Full-featured rich text editor
- **SimpleRichTextEditor**: Simplified rich text editing
- **ToolbarPlugin**: Customizable toolbar for rich text editing

### UI Components

All standard UI components following shadcn/ui patterns:
- Button, Card, Input, Select, Textarea
- Dropdown Menu, Popover, Tabs
- Alert Dialog, Avatar, Breadcrumb
- Loading Spinner, Separator, Sidebar
- Typography components

## Storybook Stories

The Storybook documentation includes comprehensive stories for:

### LayoutRenderer Stories
- All 9 layout types (L1-L9)
- Different rendering modes (PREVIEW, BUILDER, SUBMISSION)
- Theme variations (light, dark, auto)
- Custom styling examples
- Interactive controls for all props

### PageRenderer Stories
- Single page vs multipage modes
- All field types with validation
- Navigation controls and behaviors
- Custom layout styles
- Controlled form examples

### Individual Layout Stories
- Dedicated stories for each layout component
- Layout-specific features and customizations
- Responsive behavior demonstrations
- Theme and spacing variations

## Development

### Building the Package

```bash
# From the UI package directory
pnpm build

# Or from the project root
pnpm ui:build
```

### Type Checking

```bash
# From the UI package directory
pnpm type-check

# Or from the project root
pnpm ui:type-check
```

## Dependencies

### Core Dependencies
- React 18.3+
- @dculus/types (workspace package)
- @dculus/utils (workspace package)
- Lexical (rich text editing)
- Radix UI components
- Lucide React (icons)

### Development Dependencies
- TypeScript 5.6+
- Storybook 8.4+
- Storybook React Vite adapter

## Architecture

This package follows these key principles:

- **Centralized UI**: All UI components are centralized in this package
- **No Duplication**: Components are imported by applications, not duplicated
- **TypeScript First**: Full type safety throughout
- **Storybook Documentation**: Comprehensive visual documentation
- **Modular Design**: Components can be used independently or together

## Usage in Applications

```tsx
// Import UI components
import { Button, Card, LayoutRenderer } from '@dculus/ui';

// Import utilities and constants
import { generateId, RendererMode } from '@dculus/utils';

// Import types
import type { FormPage, FormLayout } from '@dculus/types';
```

## Contributing

When adding new components:

1. Add the component to the appropriate directory in `src/`
2. Export it from `src/index.ts`
3. Create comprehensive Storybook stories
4. Follow existing patterns and conventions
5. Ensure full TypeScript type coverage

## License

This package is part of the Dculus Forms monorepo and follows the same licensing terms.