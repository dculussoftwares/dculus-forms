# Collaborative Form Builder Migration - Summary

**Document**: `COLLABORATIVE_BUILDER_MIGRATION.md` (2,975 lines)
**Created**: 2025-01-27
**Status**: Planning Complete

## Overview

Comprehensive migration plan for moving the collaborative form builder from form-app (V1) to form-app-v2 (V2), following modern design patterns with Shadcn UI and resizable panels.

## Key Decisions

✅ **Create new V2 store** - Modern, type-safe implementation
✅ **Resizable panels** - VS Code-style workspace  
✅ **Hide main sidebar** - Full-screen builder experience
✅ **Phased migration** - Page Builder + Preview first, then Layout, then Settings

## Document Structure

1. **Executive Summary** - What, why, and high-level architecture
2. **Current State Analysis** - Detailed breakdown of form-app implementation
3. **Target Architecture** - V2 design principles and structure
4. **Migration Phases** - Step-by-step implementation plan (3 phases)
5. **Component Specifications** - Detailed specs for all components
6. **Technical Implementation** - Store, YJS, drag-drop, GraphQL integration
7. **File Structure** - Complete directory tree (~30 new files)
8. **Testing Strategy** - Unit, integration, E2E tests
9. **User Flow Diagrams** - Visual workflows
10. **Success Criteria** - Acceptance tests and requirements
11. **Migration Checklist** - Step-by-step checklist for implementation
12. **Risk Assessment** - Risks and mitigation strategies
13. **References** - Internal and external documentation links

## Timeline

| Phase | Duration | Lines of Code |
|-------|----------|---------------|
| Phase 1: Page Builder + Preview | 3-4 days | ~2,500 lines |
| Phase 2: Layout Tab | 1-2 days | ~800 lines |
| Phase 3: Settings Placeholder | 0.5 day | ~100 lines |
| Testing & Polish | 1 day | ~500 lines |
| **Total** | **5-7 days** | **~3,900 lines** |

## Critical Sections

**Must Read Before Starting**:
- Section 2: Current State Analysis (understand existing implementation)
- Section 4: Migration Phases (follow step-by-step)
- Section 6: Technical Implementation (YJS, serialization, drag-drop)
- Section 11: Migration Checklist (track progress)

**Reference During Implementation**:
- Section 5: Component Specifications
- Section 7: File Structure
- Section 8: Testing Strategy

## Key Technical Points

### YJS Collaboration (CRITICAL)
- **Preserve CollaborationManager class exactly** from form-app
- Do NOT modify core observer setup logic
- Test real-time sync thoroughly with 2+ users

### Imports
- **UI**: `@dculus/ui-v2` (V2 components only)
- **Types**: `@dculus/types` (shared)
- **Utils**: `@dculus/utils` (shared)
- **Legacy**: `FormRenderer` from `@dculus/ui` (temporary until migrated)

### Dependencies to Install
```bash
# In packages/ui-v2
npx shadcn@latest add resizable form toggle-group popover context-menu

# In apps/form-app-v2
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
pnpm add yjs @hocuspocus/provider
pnpm add react-json-view  # optional
```

## Next Steps

1. ✅ Review complete migration documentation
2. ⏳ Install dependencies (Shadcn components + npm packages)
3. ⏳ Create store (copy from form-app, update for V2)
4. ⏳ Implement Phase 1 (Page Builder + Preview)
5. ⏳ Test collaboration with 2+ users
6. ⏳ Implement Phase 2 (Layout Tab)
7. ⏳ Implement Phase 3 (Settings Tab)
8. ⏳ Final testing and polish

## Quick Start

```bash
# 1. Add Shadcn components
cd packages/ui-v2
npx shadcn@latest add resizable form toggle-group popover context-menu
cd ../..
pnpm --filter @dculus/ui-v2 build

# 2. Install dependencies
cd apps/form-app-v2
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities yjs @hocuspocus/provider

# 3. Start implementation following Phase 1 checklist (Section 11.2)
```

## Success Criteria (Phase 1)

- [ ] Users can add/edit/delete pages and fields
- [ ] Drag & drop works smoothly
- [ ] Real-time collaboration syncs < 1 second
- [ ] Preview updates in real-time
- [ ] All permission levels enforced
- [ ] No memory leaks or performance issues

## Documentation Links

- **Full Migration Guide**: `./COLLABORATIVE_BUILDER_MIGRATION.md`
- **Project Docs**: `../../CLAUDE.md`
- **UI V2 Guide**: `../../../packages/ui-v2/README.md`

---

**Ready to Start Migration** ✅

Follow the migration checklist in Section 11 of the main document.
