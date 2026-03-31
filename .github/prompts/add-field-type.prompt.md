---
description: "Add a new form field type to the dculus-forms application"
mode: "agent"
---

# Add New Form Field Type

Follow these steps to add a new form field type (e.g., PhoneField, UrlField, RatingField):

## Step 1: Define the Field Class

In `packages/types/src/index.ts`, add a new class extending `FillableFormField`:

```typescript
export class MyNewField extends FillableFormField {
  type = 'myFieldType' as const;
  
  // Add field-specific properties
  myOption: string;
  
  constructor(data?: Partial<MyNewField>) {
    super(data);
    this.myOption = data?.myOption ?? 'default';
  }
}
```

## Step 2: Update Serialization

In `packages/types/src/index.ts`, update the `deserializeFormField` function:

```typescript
case 'myFieldType':
  return new MyNewField(data);
```

## Step 3: Add Validation Schema

In `packages/types/src/validation.ts`, add a Zod schema:

```typescript
const myNewFieldSchema = fillableFieldSchema.extend({
  myOption: z.string().optional(),
});
```

## Step 4: Add Field Renderer

In `packages/ui/src/renderers/FormFieldRenderer.tsx`, add the rendering case:

```typescript
case 'myFieldType':
  return <MyNewFieldRenderer field={field} mode={mode} />;
```

## Step 5: Add to Field Types Panel

In `apps/form-app/src/components/form-builder/FieldTypesPanel.tsx`, add the new field option.

## Step 6: Add Field Settings

Create field settings in `apps/form-app/src/components/form-builder/field-settings/`.

## Step 7: Add Translations

Create translation keys in `apps/form-app/src/locales/en/fieldSettingsConstants.json`.

## Step 8: Add Field Analytics (Optional)

If the field type needs custom analytics, add to `apps/backend/src/services/fieldAnalyticsService.ts`.
