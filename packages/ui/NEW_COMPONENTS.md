# New UI Components - @dculus/ui

This document provides comprehensive documentation for all new components added to the `@dculus/ui` package during the UI refactoring.

## Table of Contents

1. [Chip Component](#chip-component)
2. [Calendar & DatePicker](#calendar--datepicker)
3. [Switch Component](#switch-component)
4. [Toggle & ToggleGroup](#toggle--togglegroup)
5. [Command Component](#command-component)
6. [OTPInput Component](#otpinput-component)

---

## Chip Component

A versatile chip/tag component that supports multiple variants for different use cases.

### Import

```typescript
import { Chip } from '@dculus/ui';
```

### Variants

- `default`: Selectable chip with toggle states (e.g., category filters)
- `filter`: Displayed filter with icon and remove button (e.g., active filters)
- `outline`: Outlined style for subtle emphasis

### Props

```typescript
interface ChipProps {
  children: React.ReactNode;
  variant?: 'default' | 'filter' | 'outline';
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  icon?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

### Examples

**Category Selection Chip**
```tsx
<Chip
  selected={isActive}
  onClick={() => setActive(!isActive)}
>
  All Forms
</Chip>
```

**Filter Chip with Icon and Remove Button**
```tsx
<Chip
  variant="filter"
  icon={<FileIcon />}
  onRemove={() => removeFilter()}
>
  Status: Published
</Chip>
```

**Outline Chip**
```tsx
<Chip variant="outline">
  Tag Name
</Chip>
```

### Features

- **Accessible**: Proper ARIA attributes (`aria-pressed` for selected state)
- **Keyboard Support**: Focus visible with keyboard navigation
- **Size Variants**: sm, md, lg sizes
- **Customizable**: Full className support for custom styling

---

## Calendar & DatePicker

Modern date selection components with calendar popover, replacing native `<input type="date">`.

### Import

```typescript
import { Calendar, DatePicker, DateRangePicker } from '@dculus/ui';
```

### Components

#### Calendar

Base calendar component using `react-day-picker`.

```tsx
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  disabled={(date) => date > new Date()}
/>
```

#### DatePicker

Calendar with popover trigger for single date selection.

```tsx
const [date, setDate] = useState<Date>()

<DatePicker
  date={date}
  onDateChange={setDate}
  minDate={new Date()}
  maxDate={new Date('2025-12-31')}
  placeholder="Select a date"
  error={!!validationError}
/>
```

#### DateRangePicker

Calendar for selecting date ranges.

```tsx
const [from, setFrom] = useState<Date>()
const [to, setTo] = useState<Date>()

<DateRangePicker
  from={from}
  to={to}
  onDateRangeChange={(from, to) => {
    setFrom(from)
    setTo(to)
  }}
  placeholder="Select date range"
/>
```

### Props

**DatePicker Props**
```typescript
interface DatePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean | string
}
```

**DateRangePicker Props**
```typescript
interface DateRangePickerProps {
  from?: Date
  to?: Date
  onDateRangeChange?: (from: Date | undefined, to: Date | undefined) => void
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean | string
}
```

### Features

- **Better UX**: Calendar popover instead of native date picker
- **Validation Support**: Min/max date constraints
- **Error States**: Visual feedback for validation errors
- **Keyboard Navigation**: Full keyboard support
- **Format Display**: Formatted date display using `date-fns`
- **Responsive**: Works on mobile and desktop

### Dependencies

- `react-day-picker@9.3.4`
- `date-fns@4.1.0`

---

## Switch Component

Toggle switch for boolean on/off states (different from Checkbox).

### Import

```typescript
import { Switch } from '@dculus/ui';
```

### Example

```tsx
const [enabled, setEnabled] = useState(false)

<div className="flex items-center space-x-2">
  <Switch
    checked={enabled}
    onCheckedChange={setEnabled}
    id="airplane-mode"
  />
  <Label htmlFor="airplane-mode">Airplane Mode</Label>
</div>
```

### Props

Extends `@radix-ui/react-switch` props:

```typescript
interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  required?: boolean
  name?: string
  value?: string
  className?: string
}
```

### Features

- **Accessible**: Full ARIA support from Radix UI
- **Keyboard Support**: Space/Enter to toggle
- **Visual States**: Clear on/off indication
- **Smooth Animation**: Animated thumb transition

### Use Cases

- Feature toggles
- Settings panels
- Enable/disable options
- Replacing checkboxes for boolean states

### Dependencies

- `@radix-ui/react-switch@1.1.2`

---

## Toggle & ToggleGroup

Toggle buttons for single or grouped selections.

### Import

```typescript
import { Toggle, ToggleGroup, ToggleGroupItem } from '@dculus/ui';
```

### Toggle

Single toggle button.

```tsx
<Toggle
  pressed={isBold}
  onPressedChange={setIsBold}
  aria-label="Toggle bold"
>
  <Bold className="h-4 w-4" />
</Toggle>
```

### ToggleGroup

Group of related toggle buttons.

```tsx
<ToggleGroup type="single" value={alignment} onValueChange={setAlignment}>
  <ToggleGroupItem value="left" aria-label="Align left">
    <AlignLeft className="h-4 w-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="center" aria-label="Align center">
    <AlignCenter className="h-4 w-4" />
  </ToggleGroupItem>
  <ToggleGroupItem value="right" aria-label="Align right">
    <AlignRight className="h-4 w-4" />
  </ToggleGroupItem>
</ToggleGroup>
```

### Props

**Toggle Props**
```typescript
interface ToggleProps {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  disabled?: boolean
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}
```

**ToggleGroup Props**
```typescript
interface ToggleGroupProps {
  type: 'single' | 'multiple'
  value?: string | string[]
  onValueChange?: (value: string | string[]) => void
  disabled?: boolean
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}
```

### Features

- **Single/Multiple Selection**: Support for both modes
- **Variants**: Default and outline styles
- **Size Options**: sm, default, lg
- **Accessible**: Full keyboard and screen reader support
- **Visual States**: Clear pressed/unpressed indication

### Use Cases

- Text formatting toolbars (bold, italic, underline)
- Alignment controls
- View mode switchers (list, grid, kanban)
- Filter toggles

### Dependencies

- `@radix-ui/react-toggle@1.1.1`
- `@radix-ui/react-toggle-group@1.1.1`

---

## Command Component

Keyboard-first search/command palette component (⌘K menu).

### Import

```typescript
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@dculus/ui';
```

### Examples

**Basic Command Menu**
```tsx
<Command>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem onSelect={() => runCommand('create-form')}>
        <Plus className="mr-2 h-4 w-4" />
        <span>Create New Form</span>
        <CommandShortcut>⌘N</CommandShortcut>
      </CommandItem>
      <CommandItem onSelect={() => runCommand('search')}>
        <Search className="mr-2 h-4 w-4" />
        <span>Search Forms</span>
        <CommandShortcut>⌘F</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>
```

**Command Dialog (Modal)**
```tsx
const [open, setOpen] = useState(false)

useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setOpen((open) => !open)
    }
  }
  document.addEventListener('keydown', down)
  return () => document.removeEventListener('keydown', down)
}, [])

