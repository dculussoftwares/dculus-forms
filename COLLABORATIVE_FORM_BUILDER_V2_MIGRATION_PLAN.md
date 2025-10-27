# Collaborative Form Builder V2 Migration Plan

## Executive Summary

This document outlines the phased migration plan for moving the Collaborative Form Builder feature from `form-app` to `form-app-v2`. The feature includes real-time collaboration powered by YJS/Hocuspocus and consists of 4 major sections: **Layout**, **Page Builder**, **Preview**, and **Settings**.

**Critical Requirements:**
- ✅ Maintain real-time collaboration functionality (YJS + Hocuspocus)
- ✅ Follow `form-app-v2` design principles and Shadcn UI patterns
- ✅ Use `@dculus/ui-v2` for all UI components
- ✅ Preserve GraphQL-first architecture
- ✅ Maintain type safety and functional programming patterns

---

## Current Implementation Analysis

### Architecture Overview (form-app)

**Main Entry Point:**
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` (349 lines)
  - Orchestrates DnD context, tab navigation, and collaboration
  - Routes: `/dashboard/form/:formId/collaborate/:tab`
  - Tabs: `layout`, `page-builder`, `preview`, `settings`

**State Management:**
- `apps/form-app/src/store/useFormBuilderStore.ts` (1309 lines)
  - Zustand store with YJS/Hocuspocus integration
  - Real-time synchronization of form schema
  - Handles: pages, fields, layout, collaboration state

**Core Components:**

#### 1. Layout Tab (`LayoutTab.tsx`)
- **Purpose:** Visual layout design (L1-L9 layouts)
- **Features:**
  - Layout code selection
  - Theme customization (colors, spacing, background)
  - Background image management (Pixabay integration)
  - Real-time layout preview with FormRenderer
- **Sidebar Components:**
  - `LayoutSidebar.tsx` - Main container
  - `LayoutThumbnails.tsx` - Visual layout picker
  - `LayoutOptions.tsx` - Theme/color controls
  - `BackgroundImageGallery.tsx`, `PixabayImageBrowser.tsx`

#### 2. Page Builder Tab (`PageBuilderTab.tsx`)
- **Purpose:** Drag-and-drop form building
- **Features:**
  - Field types panel (left sidebar)
  - Canvas with droppable pages
  - Pages sidebar (right sidebar) with thumbnails
  - Real-time field manipulation
- **Key Components:**
  - `FieldTypesPanel.tsx` - Draggable field types
  - `DroppablePage.tsx` - Drop zone for fields
  - `PagesSidebar.tsx` - Page management + field settings
  - `DraggableField.tsx`, `FieldItem.tsx`

#### 3. Preview Tab (`PreviewTab.tsx`)
- **Purpose:** Form preview without editing
- **Features:**
  - Uses `FormRenderer` with `RendererMode.PREVIEW`
  - Read-only view of current form state
  - Simple pass-through to `@dculus/ui` renderer

#### 4. Settings Tab (`SettingsTab.tsx`)
- **Purpose:** Form-level settings (placeholder/coming soon)
- **Features:**
  - Currently shows "Coming Soon" card
  - Displays form stats (pages, fields, shuffle status)
  - Placeholder for future settings

**Navigation:**
- `TabNavigation.tsx` - Floating bottom navigation bar
- `TabKeyboardShortcuts` - Keyboard shortcuts for tab switching
- `FormBuilderHeader.tsx` - Top header with title, collaboration status

**Shared Utilities:**
- `useDragAndDrop` - DnD logic hook
- `useCollisionDetection` - DnD collision strategy
- `useFieldCreation` - Field factory logic
- `useFormPermissions` - Permission checks (VIEWER/EDITOR/OWNER)

---

## Migration Strategy: Phased Approach

### Phase 1: Foundation & Infrastructure 🏗️
**Goal:** Set up core infrastructure without breaking existing `form-app`

#### 1.1 Install Dependencies
```bash
cd apps/form-app-v2
pnpm add yjs @hocuspocus/provider zustand
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm add @dculus/types @dculus/ui @dculus/utils
```

#### 1.2 Create Store Structure
**File:** `apps/form-app-v2/src/store/useFormBuilderStore.ts`
- Copy and adapt from `form-app` version
- Update imports to use `@dculus/ui-v2` where applicable
- Maintain YJS/Hocuspocus integration
- Add TypeScript strict mode compliance
- **Key Changes:**
  - Use Vite environment variables (`import.meta.env`)
  - Follow V2 naming conventions
  - Add JSDoc comments

#### 1.3 Create Contexts
**File:** `apps/form-app-v2/src/contexts/FormPermissionContext.tsx`
- Permission levels: VIEWER, EDITOR, OWNER
- Permission checks for actions

#### 1.4 Create Routing Structure
**File:** `apps/form-app-v2/src/pages/CollaborativeFormBuilder.tsx`
- Route: `/dashboard/form/:formId/collaborate/:tab`
- Tab parameter handling with validation
- DnD context provider setup

**Update:** `apps/form-app-v2/src/App.tsx`
```tsx
<Route path="/dashboard/form/:formId/collaborate/:tab" element={<CollaborativeFormBuilder />} />
```

#### 1.5 Add GraphQL Queries
**File:** `apps/form-app-v2/src/graphql/formBuilder.ts`
```graphql
query GetFormById($id: ID!) {
  form(id: $id) {
    id
    title
    shortUrl
    userPermission
    organization { id name }
  }
}
```

---

### Phase 2: Layout Tab Migration 🎨
**Goal:** Migrate layout customization features with Shadcn UI

#### 2.1 Create Layout Components Directory
```
apps/form-app-v2/src/components/collaborative-builder/
  layout/
    LayoutTab.tsx
    LayoutSidebar.tsx
    LayoutThumbnails.tsx
    LayoutOptions.tsx
    BackgroundControls.tsx
    PixabayBrowser.tsx
