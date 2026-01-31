# Drag & Drop Enhancement Roadmap
**Premium UX Implementation - Phased Approach**

---

## 🎯 Core Design Principles

### Real-time Collaboration Strategy
- ✅ **Local animations during drag**: Instant visual feedback (60fps)
- ✅ **YJS sync only on drop**: Atomic, reliable state updates
- ❌ **No intermediate syncing**: Prevents network spam and jitter for remote users

### Quality Standards
- All changes must be backwards compatible
- Each phase independently testable
- No phase proceeds without manual testing approval
- Performance target: 60fps with 100+ fields
- Accessibility: WCAG 2.1 AA compliance

---

## 📋 Current State Analysis

### ✅ What's Working
- Basic drag start/end handlers
- Field type drops from sidebar
- Within-page field reordering
- Cross-page field moves (via drag to page area or thumbnails)
- Page reordering in sidebar
- Visual drag overlay (CompactFieldCard with `rotate-2`)
- YJS integration (updates on `handleDragEnd`)

### ⚠️ Current Gaps
1. **Empty `handleDragOver`** - No real-time visual feedback during drag
2. **Static layout** - Items don't slide to show insertion point
3. **Basic drop indicators** - Thin bars instead of animated displacement
4. **Mouse-only** - No keyboard sensor (accessibility gap)
5. **Default auto-scroll** - Not tuned for smooth experience
6. **No touch optimization** - Potential conflicts with scroll on mobile

---

## 🚀 Implementation Phases

### **Phase 1A: Foundation - Shadow State Setup**
**Status**: 🔵 Ready to Start  
**Goal**: Introduce temporary drag state infrastructure  
**Risk**: 🟢 Low (additive only)  
**Estimated Time**: 20-30 minutes

#### Changes
- Add `localFieldOrder` state map in `useDragAndDrop.ts`
  ```typescript
  // Structure: { [pageId: string]: FormField[] }
  const [localFieldOrder, setLocalFieldOrder] = useState<Record<string, FormField[]>>({});
  ```
- Initialize on `handleDragStart`
- Clear on `handleDragEnd` and `handleDragCancel`
- **NO UI changes** - pure state setup

#### Files Modified
- `apps/form-app/src/hooks/useDragAndDrop.ts`

#### Testing Checklist
- [ ] Existing drag-drop still works identically
- [ ] No console errors or warnings
- [ ] State resets properly after drop
- [ ] State clears on ESC/cancel
- [ ] Multi-user collaboration unaffected
- [ ] YJS updates still work correctly

#### Acceptance Criteria
- All existing tests pass
- Manual drag-drop flow unchanged from user perspective
- State structure properly typed
- No memory leaks (state clears on unmount)

---

### **Phase 1B: Real-time handleDragOver Logic**
**Status**: ⏸️ Awaiting 1A Approval  
**Goal**: Calculate optimal insertion point during drag  
**Risk**: 🟡 Medium (core logic change)  
**Estimated Time**: 45-60 minutes

#### Changes
- Implement collision detection in `handleDragOver`
- Calculate insertion index based on cursor position
- Update `localFieldOrder` to reflect hover position
- Handle edge cases:
  - Empty pages
  - First/last positions
  - Cross-page boundaries
  - Same-position hovers (no-op)

#### Technical Approach
```typescript
const handleDragOver = useCallback((event: DragOverEvent) => {
  const { active, over } = event;
  
  if (!over || !active.data.current) return;
  
  const activeData = active.data.current;
  const overData = over.data.current;
  
  // Calculate insertion point
  if (activeData?.type === 'field' && overData?.type === 'field') {
    const sourcePageId = activeData.pageId;
    const targetPageId = overData.pageId;
    const targetPage = pages.find(p => p.id === targetPageId);
    
    if (!targetPage) return;
    
    // Find insertion index
    const overIndex = targetPage.fields.findIndex(f => f.id === over.id);
    const activeField = activeData.field;
    
    // Build shadow order
    const newOrder = [...targetPage.fields];
    // ... reordering logic
    
    setLocalFieldOrder(prev => ({
      ...prev,
      [targetPageId]: newOrder
    }));
  }
}, [pages]);
```

#### Files Modified
- `apps/form-app/src/hooks/useDragAndDrop.ts`

