# L1ClassicLayout - Component Reference Documentation

## Overview
The L1ClassicLayout is a sophisticated form builder layout component that provides a dual-section interface with background image support, rich text editing capabilities, and a seamless view/edit mode system.

## Visual Structure Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            L1ClassicLayout Container                            │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        Background Image Layer                          │  │
│  │                         (with blur overlay)                            │  │
│  │                                                                         │  │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │   │                   Central Content Area                          │   │  │
│  │   │                     (rounded container)                         │   │  │
│  │   │                                                                 │   │  │
│  │   │  ┌─────────────────┐  ┌─────────────────────────────────────┐   │   │  │
│  │   │  │                 │  │                                     │   │   │  │
│  │   │  │   IMAGE CHUNK   │  │        WHITE PAPER CHUNK            │   │   │  │
│  │   │  │                 │  │                                     │   │   │  │
│  │   │  │  (Background    │  │  ┌─────────────────────────────┐   │   │   │  │
│  │   │  │   showcase)     │  │  │  Mode Toggle + Save/Cancel  │   │   │  │
│  │   │  │                 │  │  └─────────────────────────────┘   │   │   │  │
│  │   │  │                 │  │                                     │   │   │  │
│  │   │  │                 │  │  ┌─────────────────────────────┐   │   │   │  │
│  │   │  │                 │  │  │                             │   │   │   │  │
│  │   │  │                 │  │  │     RICH TEXT EDITOR        │   │   │   │  │
│  │   │  │                 │  │  │   (with font size, etc.)    │   │   │   │  │
│  │   │  │                 │  │  │                             │   │   │   │  │
│  │   │  │                 │  │  └─────────────────────────────┘   │   │   │  │
│  │   │  │                 │  │                                     │   │   │  │
│  │   │  │                 │  │  ┌─────────────────────────────┐   │   │   │  │
│  │   │  │                 │  │  │      CUSTOM CTA BUTTON      │   │   │   │  │
│  │   │  │                 │  │  └─────────────────────────────┘   │   │   │  │
│  │   │  └─────────────────┘  └─────────────────────────────────────┘   │   │  │
│  │   └─────────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## State Management Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    L1ClassicLayout State                       │
│                                                                 │
│  showPages: boolean           ─── Controls intro vs pages view │
│  isEditMode: boolean          ─── Controls edit vs view mode   │
│  tempContent: string          ─── Local editor content state   │
│  hasUnsavedChanges: boolean   ─── Tracks unsaved modifications │
│  editorKey: number            ─── Forces editor remount        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Content Flow                             │   │
│  │                                                         │   │
│  │  layout.content ──→ tempContent ──→ [editing] ──→       │   │
│  │                                                    ↓    │   │
│  │              ┌─ Save ──→ onLayoutChange(tempContent)    │   │
│  │              │                                          │   │
│  │              └─ Cancel ──→ revert to layout.content    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Features

### 1. Dual Section Layout
```
┌──────────────────┬──────────────────────────────────────┐
│                  │                                      │
│   IMAGE SECTION  │         WHITE PAPER SECTION          │
│                  │                                      │
│   • Background   │  • Rich Text Editor                  │
│     showcase     │  • Mode Toggle (Edit/View)           │
│   • Visual       │  • Save/Cancel Buttons               │
│     appeal       │  • Custom CTA Button                 │
│                  │  • Scrollable Content                │
└──────────────────┴──────────────────────────────────────┘
```

### 2. Edit/View Mode System
```
┌─────────────────────────────────────────────────────────────┐
│                    Mode Toggle System                      │
│                                                             │
│  EDIT MODE                    │   VIEW MODE                 │
│  ─────────────                │   ─────────                 │
│  • Toolbar visible            │   • Toolbar hidden          │
│  • Content editable           │   • Content read-only       │
│  • Save/Cancel buttons        │   • Clean display           │
│  • Font size controls         │   • No distractions         │
│  • Full editor features       │   • Pure content view       │
│                                                             │
│           Save ──────────────────────→ Auto-switch to View │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Rich Text Editor Features
```
┌─────────────────────────────────────────────────────────────┐
│                   Editor Toolbar                           │
│                                                             │
│  [Block Type ▼] [Font Size ▼] │ [B] [I] [U] │ [•] [1.] │ ≡  │
│                                                             │
│  • Headings (H1, H2, H3)      • Bold, Italic, Underline   │
│  • Normal paragraphs          • Bullet & numbered lists    │
│  • Font sizes (12px - 48px)   • Text alignment            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Props Interface

```typescript
interface L1ClassicLayoutProps {
  pages: FormPage[];                               // Form pages to display
  layout?: FormLayout;                             // Layout configuration
  className?: string;                              // Additional CSS classes
  onLayoutChange?: (updates: Partial<FormLayout>) => void; // Layout update handler
}

interface FormLayout {
  theme: 'light' | 'dark' | 'auto';
  textColor: string;
  spacing: 'compact' | 'normal' | 'spacious';
  code: string;
  content: string;                                 // Rich text content
  customBackGroundColor: string;
  customCTAButtonName?: string;                    // CTA button text
  backgroundImageKey: string;                      // Background image
}
```

## Key Implementation Patterns

### 1. Temporary State Management
```javascript
// Prevents YJS conflicts during editing
const [tempContent, setTempContent] = useState(layout?.content || 'default');
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

// Local editing → Save → Sync to layout
const handleSave = () => {
  onLayoutChange?.({ content: tempContent });
  setHasUnsavedChanges(false);
  setIsEditMode(false); // Auto-switch to view mode
};
```