```

#### 2.2 Shadcn UI Component Mapping

| Old Component | New Shadcn Component | Notes |
|---------------|---------------------|-------|
| Custom sidebar | `Sheet` or `Sidebar` from ui-v2 | Right sidebar pattern |
| Layout thumbnails | `Card` + `AspectRatio` | Grid layout with hover effects |
| Color pickers | `Popover` + custom input | HEX/RGB input with preview |
| Theme toggle | `Tabs` or `ToggleGroup` | Light/Dark/Auto |
| Image browser | `Dialog` + `ScrollArea` | Pixabay modal |
| Upload button | `Button` + file input | With upload icon |

#### 2.3 Implementation Steps
1. **LayoutTab.tsx:**
   - Use `FormRenderer` from `@dculus/ui` (same as V1)
   - Integrate with `useFormBuilderStore` for state
   - Pass `mode={RendererMode.BUILDER}` prop

2. **LayoutSidebar.tsx:**
   - Use Shadcn `Sheet` component for slide-out sidebar
   - Or use `Sidebar` from ui-v2 with custom width
   - Sections: Layout Picker, Theme Options, Background Controls

3. **LayoutThumbnails.tsx:**
   ```tsx
   <div className="grid grid-cols-2 gap-4">
     {LAYOUTS.map(layout => (
       <Card key={layout.code} onClick={() => onSelect(layout.code)}>
         <AspectRatio ratio={4/3}>
           <img src={layout.thumbnail} alt={layout.name} />
         </AspectRatio>
         <CardContent>{layout.name}</CardContent>
       </Card>
     ))}
   </div>
   ```

4. **LayoutOptions.tsx:**
   - Use `Label` + `Input` for colors
   - Use `Select` for spacing (compact/normal/spacious)
   - Use `ToggleGroup` for theme selection

5. **PixabayBrowser.tsx:**
   - Use `Dialog` with search input
   - `ScrollArea` for image grid
   - Lazy loading with pagination

#### 2.4 Key Features to Preserve
- ✅ Real-time layout updates via YJS
- ✅ Layout code persistence
- ✅ Background image upload/selection
- ✅ Theme toggle (light/dark/auto)
- ✅ Custom color overrides

---

### Phase 3: Page Builder Tab Migration 🔨
**Goal:** Migrate drag-and-drop form builder with improved UX

#### 3.1 Create Page Builder Components
```
apps/form-app-v2/src/components/collaborative-builder/
  page-builder/
    PageBuilderTab.tsx
    FieldTypesPanel.tsx
    CanvasArea.tsx
    PagesPanel.tsx
    FieldSettingsSheet.tsx
    DroppableField.tsx
    DraggableFieldType.tsx