#### Testing Checklist
- [ ] Console logs show correct insertion indices
- [ ] Handles drag over empty page correctly
- [ ] Handles first position insertion
- [ ] Handles last position insertion
- [ ] Cross-page drag calculations correct
- [ ] Same-page reordering calculations correct
- [ ] No interference with `handleDragEnd`
- [ ] Performance: no lag during rapid mouse movement

#### Acceptance Criteria
- Insertion index always accurate (verify via console logs)
- No errors when dragging to edge cases
- Shadow state updates at 60fps
- Drop still commits to correct final position

---

### **Phase 1C: Connect Shadow State to UI**
**Status**: ⏸️ Awaiting 1B Approval  
**Goal**: Render fields using shadow order during drag  
**Risk**: 🟡 Medium (visual changes)  
**Estimated Time**: 60-90 minutes

#### Changes
- Export `localFieldOrder` from `useDragAndDrop` hook
- Pass through `CollaborativeFormBuilder` to `DroppablePage`
- Update `DroppablePage` to use shadow order when dragging:
  ```typescript
  const displayFields = isDragging && localFieldOrder?.[page.id] 
    ? localFieldOrder[page.id] 
    : page.fields;
  ```
- Add CSS transitions for smooth sliding:
  ```css
  .draggable-field {
    transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
  }
  ```

#### Files Modified
- `apps/form-app/src/hooks/useDragAndDrop.ts` (export state)
- `apps/form-app/src/components/form-builder/DroppablePage.tsx` (consume state)
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` (pass props)

#### Testing Checklist
- [ ] Fields slide smoothly when dragging over them
- [ ] Correct insertion point visually shown
- [ ] No flickering or layout jumps
- [ ] Drop commits to YJS correctly
- [ ] Shadow state clears after drop
- [ ] Shadow state clears on cancel (ESC)
- [ ] Cross-page moves show preview correctly
- [ ] Performance: 60fps during drag
- [ ] No "double rendering" or ghost elements

#### Acceptance Criteria
- Smooth, physical-feeling reordering animation
- Final drop position matches preview
- No visual artifacts or glitches
- Multi-user: remote users see change only after drop

---

### **Phase 1D: Enhanced DragOverlay Visuals**
**Status**: ⏸️ Awaiting 1C Approval  
**Goal**: Premium "lift" effect when dragging  
**Risk**: 🟢 Low (cosmetic only)  
**Estimated Time**: 30-45 minutes

#### Changes
- Add elevation shadow to overlay:
  ```tsx
  <div className="shadow-2xl ring-4 ring-blue-500/20">
    <CompactFieldCard field={field} variant="overlay" />
  </div>
  ```
- Subtle scale-up (1.03x) on drag start
- Ensure cursor offset accuracy via `cursorOffset` prop
- Smooth opacity fade-in (0 → 90%) on lift

#### Design Specifications
- **Shadow**: `shadow-2xl` (large elevation)
- **Ring**: 4px blue glow at 20% opacity
- **Scale**: 1.03x (subtle lift perception)
- **Opacity**: 90% (shows depth vs background)
- **Cursor offset**: Preserved from grab point

#### Files Modified
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx` (`renderDragOverlay`)
- `apps/form-app/src/components/form-builder/CompactFieldCard.tsx` (optional: add `elevation` variant)

#### Testing Checklist
- [ ] Overlay matches item dimensions exactly
- [ ] Shadow creates clear depth perception
- [ ] Cursor grabs item at correct relative position
- [ ] Scale-up is subtle (not jarring)
- [ ] Opacity allows seeing underneath
- [ ] Works across all field types
- [ ] No performance impact
- [ ] Looks good in dark mode

#### Acceptance Criteria
- Visual polish feels "premium"
- Cursor alignment pixel-perfect
- No layout shift on drag start
- Smooth transitions (no "pop-in")

---

### **Phase 1E: Auto-Scroll Configuration**
**Status**: ⏸️ Awaiting 1D Approval  
**Goal**: Smooth edge scrolling for large forms  
**Risk**: 🟢 Low (configuration only)  
**Estimated Time**: 30-45 minutes

#### Changes
- Configure `autoScroll` prop in `DndContext`:
  ```tsx
  <DndContext
    autoScroll={{
      threshold: { x: 0.2, y: 0.2 }, // Activate at 20% from edge
      acceleration: 5, // Scroll speed multiplier
      interval: 5, // Update every 5ms (smooth)
    }}
  >
  ```
