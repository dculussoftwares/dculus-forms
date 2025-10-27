# Migration Architecture Diagram

## Current State (form-app) vs Target State (form-app-v2)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FORM-APP (V1) - Current                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ CollaborativeFormBuilder.tsx (349 lines)                       │   │
│  │                                                                 │   │
│  │  • DndContext Provider                                         │   │
│  │  • Tab Routing Logic                                           │   │
│  │  • useFormBuilderStore (Zustand + YJS)                        │   │
│  │  • Drag & Drop Handlers                                        │   │
│  └────────────────────────────────────────────────────────────────┘   │
│          │                                                              │
│          ├──► LayoutTab                                                 │
│          │    └─► LayoutSidebar (custom components)                    │
│          │                                                              │
│          ├──► PageBuilderTab                                           │
│          │    ├─► FieldTypesPanel (custom)                            │
│          │    ├─► DroppablePage (custom)                              │
│          │    └─► PagesSidebar (custom)                               │
│          │                                                              │
│          ├──► PreviewTab                                               │
│          │    └─► FormRenderer (@dculus/ui)                           │
│          │                                                              │
│          └──► SettingsTab                                              │
│               └─► Coming Soon Card                                     │
│                                                                          │
│  Components: Custom CSS, Inline Styles, Mixed Patterns                  │
│  UI Library: None (custom components)                                   │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                      FORM-APP-V2 (V2) - Target State                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ CollaborativeFormBuilder.tsx (NEW)                             │   │
│  │                                                                 │   │
│  │  • Same YJS/Hocuspocus Logic                                   │   │
│  │  • Same Store Architecture                                     │   │
│  │  • Same Tab Routing                                            │   │
│  │  • Cleaner Component Structure                                 │   │
│  └────────────────────────────────────────────────────────────────┘   │
│          │                                                              │
│          ├──► LayoutTab                                                 │
│          │    └─► LayoutSidebar (Sheet/Sidebar from ui-v2)            │
│          │         ├─► LayoutThumbnails (Card + AspectRatio)          │
│          │         ├─► LayoutOptions (Popover + ToggleGroup)          │
│          │         └─► BackgroundControls (Dialog + ScrollArea)       │
│          │                                                              │
│          ├──► PageBuilderTab                                           │
│          │    ├─► FieldTypesPanel (ScrollArea + Button)               │
│          │    ├─► CanvasArea (Card with DnD zones)                    │
│          │    └─► PagesPanel (Sheet with thumbnails)                  │
│          │         └─► FieldSettingsSheet (Sheet + Form)              │
│          │                                                              │
│          ├──► PreviewTab                                               │
│          │    └─► FormRenderer (@dculus/ui) - same as V1              │
│          │                                                              │
│          └──► SettingsTab                                              │
│               └─► FormInfoCard (Card + Badge)                          │
│                                                                          │
│  Components: Shadcn UI (@dculus/ui-v2)                                  │
│  UI Library: Radix UI primitives, Tailwind CSS                          │
│  Design System: Consistent, Accessible, Modern                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Real-Time Collaboration Architecture (Preserved)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Real-Time Collaboration Flow                         │
└─────────────────────────────────────────────────────────────────────────┘

  User A (Browser 1)              Backend Server              User B (Browser 2)
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │              │              │              │              │              │
  │  Zustand     │              │  Hocuspocus  │              │  Zustand     │
  │  Store       │              │  WebSocket   │              │  Store       │
  │              │              │  Server      │              │              │
  │  ┌────────┐  │              │              │              │  ┌────────┐  │
  │  │ Y.Doc  │◄─┼──WebSocket──┤  Y.Doc Store ├──WebSocket──►│  │ Y.Doc  │  │
  │  │        │  │              │  (MongoDB)   │              │  │        │  │
  │  └────────┘  │              │              │              │  └────────┘  │
  │      ▲       │              │              │              │      ▲       │
  │      │       │              │              │              │      │       │
  │      ▼       │              │              │              │      ▼       │
  │  React UI    │              │              │              │  React UI    │
  │              │              │              │              │              │
  └──────────────┘              └──────────────┘              └──────────────┘

  1. User A adds field → Zustand updates → YJS sync → Hocuspocus broadcasts
  2. User B receives update → YJS merges → Zustand updates → React re-renders
  3. CRITICAL: This flow MUST remain identical in V2
```

## Data Flow Comparison

### Form-App (V1)
```
GraphQL Query → Form Data → useFormBuilderStore (Zustand) → YJS Doc
                                      ↓
                            Pages, Layout, Fields
                                      ↓
                            Custom Components
                                      ↓
                            User Sees Form
```

### Form-App-V2 (Target)
```
GraphQL Query → Form Data → useFormBuilderStore (Zustand) → YJS Doc
                                      ↓
                            Pages, Layout, Fields
                                      ↓
                            Shadcn UI Components
                                      ↓
                            User Sees Form (Better UX)