```

#### 3.2 Shadcn UI Component Mapping

| Old Component | New Shadcn Component | Notes |
|---------------|---------------------|-------|
| FieldTypesPanel | `ScrollArea` + `Button` variants | Left sidebar with icons |
| DroppablePage | Custom with DnD + `Card` | Canvas drop zone |
| PagesSidebar | `Sheet` or fixed sidebar | Right sidebar with thumbnails |
| FieldSettings | `Sheet` with forms | Slide-out settings panel |
| Page thumbnails | `Card` + mini preview | Visual page selector |
| Empty states | Custom illustration + `Button` | Onboarding UI |

#### 3.3 Implementation Steps

1. **PageBuilderTab.tsx:**
   - Three-column layout: Fields | Canvas | Pages
   - Use CSS Grid or Flexbox
   - Responsive breakpoints

2. **FieldTypesPanel.tsx:**
   ```tsx
   <ScrollArea className="h-full">
     <div className="p-4 space-y-2">
       {FIELD_TYPES.map(field => (
         <Button
           key={field.type}
           variant="outline"
           className="w-full justify-start"
           draggable
           onDragStart={...}
         >
           <field.icon className="mr-2 h-4 w-4" />
           {field.label}
         </Button>
       ))}
     </div>
   </ScrollArea>
   ```

3. **CanvasArea.tsx:**
   - Droppable zone with `@dnd-kit`
   - Show drop indicators
   - Handle field insertion/reordering
   - Empty state: "Drop fields here" illustration

4. **PagesPanel.tsx:**
   - Sortable page list
   - Add/Remove/Duplicate page actions
   - Page thumbnails with field count
   - Selected field settings integration

5. **FieldSettingsSheet.tsx:**
   - Use Shadcn `Sheet` from right side
   - Dynamic form based on field type
   - Use `react-hook-form` + `zod` validation
   - Real-time YJS updates on change

#### 3.4 DnD Strategy
```tsx
// DndContext setup
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnd={handleDragEnd}
>
  <FieldTypesPanel />
  <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
    <CanvasArea />
  </SortableContext>
  <PagesPanel />
  <DragOverlay>{renderDragOverlay()}</DragOverlay>
</DndContext>
```

#### 3.5 Key Features to Preserve
- ✅ Drag fields from panel to canvas
- ✅ Reorder fields within page
- ✅ Move fields between pages
- ✅ Duplicate/delete fields
- ✅ Real-time multi-user editing
- ✅ Field validation settings
- ✅ Page management (add/remove/reorder)

---

### Phase 4: Preview Tab Migration 👁️
**Goal:** Simple preview mode with responsive design

#### 4.1 Create Preview Components
```
apps/form-app-v2/src/components/collaborative-builder/
  preview/
    PreviewTab.tsx
    DeviceSelector.tsx (optional)
```

#### 4.2 Implementation Steps

1. **PreviewTab.tsx:**
   ```tsx
   import { FormRenderer } from '@dculus/ui';
   import { RendererMode } from '@dculus/utils';

   export const PreviewTab = () => {
     const { pages, layout } = useFormBuilderStore();
     const cdnEndpoint = import.meta.env.VITE_CDN_ENDPOINT;

     const formSchema = useMemo(
       () => ({ pages, layout, isShuffleEnabled: false }),
       [pages, layout]
     );

     return (
       <div className="h-full overflow-auto">
         <FormRenderer
           formSchema={formSchema}
           cdnEndpoint={cdnEndpoint}
           mode={RendererMode.PREVIEW}
         />
       </div>
     );
   };
   ```

2. **Optional: DeviceSelector:**
   - Add device frame simulation (mobile/tablet/desktop)
   - Use `Tabs` to switch views
   - CSS media query simulation

#### 4.3 Key Features to Preserve
- ✅ Real-time preview updates
- ✅ Full form interaction (no submission)
- ✅ Layout/theme rendering
- ✅ Multi-page navigation

---

### Phase 5: Settings Tab Migration ⚙️
**Goal:** Placeholder with future settings structure

#### 5.1 Create Settings Components
```
apps/form-app-v2/src/components/collaborative-builder/
  settings/
    SettingsTab.tsx
    FormInfoCard.tsx
    SubmissionSettings.tsx (future)
    NotificationSettings.tsx (future)