- Adjust activation thresholds (50px from edge)
- Tune scroll speed curves for "easing" feel
- Handle nested scroll containers (sidebar vs main area)

#### Technical Details
- **Threshold**: Percentage of container size from edge
- **Acceleration**: Multiplier for scroll speed (5-10 ideal)
- **Interval**: Frame rate for scroll updates (5ms = 200fps)
- **Nested containers**: Ensure both sidebar and main area scroll

#### Files Modified
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`

#### Testing Checklist
- [ ] Scrolls smoothly when near top edge
- [ ] Scrolls smoothly when near bottom edge
- [ ] Scrolls in sidebar when dragging pages
- [ ] Scrolls in main area when dragging fields
- [ ] Stops scrolling when cursor moves away
- [ ] No jerky movements
- [ ] Scroll speed feels natural (not too fast/slow)
- [ ] Performance: maintains 60fps while scrolling

#### Acceptance Criteria
- Auto-scroll feels "magnetic" and predictable
- Works in all scroll containers
- No performance degradation
- Speed tuned to user expectations

---

### **Phase 2A: Keyboard Sensor Integration**
**Status**: ⏸️ Awaiting Phase 1 Completion  
**Goal**: Enable keyboard-only drag-and-drop (WCAG compliance)  
**Risk**: 🟡 Medium (new interaction pattern)  
**Estimated Time**: 60-90 minutes

#### Changes
- Add `KeyboardSensor` to `DndContext`:
  ```tsx
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  ```
- Configure activation keys:
  - `Space` or `Enter`: Pick up item
  - `Arrow Up/Down`: Move within list
  - `Space` or `Enter`: Drop item
  - `ESC`: Cancel drag
- Add screen reader announcements:
  ```typescript
  announcer.announce(`Picked up ${field.label}. Use arrow keys to move.`);
  ```

#### Accessibility Requirements
- Visible focus indicators (2px blue outline)
- Screen reader announces drag state
- Logical tab order maintained
- No keyboard traps
- Instructions visible on focus

#### Files Modified
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`
- `apps/form-app/src/components/form-builder/DraggableField.tsx` (keyboard hints)

#### Testing Checklist
- [ ] Tab navigates to fields
- [ ] Space activates drag mode
- [ ] Arrow up moves item up
- [ ] Arrow down moves item down
- [ ] Enter/Space drops item
- [ ] ESC cancels and returns focus
- [ ] Screen reader announces state changes
- [ ] Visible focus indicator at all times
- [ ] No focus loss during drag
- [ ] Works with NVDA/JAWS/VoiceOver

#### Acceptance Criteria
- WCAG 2.1 Level AA compliant
- Keyboard-only users can perform all drag operations
- Clear auditory and visual feedback
- No accessibility regressions

---

### **Phase 2B: Cross-Page Keyboard Navigation**
**Status**: ⏸️ Awaiting 2A Approval  
**Goal**: Move fields between pages via keyboard  
**Risk**: 🟡 Medium (complex navigation)  
**Estimated Time**: 45-60 minutes

#### Changes
- Extend keyboard sensor to detect page boundaries
- `Arrow Left/Right`: Switch target page during drag
- Visual indicator for active drop target page
- Maintain focus management across pages

#### Keyboard Mappings
- `Arrow Up/Down`: Move within current page
- `Arrow Left`: Move to previous page (if available)
- `Arrow Right`: Move to next page (if available)
- `Home`: Move to first position in page
- `End`: Move to last position in page

#### Files Modified
- `apps/form-app/src/hooks/useDragAndDrop.ts` (keyboard logic)
- `apps/form-app/src/components/form-builder/DroppablePage.tsx` (focus indicators)

