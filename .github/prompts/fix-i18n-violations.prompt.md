---
description: 'Audit and fix hardcoded i18n strings in a component file or directory'
mode: 'agent'
---

# Fix i18n Violations

Audit the target component(s) for hardcoded user-facing strings and replace them with `useTranslation` hook calls.

## Target

$SELECTION_OR_CONTEXT

## Steps

### 1. Identify Hardcoded Strings

Scan for:

- Hardcoded JSX text: `<p>Some text</p>`, `<button>Submit</button>`
- Hardcoded strings in `toastSuccess`/`toastError` calls
- Hardcoded `placeholder`, `label`, `title` props
- Template literals in JSX attributes

**Ignore**: non-UI strings (variable names, CSS classes, URLs, log messages).

### 2. Determine the Namespace

Check if a namespace already exists for this component area:

- Look in `apps/form-app/src/locales/index.ts` for the namespace registry
- If a namespace exists that fits, use it
- If not, create a new namespace file

### 3. Add Translation Keys

For each hardcoded string:

1. Add the key to `apps/form-app/src/locales/en/{namespace}.json`
2. Add the matching key to `apps/form-app/src/locales/ta/{namespace}.json` (use the English text as a placeholder if Tamil is unknown)

Follow the structure convention:

```json
{
  "titles": { "main": "..." },
  "buttons": { "save": "Save", "cancel": "Cancel" },
  "labels": { "fieldName": "..." },
  "errors": { "loadFailed": "..." },
  "placeholders": { "search": "..." }
}
```

### 4. Register the Namespace (if new)

Add to `apps/form-app/src/locales/index.ts`:

```typescript
import en_myNamespace from './en/myNamespace.json';
import ta_myNamespace from './ta/myNamespace.json';

// In the resources object:
myNamespace: { en: en_myNamespace, ta: ta_myNamespace },
```

### 5. Update the Component

```typescript
// Add at top of component
const { t } = useTranslation('myNamespace');

// Replace hardcoded strings
// ❌ Before: <p>Loading field analytics...</p>
// ✅ After:  <p>{t('messages.loadingFieldAnalytics')}</p>

// ❌ Before: toastSuccess('Saved', 'Your changes were saved')
// ✅ After:  toastSuccess(t('toasts.savedTitle'), t('toasts.savedMessage'))
```

### 6. Verify

Run `pnpm type-check` to confirm no TypeScript errors.