```

#### 5.2 Implementation Steps

1. **SettingsTab.tsx:**
   ```tsx
   <div className="container mx-auto p-6">
     <Card>
       <CardHeader>
         <CardTitle>Form Settings</CardTitle>
         <CardDescription>Coming soon...</CardDescription>
       </CardHeader>
       <CardContent>
         <FormInfoCard />
       </CardContent>
     </Card>
   </div>
   ```

2. **FormInfoCard.tsx:**
   - Display current form statistics
   - Use `Badge`, `Separator`, `Text` components
   - Show: page count, field count, shuffle status

---

### Phase 6: Navigation & Shared Components 🧭
**Goal:** Tab navigation and shared utilities

#### 6.1 Create Navigation Components
```
apps/form-app-v2/src/components/collaborative-builder/
  navigation/
    TabNavigation.tsx
    FormBuilderHeader.tsx
    CollaborationIndicator.tsx
```

#### 6.2 Shadcn UI Component Mapping

| Old Component | New Shadcn Component | Notes |
|---------------|---------------------|-------|
| TabNavigation | `Tabs` (floating variant) | Bottom floating bar |
| FormBuilderHeader | Custom header + `Breadcrumb` | Top bar with title |
| Collaboration status | `Avatar` + `Tooltip` | User indicators |
| Save indicator | `Badge` with animation | Sync status |

#### 6.3 Implementation Steps

1. **TabNavigation.tsx:**
   ```tsx
   <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
     <Card className="shadow-lg">
       <Tabs value={activeTab} onValueChange={onTabChange}>
         <TabsList className="grid grid-cols-4">
           <TabsTrigger value="layout">
             <Palette className="mr-2 h-4 w-4" />
             Layout
           </TabsTrigger>
           {/* ... other tabs */}
         </TabsList>
       </Tabs>
     </Card>
   </div>
   ```

2. **FormBuilderHeader.tsx:**
   - Use `Breadcrumb` for navigation
   - Show form title (editable)
   - Collaboration indicators (avatars)
   - Back button, share button, publish button

3. **CollaborationIndicator.tsx:**
   - Show connected users (avatars)
   - Show sync status (Badge)
   - Use `Tooltip` for user details

#### 6.4 Keyboard Shortcuts
- Implement with `useEffect` + event listeners
- Shortcuts: `Ctrl+1` (Layout), `Ctrl+2` (Builder), `Ctrl+3` (Preview), `Ctrl+4` (Settings)

---

## Phase 7: Testing & Refinement 🧪

### 7.1 Testing Strategy
1. **Unit Tests:**
   - Store actions (useFormBuilderStore)
   - Component rendering
   - DnD logic

2. **Integration Tests:**
   - Tab navigation
   - Real-time collaboration
   - Field CRUD operations
   - GraphQL mutations

3. **E2E Tests (Playwright):**
   - Complete form building flow
   - Multi-user collaboration
   - Publish and preview

### 7.2 Test Files
```
apps/form-app-v2/src/components/collaborative-builder/
  __tests__/
    LayoutTab.test.tsx
    PageBuilderTab.test.tsx
    PreviewTab.test.tsx
    SettingsTab.test.tsx
    useFormBuilderStore.test.ts
