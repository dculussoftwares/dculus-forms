# Native Button Replacement Guide

This guide provides patterns for replacing native `<button>` elements with shadcn/ui components.

## Identified Patterns

### Pattern 1: Tab/Toggle Buttons (Use ToggleGroup)

**When to use**: Navigation tabs, view mode switchers, grouped selections

**Before:**
```tsx
<button
  onClick={() => handleTabChange('layout')}
  className={`
    flex items-center px-4 py-2.5 rounded-lg
    ${isActive
      ? 'bg-blue-50 text-blue-700 border-2 border-blue-200'
      : 'text-gray-600 hover:bg-gray-50 border-2 border-transparent'
    }
  `}
  aria-label="Switch to Layout tab"
  role="tab"
  aria-selected={isActive}
>
  <LayoutIcon className="w-5 h-5" />
  Layout
</button>
```

**After:**
```tsx
<ToggleGroup type="single" value={activeTab} onValueChange={setActiveTab}>
  <ToggleGroupItem value="layout" aria-label="Switch to Layout tab">
    <LayoutIcon className="w-5 h-5 mr-2" />
    Layout
  </ToggleGroupItem>
  {/* More tabs... */}
</ToggleGroup>
```

**Benefits:**
- ✅ Better accessibility (built-in ARIA)
- ✅ Consistent styling
- ✅ Less custom CSS
- ✅ Type-safe values

---

### Pattern 2: Selection Grid (Use Button variant)

**When to use**: Layout templates, card selections, grid items

**Before:**
```tsx
<button
  onClick={() => onLayoutSelect(template.code)}
  disabled={disabled}
  className={`
    p-2 rounded-lg border-2 transition-all
    ${currentLayoutCode === template.code
      ? 'border-purple-500 bg-purple-50 shadow-lg'
      : 'border-gray-200 hover:border-purple-300 bg-white'
    }
  `}
>
  {template.name}
</button>
```

**After:**
```tsx
<Button
  variant={currentLayoutCode === template.code ? "default" : "outline"}
  onClick={() => onLayoutSelect(template.code)}
  disabled={disabled}
  className={cn(
    "p-2 h-20 justify-start",
    currentLayoutCode === template.code && "ring-2 ring-purple-200"
  )}
>
  {template.name}
</Button>
```

**Benefits:**
- ✅ Consistent button styling
- ✅ Built-in variants
- ✅ Better disabled states
- ✅ Proper focus management

---

### Pattern 3: Text Buttons (Use Button variant="ghost")

**When to use**: Inline editable text, subtle actions, minimal buttons

**Before:**
```tsx
<button
  onClick={() => setIsEditingTitle(true)}
  disabled={!isConnected}
  className="text-lg font-semibold text-gray-900 hover:text-purple-600 transition-colors"
>
  {page.title || `Page ${index + 1}`}
</button>
```

**After:**
```tsx
<Button
  variant="ghost"
  onClick={() => setIsEditingTitle(true)}
  disabled={!isConnected}
  className="text-lg font-semibold hover:text-purple-600 h-auto p-0"
>
  {page.title || `Page ${index + 1}`}
</Button>
```

**Benefits:**
- ✅ Consistent hover states
- ✅ Better disabled styling
- ✅ Proper focus rings
- ✅ Accessible by default

---

### Pattern 4: Icon-Only Buttons (Use Button variant="ghost" size="icon")

**When to use**: Close buttons, edit icons, action buttons

**Before:**
```tsx
<button
  onClick={onClose}
  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
  aria-label="Close dialog"
>
  <X className="w-5 h-5" />
</button>
```

**After:**
```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={onClose}
  aria-label="Close dialog"
>
  <X className="w-5 h-5" />
</Button>
```

**Benefits:**
- ✅ Consistent sizing
- ✅ Better touch targets (minimum 44x44px)
- ✅ Built-in accessibility
- ✅ Proper focus indicators

---

### Pattern 5: Primary Action Buttons

**When to use**: Submit buttons, primary actions, CTAs

**Before:**
```tsx
<button
  onClick={handleSubmit}
  disabled={isLoading}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
>
  {isLoading ? 'Saving...' : 'Save'}
</button>
```

**After:**
```tsx
<Button
  onClick={handleSubmit}
  disabled={isLoading}
>
  {isLoading ? 'Saving...' : 'Save'}
</Button>
```

**Benefits:**
- ✅ Consistent primary styling
- ✅ Built-in loading states
- ✅ Proper disabled states
- ✅ No custom CSS needed

---

## Replacement Checklist

When replacing a native button, consider:

- [ ] **Purpose**: What is the button's role?
  - Navigation/Tabs → `ToggleGroup`
  - Selection → `Button` with variant
  - Subtle action → `Button variant="ghost"`
  - Icon only → `Button variant="ghost" size="icon"`
  - Primary action → `Button variant="default"`

- [ ] **Accessibility**: Does it have:
  - [ ] `aria-label` for icon-only buttons
  - [ ] Proper role (button, tab, etc.)
  - [ ] Keyboard support (Enter/Space)
  - [ ] Focus indicators

- [ ] **Styling**: Can we use:
  - [ ] Built-in variants (default, outline, ghost, etc.)
  - [ ] Built-in sizes (sm, default, lg, icon)
  - [ ] Minimal custom className

- [ ] **State Management**:
  - [ ] Disabled state
  - [ ] Loading state
  - [ ] Selected/Active state

---

## Common Variants

### Button Variants
```tsx
<Button variant="default">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>
<Button variant="destructive">Delete</Button>
```

### Button Sizes
```tsx
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

### ToggleGroup
```tsx
// Single selection
<ToggleGroup type="single" value={value} onValueChange={setValue}>
  <ToggleGroupItem value="left">Left</ToggleGroupItem>
  <ToggleGroupItem value="center">Center</ToggleGroupItem>
  <ToggleGroupItem value="right">Right</ToggleGroupItem>
</ToggleGroup>

// Multiple selection
<ToggleGroup type="multiple" value={values} onValueChange={setValues}>
  <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
  <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
</ToggleGroup>
```

---

## Migration Priority

1. **High Priority** (User-facing navigation)
   - TabNavigation.tsx
   - LayoutThumbnails.tsx
   - Dashboard filter buttons

2. **Medium Priority** (Form builder)
   - PageCard.tsx
   - FieldItem.tsx
   - Form settings panels

3. **Low Priority** (Edge cases)
   - Test files
   - Internal components
   - Complex custom buttons

---

## Testing After Replacement

1. **Visual Check**: Does it look correct?
2. **Keyboard Test**: Tab, Enter, Space keys work?
3. **Screen Reader**: Proper announcements?
4. **States**: Hover, focus, disabled, active all work?
5. **TypeScript**: No type errors?

---

## Examples

### Example 1: TabNavigation.tsx

Replace complex tab buttons with ToggleGroup for:
- Cleaner code
- Better accessibility
- Consistent styling
- Type-safe tab management

### Example 2: LayoutThumbnails.tsx

Replace selection grid buttons with Button component for:
- Consistent outline/filled states
- Better disabled states
- Proper focus management
- Less custom CSS

### Example 3: PageCard.tsx

Replace text button with Button variant="ghost" for:
- Consistent hover states
- Better accessibility
- Proper focus indicators
- Cleaner code

---

## Resources

- [shadcn/ui Button](https://ui.shadcn.com/docs/components/button)
- [shadcn/ui Toggle](https://ui.shadcn.com/docs/components/toggle)
- [WCAG Button Guidelines](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