### 2. Editor Key Reset Pattern
```javascript
// Forces editor remount for clean state
const [editorKey, setEditorKey] = useState(0);

// Reset on cancel or external content changes
const handleCancel = () => {
  setTempContent(originalContent);
  setEditorKey(prev => prev + 1); // Force remount
};
```

### 3. Background Image Handling
```javascript
// CDN integration with fallback
const outerBackgroundStyle = layout?.backgroundImageKey && cdnEndpoint
  ? {
      backgroundImage: `url(${getImageUrl(layout.backgroundImageKey, cdnEndpoint)})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }
  : { 
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ff4757 100%)'
    };
```

## CSS Architecture

### 1. Layout Structure
```css
/* Outer container with background */
.outer-background {
  background-image: url(...);
  background-size: cover;
  position: relative;
}

/* Blur overlay */
.blur-overlay {
  backdrop-filter: blur(250px);
  background: rgba(0, 0, 0, 0.1);
  position: absolute;
  inset: 0;
}

/* Central content area */
.central-container {
  padding: 5% 10%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Two-chunk layout */
.chunk-container {
  display: flex;
  width: 100%;
  height: 100%;
}

/* White paper overlay */
.white-paper {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(1px);
  border-radius: 0.125rem;
  padding: 2rem;
  overflow-y: auto; /* Scrollable content */
}
```

### 2. Responsive Behavior
```css
/* Flexible layout */
.chunk-left, .chunk-right {
  flex: 1; /* Equal width chunks */
}

/* Content positioning */
.content-area {
  position: absolute;
  top: 5%;
  right: 5%;
  bottom: 5%;
  left: 5%;
}
```

## Navigation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Journey                          │
│                                                             │
│  1. Land on Intro Section                                  │
│     ↓                                                       │
│  2. Edit Content (optional)                                │
│     ├─ Save → Auto-switch to View Mode                     │
│     └─ Cancel → Revert changes                             │
│     ↓                                                       │
│  3. Click CTA Button                                       │
│     ↓                                                       │
│  4. Navigate to Pages Section                              │
│     ↓                                                       │
│  5. View Form Pages                                        │
│     ↓                                                       │
│  6. Back to Intro (optional)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Usage Instructions for Claude Code

### Creating Similar Layouts

1. **Basic Structure**:
   ```typescript
   // Always start with this container pattern
   <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col">
     <div className="flex-1 overflow-y-auto">
       {/* Your layout content */}
     </div>
   </div>
   ```

2. **Background Image Pattern**:
   ```typescript
   // Use CDN integration with fallback
   const backgroundStyle = layout?.backgroundImageKey && cdnEndpoint
     ? { backgroundImage: `url(${getImageUrl(...)})` }
     : { background: 'linear-gradient(...)' };
   ```

3. **State Management Pattern**:
   ```typescript
   // Always use temporary state for content editing
   const [tempContent, setTempContent] = useState(initial);
   const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
   const [editorKey, setEditorKey] = useState(0);
   ```

4. **Edit/View Mode Pattern**:
   ```typescript
   // Consistent mode management
   const [isEditMode, setIsEditMode] = useState(true);
   
   // Auto-switch to view after save
   const handleSave = () => {
     onLayoutChange?.(updates);
     setIsEditMode(false);
   };
   ```

### Key Components to Include

- **RichTextEditor** with `editable` prop
- **Mode toggle buttons** with clear icons
- **Save/Cancel buttons** (conditional rendering)
- **Custom CTA button** with `layout.customCTAButtonName`
- **Scrollable containers** with `overflow-y-auto`

### Common Patterns

1. **Conditional Rendering**:
   ```typescript
   {!showPages ? (
     // Intro section
   ) : (
     // Pages section
   )}
   ```

2. **Button States**:
   ```typescript
   {isEditMode && hasUnsavedChanges && (
     // Save/Cancel buttons
   )}
   ```

3. **Background Layers**:
   ```typescript
   // Outer background → Blur overlay → Content container → White paper
   ```

## File Structure Reference

```
L1ClassicLayout.tsx
├── Imports (React, types, components)
├── Interface definitions
├── Component function
│   ├── State management
│   ├── Event handlers
│   ├── Effects
│   ├── Render logic
│   │   ├── Background setup
│   │   ├── Intro section
│   │   │   ├── Image chunk
│   │   │   └── White paper chunk
│   │   │       ├── Controls
│   │   │       ├── Editor
│   │   │       └── CTA button
│   │   └── Pages section
│   └── Export
```

## Best Practices

1. **Always use temporary state** for content editing to avoid YJS conflicts
2. **Include save/cancel functionality** for better UX
3. **Auto-switch to view mode** after saving
4. **Use consistent spacing** (5% margins, 2rem padding)
5. **Include scrollable containers** for overflow content
6. **Provide fallback backgrounds** when no image is set
7. **Use semantic HTML structure** with proper accessibility
8. **Keep components pure** - no side effects in render
9. **Use TypeScript interfaces** for all props and state
10. **Follow existing naming conventions** (camelCase, descriptive names)

---

*This documentation serves as a complete reference for implementing layouts similar to L1ClassicLayout. Use it as a template for creating new layout components with consistent patterns and functionality.*