```

### 7.3 Collaboration Testing
- Use two browser windows
- Verify real-time updates
- Test conflict resolution
- Verify YJS sync

---

## Migration Checklist

### ✅ Phase 1: Foundation (Week 1)
- [ ] Install dependencies (yjs, @dnd-kit, zustand)
- [ ] Create `useFormBuilderStore` with YJS integration
- [ ] Create `FormPermissionContext`
- [ ] Create routing structure
- [ ] Add GraphQL queries for form data
- [ ] Set up DnD context providers

### ✅ Phase 2: Layout Tab (Week 2)
- [ ] Create `LayoutTab` component
- [ ] Create `LayoutSidebar` with Shadcn Sheet
- [ ] Implement `LayoutThumbnails` grid
- [ ] Implement `LayoutOptions` (theme, colors, spacing)
- [ ] Implement `BackgroundControls` (upload + Pixabay)
- [ ] Integrate `FormRenderer` with BUILDER mode
- [ ] Test real-time layout updates

### ✅ Phase 3: Page Builder Tab (Week 3-4)
- [ ] Create `PageBuilderTab` layout (3 columns)
- [ ] Create `FieldTypesPanel` with draggable types
- [ ] Create `CanvasArea` with drop zones
- [ ] Create `PagesPanel` with thumbnails
- [ ] Create `FieldSettingsSheet` with forms
- [ ] Implement DnD logic (drag, drop, reorder)
- [ ] Implement field CRUD operations
- [ ] Implement page management
- [ ] Test multi-user collaboration

### ✅ Phase 4: Preview Tab (Week 5)
- [ ] Create `PreviewTab` component
- [ ] Integrate `FormRenderer` with PREVIEW mode
- [ ] Optional: Add device selector
- [ ] Test real-time preview updates

### ✅ Phase 5: Settings Tab (Week 5)
- [ ] Create `SettingsTab` placeholder
- [ ] Create `FormInfoCard`
- [ ] Design future settings structure

### ✅ Phase 6: Navigation (Week 6)
- [ ] Create `TabNavigation` with floating bar
- [ ] Create `FormBuilderHeader`
- [ ] Create `CollaborationIndicator`
- [ ] Implement keyboard shortcuts
- [ ] Add breadcrumb navigation

### ✅ Phase 7: Testing & Polish (Week 7-8)
- [ ] Write unit tests for all components
- [ ] Write integration tests for store
- [ ] Write E2E tests for complete flows
- [ ] Test real-time collaboration
- [ ] Performance optimization
- [ ] Accessibility audit (ARIA labels, keyboard nav)
- [ ] Documentation updates
- [ ] Code review

---

## Design Principles & Standards

### 1. Component Structure
```tsx
// ✅ Good: Functional component with proper typing
export const ComponentName: React.FC<Props> = ({ prop1, prop2 }) => {
  // Hooks at the top
  const store = useFormBuilderStore();
  const [localState, setLocalState] = useState();
  
  // Memoized values
  const computedValue = useMemo(() => {}, [deps]);
  
  // Callbacks
  const handleAction = useCallback(() => {}, [deps]);
  
  // Effects
  useEffect(() => {}, [deps]);
  
  // Render
  return <div>...</div>;
};
```

### 2. Import Pattern
```tsx
// External packages
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@apollo/client';

// Shadcn UI from shared package
import { Button, Card, Sheet, Tabs } from '@dculus/ui-v2';

// Shared packages
import { FormField, FormLayout } from '@dculus/types';
import { RendererMode, generateId } from '@dculus/utils';
import { FormRenderer } from '@dculus/ui';