<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Actions">
      <CommandItem onSelect={() => createForm()}>
        Create New Form
      </CommandItem>
      <CommandItem onSelect={() => openSettings()}>
        Settings
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Recent">
      {recentForms.map((form) => (
        <CommandItem key={form.id} onSelect={() => openForm(form.id)}>
          {form.title}
        </CommandItem>
      ))}
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Features

- **Keyboard-First**: Navigate with arrow keys, select with Enter
- **Fuzzy Search**: Built-in search functionality
- **Grouping**: Organize commands into groups
- **Shortcuts**: Display keyboard shortcuts
- **Dialog Mode**: Modal command palette
- **Fast**: Optimized for large lists

### Use Cases

- Command palettes (⌘K menus)
- Quick search interfaces
- Field type selection in form builder
- Navigation shortcuts
- Action menus

### Dependencies

- `cmdk@1.0.4`

---

## OTPInput Component

One-time password (OTP) input with full keyboard navigation support.

### Import

```typescript
import { OTPInput } from '@dculus/ui';
```

### Example

```tsx
const [otp, setOtp] = useState('')

<OTPInput
  length={6}
  value={otp}
  onChange={setOtp}
  hasError={!!error}
  autoFocus
/>
```

### Props

```typescript
interface OTPInputProps {
  length?: number;        // Number of digits (default: 6)
  value: string;          // Current OTP value
  onChange: (value: string) => void;
  disabled?: boolean;
  hasError?: boolean;     // Shows red border
  autoFocus?: boolean;    // Auto-focus first input (default: true)
}
```

