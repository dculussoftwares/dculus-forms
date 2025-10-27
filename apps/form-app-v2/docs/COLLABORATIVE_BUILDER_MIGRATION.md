# Collaborative Form Builder Migration Guide

**Version**: 1.0
**Date**: 2025-01-27
**Status**: Planning Phase
**Target**: Migrate form-app collaborative builder to form-app-v2

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Target Architecture](#3-target-architecture)
4. [Migration Phases](#4-migration-phases)
5. [Component Specifications](#5-component-specifications)
6. [Technical Implementation Guide](#6-technical-implementation-guide)
7. [File Structure](#7-file-structure)
8. [Testing Strategy](#8-testing-strategy)
9. [User Flow Diagrams](#9-user-flow-diagrams)
10. [Success Criteria](#10-success-criteria)
11. [Migration Checklist](#11-migration-checklist)
12. [Risk Assessment](#12-risk-assessment)
13. [References](#13-references)

---

## 1. Executive Summary

### 1.1 What We're Migrating

The **Collaborative Form Builder** is a real-time, multi-user form editing workspace that allows users to create, edit, and customize forms with live synchronization across multiple clients. This migration involves moving the entire feature from `form-app` (V1) to `form-app-v2` (V2).

**Core Features**:
- **Page Builder**: Drag-and-drop interface for adding and arranging form fields
- **Layout Designer**: Visual form theme and layout customization
- **Live Preview**: Real-time form preview as respondents will see it
- **Settings**: Form configuration and advanced options
- **Real-time Collaboration**: Multi-user editing with YJS and Hocuspocus
- **Permission Management**: Role-based access control (Owner, Editor, Viewer)

### 1.2 Why This Migration

**Business Drivers**:
- Modernize user experience with contemporary design patterns
- Leverage Shadcn UI's component library for consistency
- Improve developer experience with better code organization
- Enable future enhancements with scalable architecture

**Technical Drivers**:
- **V2 Design System**: Use `@dculus/ui-v2` components exclusively
- **Resizable Panels**: Better workspace customization (VS Code-style)
- **Full-Screen Experience**: Distraction-free editing mode
- **Modern State Management**: Clean, type-safe store implementation
- **Performance**: Optimized rendering and collaboration sync

### 1.3 High-Level Architecture Decisions

| Decision Area | Form-App (V1) | Form-App-V2 (V2) |
|---------------|---------------|-------------------|
| **UI Components** | `@dculus/ui` | `@dculus/ui-v2` |
| **Layout Pattern** | Fixed sidebars | Resizable panels |
| **Main Sidebar** | Always visible | Hidden in builder |
| **Store** | Shared with V1 | New V2-specific store |
| **Collaboration** | YJS + Hocuspocus | Same (preserved) |
| **Drag & Drop** | `@dnd-kit` | Same library |
| **Route** | `/form/:id/collaborate/:tab` | `/form/:id/builder/:tab` |

### 1.4 Migration Approach

**Phased Implementation**:
1. **Phase 1** (Essential - 80%): Page Builder + Preview tabs
2. **Phase 2** (Design - 15%): Layout tab
3. **Phase 3** (Future - 5%): Settings tab placeholder

**Timeline**: 5-7 days total development time

---

## 2. Current State Analysis

### 2.1 Form-App Architecture Overview

The collaborative form builder in form-app is a sophisticated, feature-rich application with the following structure:

**Main Entry Point**: `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` (347 lines)

**Route Pattern**: `/dashboard/form/:formId/collaborate/:tab?`
- Default tab: `page-builder`
- Valid tabs: `layout`, `page-builder`, `settings`, `preview`

**Core Technology Stack**:
- React 18.3.1 with TypeScript
- Zustand for state management
- YJS (Yjs) for CRDT-based collaboration
- Hocuspocus for WebSocket synchronization
- `@dnd-kit` for drag-and-drop
- Apollo Client for GraphQL
- `@dculus/ui` for UI components

### 2.2 Component Inventory

#### 2.2.1 Main Components

| Component | Location | Lines | Purpose |
|-----------|----------|-------|---------|
| `CollaborativeFormBuilder` | `pages/CollaborativeFormBuilder.tsx` | 347 | Main container with routing and drag context |
| `FormBuilderHeader` | `components/form-builder/FormBuilderHeader.tsx` | 207 | Title, actions, connection status, permissions |
| `PageBuilderTab` | `components/form-builder/tabs/PageBuilderTab.tsx` | 100+ | Main editing interface with 3-panel layout |
| `LayoutTab` | `components/form-builder/tabs/LayoutTab.tsx` | 80 | Layout customization interface |
| `PreviewTab` | `components/form-builder/tabs/PreviewTab.tsx` | 45 | Full form preview |
| `SettingsTab` | `components/form-builder/tabs/SettingsTab.tsx` | ~50 | Settings placeholder |

#### 2.2.2 Page Builder Components

| Component | Purpose |
|-----------|---------|
| `FieldTypesPanel` | Left sidebar with draggable field types catalog |
| `DroppablePage` | Canvas area with current page and drop zones |
| `DraggableField` | Individual field item with drag handle and actions |
| `PagesSidebar` | Right sidebar with pages list and field settings |
| `FieldSettings` (V1) | Legacy field configuration UI |
| `FieldSettingsV2` | Modern field configuration UI |
| `JSONPreview` | Live JSON schema viewer |
| `DragOverlay` | Visual feedback during drag operations |

#### 2.2.3 Layout Components

| Component | Purpose |
|-----------|---------|
| `LayoutSidebar` | Layout configuration options |
| `LayoutThumbnails` | Visual layout selection |
| `BackgroundImageGallery` | Image browser and selector |
| `BackgroundImageUpload` | Upload interface |
| `PixabayModal` | External image search integration |
| `CollaborationStatus` | Real-time sync indicator |

### 2.3 State Management Architecture

#### 2.3.1 Zustand Store Structure

**File**: `apps/form-app/src/store/useFormBuilderStore.ts` (1,305 lines)

**State Schema**:
```typescript
interface FormBuilderStore {
  // Connection State
  isConnected: boolean;
  isLoading: boolean;
  formId: string | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  observerCleanups: Array<() => void>;

  // Form Data
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;

  // Selection State
  selectedPageId: string | null;
  selectedFieldId: string | null;
}
```

**Key Actions** (50+ methods):
- **Initialization**: `initializeCollaboration()`, `disconnectCollaboration()`
- **Pages**: `addEmptyPage()`, `removePage()`, `duplicatePage()`, `reorderPages()`
- **Fields**: `addField()`, `updateField()`, `removeField()`, `reorderFields()`, `duplicateField()`, `moveFieldBetweenPages()`
- **Layout**: `updateLayout()`
- **Selection**: `setSelectedPage()`, `setSelectedField()`

#### 2.3.2 CollaborationManager Class

**Embedded within store** (lines 389-623):

```typescript
class CollaborationManager {
  private ydoc: Y.Doc;
  private provider: HocuspocusProvider;
  private formSchemaMap: Y.Map<any>;
  private pagesArray: Y.Array<Y.Map<any>>;
  private observerCleanups: Array<() => void> = [];

  // Setup methods
  setupConnectionHandlers(): void;
  setupObservers(): void;
  setupPageObservers(pageMap: Y.Map<any>): void;
  setupFieldObservers(fieldsArray: Y.Array<Y.Map<any>>): void;

  // Sync methods
  updateFromYJS(): void;
  disconnect(): void;
}
```

**Observer Pattern**:
1. **formSchemaMap observer**: Detects root schema changes
2. **pagesArray observer**: Detects page additions/deletions
3. **pageMap observer**: Detects page property changes (title, order)
4. **fieldsArray observer**: Detects field additions/deletions/reorders
5. **fieldMap observer**: Detects individual field property changes

### 2.4 Real-Time Collaboration

#### 2.4.1 YJS Document Structure

```typescript
Y.Doc
├── Y.Map("formSchema")
    ├── Y.Array("pages")
    │   └── Y.Map (per page)
    │       ├── "id": string
    │       ├── "title": string
    │       ├── "order": number
    │       └── Y.Array("fields")
    │           └── Y.Map (per field)
    │               ├── "id": string
    │               ├── "type": string
    │               ├── "label": string
    │               ├── Y.Map("validation")
    │               └── ... (field-specific props)
    │
    ├── Y.Map("layout")
    │   ├── "theme": string
    │   ├── "textColor": string
    │   ├── "spacing": string
    │   ├── "code": string
    │   └── ... (layout props)
    │
    └── "isShuffleEnabled": boolean
```

#### 2.4.2 WebSocket Connection

**Configuration** (`apps/form-app/src/lib/config.ts`):
```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';

// Connection with authentication
new HocuspocusProvider({
  url: `${WS_URL}?token=${bearerToken}`,
  name: formId, // Document identifier
  document: ydoc,
  token: bearerToken,
});
```

**Events Handled**:
- `connect`: Connection established
- `disconnect`: Connection lost
- `synced`: Document fully synchronized
- `status`: Connection status changes

#### 2.4.3 Synchronization Flow

```
User Action (React)
    ↓
Store Action (Zustand)
    ↓
YJS Modification (Y.Map/Y.Array)
    ↓
    ├──→ Local Observer Fires
    │     ├──→ updateFromYJS()
    │     └──→ set({ pages: [...] })
    │           ↓
    │         React Re-render
    │
    └──→ Hocuspocus Sync to Server
          └──→ Broadcast to Other Clients
                └──→ Their Observers Fire
                      └──→ Their UI Updates
```

### 2.5 Drag & Drop System

**Library**: `@dnd-kit/core` + `@dnd-kit/sortable`

**Hook**: `apps/form-app/src/hooks/useDragAndDrop.ts`

**Supported Operations**:
1. **Drag new field** from FieldTypesPanel → DroppablePage
2. **Reorder fields** within a page (sortable)
3. **Move fields** between pages (future feature)

**Collision Detection**: `closestCenter` strategy

**Components Used**:
- `DndContext`: Top-level drag context
- `DragOverlay`: Visual feedback during drag
- `SortableContext`: Makes list sortable
- `useSortable`: Hook for sortable items
- `useDraggable`: Hook for draggable sources

### 2.6 GraphQL Integration

#### 2.6.1 Queries

**File**: `apps/form-app/src/graphql/queries.ts`

```graphql
# Main form loading
GET_FORM_BY_ID($id: ID!)
  - Returns: id, title, description, formSchema, userPermission, metadata
  - Used in: Initial form load

# Permission management
GET_FORM_PERMISSIONS($formId: ID!)
  - Returns: List of users with access and their permission levels

GET_ORGANIZATION_MEMBERS($organizationId: ID!)
  - Returns: Members available for sharing
```

#### 2.6.2 Mutations

```graphql
# Form metadata updates
UPDATE_FORM($id: ID!, $input: UpdateFormInput!)
  - Updates: title, description (NOT formSchema)

# Sharing
SHARE_FORM($formId: ID!, $userId: ID!, $permission: PermissionLevel!)
UPDATE_FORM_PERMISSION($formId: ID!, $userId: ID!, $permission: PermissionLevel!)
REMOVE_FORM_ACCESS($formId: ID!, $userId: ID!)
```

**Important**: Form schema changes are NOT persisted via GraphQL mutations. They are synced through YJS/Hocuspocus and persisted to MongoDB by the backend.

### 2.7 Permission System

**Context**: `apps/form-app/src/contexts/FormPermissionContext.tsx`

**Permission Levels** (from lowest to highest):
```typescript
enum PermissionLevel {
  NO_ACCESS = 0,  // Cannot access form
  VIEWER = 1,     // Read-only access
  EDITOR = 2,     // Can edit form
  OWNER = 3,      // Full control
}
```

**Permission Capabilities**:
```typescript
interface PermissionCapabilities {
  canView: boolean;      // VIEWER, EDITOR, OWNER
  canEdit: boolean;      // EDITOR, OWNER
  canManageSharing: boolean; // VIEWER (view only), EDITOR (add/edit), OWNER (full)
  canDelete: boolean;    // OWNER only
  canSave: boolean;      // Same as canEdit
  isReadOnly: boolean;   // VIEWER only
}
```

**Usage in Components**:
```typescript
const { canEdit, isReadOnly } = useFormPermissions();

// Disable editing features for VIEWER
<Button disabled={isReadOnly}>Edit Field</Button>
<DraggableField isDraggable={canEdit} />
```

### 2.8 Field Type System

**File**: `packages/types/src/form-fields/`

**Class Hierarchy**:
```
FormField (base)
├── FillableFormField (has label, validation, defaultValue)
│   ├── TextInputField (single-line text)
│   ├── TextAreaField (multi-line text)
│   ├── EmailField (email validation)
│   ├── NumberField (numeric with min/max)
│   ├── DateField (date picker with range)
│   ├── SelectField (dropdown with options)
│   ├── RadioField (single choice)
│   ├── CheckboxField (multiple choice)
│   └── RichTextField (formatted text editor)
└── StaticFormField (display-only, future)
    ├── HeadingField
    └── DividerField
```

**Serialization**:
```typescript
// Class instance → Plain object for storage
serializeFormField(field: FormField): object

// Plain object → Class instance
deserializeFormField(data: any): FormField

// Full schema serialization
serializeFormSchema(schema: FormSchema): object
deserializeFormSchema(data: any): FormSchema
```

### 2.9 Key Files Reference

| File | Path | Purpose |
|------|------|---------|
| Main Page | `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` | Entry point and routing |
| Store | `apps/form-app/src/store/useFormBuilderStore.ts` | State + YJS integration |
| Header | `apps/form-app/src/components/form-builder/FormBuilderHeader.tsx` | Top bar with actions |
| Page Builder Tab | `apps/form-app/src/components/form-builder/tabs/PageBuilderTab.tsx` | Main editing UI |
| Layout Tab | `apps/form-app/src/components/form-builder/tabs/LayoutTab.tsx` | Theme/design UI |
| Preview Tab | `apps/form-app/src/components/form-builder/tabs/PreviewTab.tsx` | Form preview |
| Settings Tab | `apps/form-app/src/components/form-builder/tabs/SettingsTab.tsx` | Settings placeholder |
| Permission Context | `apps/form-app/src/contexts/FormPermissionContext.tsx` | Access control |
| Drag Hook | `apps/form-app/src/hooks/useDragAndDrop.ts` | Drag & drop logic |
| GraphQL Queries | `apps/form-app/src/graphql/queries.ts` | API queries |
| GraphQL Mutations | `apps/form-app/src/graphql/mutations.ts` | API mutations |
| Config | `apps/form-app/src/lib/config.ts` | WebSocket URL config |

### 2.10 Current Limitations & Issues

**Known Issues**:
1. **Field Settings**: Two versions (V1 and V2) causing confusion
2. **Mobile Experience**: Limited responsiveness on smaller screens
3. **Performance**: Can slow down with 50+ fields
4. **Undo/Redo**: Not implemented
5. **Field Search**: No search in field types panel
6. **Multi-select**: Cannot select multiple fields for bulk operations
7. **Copy/Paste**: No keyboard shortcuts for copy/paste fields
8. **Collaboration Awareness**: No visual indicators of other users' cursors

**Technical Debt**:
- Mixed use of V1 and V2 field settings
- Some components have inline styles instead of Tailwind classes
- Observer cleanup not always consistent
- No error boundaries in critical sections
- Limited test coverage for collaboration features

---

## 3. Target Architecture (form-app-v2)

### 3.1 Design Principles

**V2-First Approach**:
1. **Exclusive use of @dculus/ui-v2**: All UI components from V2 package only
2. **Shadcn UI patterns**: Leverage official Shadcn components and blocks
3. **Resizable panels**: VS Code-style workspace with user-adjustable panels
4. **Full-screen experience**: Hide main app sidebar for distraction-free editing
5. **Type-safe**: Strict TypeScript with proper interfaces and generics
6. **Performance-first**: Optimized rendering, memoization, virtualization where needed
7. **Accessible**: WCAG 2.1 AA compliant, keyboard navigation, screen reader support
8. **Responsive**: Mobile, tablet, desktop support with adaptive layouts

**User Experience Goals**:
- **Professional**: Modern, clean interface matching industry standards
- **Intuitive**: Familiar patterns (drag-drop, context menus, keyboard shortcuts)
- **Fast**: Instant feedback, optimistic updates, smooth animations
- **Collaborative**: Real-time sync with visual awareness of other users
- **Flexible**: Customizable workspace with resizable panels

### 3.2 Layout Architecture

#### 3.2.1 Full-Screen Builder Mode

**Route**: `/dashboard/form/:formId/builder/:tab?`

**Layout Structure**:
```
┌─────────────────────────────────────────────────────────────┐
│ FormBuilderHeader (fixed, h-16)                            │
│ [← Back] Form Title [Live ●] [EDITOR] [Save] [Share] [⋯]  │
└─────────────────────────────────────────────────────────────┘
│                                                             │
│                    Active Tab Content                       │
│                    (ResizablePanel layout)                  │
│                                                             │
│                    (fills remaining height)                 │
│                                                             │
┌─────────────────────────────────────────────────────────────┐
│ TabNavigation (fixed, h-14)                                │
│ [Page Builder] [Preview] [Layout] [Settings]               │
└─────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- Main app sidebar hidden (full-screen workspace)
- Header and tab nav fixed positions
- Content area fills viewport height
- No max-width constraints (full workspace)
- Exit via back button or browser navigation

#### 3.2.2 Page Builder Tab Layout (Resizable)

```
┌────────────┬─────────────────────────┬───────────────┐
│            │                         │               │
│  Left      │  Canvas                 │  Right        │
│  Sidebar   │  (Drop Zone)            │  Sidebar      │
│            │                         │               │
│  Field     │  ┌──────────────────┐   │  ┌─────────┐ │
│  Types     │  │ Page Header      │   │  │ Pages   │ │
│  Catalog   │  │ ─────────────    │   │  │ JSON    │ │
│            │  │                  │   │  │ Settings│ │
│  ┌──────┐  │  │ ┌─────────────┐ │   │  └─────────┘ │
│  │ Text │  │  │ │ Field 1     │ │   │               │
│  │ Email│  │  │ │             │ │   │  [Field       │
│  │ Number│ │  │ ├─────────────┤ │   │   Settings    │
│  │ ...  │  │  │ │ Field 2     │ │   │   Panel]      │
│  └──────┘  │  │ │             │ │   │               │
│            │  │ └─────────────┘ │   │               │
│            │  └──────────────────┘   │               │
│            │                         │               │
│ w: 15-25%  │  flex-1                 │  w: 20-35%    │
│ min: 200px │                         │  min: 280px   │
└────────────┴─────────────────────────┴───────────────┘
```

**ResizablePanelGroup Configuration**:
```typescript
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel
    defaultSize={20}
    minSize={15}
    maxSize={30}
    collapsible={true}
  >
    {/* Left Sidebar: Field Types */}
  </ResizablePanel>

  <ResizableHandle withHandle />

  <ResizablePanel defaultSize={50} minSize={30}>
    {/* Canvas: Current Page */}
  </ResizablePanel>

  <ResizableHandle withHandle />

  <ResizablePanel
    defaultSize={30}
    minSize={20}
    maxSize={40}
    collapsible={true}
  >
    {/* Right Sidebar: Pages/JSON/Settings */}
  </ResizablePanel>
</ResizablePanelGroup>
```

**Responsive Behavior**:
- **Desktop (>1024px)**: Full 3-panel layout
- **Tablet (768-1024px)**: Canvas + one sidebar (collapsible)
- **Mobile (<768px)**: Canvas only, sidebars as overlays/sheets

#### 3.2.3 Layout Tab Structure

```
┌───────────────────────────────┬─────────────────┐
│                               │                 │
│  FormRenderer Preview         │  Layout         │
│  (Live Interactive)           │  Sidebar        │
│                               │                 │
│  ┌─────────────────────────┐  │  [Layout Code] │
│  │                         │  │  ○ L1  ○ L2    │
│  │  Form with Applied      │  │  ○ L3  ○ L4    │
│  │  Layout & Theme         │  │                │
│  │                         │  │  [Theme]       │
│  │  Updates in real-time   │  │  ● Light       │
│  │                         │  │  ○ Dark        │
│  │                         │  │  ○ Auto        │
│  │                         │  │                │
│  └─────────────────────────┘  │  [Colors]      │
│                               │  [Spacing]     │
│                               │  [Background]  │
│                               │                │
│  flex-1                       │  w: 25-35%     │
│                               │  min: 320px    │
└───────────────────────────────┴─────────────────┘
```

### 3.3 New V2 Store Architecture

**File**: `apps/form-app-v2/src/store/useFormBuilderStore.ts`

**Design Goals**:
- Preserve all YJS collaboration logic from form-app
- Improve TypeScript typing with strict mode
- Better error handling with toast notifications
- Optimistic updates for better UX
- Proper cleanup on unmount
- Extensible for future features (undo/redo, multi-select)

**State Interface**:
```typescript
interface FormBuilderStoreState {
  // Connection State
  isConnected: boolean;
  isSyncing: boolean;
  isLoading: boolean;
  connectionError: string | null;

  // Collaboration
  formId: string | null;
  ydoc: Y.Doc | null;
  provider: HocuspocusProvider | null;
  observerCleanups: Array<() => void>;

  // Form Data (mirrors YJS structure)
  pages: FormPage[];
  layout: FormLayout;
  isShuffleEnabled: boolean;

  // UI State
  selectedPageId: string | null;
  selectedFieldId: string | null;
  activeTab: BuilderTab;

  // Panel State (for resizable panels)
  panelSizes: {
    left: number;
    canvas: number;
    right: number;
  };

  // Future: Undo/Redo
  history: {
    past: FormSnapshot[];
    future: FormSnapshot[];
  };
}

interface FormBuilderStoreActions {
  // Initialization
  initializeCollaboration: (formId: string) => Promise<void>;
  disconnectCollaboration: () => void;

  // Page Management
  addEmptyPage: () => string | undefined;
  addPageAtIndex: (index: number) => string | undefined;
  removePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => void;
  reorderPages: (oldIndex: number, newIndex: number) => void;
  updatePage: (pageId: string, updates: Partial<FormPage>) => void;

  // Field Management
  addField: (pageId: string, fieldType: FieldType, fieldData?: Partial<FieldData>) => void;
  addFieldAtIndex: (pageId: string, fieldType: FieldType, fieldData: Partial<FieldData>, insertIndex: number) => void;
  updateField: (pageId: string, fieldId: string, updates: Partial<FieldData>) => void;
  removeField: (pageId: string, fieldId: string) => void;
  duplicateField: (pageId: string, fieldId: string) => void;
  reorderFields: (pageId: string, oldIndex: number, newIndex: number) => void;
  moveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => void;
  copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => void;

  // Layout Management
  updateLayout: (layoutUpdates: Partial<FormLayout>) => void;
  resetLayout: () => void;

  // Selection Management
  setSelectedPage: (pageId: string | null) => void;
  setSelectedField: (fieldId: string | null) => void;
  getSelectedField: () => FormField | null;
  clearSelection: () => void;

  // UI State
  setActiveTab: (tab: BuilderTab) => void;
  setPanelSizes: (sizes: Partial<typeof FormBuilderStoreState.panelSizes>) => void;

  // Utilities
  setConnectionState: (isConnected: boolean) => void;
  setLoadingState: (isLoading: boolean) => void;
  setConnectionError: (error: string | null) => void;
}

type FormBuilderStore = FormBuilderStoreState & FormBuilderStoreActions;
```

**CollaborationManager Integration** (same as V1):
- Embedded class within store
- Manages YJS document and Hocuspocus provider
- Sets up all observers for real-time sync
- Handles connection lifecycle
- Converts between YJS types and React state

### 3.4 Component Architecture

#### 3.4.1 Component Hierarchy

```
CollaborativeFormBuilder (route page)
├── FormBuilderContainer (full-screen wrapper)
    ├── FormBuilderHeader
    │   ├── BackButton
    │   ├── TitleEditor
    │   ├── ConnectionStatusBadge
    │   ├── PermissionBadge
    │   ├── SaveButton (with auto-save indicator)
    │   ├── ShareButton → ShareModal
    │   ├── PreviewButton
    │   └── MoreActionsMenu
    │
    ├── TabContent (dynamic based on activeTab)
    │   ├── PageBuilderTab
    │   │   ├── ResizablePanelGroup
    │   │       ├── LeftPanel: FieldTypesPanel
    │   │       │   ├── SearchInput
    │   │       │   ├── CategoryHeader
    │   │       │   └── DraggableFieldType (per type)
    │   │       │
    │   │       ├── CenterPanel: DroppablePage
    │   │       │   ├── PageHeader
    │   │       │   ├── FieldsList
    │   │       │   │   ├── DraggableField (per field)
    │   │       │   │   └── DropIndicator (between fields)
    │   │       │   └── AddFieldButton
    │   │       │
    │   │       └── RightPanel: PagesSidebar
    │   │           ├── Tabs (Pages, JSON, Settings)
    │   │           ├── PagesTab
    │   │           │   ├── AddPageButton
    │   │           │   └── PageList
    │   │           │       └── DraggablePageItem (per page)
    │   │           ├── JSONPreviewTab
    │   │           │   └── CodeEditor
    │   │           └── FieldSettingsTab
    │   │               └── FieldSettingsPanel
    │   │
    │   ├── PreviewTab
    │   │   └── FormRenderer (from @dculus/ui)
    │   │
    │   ├── LayoutTab
    │   │   ├── ResizablePanelGroup
    │   │       ├── PreviewPanel: FormRenderer
    │   │       └── SettingsPanel: LayoutSidebar
    │   │           ├── LayoutCodeSelector
    │   │           ├── ThemeSelector
    │   │           ├── ColorPickers
    │   │           ├── SpacingSelector
    │   │           └── BackgroundImageSection
    │   │
    │   └── SettingsTab
    │       └── ComingSoonCard
    │
    └── TabNavigation
        ├── TabButton (per tab)
        └── KeyboardShortcutHints
```

#### 3.4.2 Component Specifications (Key Components)

**FormBuilderHeader**:
```typescript
interface FormBuilderHeaderProps {
  formId: string;
  formTitle: string;
  onTitleChange: (title: string) => void;
  isConnected: boolean;
  isSyncing: boolean;
  permissionLevel: PermissionLevel;
  canEdit: boolean;
  canManageSharing: boolean;
  onSave: () => Promise<void>;
  onShare: () => void;
  onPreview: () => void;
  onBack: () => void;
}
```

**FieldTypesPanel**:
```typescript
interface FieldTypesPanelProps {
  onFieldTypeSelect?: (fieldType: FieldType) => void;
  isReadOnly?: boolean;
  searchable?: boolean;
}

interface FieldTypeItem {
  type: FieldType;
  label: string;
  description: string;
  icon: LucideIcon;
  category: 'input' | 'choice' | 'content' | 'advanced';
}
```

**DroppablePage**:
```typescript
interface DroppablePageProps {
  page: FormPage;
  fields: FormField[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  onFieldUpdate: (fieldId: string, updates: Partial<FieldData>) => void;
  onFieldDelete: (fieldId: string) => void;
  onFieldDuplicate: (fieldId: string) => void;
  onFieldReorder: (oldIndex: number, newIndex: number) => void;
  isReadOnly: boolean;
}
```

**FieldSettingsPanel**:
```typescript
interface FieldSettingsPanelProps {
  field: FormField | null;
  onUpdate: (updates: Partial<FieldData>) => void;
  onClose: () => void;
  isReadOnly: boolean;
}
```

### 3.5 Import Strategy

**V2 UI Components** (from @dculus/ui-v2):
```typescript
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Input,
  Label,
  Badge,
  Separator,
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DropdownMenu,
  Tooltip,
  ScrollArea,
  Skeleton,
  toast,
  cn,
  useIsMobile,
} from '@dculus/ui-v2';
```

**Shared Types** (from @dculus/types):
```typescript
import {
  FormField,
  FormPage,
  FormLayout,
  FormSchema,
  FillableFormField,
  TextInputField,
  EmailField,
  // ... other field types
  FieldType,
  PermissionLevel,
} from '@dculus/types';
```

**Shared Utilities** (from @dculus/utils):
```typescript
import {
  generateId,
  serializeFormField,
  deserializeFormField,
  serializeFormSchema,
  deserializeFormSchema,
  FIELD_TYPES,
} from '@dculus/utils';
```

**Drag & Drop**:
```typescript
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
```

**Collaboration**:
```typescript
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
```

**GraphQL**:
```typescript
import { useQuery, useMutation } from '@apollo/client';
import { GET_FORM_BY_ID, GET_FORM_PERMISSIONS } from '@/graphql/queries';
import { UPDATE_FORM, SHARE_FORM } from '@/graphql/mutations';
```

**Store**:
```typescript
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
```

**Legacy Components** (temporary, until migrated):
```typescript
// FormRenderer not yet in @dculus/ui-v2, use from @dculus/ui
import { FormRenderer } from '@dculus/ui';
```

### 3.6 Routing Integration

**New Route** in `App.tsx`:
```typescript
<Route
  path="/dashboard/form/:formId/builder/:tab?"
  element={
    <ProtectedRoute>
      <CollaborativeFormBuilder />
    </ProtectedRoute>
  }
/>
```

**Navigation**:
- From FormDashboard: "Edit" button → `/dashboard/form/:formId/builder`
- From Dashboard: Quick action → `/dashboard/form/:formId/builder`
- Builder tabs: Navigate to `/dashboard/form/:formId/builder/:tab`
- Back button: Returns to `/dashboard/form/:formId`

**Tab Routing**:
```typescript
type BuilderTab = 'page-builder' | 'preview' | 'layout' | 'settings';

const DEFAULT_TAB: BuilderTab = 'page-builder';

// In CollaborativeFormBuilder component
const { formId, tab } = useParams<{ formId: string; tab?: string }>();
const navigate = useNavigate();

const activeTab = useMemo(() => {
  const validTabs: BuilderTab[] = ['page-builder', 'preview', 'layout', 'settings'];
  return validTabs.includes(tab as BuilderTab) ? (tab as BuilderTab) : DEFAULT_TAB;
}, [tab]);

const handleTabChange = (newTab: BuilderTab) => {
  navigate(`/dashboard/form/${formId}/builder/${newTab}`);
};
```

### 3.7 Permission Integration

**Context Provider** (reuse pattern from form-app):
```typescript
// In CollaborativeFormBuilder
const { data: formData } = useQuery(GET_FORM_BY_ID, {
  variables: { id: formId }
});

const permissionLevel = formData?.form?.userPermission || PermissionLevel.NO_ACCESS;

<FormBuilderPermissionContext.Provider value={{ permissionLevel, formId }}>
  <FormBuilderContainer>
    {/* Builder UI */}
  </FormBuilderContainer>
</FormBuilderPermissionContext.Provider>
```

**Permission Hook**:
```typescript
const useBuilderPermissions = () => {
  const { permissionLevel } = useContext(FormBuilderPermissionContext);

  return {
    canView: permissionLevel >= PermissionLevel.VIEWER,
    canEdit: permissionLevel >= PermissionLevel.EDITOR,
    canManageSharing: permissionLevel >= PermissionLevel.VIEWER,
    canDelete: permissionLevel === PermissionLevel.OWNER,
    isReadOnly: permissionLevel === PermissionLevel.VIEWER,
    isOwner: permissionLevel === PermissionLevel.OWNER,
    isEditor: permissionLevel === PermissionLevel.EDITOR,
  };
};
```

### 3.8 Error Handling & UX

**Toast Notifications** (using Sonner from @dculus/ui-v2):
```typescript
import { toast } from '@dculus/ui-v2';

// Success notifications
toast.success('Field added', 'Text field added to page 1');
toast.success('Form saved', 'All changes have been saved');

// Error notifications
toast.error('Failed to save', 'Could not connect to server');
toast.error('Permission denied', 'You need EDITOR access to edit fields');

// Info notifications
toast.info('Syncing', 'Syncing changes with server...');
```

**Loading States**:
- Skeleton loaders during initial form load
- Spinner in save button during save operation
- "Syncing..." badge in header during YJS sync
- Progress indicators for long operations

**Error Boundaries**:
```typescript
class FormBuilderErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Form builder error:', error, errorInfo);
    toast.error('Something went wrong', 'Please refresh the page');
  }

  render() {
    return this.props.children;
  }
}
```

**Offline Handling**:
- YJS queues changes when offline
- Visual indicator: "Offline" badge in header
- Auto-reconnect when connection restored
- Toast notification on reconnect: "Back online, syncing changes..."

---

## 4. Migration Phases

### 4.1 Phase 1: Foundation & Page Builder Tab (Essential - 80%)

**Duration**: 3-4 days
**Priority**: HIGH (Core functionality)

#### 4.1.1 Prerequisites & Dependencies

**Add Shadcn Components to @dculus/ui-v2**:
```bash
cd packages/ui-v2

# Resizable panels (VS Code-style)
npx shadcn@latest add resizable

# Form components
npx shadcn@latest add form

# UI controls
npx shadcn@latest add toggle-group
npx shadcn@latest add popover
npx shadcn@latest add context-menu

# Optional future components
# npx shadcn@latest add command  # For command palette
# npx shadcn@latest add checkbox  # If not already added

# Rebuild package
cd ../..
pnpm --filter @dculus/ui-v2 build
```

**Install Dependencies in form-app-v2**:
```bash
cd apps/form-app-v2

pnpm add @dnd-kit/core@^6.1.0
pnpm add @dnd-kit/sortable@^8.0.0
pnpm add @dnd-kit/utilities@^3.2.2
pnpm add yjs@^13.6.20
pnpm add @hocuspocus/provider@^2.17.0

# Optional: JSON viewer
pnpm add react-json-view@^1.21.3
# Or Monaco Editor for advanced JSON editing
# pnpm add @monaco-editor/react@^4.6.0
```

**Update package.json dependencies**:
- Verify `react-hook-form@^7.62.0` is installed (already exists)
- Verify `zod@4.1.12` is installed (already exists)

#### 4.1.2 Store Creation

**File**: `apps/form-app-v2/src/store/useFormBuilderStore.ts`

**Implementation Steps**:
1. Copy `useFormBuilderStore.ts` from form-app as starting point
2. Update imports to use V2 types and utilities
3. Add strict TypeScript types (no `any` types)
4. Add toast notifications for all operations
5. Add optimistic updates where applicable
6. Improve error handling with try-catch blocks
7. Add JSDoc comments for all public methods

**Key Changes from V1**:
```typescript
// V1 (form-app)
import { toastError, toastSuccess } from '@dculus/ui';

// V2 (form-app-v2)
import { toast } from '@dculus/ui-v2';

// Replace toastError/toastSuccess with toast.error/toast.success
toastSuccess('Success', 'Field added')
  → toast.success('Field added', 'Text field added to page 1')
```

**CollaborationManager Preservation**:
- Keep the entire CollaborationManager class unchanged
- Preserve all YJS observer setup logic
- Preserve all serialization/deserialization helpers
- Ensure cleanup logic is robust

**Testing**:
- Unit test each store action
- Test YJS sync with mock Hocuspocus provider
- Test observer cleanup on unmount

#### 4.1.3 Route & Main Container

**Files to Create**:

**1. Main Route Page** - `src/pages/CollaborativeFormBuilder.tsx`
```typescript
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';
import { GET_FORM_BY_ID } from '@/graphql/queries';
import { FormBuilderContainer } from '@/components/collaborative-builder/FormBuilderContainer';
import { Skeleton } from '@dculus/ui-v2';

export function CollaborativeFormBuilder() {
  const { formId, tab } = useParams<{ formId: string; tab?: string }>();

  const { data, loading, error } = useQuery(GET_FORM_BY_ID, {
    variables: { id: formId },
    skip: !formId,
  });

  if (loading) return <LoadingState />;
  if (error || !data?.form) return <Navigate to="/dashboard" replace />;

  return <FormBuilderContainer form={data.form} initialTab={tab} />;
}
```

**2. Main Container** - `src/components/collaborative-builder/FormBuilderContainer.tsx`
```typescript
import { useEffect } from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { FormBuilderHeader } from './FormBuilderHeader';
import { TabNavigation } from './TabNavigation';
import { PageBuilderTab } from './tabs/PageBuilderTab';
import { PreviewTab } from './tabs/PreviewTab';
import { LayoutTab } from './tabs/LayoutTab';
import { SettingsTab } from './tabs/SettingsTab';

export function FormBuilderContainer({ form, initialTab }) {
  const {
    initializeCollaboration,
    disconnectCollaboration,
    activeTab,
    setActiveTab
  } = useFormBuilderStore();

  // Initialize collaboration on mount
  useEffect(() => {
    initializeCollaboration(form.id);
    return () => disconnectCollaboration();
  }, [form.id]);

  // Set initial tab
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
        <FormBuilderHeader form={form} />

        <div className="flex-1 overflow-hidden">
          {activeTab === 'page-builder' && <PageBuilderTab />}
          {activeTab === 'preview' && <PreviewTab />}
          {activeTab === 'layout' && <LayoutTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <DragOverlay>{/* Render dragged item */}</DragOverlay>
    </DndContext>
  );
}
```

#### 4.1.4 Header Component

**File**: `src/components/collaborative-builder/FormBuilderHeader.tsx`

**Features**:
- Editable form title with inline editing
- Connection status badge (Live/Connecting/Offline)
- Permission level badge (OWNER/EDITOR/VIEWER)
- Save button with auto-save indicator
- Share button → opens ShareModal
- Preview button → opens form in new tab
- More actions menu (Settings, Duplicate, Delete)
- Back button → returns to form dashboard

**Implementation**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, Eye, Save, MoreVertical } from 'lucide-react';
import {
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Input,
} from '@dculus/ui-v2';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';

export function FormBuilderHeader({ form }) {
  const navigate = useNavigate();
  const { isConnected, isSyncing } = useFormBuilderStore();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState(form.title);

  const connectionStatus = isConnected
    ? 'Live'
    : isSyncing
    ? 'Connecting...'
    : 'Offline';

  return (
    <header className="h-16 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/form/${form.id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isEditingTitle ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            className="h-8"
            autoFocus
          />
        ) : (
          <h1 className="text-lg font-semibold cursor-pointer" onClick={() => setIsEditingTitle(true)}>
            {title}
          </h1>
        )}

        <Badge variant={isConnected ? 'default' : 'secondary'}>
          <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
          {connectionStatus}
        </Badge>

        <Badge variant="outline">{form.userPermission}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>

        <Button variant="outline" onClick={handleShare}>
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>

        <Button variant="outline" onClick={handlePreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

#### 4.1.5 Tab Navigation

**File**: `src/components/collaborative-builder/TabNavigation.tsx`

**Features**:
- Fixed bottom bar
- Tab buttons with icons
- Active tab indicator
- Keyboard shortcuts display (Cmd/Ctrl + 1-4)

**Implementation**:
```typescript
import { LayoutGrid, Eye, Palette, Settings } from 'lucide-react';
import { Button, Separator } from '@dculus/ui-v2';

const TABS = [
  { id: 'page-builder', label: 'Page Builder', icon: LayoutGrid, shortcut: '1' },
  { id: 'preview', label: 'Preview', icon: Eye, shortcut: '2' },
  { id: 'layout', label: 'Layout', icon: Palette, shortcut: '3' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '4' },
] as const;

export function TabNavigation({ activeTab, onTabChange }) {
  return (
    <nav className="h-14 border-t flex items-center justify-center gap-2 px-4">
      {TABS.map((tab) => (
        <Button
          key={tab.id}
          variant={activeTab === tab.id ? 'default' : 'ghost'}
          onClick={() => onTabChange(tab.id)}
          className="flex items-center gap-2"
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
          <kbd className="ml-2 text-xs opacity-60">⌘{tab.shortcut}</kbd>
        </Button>
      ))}
    </nav>
  );
}
```

#### 4.1.6 Page Builder Tab (Main Feature)

**File**: `src/components/collaborative-builder/tabs/PageBuilderTab.tsx`

**Layout**:
```typescript
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@dculus/ui-v2';
import { FieldTypesPanel } from '../page-builder/FieldTypesPanel';
import { DroppablePage } from '../page-builder/DroppablePage';
import { PagesSidebar } from '../page-builder/PagesSidebar';

export function PageBuilderTab() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left Sidebar: Field Types */}
      <ResizablePanel
        defaultSize={20}
        minSize={15}
        maxSize={30}
        collapsible
      >
        <FieldTypesPanel />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Center: Canvas */}
      <ResizablePanel defaultSize={50} minSize={30}>
        <DroppablePage />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right Sidebar: Pages/JSON/Settings */}
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        maxSize={40}
        collapsible
      >
        <PagesSidebar />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

#### 4.1.7 Field Types Panel

**File**: `src/components/collaborative-builder/page-builder/FieldTypesPanel.tsx`

**Features**:
- Scrollable list of field types
- Search/filter (future)
- Category headers (Input, Choice, Content, Advanced)
- Draggable field type items
- Icons for each field type

**Implementation**:
```typescript
import { useDraggable } from '@dnd-kit/core';
import { ScrollArea, Separator } from '@dculus/ui-v2';
import { Type, Mail, Hash, Calendar, List, Circle, CheckSquare, FileText } from 'lucide-react';

const FIELD_TYPES = [
  { type: 'text', label: 'Text Input', icon: Type, category: 'input' },
  { type: 'email', label: 'Email', icon: Mail, category: 'input' },
  { type: 'number', label: 'Number', icon: Hash, category: 'input' },
  { type: 'date', label: 'Date', icon: Calendar, category: 'input' },
  { type: 'select', label: 'Dropdown', icon: List, category: 'choice' },
  { type: 'radio', label: 'Multiple Choice', icon: Circle, category: 'choice' },
  { type: 'checkbox', label: 'Checkboxes', icon: CheckSquare, category: 'choice' },
  { type: 'richtext', label: 'Rich Text', icon: FileText, category: 'content' },
];

export function FieldTypesPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Field Types</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {['input', 'choice', 'content'].map(category => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase">
                {category}
              </h3>
              <div className="space-y-1">
                {FIELD_TYPES.filter(f => f.category === category).map(fieldType => (
                  <DraggableFieldType key={fieldType.type} fieldType={fieldType} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function DraggableFieldType({ fieldType }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `field-type-${fieldType.type}`,
    data: { type: 'new-field', fieldType: fieldType.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="flex items-center gap-2 p-2 rounded border hover:bg-accent cursor-move"
    >
      <fieldType.icon className="h-4 w-4" />
      <span className="text-sm">{fieldType.label}</span>
    </div>
  );
}
```

#### 4.1.8 Droppable Canvas

**File**: `src/components/collaborative-builder/page-builder/DroppablePage.tsx`

**Features**:
- Drop zone for new fields
- List of existing fields (sortable)
- Empty state when no fields
- Page header with title and field count
- Drop indicators between fields

**Implementation**: (See detailed component specs in Section 5)

#### 4.1.9 Pages Sidebar (Right Panel)

**File**: `src/components/collaborative-builder/page-builder/PagesSidebar.tsx`

**Features**:
- Tabs: Pages, JSON Preview, Field Settings
- Pages tab: List of pages with add/delete/duplicate
- JSON tab: Live JSON viewer
- Settings tab: Field configuration panel

#### 4.1.10 Preview Tab

**File**: `src/components/collaborative-builder/tabs/PreviewTab.tsx`

**Simple Implementation**:
```typescript
import { FormRenderer } from '@dculus/ui'; // Legacy until migrated
import { useFormBuilderStore } from '@/store/useFormBuilderStore';

export function PreviewTab() {
  const { pages, layout } = useFormBuilderStore();

  const formSchema = { pages, layout, isShuffleEnabled: false };

  return (
    <div className="h-full overflow-auto bg-muted/50 p-8">
      <div className="max-w-3xl mx-auto">
        <FormRenderer
          formSchema={formSchema}
          mode="preview"
          onSubmit={() => {}} // No-op in preview
        />
      </div>
    </div>
  );
}
```

#### 4.1.11 Drag & Drop Integration

**File**: `src/hooks/useDragAndDrop.ts`

**Setup**:
- Handle drag start: Show overlay
- Handle drag over: Show drop indicator
- Handle drag end: Add field or reorder
- Collision detection: closestCenter

#### 4.1.12 Phase 1 Deliverables

**Functional Requirements Met**:
- ✅ Users can create/edit forms with pages and fields
- ✅ Drag & drop works for adding fields
- ✅ Drag & drop works for reordering fields
- ✅ Field settings panel updates fields correctly
- ✅ Real-time collaboration syncs across clients
- ✅ Preview shows live updates
- ✅ All permission levels work (OWNER, EDITOR, VIEWER)
- ✅ Connection status displayed in header
- ✅ Toast notifications for all actions

**Testing Checklist**:
- [ ] Form loads and initializes collaboration
- [ ] Can add new fields by dragging from panel
- [ ] Can reorder fields by dragging
- [ ] Can edit field properties
- [ ] Can delete/duplicate fields
- [ ] Can add/delete/duplicate pages
- [ ] Preview updates in real-time
- [ ] YJS sync works across multiple clients
- [ ] Permission checks prevent unauthorized edits
- [ ] Offline mode queues changes

---

### 4.2 Phase 2: Layout Tab (Design & Theming - 15%)

**Duration**: 1-2 days
**Priority**: MEDIUM (Design features)

#### 4.2.1 Layout Tab Structure

**File**: `src/components/collaborative-builder/tabs/LayoutTab.tsx`

**Layout**:
```typescript
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@dculus/ui-v2';
import { FormRenderer } from '@dculus/ui';
import { LayoutSidebar } from '../layout/LayoutSidebar';

export function LayoutTab() {
  const { pages, layout } = useFormBuilderStore();

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left: Live Preview */}
      <ResizablePanel defaultSize={65} minSize={50}>
        <div className="h-full overflow-auto bg-muted/50 p-8">
          <div className="max-w-3xl mx-auto">
            <FormRenderer
              formSchema={{ pages, layout, isShuffleEnabled: false }}
              mode="preview"
            />
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right: Layout Settings */}
      <ResizablePanel defaultSize={35} minSize={25} maxSize={45}>
        <LayoutSidebar />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
```

#### 4.2.2 Layout Sidebar Components

**Files to Create**:

1. **LayoutSidebar.tsx** - Main container with all settings
2. **LayoutCodeSelector.tsx** - Layout code thumbnails (L1-L6)
3. **ThemeSelector.tsx** - Light/Dark/Auto toggle
4. **ColorPickers.tsx** - Text and background color pickers
5. **SpacingSelector.tsx** - Compact/Normal/Spacious options
6. **BackgroundImageSection.tsx** - Upload and select backgrounds

**Implementation** (LayoutSidebar.tsx):
```typescript
import { ScrollArea, Separator, Label, ToggleGroup, ToggleGroupItem } from '@dculus/ui-v2';
import { useFormBuilderStore } from '@/store/useFormBuilderStore';

export function LayoutSidebar() {
  const { layout, updateLayout } = useFormBuilderStore();

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Layout Settings</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Layout Code */}
          <div>
            <Label>Layout Code</Label>
            <LayoutCodeSelector
              value={layout.code}
              onChange={(code) => updateLayout({ code })}
            />
          </div>

          <Separator />

          {/* Theme */}
          <div>
            <Label>Theme</Label>
            <ToggleGroup type="single" value={layout.theme} onValueChange={(theme) => updateLayout({ theme })}>
              <ToggleGroupItem value="light">Light</ToggleGroupItem>
              <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
              <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Separator />

          {/* Colors */}
          <ColorPickers />

          <Separator />

          {/* Spacing */}
          <SpacingSelector />

          <Separator />

          {/* Background Image */}
          <BackgroundImageSection />
        </div>
      </ScrollArea>
    </div>
  );
}
```

#### 4.2.3 Phase 2 Deliverables

**Functional Requirements Met**:
- ✅ Users can select layout codes (L1-L6)
- ✅ Users can change theme (Light/Dark/Auto)
- ✅ Users can customize colors (text, background)
- ✅ Users can adjust spacing (Compact/Normal/Spacious)
- ✅ Users can upload background images
- ✅ Users can select from image gallery
- ✅ Preview updates in real-time as settings change
- ✅ Layout changes sync via YJS

---

### 4.3 Phase 3: Settings Tab (Placeholder - 5%)

**Duration**: 0.5 day
**Priority**: LOW (Future features)

#### 4.3.1 Settings Tab Implementation

**File**: `src/components/collaborative-builder/tabs/SettingsTab.tsx`

**Simple Placeholder**:
```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@dculus/ui-v2';
import { Settings, Mail, Lock, Download, Webhook } from 'lucide-react';

const PLANNED_FEATURES = [
  { icon: Settings, title: 'Form Submission Settings', description: 'Configure submission limits, time windows, and redirect URLs' },
  { icon: Mail, title: 'Email Notifications', description: 'Set up email alerts for form submissions and responses' },
  { icon: Lock, title: 'Access Permissions', description: 'Advanced permission management and access control' },
  { icon: Download, title: 'Export Options', description: 'Export form responses to CSV, Excel, or JSON' },
  { icon: Webhook, title: 'Integrations', description: 'Connect to webhooks, Zapier, and third-party services' },
];

export function SettingsTab() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground mt-2">
            Advanced form configuration options coming soon.
          </p>
        </div>

        <div className="grid gap-4">
          {PLANNED_FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <feature.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

#### 4.3.2 Phase 3 Deliverables

**Functional Requirements Met**:
- ✅ Settings tab displays planned features
- ✅ Clean, professional "Coming Soon" UI
- ✅ Extensible structure for future settings

---

### 4.4 Migration Timeline Summary

| Phase | Features | Duration | Lines of Code (Est.) |
|-------|----------|----------|----------------------|
| **Phase 1** | Page Builder + Preview | 3-4 days | ~2,500 lines |
| **Phase 2** | Layout Tab | 1-2 days | ~800 lines |
| **Phase 3** | Settings Placeholder | 0.5 day | ~100 lines |
| **Testing & Polish** | E2E tests, bug fixes | 1 day | ~500 lines |
| **Total** | Complete migration | 5-7 days | ~3,900 lines |

**Parallel Work Opportunities**:
- Store creation can happen while adding Shadcn components
- Tab navigation and header can be built in parallel
- Layout tab can start while Page Builder is in testing

---

## 5. Component Specifications

### 5.1 Core Components Quick Reference

This section provides detailed specifications for key components. For full implementations, refer to Section 4 code examples.

#### 5.1.1 DroppablePage Component

**Purpose**: Canvas area where fields are dropped and arranged

**Key Features**:
- Droppable zone using `@dnd-kit/sortable`
- Visual drop indicators
- Empty state when no fields exist
- Sortable field list

**Props Interface**:
```typescript
interface DroppablePageProps {
  pageId: string;
  isReadOnly: boolean;
}
```

**State Management**:
- Gets current page from store: `useFormBuilderStore((state) => state.pages.find(p => p.id === state.selectedPageId))`
- Handles field reordering via store action: `reorderFields(pageId, oldIndex, newIndex)`

**Drag & Drop**:
- Uses `SortableContext` with `verticalListSortingStrategy`
- Each field wrapped in `useSortable` hook
- Drop indicator shows insertion point

---

#### 5.1.2 DraggableField Component

**Purpose**: Individual field item in the canvas

**Key Features**:
- Draggable via `useSortable`
- Field icon and label display
- Action buttons (Edit, Delete, Duplicate)
- Permission-aware interactions

**Props Interface**:
```typescript
interface DraggableFieldProps {
  field: FormField;
  pageId: string;
  isReadOnly: boolean;
  isSelected: boolean;
  onSelect: () => void;
}
```

**Actions**:
- Edit: Opens field settings in right sidebar
- Delete: Removes field with confirmation
- Duplicate: Creates copy below current field

---

#### 5.1.3 PagesSidebar Component

**Purpose**: Right sidebar with tabs for pages, JSON, and settings

**Structure**:
```typescript
<Tabs defaultValue="pages">
  <TabsList>
    <TabsTrigger value="pages">Pages</TabsTrigger>
    <TabsTrigger value="json">JSON</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>

  <TabsContent value="pages">
    <PagesList />
  </TabsContent>

  <TabsContent value="json">
    <JSONPreview />
  </TabsContent>

  <TabsContent value="settings">
    <FieldSettingsPanel />
  </TabsContent>
</Tabs>
```

---

#### 5.1.4 FieldSettingsPanel Component

**Purpose**: Comprehensive field configuration UI

**Dynamic Form Based on Field Type**:
- Text fields: Label, placeholder, default value, character limits, required
- Email fields: Label, placeholder, required, email validation
- Number fields: Label, placeholder, min/max, step, required
- Date fields: Label, min/max dates, required
- Select/Radio/Checkbox: Options management, required
- Rich text: Label, default content, toolbar options

**Implementation Pattern**:
```typescript
export function FieldSettingsPanel({ field, onUpdate, isReadOnly }) {
  const form = useForm({
    defaultValues: fieldToFormValues(field),
    resolver: zodResolver(getValidationSchema(field.type))
  });

  // Debounced update to store
  const debouncedUpdate = useMemo(
    () => debounce((values) => onUpdate(values), 300),
    [onUpdate]
  );

  useEffect(() => {
    const subscription = form.watch((values) => {
      debouncedUpdate(values);
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  return (
    <Form {...form}>
      {renderFieldSettings(field.type)}
    </Form>
  );
}
```

---

###5.2 Utility Components

#### ConnectionStatusBadge
- Displays: Live (green), Connecting (yellow), Offline (red)
- Props: `isConnected: boolean`, `isSyncing: boolean`

#### PermissionBadge
- Displays: OWNER, EDITOR, VIEWER
- Props: `level: PermissionLevel`
- Styling: Different colors per level

#### DropIndicator
- Visual line showing where field will be inserted
- Appears during drag operations
- Uses `data-drop-indicator` attribute for styling

---

## 6. Technical Implementation Guide

### 6.1 Store Implementation Details

#### CollaborationManager Class

**Critical: Preserve Exactly from form-app**

The CollaborationManager embedded within the store is the heart of real-time collaboration. **Do not modify its core logic**.

**Key Methods to Preserve**:
```typescript
class CollaborationManager {
  // Connection lifecycle
  constructor(formId: string, set: SetState, get: GetState)
  disconnect(): void

  // Observer setup (most critical)
  setupConnectionHandlers(): void
  setupObservers(): void
  setupPageObservers(pageMap: Y.Map<any>): void
  setupFieldObservers(fieldsArray: Y.Array<Y.Map<any>>, pageId: string): void
  setupIndividualFieldObservers(fieldMap: Y.Map<any>, pageId: string): void

  // State sync
  updateFromYJS(): void
  
  // Cleanup
  cleanupObservers(): void
}
```

**Observer Pattern Example**:
```typescript
setupObservers() {
  const formSchemaMap = this.ydoc.getMap('formSchema');
  
  // Root schema observer
  const schemaObserver = () => {
    this.updateFromYJS();
  };
  formSchemaMap.observe(schemaObserver);
  this.observerCleanups.push(() => formSchemaMap.unobserve(schemaObserver));

  // Pages array observer
  const pagesArray = formSchemaMap.get('pages') as Y.Array<Y.Map<any>>;
  if (pagesArray) {
    const pagesObserver = () => {
      this.updateFromYJS();
    };
    pagesArray.observe(pagesObserver);
    this.observerCleanups.push(() => pagesArray.unobserve(pagesObserver));

    // Setup individual page observers
    pagesArray.forEach((pageMap) => {
      this.setupPageObservers(pageMap);
    });
  }
}
```

---

### 6.2 Serialization Helpers

**Critical: Reuse from @dculus/utils or form-app**

```typescript
// Field → YJS
export function serializeFieldToYMap(field: FormField): Y.Map<any> {
  const fieldMap = new Y.Map();
  
  fieldMap.set('id', field.id);
  fieldMap.set('type', field.type);
  
  if (field instanceof FillableFormField) {
    fieldMap.set('label', field.label);
    fieldMap.set('defaultValue', field.defaultValue);
    fieldMap.set('hint', field.hint || '');
    fieldMap.set('prefix', field.prefix || '');
    
    // Validation as nested Y.Map
    const validationMap = new Y.Map();
    validationMap.set('required', field.validation.required);
    validationMap.set('type', field.validation.type);
    fieldMap.set('validation', validationMap);
  }
  
  // Type-specific properties
  if (field.type === 'number') {
    fieldMap.set('min', field.min);
    fieldMap.set('max', field.max);
  }
  
  // ... handle other field types
  
  return fieldMap;
}

// YJS → Field
export function deserializeFieldFromYMap(fieldMap: Y.Map<any>): FormField {
  const type = fieldMap.get('type');
  const id = fieldMap.get('id');
  
  const fieldData: FieldData = {
    id,
    type,
    label: fieldMap.get('label'),
    defaultValue: fieldMap.get('defaultValue'),
    // ... extract all properties
  };
  
  return createFormField(fieldData);
}
```

---

### 6.3 Drag & Drop Implementation

**useDragAndDrop Hook**:
```typescript
export function useDragAndDrop() {
  const { addField, reorderFields, selectedPageId } = useFormBuilderStore();
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px before drag starts
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || !selectedPageId) return;
    
    // Drag new field from panel
    if (active.data.current?.type === 'new-field') {
      const fieldType = active.data.current.fieldType;
      const insertIndex = over.data.current?.index ?? 0;
      
      addFieldAtIndex(selectedPageId, fieldType, {}, insertIndex);
      toast.success('Field added', `${fieldType} field added to page`);
      return;
    }
    
    // Reorder existing field
    if (active.id !== over.id) {
      const oldIndex = active.data.current?.index;
      const newIndex = over.data.current?.index;
      
      reorderFields(selectedPageId, oldIndex, newIndex);
    }
  };

  return {
    sensors,
    handleDragEnd,
    collisionDetection: closestCenter,
  };
}
```

---

### 6.4 GraphQL Integration

**Queries to Copy/Reuse**:
```typescript
// Already exists in form-app-v2
import { GET_FORM_BY_ID } from '@/graphql/queries';

// May need to add if not present
export const GET_FORM_PERMISSIONS = gql`
  query GetFormPermissions($formId: ID!) {
    formPermissions(formId: $formId) {
      userId
      user {
        id
        name
        email
      }
      permission
    }
  }
`;

export const GET_ORGANIZATION_MEMBERS = gql`
  query GetOrganizationMembers($organizationId: ID!) {
    organization(id: $organizationId) {
      id
      members {
        id
        userId
        user {
          id
          name
          email
        }
        role
      }
    }
  }
`;
```

**Mutations to Add**:
```typescript
// Share form mutation
export const SHARE_FORM = gql`
  mutation ShareForm($formId: ID!, $userId: ID!, $permission: PermissionLevel!) {
    shareForm(formId: $formId, userId: $userId, permission: $permission) {
      id
      userPermission
    }
  }
`;

// Update permission mutation
export const UPDATE_FORM_PERMISSION = gql`
  mutation UpdateFormPermission($formId: ID!, $userId: ID!, $permission: PermissionLevel!) {
    updateFormPermission(formId: $formId, userId: $userId, permission: $permission) {
      id
    }
  }
`;
```

---

### 6.5 Permission Context

**Create New Context**:
```typescript
// src/contexts/FormBuilderPermissionContext.tsx
import { createContext, useContext, ReactNode } from 'react';
import { PermissionLevel } from '@dculus/types';

interface FormBuilderPermissionContext {
  permissionLevel: PermissionLevel;
  formId: string;
}

const FormBuilderPermissionContext = createContext<FormBuilderPermissionContext | undefined>(undefined);

export function FormBuilderPermissionProvider({
  children,
  permissionLevel,
  formId,
}: {
  children: ReactNode;
  permissionLevel: PermissionLevel;
  formId: string;
}) {
  return (
    <FormBuilderPermissionContext.Provider value={{ permissionLevel, formId }}>
      {children}
    </FormBuilderPermissionContext.Provider>
  );
}

export function useBuilderPermissions() {
  const context = useContext(FormBuilderPermissionContext);
  if (!context) {
    throw new Error('useBuilderPermissions must be used within FormBuilderPermissionProvider');
  }

  const { permissionLevel } = context;

  return {
    canView: permissionLevel >= PermissionLevel.VIEWER,
    canEdit: permissionLevel >= PermissionLevel.EDITOR,
    canManageSharing: permissionLevel >= PermissionLevel.VIEWER,
    canDelete: permissionLevel === PermissionLevel.OWNER,
    isReadOnly: permissionLevel === PermissionLevel.VIEWER,
    isOwner: permissionLevel === PermissionLevel.OWNER,
    isEditor: permissionLevel === PermissionLevel.EDITOR,
    permissionLevel,
  };
}
```

---

### 6.6 Error Handling Patterns

**Store Actions with Error Handling**:
```typescript
addField: (pageId: string, fieldType: FieldType, fieldData?: Partial<FieldData>) => {
  try {
    const page = get().pages.find(p => p.id === pageId);
    if (!page) {
      toast.error('Page not found', 'Could not add field to page');
      return;
    }

    // ... add field logic

    toast.success('Field added', `${fieldType} field added successfully`);
  } catch (error) {
    console.error('Error adding field:', error);
    toast.error('Failed to add field', 'An unexpected error occurred');
  }
}
```

**Component Error Boundaries**:
```typescript
// src/components/collaborative-builder/FormBuilderErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';
import { toast } from '@dculus/ui-v2';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class FormBuilderErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Form builder error:', error, errorInfo);
    toast.error('Something went wrong', 'Please refresh the page to continue');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">Please refresh the page to continue</p>
            <button onClick={() => window.location.reload()} className="btn-primary">
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## 7. File Structure

### 7.1 Complete Directory Tree

```
apps/form-app-v2/
├── src/
│   ├── pages/
│   │   ├── CollaborativeFormBuilder.tsx       # Main route page
│   │   ├── Dashboard.tsx                      # Existing
│   │   ├── FormDashboard.tsx                  # Existing
│   │   ├── SignIn.tsx                         # Existing
│   │   └── SignUp.tsx                         # Existing
│   │
│   ├── components/
│   │   ├── collaborative-builder/
│   │   │   ├── FormBuilderContainer.tsx       # Main container
│   │   │   ├── FormBuilderHeader.tsx          # Header with actions
│   │   │   ├── TabNavigation.tsx              # Bottom tab bar
│   │   │   ├── FormBuilderErrorBoundary.tsx   # Error boundary
│   │   │   │
│   │   │   ├── tabs/
│   │   │   │   ├── PageBuilderTab.tsx         # Page builder main
│   │   │   │   ├── PreviewTab.tsx             # Preview mode
│   │   │   │   ├── LayoutTab.tsx              # Layout customization
│   │   │   │   └── SettingsTab.tsx            # Settings placeholder
│   │   │   │
│   │   │   ├── page-builder/
│   │   │   │   ├── FieldTypesPanel.tsx        # Left sidebar - field catalog
│   │   │   │   ├── DroppablePage.tsx          # Canvas - drop zone
│   │   │   │   ├── DraggableField.tsx         # Field item
│   │   │   │   ├── DropIndicator.tsx          # Drop position indicator
│   │   │   │   ├── PagesSidebar.tsx           # Right sidebar container
│   │   │   │   ├── PagesList.tsx              # Pages list tab
│   │   │   │   ├── JSONPreview.tsx            # JSON viewer tab
│   │   │   │   ├── FieldSettingsPanel.tsx     # Field settings tab
│   │   │   │   └── DraggablePageItem.tsx      # Page list item
│   │   │   │
│   │   │   └── layout/
│   │   │       ├── LayoutSidebar.tsx          # Layout settings container
│   │   │       ├── LayoutCodeSelector.tsx     # Layout code thumbnails
│   │   │       ├── ThemeSelector.tsx          # Light/Dark/Auto
│   │   │       ├── ColorPickers.tsx           # Color customization
│   │   │       ├── SpacingSelector.tsx        # Spacing options
│   │   │       └── BackgroundImageSection.tsx # Background image upload
│   │   │
│   │   ├── app-sidebar.tsx                    # Existing main sidebar
│   │   ├── ProtectedRoute.tsx                 # Existing
│   │   └── ... (other existing components)
│   │
│   ├── store/
│   │   └── useFormBuilderStore.ts             # NEW - Form builder store
│   │
│   ├── hooks/
│   │   ├── useDragAndDrop.ts                  # NEW - Drag & drop logic
│   │   ├── useFieldSettings.ts                # NEW - Field settings form
│   │   ├── useCollaboration.ts                # NEW - Collaboration helpers
│   │   ├── useFormsDashboard.ts               # Existing
│   │   └── useFormDashboard.ts                # Existing
│   │
│   ├── contexts/
│   │   ├── FormBuilderPermissionContext.tsx   # NEW - Permission context
│   │   ├── AuthContext.tsx                    # Existing
│   │   └── TranslationContext.tsx             # Existing
│   │
│   ├── graphql/
│   │   ├── queries.ts                         # Existing (may need additions)
│   │   ├── mutations.ts                       # Existing (may need additions)
│   │   └── formSharing.ts                     # Existing
│   │
│   ├── lib/
│   │   ├── apollo-client.ts                   # Existing
│   │   ├── auth-client.ts                     # Existing
│   │   └── config.ts                          # Existing (add WS_URL if needed)
│   │
│   └── App.tsx                                # Add new route
│
├── docs/
│   └── COLLABORATIVE_BUILDER_MIGRATION.md     # This document
│
└── package.json                               # Add new dependencies
```

### 7.2 Files to Create (Summary)

**Total New Files**: ~30 files

**By Category**:
- Pages: 1 file (CollaborativeFormBuilder.tsx)
- Main Components: 4 files (Container, Header, TabNav, ErrorBoundary)
- Tab Components: 4 files (PageBuilder, Preview, Layout, Settings tabs)
- Page Builder Components: 9 files (panels, canvas, sidebars)
- Layout Components: 6 files (settings, selectors)
- Store: 1 file (useFormBuilderStore.ts)
- Hooks: 3 files (drag-drop, field-settings, collaboration)
- Contexts: 1 file (FormBuilderPermissionContext.tsx)

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Store Tests** (`useFormBuilderStore.test.ts`):
```typescript
describe('useFormBuilderStore', () => {
  describe('Page Management', () => {
    it('should add empty page', () => {
      const { result } = renderHook(() => useFormBuilderStore());
      const pageId = result.current.addEmptyPage();
      expect(result.current.pages).toHaveLength(1);
      expect(pageId).toBeDefined();
    });

    it('should remove page', () => {
      const { result } = renderHook(() => useFormBuilderStore());
      const pageId = result.current.addEmptyPage();
      result.current.removePage(pageId!);
      expect(result.current.pages).toHaveLength(0);
    });

    it('should reorder pages', () => {
      // Test reorderPages action
    });
  });

  describe('Field Management', () => {
    it('should add field to page', () => {
      // Test addField action
    });

    it('should update field properties', () => {
      // Test updateField action
    });

    it('should reorder fields', () => {
      // Test reorderFields action
    });
  });

  describe('Collaboration', () => {
    it('should initialize collaboration', async () => {
      // Mock YJS and Hocuspocus
    });

    it('should cleanup on disconnect', () => {
      // Test observer cleanup
    });
  });
});
```

**Component Tests**:
```typescript
describe('FieldTypesPanel', () => {
  it('renders all field types', () => {
    render(<FieldTypesPanel />);
    expect(screen.getByText('Text Input')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('makes field types draggable', () => {
    // Test drag initiation
  });
});

describe('DroppablePage', () => {
  it('renders empty state when no fields', () => {
    // Test empty state
  });

  it('renders fields list', () => {
    // Test field rendering
  });

  it('handles field reordering', () => {
    // Test drag and drop
  });
});
```

### 8.2 Integration Tests

**Collaborative Editing** (`collaboration.test.ts`):
```typescript
describe('Collaborative Editing', () => {
  it('syncs field addition across clients', async () => {
    // Create two stores with same formId
    // Add field in store1
    // Verify it appears in store2
  });

  it('syncs field updates across clients', async () => {
    // Update field in store1
    // Verify change in store2
  });

  it('handles concurrent edits', async () => {
    // Edit same field in both stores
    // Verify CRDT resolution
  });
});
```

**Permission System** (`permissions.test.ts`):
```typescript
describe('Permission System', () => {
  it('VIEWER cannot edit fields', () => {
    // Mock VIEWER permission
    // Attempt edit
    // Verify blocked
  });

  it('EDITOR can edit but not delete form', () => {
    // Mock EDITOR permission
    // Verify edit allowed
    // Verify delete blocked
  });

  it('OWNER has full access', () => {
    // Mock OWNER permission
    // Verify all actions allowed
  });
});
```

### 8.3 E2E Tests (Playwright)

**Form Creation Flow** (`form-builder.spec.ts`):
```typescript
test('Create form with multiple pages and fields', async ({ page }) => {
  // Navigate to builder
  await page.goto('/dashboard/form/test-form-id/builder');

  // Add page
  await page.click('[data-testid="add-page-button"]');

  // Drag field from panel to canvas
  await page.dragAndDrop(
    '[data-testid="field-type-text"]',
    '[data-testid="droppable-page"]'
  );

  // Edit field properties
  await page.click('[data-testid="field-edit-button"]');
  await page.fill('[data-testid="field-label-input"]', 'Full Name');
  await page.click('[data-testid="field-required-checkbox"]');

  // Preview form
  await page.click('[data-testid="preview-tab"]');
  await expect(page.locator('text=Full Name')).toBeVisible();
});
```

**Real-time Collaboration** (`collaboration.spec.ts`):
```typescript
test('Changes sync between users', async ({ browser }) => {
  // Create two contexts (simulate two users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const page1 = await context1.newPage();
  const page2 = await context2.newPage();

  // Both navigate to same form
  await page1.goto('/dashboard/form/test-form-id/builder');
  await page2.goto('/dashboard/form/test-form-id/builder');

  // User 1 adds field
  await page1.dragAndDrop('[data-testid="field-type-email"]', '[data-testid="droppable-page"]');

  // Verify field appears for User 2
  await expect(page2.locator('[data-field-type="email"]')).toBeVisible();
});
```

### 8.4 Performance Tests

**Load Time**:
- Form with 50 fields should load < 2 seconds
- Initial collaboration sync < 1 second

**Responsiveness**:
- Field drag should have < 16ms frame time (60fps)
- Field settings update debounced to 300ms

**Memory**:
- No memory leaks after 100 field operations
- Observer cleanup verified on unmount

---

## 9. User Flow Diagrams

### 9.1 Form Builder Entry Flow

```
User clicks "Edit" on FormDashboard
    ↓
Navigate to /dashboard/form/:formId/builder
    ↓
CollaborativeFormBuilder page loads
    ↓
GraphQL: Fetch form data (GET_FORM_BY_ID)
    ↓
FormBuilderContainer initializes
    ↓
Store: initializeCollaboration(formId)
    ↓
YJS: Create Y.Doc, connect Hocuspocus
    ↓
Setup observers for real-time sync
    ↓
Load existing form schema from YJS
    ↓
Render PageBuilderTab (default tab)
    ↓
User ready to edit form
```

### 9.2 Add Field Flow

```
User drags field type from FieldTypesPanel
    ↓
DndContext: handleDragStart (show overlay)
    ↓
User moves over DroppablePage
    ↓
Show drop indicator at insertion point
    ↓
User releases (drop)
    ↓
DndContext: handleDragEnd
    ↓
Store: addFieldAtIndex(pageId, fieldType, data, index)
    ↓
YJS: fieldsArray.insert(index, [fieldMap])
    ↓
    ├→ Local: Observer fires → updateFromYJS() → React re-render
    └→ Remote: Hocuspocus sync → Other clients update
    ↓
Toast: "Field added successfully"
```

### 9.3 Edit Field Properties Flow

```
User clicks field in canvas
    ↓
Store: setSelectedField(fieldId)
    ↓
PagesSidebar switches to "Settings" tab
    ↓
FieldSettingsPanel renders (react-hook-form)
    ↓
User modifies field property (e.g., label)
    ↓
Form watch triggers (debounced 300ms)
    ↓
Store: updateField(pageId, fieldId, updates)
    ↓
YJS: fieldMap.set('label', newValue)
    ↓
    ├→ Local: Observer fires → updateFromYJS() → Re-render
    └→ Remote: Sync to other clients
    ↓
Canvas updates with new field label
```

### 9.4 Real-time Collaboration Flow

```
User A adds field
    ↓
YJS: Local Y.Doc updates
    ↓
Hocuspocus: Broadcast to server
    ↓
Server: Forward to all connected clients
    ↓
User B's Hocuspocus receives update
    ↓
User B's YJS: Y.Doc applies update
    ↓
User B's Observer: Detects change
    ↓
User B's Store: updateFromYJS()
    ↓
User B's UI: Re-renders with new field
    ↓
Toast (optional): "User A added a field"
```

---

## 10. Success Criteria & Acceptance Tests

### 10.1 Phase 1 Success Criteria

**Core Functionality**:
- [ ] User can create new form pages
- [ ] User can add fields by dragging from panel
- [ ] User can reorder fields by dragging
- [ ] User can edit field properties in settings panel
- [ ] User can duplicate fields
- [ ] User can delete fields (with confirmation)
- [ ] User can preview form in preview tab
- [ ] All changes update in real-time preview

**Real-time Collaboration**:
- [ ] Multiple users can edit same form simultaneously
- [ ] Changes sync across all connected clients < 1 second
- [ ] No data loss or conflicts during concurrent edits
- [ ] Connection status accurately displayed in header
- [ ] Offline changes queued and synced when reconnected

**Permissions**:
- [ ] VIEWER role: Can view but not edit (UI disabled)
- [ ] EDITOR role: Can edit fields but not delete form
- [ ] OWNER role: Full access including delete
- [ ] Unauthorized edit attempts show error toast

**Performance**:
- [ ] Form with 50 fields loads < 2 seconds
- [ ] Drag operations smooth (60fps)
- [ ] No memory leaks after 100 operations
- [ ] Observer cleanup verified on unmount

---

### 10.2 Phase 2 Success Criteria

**Layout Customization**:
- [ ] User can select layout codes (L1-L6)
- [ ] User can change theme (Light/Dark/Auto)
- [ ] User can customize text color
- [ ] User can customize background color
- [ ] User can adjust spacing (Compact/Normal/Spacious)
- [ ] User can upload background images
- [ ] User can select from image gallery

**Preview & Sync**:
- [ ] Layout preview updates in real-time
- [ ] Layout changes sync via YJS
- [ ] No layout flicker or flash

---

### 10.3 Phase 3 Success Criteria

**Settings Tab**:
- [ ] Settings tab displays planned features
- [ ] Professional "Coming Soon" UI
- [ ] Extensible for future implementation

---

## 11. Migration Checklist

### 11.1 Pre-Migration Checklist

**Dependencies**:
- [ ] Add Shadcn components to @dculus/ui-v2:
  - [ ] resizable
  - [ ] form
  - [ ] toggle-group
  - [ ] popover
  - [ ] context-menu
- [ ] Install packages in form-app-v2:
  - [ ] @dnd-kit/core
  - [ ] @dnd-kit/sortable
  - [ ] @dnd-kit/utilities
  - [ ] yjs
  - [ ] @hocuspocus/provider
  - [ ] react-json-view (optional)
- [ ] Rebuild @dculus/ui-v2 package

**Environment**:
- [ ] Verify WebSocket URL configured (VITE_WS_URL)
- [ ] Test YJS server connection
- [ ] Verify GraphQL endpoints accessible

---

### 11.2 Phase 1 Implementation Checklist

**Store** (1-2 days):
- [ ] Create useFormBuilderStore.ts
- [ ] Copy CollaborationManager from form-app
- [ ] Update imports for @dculus/ui-v2
- [ ] Add all page management actions
- [ ] Add all field management actions
- [ ] Add toast notifications
- [ ] Write unit tests for store

**Routing** (0.5 day):
- [ ] Add route to App.tsx
- [ ] Create CollaborativeFormBuilder page
- [ ] Create FormBuilderContainer component
- [ ] Test route navigation

**Header & Navigation** (0.5 day):
- [ ] Create FormBuilderHeader component
- [ ] Create TabNavigation component
- [ ] Implement connection status badge
- [ ] Implement permission badge
- [ ] Test keyboard shortcuts

**Page Builder Tab** (2 days):
- [ ] Create PageBuilderTab layout
- [ ] Create FieldTypesPanel
- [ ] Create DroppablePage
- [ ] Create DraggableField
- [ ] Create PagesSidebar
- [ ] Create FieldSettingsPanel
- [ ] Implement drag & drop
- [ ] Test all interactions

**Preview Tab** (0.5 day):
- [ ] Create PreviewTab component
- [ ] Integrate FormRenderer
- [ ] Test real-time updates

**Testing** (1 day):
- [ ] Write component tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Fix bugs

---

### 11.3 Phase 2 Implementation Checklist

**Layout Tab** (1-2 days):
- [ ] Create LayoutTab layout
- [ ] Create LayoutSidebar
- [ ] Create LayoutCodeSelector
- [ ] Create ThemeSelector
- [ ] Create ColorPickers
- [ ] Create SpacingSelector
- [ ] Create BackgroundImageSection
- [ ] Test all settings

---

### 11.4 Phase 3 Implementation Checklist

**Settings Tab** (0.5 day):
- [ ] Create SettingsTab component
- [ ] Add planned features list
- [ ] Polish UI

---

### 11.5 Post-Migration Checklist

**Testing**:
- [ ] Run all unit tests (pass rate > 90%)
- [ ] Run all integration tests (pass rate > 95%)
- [ ] Run E2E tests (all critical flows pass)
- [ ] Manual testing with 2+ users
- [ ] Performance testing (load time, responsiveness)

**Documentation**:
- [ ] Update README if needed
- [ ] Document any deviations from plan
- [ ] Create user guide (optional)

**Deployment**:
- [ ] Code review
- [ ] Merge to development branch
- [ ] Test on staging environment
- [ ] Deploy to production
- [ ] Monitor for errors

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **YJS sync breaks** | HIGH | LOW | Preserve CollaborationManager exactly, extensive testing |
| **Performance issues with large forms** | MEDIUM | MEDIUM | Implement virtualization if needed, test with 100+ fields |
| **Drag & drop bugs** | MEDIUM | MEDIUM | Use @dnd-kit examples, thorough testing |
| **Permission bypass** | HIGH | LOW | Server-side validation, extensive permission testing |
| **Memory leaks** | MEDIUM | LOW | Proper observer cleanup, memory profiling |
| **Breaking changes to form-app** | MEDIUM | LOW | No shared code, independent implementations |

---

### 12.2 Schedule Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Underestimated complexity** | Delays | Add 20% buffer to timeline |
| **YJS integration issues** | Major delays | Start with store/YJS early, test frequently |
| **Blocked by Shadcn components** | Minor delays | Add components to ui-v2 first |
| **Testing takes longer** | Minor delays | Automate where possible, prioritize critical tests |

---

### 12.3 Rollback Plan

**If Migration Fails**:
1. form-app continues to work (no changes)
2. Remove route from form-app-v2
3. Revert commits if needed
4. Re-assess approach

**Gradual Rollout**:
- Deploy behind feature flag
- Enable for internal testing first
- Gradual rollout to users
- Keep form-app as fallback

---

## 13. References

### 13.1 Internal Documentation

- **CLAUDE.md**: Main project documentation
- **form-app README**: Original collaborative builder
- **@dculus/ui-v2 README**: V2 component library guide
- **TOAST_IMPLEMENTATION_GUIDE.md**: Toast notification patterns

### 13.2 Form-App Source Files

**Key Files to Reference**:
- `apps/form-app/src/store/useFormBuilderStore.ts` - Store implementation
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` - Main page
- `apps/form-app/src/components/form-builder/` - All builder components
- `apps/form-app/src/hooks/useDragAndDrop.ts` - Drag & drop logic
- `apps/form-app/src/contexts/FormPermissionContext.tsx` - Permissions

### 13.3 External Documentation

**Shadcn UI**:
- Main: https://ui.shadcn.com
- Resizable: https://ui.shadcn.com/docs/components/resizable
- Blocks: https://ui.shadcn.com/blocks

**@dnd-kit**:
- Docs: https://docs.dndkit.com
- Examples: https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com

**YJS**:
- Docs: https://docs.yjs.dev
- Hocuspocus: https://tiptap.dev/hocuspocus

**React Hook Form**:
- Docs: https://react-hook-form.com

### 13.4 Design References

**Inspiration**:
- Typeform builder: https://www.typeform.com
- Notion blocks: Drag-and-drop patterns
- VS Code: Resizable panels
- Figma: Properties panel

---

## Appendix A: Quick Start Guide

### For Developers Starting Migration

1. **Read Sections 1-3** - Understand what we're building
2. **Review Section 4** - Understand the phases
3. **Start with Phase 1, Step 4.1.1** - Install dependencies
4. **Follow checklist in Section 11** - Track progress
5. **Refer to Section 6** - For implementation details
6. **Use Section 8** - For testing guidance

### Key Principles

1. **Preserve YJS logic exactly** - Don't modify CollaborationManager
2. **Use @dculus/ui-v2 exclusively** - No V1 components
3. **Test frequently** - Especially collaboration features
4. **Follow existing patterns** - Match form-app-v2 conventions
5. **Document deviations** - Note any changes from plan

---

## Document History

- **v1.0** - 2025-01-27 - Initial comprehensive migration plan created
- Future updates will be tracked here

---

**End of Migration Guide**

For questions or clarifications, refer to CLAUDE.md or consult the development team.