// Local imports
import { useFormBuilderStore } from '@/store/useFormBuilderStore';
import { LayoutThumbnails } from './LayoutThumbnails';
```

### 3. Styling Guidelines
- Use Tailwind utility classes
- Follow Shadcn design tokens
- Responsive design (mobile-first)
- Dark mode support
- Use `cn()` helper for conditional classes

```tsx
<Card className={cn(
  "p-6 border-2 transition-colors",
  isActive && "border-primary bg-primary/5",
  isDisabled && "opacity-50 pointer-events-none"
)}>
```

### 4. State Management Rules
- Use Zustand for global state (form builder)
- Use React state for local UI state
- Use YJS for collaborative state
- Avoid prop drilling (use context for deep props)

### 5. Performance Optimization
- Memoize expensive computations
- Use `React.memo` for pure components
- Virtualize long lists (field panel, pages)
- Debounce/throttle frequent updates
- Lazy load heavy components (Pixabay modal)

---

## Dependencies & Compatibility

### Required Packages (form-app-v2)
```json
{
  "dependencies": {
    "@apollo/client": "^3.13.8",
    "@dculus/types": "workspace:*",
    "@dculus/ui": "workspace:*",
    "@dculus/ui-v2": "workspace:*",
    "@dculus/utils": "workspace:*",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@hocuspocus/provider": "^2.13.5",
    "yjs": "^13.6.18",
    "zustand": "^5.0.2",
    "react-hook-form": "7.62.0",
    "zod": "4.1.12"
  }
}
```

### Environment Variables
```env
VITE_API_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/collaboration
VITE_CDN_ENDPOINT=http://localhost:4000/static-files
```

---

## Risk Mitigation

### 1. Real-Time Collaboration Breakage
**Risk:** YJS integration might break during migration
**Mitigation:**
- Copy YJS logic exactly from V1
- Test with multiple users immediately
- Keep V1 running for comparison testing
- Use feature flags for gradual rollout

### 2. Performance Degradation
**Risk:** V2 might be slower than V1
**Mitigation:**
- Profile with React DevTools
- Implement virtualization early
- Monitor bundle size
- Use code splitting for tabs

### 3. UI/UX Inconsistencies
**Risk:** V2 might feel different from V1
**Mitigation:**
- Reference Shadcn registry examples
- Get design review from stakeholders
- A/B testing with users
- Maintain feature parity

### 4. Data Loss During Migration
**Risk:** Users might lose work if switching apps
**Mitigation:**
- Both apps use same backend (no data migration needed)
- YJS documents are backend-agnostic
- Test data integrity thoroughly

---

## Success Criteria

### Functional Requirements ✅
- [ ] All 4 tabs functional (Layout, Builder, Preview, Settings)
- [ ] Real-time collaboration works with multiple users
- [ ] Drag-and-drop field creation/reordering
- [ ] Layout customization (themes, colors, backgrounds)
- [ ] Form preview with live updates
- [ ] Page management (add/remove/reorder)
- [ ] Field settings panel (validation, options, etc.)
- [ ] Keyboard shortcuts working
- [ ] GraphQL integration for form data

### Non-Functional Requirements ✅
- [ ] TypeScript strict mode (no `any`)
- [ ] 100% test coverage for critical paths
- [ ] Lighthouse score > 90
- [ ] Bundle size < 500KB (gzipped)
- [ ] First Contentful Paint < 2s
- [ ] Accessibility WCAG 2.1 AA compliant
- [ ] Mobile responsive (320px - 1920px)
- [ ] Dark mode support

### User Experience ✅
- [ ] Smooth animations (60fps)
- [ ] Intuitive drag-and-drop
- [ ] Clear visual feedback
- [ ] Helpful empty states
- [ ] Consistent with Shadcn design system
- [ ] Fast perceived performance

---

## Timeline Estimate

| Phase | Duration | Tasks | Complexity |
|-------|----------|-------|------------|
| Phase 1: Foundation | 1 week | Store, routing, contexts | Medium |
| Phase 2: Layout Tab | 1 week | Layout UI, sidebar, Pixabay | Medium |
| Phase 3: Page Builder | 2 weeks | DnD, canvas, field settings | High |
| Phase 4: Preview Tab | 3 days | Simple renderer integration | Low |
| Phase 5: Settings Tab | 2 days | Placeholder UI | Low |
| Phase 6: Navigation | 1 week | Header, tab nav, shortcuts | Medium |
| Phase 7: Testing | 2 weeks | Unit, integration, E2E tests | High |

**Total Estimated Time:** 7-8 weeks (1 developer, full-time)

---

## Next Steps

1. **Review & Approval:** Get stakeholder sign-off on this plan
2. **Environment Setup:** Ensure `form-app-v2` has all dependencies
3. **Start Phase 1:** Begin with foundation infrastructure
4. **Daily Standups:** Track progress and blockers
5. **Weekly Demos:** Show progress to team
6. **Documentation:** Update as we go, not at the end

---

## References

### Key Documentation
- [Copilot Instructions](/.github/copilot-instructions.md) - Architecture guidelines
- [form-app-v2 README](/apps/form-app-v2/README.md) - V2 setup and structure
- [RENDERER_MODE_CHANGES.md](/RENDERER_MODE_CHANGES.md) - Layout mode patterns
- [Shadcn UI Docs](https://ui.shadcn.com/) - Component reference

### Key Files to Reference
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`
- `apps/form-app/src/store/useFormBuilderStore.ts`
- `apps/form-app/src/components/form-builder/tabs/*`
- `packages/ui-v2/src/components/*`

### GraphQL Endpoints
- `GET_FORM_BY_ID` - Fetch form data
- `UPDATE_FORM` - Save changes (if needed beyond YJS)

---

**Document Version:** 1.0  
**Created:** 2025-01-26  
**Author:** AI Assistant (GitHub Copilot)  
**Status:** Draft - Awaiting Review