### Features

- **Auto-Advance**: Automatically moves to next input on digit entry
- **Keyboard Navigation**:
  - Arrow keys to move between inputs
  - Backspace to delete and move back
  - Delete to clear current input
  - Enter to submit when complete
- **Paste Support**: Paste entire OTP code at once
- **Visual Feedback**:
  - Green border when digit entered
  - Red border for errors
  - Focus ring on active input
- **Accessibility**:
  - ARIA labels for each digit
  - Group role with label
  - Numeric input mode for mobile keyboards
  - Auto-complete="one-time-code" for SMS codes

### Use Cases

- Email verification
- Phone number verification
- Two-factor authentication (2FA)
- Security codes

---

## Migration Guide

### Replacing Native Elements

#### Native Date Input → DatePicker

**Before:**
```tsx
<input
  type="date"
  value={date}
  onChange={(e) => setDate(e.target.value)}
  className="w-full px-3 py-2 border rounded-md"
  max={new Date().toISOString().split('T')[0]}
/>
```

**After:**
```tsx
<DatePicker
  date={date ? new Date(date) : undefined}
  onDateChange={(d) => setDate(d?.toISOString().split('T')[0])}
  maxDate={new Date()}
/>
```

#### Checkbox for Toggle → Switch

**Before:**
```tsx
<Checkbox
  checked={enabled}
  onCheckedChange={setEnabled}
/>
<Label>Enable feature</Label>
```

**After:**
```tsx
<div className="flex items-center space-x-2">
  <Switch
    checked={enabled}
    onCheckedChange={setEnabled}
    id="feature"
  />
  <Label htmlFor="feature">Enable feature</Label>
</div>
```

#### Custom Chip → Chip Component

**Before:**
```tsx
<button
  onClick={onClick}
  className={cn(
    'px-3 py-1 rounded-full border',
    selected && 'bg-gray-900 text-white'
  )}
>
  {children}
</button>
```

**After:**
```tsx
<Chip selected={selected} onClick={onClick}>
  {children}
</Chip>
```

---

## Best Practices

### DatePicker

- Always use `Date` objects instead of strings
- Provide `minDate`/`maxDate` for validation
- Show error states with the `error` prop
- Use descriptive placeholders

### Switch

- Always pair with a `Label` for accessibility
- Use `id` attribute to link with label
- Prefer Switch over Checkbox for boolean toggles

### Command

- Use `CommandDialog` for modal command palettes
- Implement ⌘K/Ctrl+K keyboard shortcut
- Group related commands together
- Show keyboard shortcuts with `CommandShortcut`

### OTPInput

- Use `length={6}` for standard OTP codes
- Enable `autoFocus` for better UX
- Show errors with `hasError` prop
- Handle form submission on Enter key

### General

- Import all components from `@dculus/ui`
- Use TypeScript for type safety
- Follow shadcn/ui styling conventions
- Maintain accessibility standards

---

## Summary

All new components are:

✅ **Fully Typed** - Complete TypeScript support
✅ **Accessible** - ARIA attributes and keyboard navigation
✅ **Themed** - Consistent with shadcn/ui design system
✅ **Tested** - All components build without errors
✅ **Documented** - Comprehensive examples and props

---

## Dependencies Summary

```json
{
  "react-day-picker": "^9.3.4",
  "date-fns": "^4.1.0",
  "@radix-ui/react-switch": "^1.1.2",
  "@radix-ui/react-toggle": "^1.1.1",
  "@radix-ui/react-toggle-group": "^1.1.1",
  "cmdk": "^1.0.4"
}
```

All components are exported from `@dculus/ui` and ready for use across all applications in the monorepo.
