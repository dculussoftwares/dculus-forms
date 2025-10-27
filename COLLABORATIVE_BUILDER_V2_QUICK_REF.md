# Collaborative Form Builder V2 - Quick Reference

## Component Hierarchy

```
CollaborativeFormBuilder (Main Entry)
├── FormBuilderHeader
│   ├── Breadcrumb Navigation
│   ├── Form Title (editable)
│   ├── Collaboration Indicators
│   └── Action Buttons (Share, Publish, Back)
│
├── Tab Content (Dynamic)
│   ├── LayoutTab
│   │   ├── FormRenderer (BUILDER mode)
│   │   └── LayoutSidebar
│   │       ├── LayoutThumbnails (L1-L9)
│   │       ├── LayoutOptions (Theme, Colors, Spacing)
│   │       └── BackgroundControls (Upload + Pixabay)
│   │
│   ├── PageBuilderTab
│   │   ├── FieldTypesPanel (Left Sidebar)
│   │   │   └── Draggable Field Types
│   │   ├── CanvasArea (Center)
│   │   │   ├── DroppablePages
│   │   │   └── DraggableFields
│   │   └── PagesPanel (Right Sidebar)
│   │       ├── Page Thumbnails
│   │       └── FieldSettingsSheet
│   │
│   ├── PreviewTab
│   │   └── FormRenderer (PREVIEW mode)
│   │
│   └── SettingsTab
│       └── FormInfoCard (Coming Soon)
│
└── TabNavigation (Floating Bottom)
    └── Tabs: Layout | Builder | Preview | Settings
```

## State Flow

```
User Action → Zustand Store → YJS Document → Hocuspocus Server → Other Users
                    ↓
                React Re-render
```

## Shadcn UI Component Mapping

| Section | Old Pattern | New Shadcn Components |
|---------|-------------|----------------------|
| **Layout Tab** |
| Sidebar | Custom div | `Sheet` or `Sidebar` |
| Layout cards | Custom cards | `Card` + `AspectRatio` |
| Color picker | Input | `Popover` + `Input` |
| Theme toggle | Custom | `ToggleGroup` or `Tabs` |
| Image modal | Custom modal | `Dialog` + `ScrollArea` |
| **Page Builder** |
| Field types | Custom list | `ScrollArea` + `Button` |
| Canvas | Custom div | `Card` with DnD zones |
| Pages sidebar | Custom | `Sheet` or fixed sidebar |
| Field settings | Custom panel | `Sheet` with `Form` |
| Page cards | Custom | `Card` + hover effects |
| Empty states | Custom | Illustration + `Button` |
| **Navigation** |
| Tab bar | Custom | `Tabs` (floating variant) |
| Header | Custom | `Breadcrumb` + buttons |
| User avatars | Custom | `Avatar` + `Tooltip` |
| Sync badge | Custom | `Badge` with animation |

## File Structure (form-app-v2)

```
apps/form-app-v2/src/
├── components/
│   └── collaborative-builder/
│       ├── layout/
│       │   ├── LayoutTab.tsx
│       │   ├── LayoutSidebar.tsx
│       │   ├── LayoutThumbnails.tsx
│       │   ├── LayoutOptions.tsx
│       │   ├── BackgroundControls.tsx
│       │   └── PixabayBrowser.tsx
│       │
│       ├── page-builder/
│       │   ├── PageBuilderTab.tsx
│       │   ├── FieldTypesPanel.tsx
│       │   ├── CanvasArea.tsx
│       │   ├── PagesPanel.tsx
│       │   ├── FieldSettingsSheet.tsx
│       │   ├── DroppableField.tsx
│       │   └── DraggableFieldType.tsx
│       │
│       ├── preview/
│       │   ├── PreviewTab.tsx
│       │   └── DeviceSelector.tsx (optional)
│       │
│       ├── settings/
│       │   ├── SettingsTab.tsx
│       │   └── FormInfoCard.tsx
│       │
│       └── navigation/
│           ├── TabNavigation.tsx
│           ├── FormBuilderHeader.tsx
│           └── CollaborationIndicator.tsx
│
├── store/
│   └── useFormBuilderStore.ts (with YJS integration)
│
├── contexts/
│   └── FormPermissionContext.tsx
│
├── hooks/
│   ├── useDragAndDrop.ts
│   ├── useCollisionDetection.ts
│   ├── useFieldCreation.ts
│   └── useFormPermissions.ts
│
├── graphql/
│   └── formBuilder.ts (queries & mutations)
│
└── pages/
    └── CollaborativeFormBuilder.tsx
```

## Key Dependencies

```json
{
  "yjs": "^13.6.18",
  "@hocuspocus/provider": "^2.13.5",
  "zustand": "^5.0.2",
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dculus/ui-v2": "workspace:*",
  "@dculus/types": "workspace:*",
  "@dculus/utils": "workspace:*"
}
```

## Migration Priority

1. **HIGH PRIORITY** (Core functionality)
   - ✅ Page Builder Tab (field CRUD, DnD)
   - ✅ useFormBuilderStore (real-time sync)
   - ✅ Layout Tab (visual design)
   - ✅ TabNavigation (tab switching)

2. **MEDIUM PRIORITY** (Enhanced UX)
   - ✅ Preview Tab (form preview)
   - ✅ FormBuilderHeader (collaboration status)
   - ✅ FieldSettingsSheet (field customization)

3. **LOW PRIORITY** (Nice to have)
   - ✅ Settings Tab (future features)
   - ✅ Device selector (responsive preview)
   - ✅ Keyboard shortcuts

## Testing Strategy

| Type | Coverage | Tools |
|------|----------|-------|
| Unit | 80%+ | Jest + React Testing Library |
| Integration | Critical paths | Apollo MockProvider |
| E2E | Complete flows | Playwright + Cucumber |
| Collaboration | Multi-user | Manual (2 browsers) |

## Critical Success Factors

1. ✅ **Real-time collaboration must work flawlessly**
   - Use same YJS/Hocuspocus setup as V1
   - Test with 5+ concurrent users
   - Verify conflict resolution

2. ✅ **Shadcn UI design consistency**
   - Follow Shadcn registry examples
   - Use design tokens from ui-v2
   - Maintain dark mode support

3. ✅ **Performance targets**
   - < 2s initial load
   - 60fps drag-and-drop
   - < 100ms real-time sync

4. ✅ **Accessibility compliance**
   - WCAG 2.1 AA
   - Keyboard navigation
   - Screen reader support

## Quick Start Commands

```bash
# Install dependencies
cd apps/form-app-v2
pnpm add yjs @hocuspocus/provider zustand @dnd-kit/core @dnd-kit/sortable

# Start development
pnpm form-app-v2:dev

# Run tests
pnpm --filter form-app-v2 test

# Build for production
pnpm form-app-v2:build
```

## Useful Links

- [Full Migration Plan](./COLLABORATIVE_FORM_BUILDER_V2_MIGRATION_PLAN.md)
- [Shadcn UI Components](https://ui.shadcn.com/docs/components)
- [YJS Documentation](https://docs.yjs.dev/)
- [DnD Kit Docs](https://docs.dndkit.com/)

---

**Last Updated:** 2025-01-26