```

**Key Insight:** Data flow is identical, only UI layer changes!

## Component Dependency Graph

```
CollaborativeFormBuilder
  │
  ├─ useFormBuilderStore (Zustand + YJS)
  │   ├─ Y.Doc (YJS document)
  │   ├─ HocuspocusProvider (WebSocket)
  │   └─ Zustand state (pages, layout, selectedPageId, etc.)
  │
  ├─ FormPermissionContext
  │   └─ User permission level (VIEWER/EDITOR/OWNER)
  │
  ├─ DndContext (@dnd-kit)
  │   ├─ Sensors (pointer, keyboard)
  │   ├─ Collision detection
  │   └─ Drag handlers
  │
  ├─ FormBuilderHeader
  │   ├─ Breadcrumb (ui-v2)
  │   ├─ Collaboration indicators
  │   └─ Action buttons
  │
  ├─ Tab Components (dynamic)
  │   ├─ LayoutTab → FormRenderer + Sidebar
  │   ├─ PageBuilderTab → 3-column layout
  │   ├─ PreviewTab → FormRenderer
  │   └─ SettingsTab → InfoCard
  │
  └─ TabNavigation
      └─ Tabs (ui-v2)
```

## Migration Phases Timeline

```
Week 1: Foundation
│
├─ Install dependencies
├─ Create store structure
├─ Setup routing
└─ GraphQL queries
    │
    ▼
Week 2: Layout Tab
│
├─ LayoutTab component
├─ LayoutSidebar (Shadcn)
├─ Layout thumbnails
├─ Theme options
└─ Background controls
    │
    ▼
Week 3-4: Page Builder
│
├─ PageBuilderTab layout
├─ FieldTypesPanel
├─ CanvasArea with DnD
├─ PagesPanel
├─ FieldSettingsSheet
└─ Test collaboration
    │
    ▼
Week 5: Preview + Settings
│
├─ PreviewTab (simple)
└─ SettingsTab (placeholder)
    │
    ▼
Week 6: Navigation
│
├─ TabNavigation
├─ FormBuilderHeader
├─ Collaboration indicators
└─ Keyboard shortcuts
    │
    ▼
Week 7-8: Testing & Polish
│
├─ Unit tests
├─ Integration tests
├─ E2E tests
├─ Performance optimization
└─ Accessibility audit
    │
    ▼
  LAUNCH 🚀
```

## Risk Matrix

```
                 │ High Impact │ Medium Impact │ Low Impact │
─────────────────┼─────────────┼───────────────┼────────────┤
High Probability │ YJS Sync ⚠️  │ Performance   │ UI Polish  │
                 │ DnD Logic ⚠️ │               │            │
─────────────────┼─────────────┼───────────────┼────────────┤
Medium Prob.     │ Data Loss   │ Accessibility │ Dark Mode  │
                 │             │ Keyboard Nav  │            │
─────────────────┼─────────────┼───────────────┼────────────┤
Low Probability  │ Security    │ i18n          │ Animations │
                 │             │               │            │
```

**Focus on:** High Impact + High Probability items first!

## Success Metrics

### Technical Metrics
```
Metric                    Target        Current (V1)    Status
────────────────────────────────────────────────────────────
Bundle Size (gzipped)     < 500KB       ~450KB          ✅
First Contentful Paint    < 2s          ~2.5s           ⚠️
Time to Interactive       < 3s          ~3.2s           ⚠️
Lighthouse Score          > 90          85              ⚠️
Test Coverage             > 80%         ~60%            ⚠️
TypeScript Strict         Yes           Partial         ⚠️
```

### User Experience Metrics
```
Metric                    Target        Measurement
────────────────────────────────────────────────────
Drag & Drop Smoothness    60fps         Chrome DevTools
Real-time Sync Latency    < 100ms       Network tab
Keyboard Navigation       100%          Manual test
Screen Reader Support     WCAG AA       axe DevTools
Mobile Usability          100%          Lighthouse
```

## Shadcn Component Checklist

### Already Available in @dculus/ui-v2
- [x] Avatar
- [x] Badge
- [x] Breadcrumb
- [x] Button
- [x] Card
- [x] Dialog
- [x] Dropdown Menu
- [x] Input
- [x] Label
- [x] Popover
- [x] Scroll Area
- [x] Select
- [x] Separator
- [x] Sheet
- [x] Sidebar
- [x] Skeleton
- [x] Tabs
- [x] Toast
- [x] Toggle
- [x] Tooltip

### May Need to Add
- [ ] Aspect Ratio (for layout thumbnails)
- [ ] Form (for field settings)
- [ ] Radio Group (for options)
- [ ] Switch (for toggles)
- [ ] Slider (for range inputs)

---

**Document Version:** 1.0  
**Created:** 2025-01-26
