---
applyTo: "packages/**"
---

# Shared Packages Development Instructions

## Package Overview

| Package | Import As | Purpose |
|---------|-----------|---------|
| `packages/ui/` | `@dculus/ui` | ALL shared UI components, layouts, renderers, stores |
| `packages/types/` | `@dculus/types` | TypeScript types, FormField class hierarchy, validation |
| `packages/utils/` | `@dculus/utils` | Utilities, constants, collaboration helpers |

## @dculus/ui — UI Components

### Components (55+ files in `src/`)

**Core shadcn/ui**: `Button`, `Card`, `Input`, `Label`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Dialog`, `AlertDialog`, `Drawer`, `Popover`, `HoverCard`, `Tabs`, `Accordion`, `Badge`, `Avatar`, `Separator`, `Switch`, `Toggle`, `ToggleGroup`, `Slider`, `Progress`, `Skeleton`, `ScrollArea`

**Navigation**: `Sidebar`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `Breadcrumb`, `DropdownMenu`, `ContextMenu`, `Menubar`, `Command`, `Pagination`

**Data Display**: `DataTable`, `ServerDataTable`, `DataTableColumnHeader`, `DataTableToolbar`, `Carousel`, `Calendar`, `DatePicker`, `Chip`, `Typography`

**Forms**: `Form` (react-hook-form integration), `OtpInput`

**Custom**: `LoadingSpinner`, `PageWrapper`, `FieldPreview`, `FieldDragPreview`, `Sonner` (toasts)

### Subdirectories

```
packages/ui/src/
├── layouts/        # Form layout components (L1–L9)
├── renderers/      # LayoutRenderer, PageRenderer, FormFieldRenderer
├── rich-text-editor/ # Lexical-based rich text editor
├── stores/         # Zustand stores (formResponseStore)
├── hooks/          # Shared hooks
├── components/     # Composite components
├── styles/         # Shared styles
├── tokens/         # Design tokens
├── types/          # UI-specific types
├── utils/          # UI utilities
├── constants/      # UI constants
└── stories/        # Storybook stories
```

### Adding a UI Component

1. Create `packages/ui/src/my-component.tsx`
2. Export from `packages/ui/src/index.ts`:
```typescript
export { MyComponent } from './my-component';
```
3. Use in apps:
```typescript
import { MyComponent } from '@dculus/ui';
```

### Layout Components (L1–L9)

Layout components render form pages with different visual designs:
```typescript
interface LayoutProps {
  page: FormPage;
  currentPageIndex: number;
  totalPages: number;
  onNavigate: (direction: 'next' | 'prev') => void;
  layout: FormLayout;
  mode?: RendererMode;
  isEditMode?: boolean;
  onEditModeChange?: (editing: boolean) => void;
}
```

### Zustand Store

```typescript
// Form response store for tracking user inputs
import { useFormResponseStore, useFormResponseUtils } from '@dculus/ui';

const { setFieldValue, getFieldValue, getPageResponses, clearResponses } = useFormResponseStore();
const { getFormattedResponses } = useFormResponseUtils();
```

---

## @dculus/types — Type Definitions

### Key Files
- `src/index.ts` — Main types and FormField class hierarchy (26KB)
- `src/validation.ts` — Zod validation schemas (16KB)
- `src/graphql.ts` — GraphQL type helpers
- `src/plugins.ts` — Plugin type definitions
- `src/formHookUtils.ts` — Form hook utilities

### FormField Class Hierarchy

```typescript
// Base class
abstract class FormField { id: string; type: string; }

// User-input fields
abstract class FillableFormField extends FormField {
  label: string;
  defaultValue: any;
  prefix: string;
  hint: string;
  validation: { required: boolean; minLength?: number; maxLength?: number };
}

// Concrete implementations
class TextInputField extends FillableFormField { type = 'text'; }
class TextAreaField extends FillableFormField { type = 'textarea'; }
class EmailField extends FillableFormField { type = 'email'; }
class NumberField extends FillableFormField { min?: number; max?: number; }
class DateField extends FillableFormField { minDate?: string; maxDate?: string; }
class SelectField extends FillableFormField { options: string[]; multiple: boolean; }
class RadioField extends FillableFormField { options: string[]; }
class CheckboxField extends FillableFormField { options: string[]; min/maxSelections; }

// Non-fillable
class RichTextFormField extends NonFillableFormField { content: any; }
```

### Serialization Functions

```typescript
// Convert class instances to plain objects (for DB/Y.js storage)
serializeFormField(field: FormField): object
serializeFormSchema(schema: FormSchema): object

// Reconstruct class instances from plain objects
deserializeFormField(data: any): FormField
deserializeFormSchema(data: any): FormSchema
```

---

## @dculus/utils — Utilities

### Exports from `src/index.ts`

```typescript
// ID generation
generateId(): string                    // nanoid-based unique IDs

// CSS utilities
cn(...classes): string                  // clsx + tailwind-merge

// Image URLs
getImageUrl(key: string): string        // Construct full URL from file key

// Renderer modes
enum RendererMode { BUILDER, PREVIEW, SUBMISSION }

// API endpoints
API_ENDPOINTS: { ... }                  // Backend URL constants

// Field type utilities (from fieldTypeUtils.ts)
getFieldTypeLabel(type: string): string
getFieldTypeIcon(type: string): IconComponent
```

### Constants (`src/constants.ts`)
- API endpoint URLs
- Application-wide constants

### Collaboration Utilities (`src/collaboration/`)
- Y.js collaboration helpers

---

## Build Commands

```bash
pnpm build              # Build all packages
pnpm --filter @dculus/ui build
pnpm --filter @dculus/types build
pnpm --filter @dculus/utils build

# Storybook (UI package)
pnpm ui:storybook       # Start Storybook
pnpm ui:build-storybook # Build Storybook
```
