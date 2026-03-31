---
description: "Add a new page/feature to the form-app frontend"
mode: "agent"
---

# Add New Frontend Page

Follow these steps to add a new page/feature to the form-app:

## Step 1: Create Page Component

Create `apps/form-app/src/pages/MyPage.tsx`:

```typescript
import { useTranslation } from '../hooks/useTranslation';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';

export default function MyPage() {
  const { t } = useTranslation('myPage');
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t('titles.main')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('titles.section')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Page content */}
        </CardContent>
      </Card>
    </div>
  );
}
```

## Step 2: Add Route

In `apps/form-app/src/App.tsx`, add the route:

```typescript
import MyPage from './pages/MyPage';

<Route path="/my-page" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
```

## Step 3: Add Navigation

Update the sidebar in `apps/form-app/src/components/nav-main.tsx` or appropriate nav component.

## Step 4: Create Translations

Create `apps/form-app/src/locales/en/myPage.json`:
```json
{
  "titles": { "main": "My Page", "section": "Section Title" },
  "buttons": { "save": "Save", "cancel": "Cancel" },
  "messages": { "success": "Done!", "error": "Failed" }
}
```

Create `apps/form-app/src/locales/ta/myPage.json` (Tamil translations).

Register in `apps/form-app/src/locales/index.ts`.

## Step 5: Add GraphQL Queries (if needed)

Add queries to `apps/form-app/src/graphql/queries.ts`.

## Step 6: Create Custom Hook (if needed)

Create `apps/form-app/src/hooks/useMyFeature.ts` to encapsulate logic.

## Step 7: Add Sub-Components (if needed)

Create in `apps/form-app/src/components/my-feature/` directory.