#### Testing Checklist
- [ ] Can move field to previous page
- [ ] Can move field to next page
- [ ] Clear visual feedback for target page (border highlight)
- [ ] Focus returns to correct position after drop
- [ ] Boundary detection (can't go left from first page)
- [ ] Screen reader announces page changes
- [ ] Works with all keyboard layouts

#### Acceptance Criteria
- Intuitive keyboard navigation model
- Clear indication of current target page
- No confusion about drop location
- Focus management robust

---

### **Phase 3A: Touch/Mobile Optimization**
**Status**: ⏸️ Awaiting Phase 2 Completion  
**Goal**: Reliable drag on touch devices  
**Risk**: 🟡 Medium (device-specific)  
**Estimated Time**: 60-90 minutes

#### Changes
- Configure `TouchSensor` with activation delay:
  ```tsx
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250, // Long press 250ms
      tolerance: 5, // Allow 5px movement
    },
  })
  ```
- Increase touch target sizes (minimum 44x44px)
- Add haptic feedback (where supported):
  ```typescript
  if (window.navigator.vibrate) {
    window.navigator.vibrate(10); // 10ms haptic pulse
  }
  ```
- Prevent scroll conflicts during drag

#### Touch Enhancements
- **Long-press delay**: 250ms (iOS standard)
- **Touch targets**: Minimum 44x44px (Apple HIG)
- **Visual feedback**: Show "grabbing" cursor equivalent
- **Haptics**: Vibrate on pick-up and drop
- **Scroll lock**: Disable scroll during active drag

#### Files Modified
- `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`
- `apps/form-app/src/components/form-builder/DroppablePage.tsx` (larger touch targets)
- `apps/form-app/src/components/form-builder/DraggableField.tsx` (touch indicators)

#### Testing Checklist
- [ ] Long-press activates drag (iOS Safari)
- [ ] Long-press activates drag (Android Chrome)
- [ ] Doesn't conflict with scroll gestures
- [ ] Drop zones large enough for fingers
- [ ] Visual feedback during long-press
- [ ] Haptic feedback on pick-up (if supported)
- [ ] Haptic feedback on drop (if supported)
- [ ] Works in landscape orientation
- [ ] Works with different finger sizes

#### Device Testing Matrix
- [ ] iPhone (iOS Safari)
- [ ] iPad (iOS Safari)
- [ ] Android Phone (Chrome)
- [ ] Android Tablet (Chrome)

#### Acceptance Criteria
- Touch drag feels natural and responsive
- No accidental drags during scrolling
- Clear feedback for touch interactions
- Works across device/OS combinations

---

### **Phase 3B: Performance Optimization**
**Status**: ⏸️ Awaiting 3A Approval  
**Goal**: Maintain 60fps with 100+ fields  
**Risk**: 🟢 Low (optimization only)  
**Estimated Time**: 60-90 minutes

#### Changes
- Memoize expensive lookups in `useDragAndDrop`:
  ```typescript
  const pageFieldsMap = useMemo(() => 
    pages.reduce((acc, page) => ({
      ...acc,
      [page.id]: page.fields
    }), {}),
    [pages]
  );
  ```
- Add `React.memo` to `DraggableField`:
  ```typescript
  export const DraggableField = React.memo(({ ... }) => { ... });
  ```
- Optimize re-render triggers via `useCallback`
- Add performance monitoring (React DevTools Profiler)

#### Optimization Checklist
- [ ] Memoize page lookups
- [ ] Memoize field arrays
- [ ] Wrap event handlers in `useCallback`
- [ ] Use `React.memo` for list items
- [ ] Virtualize long lists (if 100+ fields)
- [ ] Lazy load field type icons
- [ ] Debounce expensive calculations

#### Files Modified
- `apps/form-app/src/hooks/useDragAndDrop.ts`
- `apps/form-app/src/components/form-builder/DraggableField.tsx`
- `apps/form-app/src/components/form-builder/DroppablePage.tsx`

#### Testing Checklist
- [ ] No dropped frames during drag (Chrome DevTools Performance)
- [ ] Smooth drag with 50 fields
- [ ] Smooth drag with 100 fields
- [ ] Smooth drag with 200 fields
- [ ] CPU usage < 50% during drag
- [ ] Memory stable (no leaks over time)
- [ ] React DevTools shows minimal re-renders
- [ ] Bundle size impact < 5KB

#### Performance Targets
- **Frame rate**: Consistent 60fps during drag
- **Time to Interactive**: < 3s on 3G
- **First Contentful Paint**: < 1.5s
- **CPU usage**: < 50% on mid-tier devices
- **Memory**: No growth over 10 consecutive drags

#### Acceptance Criteria
- Meets all performance targets
- No visual stuttering or lag
- Memory profiler shows stable usage
- Lighthouse score > 90 (Performance)

---

## 🔮 Future Phases (Deferred)

### Phase 4: Multi-Select Drag
**Priority**: 🟡 Medium  
**Complexity**: High

- Cmd/Ctrl+Click to select multiple fields
- Drag bundle of selected items
- Visual "stack" appearance in overlay (e.g., "3 items")
- Bulk drop operations

### Phase 5: Grid Layout Support
**Priority**: 🟡 Medium  
**Complexity**: Medium

- Switch to `rectSortingStrategy`
- 2-column field layouts
- Responsive breakpoints
- Maintain accessibility in 2D grid

### Phase 6: AI-Assisted Placement
**Priority**: 🟢 Low  
**Complexity**: High

- Smart drop zone highlighting (e.g., "City" near "State")
- Context-aware suggestions
- Auto-grouping related fields
- ML model for form patterns

---

## 🔄 Execution Workflow

### For Each Phase:
1. **Implementation**: Developer implements changes
2. **Self-Review**: Code review against checklist
3. **Manual Testing**: Tester validates all test cases
4. **Feedback Loop**: Report issues, iterate if needed
5. **Sign-off**: Explicit approval to proceed
6. **Git Commit**: Atomic commit with phase label

### Commit Message Format:
```
feat(drag-drop): Phase 1A - Shadow state foundation

- Add localFieldOrder state to useDragAndDrop hook
- Initialize on drag start, clear on drag end
- No visual changes (pure state setup)

Testing: All existing drag-drop flows work unchanged
```

### Rollback Strategy:
- Each phase in separate commit
- Tag stable milestones: `v1-phase1a-stable`
- Can cherry-pick or revert individual changes
- Maintain `main` branch stability

---

## 📊 Progress Tracking

| Phase | Status | Started | Completed | Tester | Sign-off |
|-------|--------|---------|-----------|--------|----------|
| 1A | 🔵 Ready | - | - | - | - |
| 1B | ⏸️ Blocked | - | - | - | - |
| 1C | ⏸️ Blocked | - | - | - | - |
| 1D | ⏸️ Blocked | - | - | - | - |
| 1E | ⏸️ Blocked | - | - | - | - |
| 2A | ⏸️ Blocked | - | - | - | - |
| 2B | ⏸️ Blocked | - | - | - | - |
| 3A | ⏸️ Blocked | - | - | - | - |
| 3B | ⏸️ Blocked | - | - | - | - |

**Legend:**
- 🔵 Ready to Start
- 🟡 In Progress
- 🟢 Testing
- ✅ Completed
- ⏸️ Blocked (awaiting previous phase)
- 🔴 Blocked (issues found)

---

## 🛠️ Technical Stack Reference

### Dependencies
- `@dnd-kit/core` - Core drag-and-drop primitives
- `@dnd-kit/sortable` - Sortable list utilities
- `@dnd-kit/utilities` - Helper functions
- `react` - UI framework
- `yjs` - Real-time collaboration (CRDT)

### Key Files
- **Hook**: `apps/form-app/src/hooks/useDragAndDrop.ts`
- **Page Component**: `apps/form-app/src/components/form-builder/DroppablePage.tsx`
- **Field Component**: `apps/form-app/src/components/form-builder/DraggableField.tsx`
- **Overlay Component**: `apps/form-app/src/components/form-builder/CompactFieldCard.tsx`
- **Container**: `apps/form-app/src/pages/CollaborativeFormBuilder.tsx`

### Testing Tools
- React DevTools (performance profiling)
- Chrome DevTools Performance tab
- Lighthouse (performance audits)
- Screen reader (NVDA/JAWS/VoiceOver)
- Touch device emulation (Chrome DevTools)

---

## 📞 Support & Questions

For technical questions or clarifications during implementation:
1. Reference this document first
2. Check dnd-kit documentation: https://docs.dndkit.com
3. Review existing implementation in codebase
4. Ask for clarification before proceeding if uncertain

---

## ✅ Success Metrics

### UX Quality
- Drag feels "physical" and responsive
- Visual feedback clear and immediate
- No stuttering or jank (60fps)
- Accessible to keyboard and screen reader users

### Technical Quality
- TypeScript strict mode, zero `any` types
- All event handlers properly typed
- Performance targets met
- No memory leaks
- Code coverage > 80% for new logic

### Collaboration Quality
- YJS updates atomic and reliable
- No race conditions or conflicts
- Remote users see clean state changes
- No intermediate drag state synced

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-31  
**Next Review**: After Phase 1E completion
