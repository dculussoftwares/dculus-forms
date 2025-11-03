# Admin App - Internationalization (i18n) Implementation

## Overview

The admin-app now has a complete i18n infrastructure similar to the form-app, enabling easy translation support for multiple languages while currently focusing on English.

## Architecture

### Structure

```
apps/admin-app/src/
├── locales/
│   ├── index.ts                 # Translations aggregator and type exports
│   └── en/                      # English translations
│       ├── common.json          # Common UI strings
│       ├── dashboard.json       # Dashboard page
│       ├── organizations.json   # Organizations page
│       ├── users.json           # Users page
│       ├── templates.json       # Templates page
│       ├── layout.json          # Layout/Sidebar
│       ├── login.json           # Login page
│       └── app.json             # App-level strings
├── contexts/
│   └── LocaleContext.tsx        # Locale provider and context
└── hooks/
    └── useTranslation.ts        # Translation hook
```

## Usage

### 1. Using Translations in Components

```tsx
import { useTranslation } from '../hooks/useTranslation';

function MyComponent() {
  const { t } = useTranslation('dashboard'); // Specify namespace
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome')}</p>
    </div>
  );
}
```

### 2. Using Nested Keys

```tsx
const { t } = useTranslation('dashboard');

// Access nested properties with dot notation
<p>{t('stats.totalOrganizations')}</p>
<p>{t('error.unableToLoad')}</p>
```

### 3. Using Variables

```tsx
const { t } = useTranslation('dashboard');

// Pass values object
<p>{t('storage.subtitle', { values: { count: 10 } })}</p>

// In JSON file:
// "subtitle": "{{count}} files"
```

### 4. Default Values

```tsx
const { t } = useTranslation('common');

// Provide fallback text
<button>{t('tryAgain', { defaultValue: 'Try again' })}</button>
```

## Translation Files

### Common Strings (`common.json`)
Shared strings used across multiple pages:
- UI labels (loading, error, success)
- Common actions (save, delete, edit, cancel)
- Generic messages

### Page-Specific Files
Each major page has its own translation file:
- `dashboard.json` - Dashboard statistics and system health
- `organizations.json` - Organization management
- `users.json` - User management
- `templates.json` - Template management
- `layout.json` - Navigation and sidebar
- `login.json` - Login page
- `app.json` - App-level messages (access denied, loading)

## Adding New Translations

### 1. Add to English JSON File

```json
// apps/admin-app/src/locales/en/mypage.json
{
  "title": "My Page",
  "description": "This is my page",
  "actions": {
    "create": "Create New",
    "delete": "Delete"
  }
}
```

### 2. Import in `locales/index.ts`

```typescript
import enMyPage from './en/mypage.json';

export const translations = {
  en: {
    // ... existing translations
    myPage: enMyPage,
  },
} as const;
```

### 3. Use in Component

```tsx
import { useTranslation } from '../hooks/useTranslation';

function MyPage() {
  const { t } = useTranslation('myPage');
  
  return <h1>{t('title')}</h1>;
}
```

## Adding New Languages

To add support for additional languages (e.g., Spanish):

### 1. Create Language Directory

```bash
mkdir apps/admin-app/src/locales/es
```

### 2. Copy and Translate JSON Files

```bash
cp apps/admin-app/src/locales/en/*.json apps/admin-app/src/locales/es/
# Then translate each file
```

### 3. Update `locales/index.ts`

```typescript
import esCommon from './es/common.json';
import esDashboard from './es/dashboard.json';
// ... import all Spanish translations

export const translations = {
  en: { /* ... */ },
  es: {
    common: esCommon,
    dashboard: esDashboard,
    // ... all Spanish translations
  },
} as const;
```

### 4. Add Language Switcher (Optional)

Create a `LocaleSwitcher` component similar to form-app:

```tsx
import { useLocale } from '../contexts/LocaleContext';

export function LocaleSwitcher() {
  const { locale, setLocale, availableLocales } = useLocale();
  
  return (
    <select value={locale} onChange={(e) => setLocale(e.target.value)}>
      {availableLocales.map(lang => (
        <option key={lang} value={lang}>{lang}</option>
      ))}
    </select>
  );
}
```

## Type Safety

The i18n system is fully typed:

```typescript
// These types are auto-generated from your JSON files
type Locale = 'en' | 'es' | ...;
type Namespace = 'common' | 'dashboard' | 'organizations' | ...;

// TypeScript will autocomplete namespaces
const { t } = useTranslation('dashboard'); // ✅ Valid
const { t } = useTranslation('invalid');   // ❌ Type error
```

## Best Practices

1. **Keep keys semantic**: Use descriptive keys like `error.unableToLoad` instead of `errMsg1`

2. **Organize by feature**: Create separate JSON files for each major page or feature

3. **Use nested objects**: Group related translations together:
   ```json
   {
     "stats": {
       "totalUsers": "Total Users",
       "totalForms": "Total Forms"
     }
   }
   ```

4. **Consistent naming**: Use camelCase for keys, even in nested objects

5. **Default values**: Always provide default values for dynamic content:
   ```tsx
   t('missingKey', { defaultValue: 'Fallback text' })
   ```

## Current Status

✅ **Fully implemented** for English
- All pages using translations
- Type-safe translation system
- Consistent with form-app architecture
- Ready for multi-language expansion

## Files Updated

- ✅ `main.tsx` - Added LocaleProvider
- ✅ `App.tsx` - Using translations
- ✅ `AdminLayout.tsx` - Using translations
- ✅ `DashboardPage.tsx` - Using translations
- ✅ `OrganizationsPage.tsx` - Using translations
- ✅ `LoginPage.tsx` - Using translations
- ✅ `TemplatesPage.tsx` - Using translations

## Testing

The i18n system has been type-checked and is ready for use. To verify:

```bash
cd apps/admin-app
pnpm type-check  # ✅ Should pass
pnpm dev         # Test in browser
```

---

**Created**: November 3, 2025  
**Version**: 1.0
