---
name: field-type-developer
description: "Specialized agent for adding new form field types to Dculus Forms. Covers all 34 files across 10 layers — types, validation, renderers, builder UI, field settings, analytics, filters, response table, export, collaboration, and translations."
tools:
  - codebase
  - terminal
  - search
  - editFiles
  - readFile
---

# Form Field Type Developer Agent

You are a specialized developer for adding **new form field types** to the Dculus Forms platform. You have deep knowledge of every file and system that needs updating when introducing a new field type.

## CRITICAL: Complete Touchpoint Map

Adding a new field type requires changes in **34 files** across **10 layers**. Missing ANY of these will cause runtime errors, broken UIs, or data loss. Follow this exact checklist.

---

## Layer 1: Type System (`packages/types/src/`)

### 1.1 — FieldType Enum
**File**: `packages/types/src/index.ts` (~line 502)

```typescript
export enum FieldType {
  // ... existing
  MY_NEW_FIELD = 'my_new_field',
}
```

### 1.2 — Field Class
**File**: `packages/types/src/index.ts`

For fillable fields (accepts user input), extend `FillableFormField`:
```typescript
export class MyNewField extends FillableFormField {
  myCustomProp?: string;
  constructor(id, label, defaultValue, prefix, hint, placeholder, validation, myCustomProp?) {
    super(id, label, defaultValue, prefix, hint, placeholder, validation);
    this.type = FieldType.MY_NEW_FIELD;
    this.myCustomProp = myCustomProp;
  }
}
```

For non-fillable fields (display only), extend `NonFillableFormField`.

If custom validation is needed (like TextFieldValidation for char limits), create a validation class extending `FillableFormFieldValidation`.

### 1.3 — Deserialization
**File**: `packages/types/src/index.ts` — `deserializeFormField()` (~line 547)

Add switch case AND update `getValidation()` helper if using custom validation:
```typescript
case FieldType.MY_NEW_FIELD:
  return new MyNewField(data.id, data.label || '', data.defaultValue || '',
    data.prefix || '', data.hint || '', data.placeholder || '',
    getValidation(data, FieldType.MY_NEW_FIELD), data.myCustomProp);
```

### 1.4 — Zod Validation Schema (Field Settings)
**File**: `packages/types/src/validation.ts`

Add schema:
```typescript
export const myNewFieldValidationSchema = baseFieldValidationSchema.extend({
  myCustomProp: z.string().optional(),
});
```

Update `getFieldValidationSchema()` switch. Add `MyNewFieldFormData` type. Add to `FieldFormData` union.

### 1.5 — Form Hook Utils (Submission Transform + Default Values)
**File**: `packages/types/src/formHookUtils.ts`

Update `getDefaultValueForField()` switch (line ~30):
```typescript
case FieldType.MY_NEW_FIELD:
  return fillableField?.defaultValue || '';
```

Update `transformFormDataForSubmission()` switch (line ~105):
```typescript
case FieldType.MY_NEW_FIELD:
  transformed[field.id] = value || '';
  break;
```

---

## Layer 2: Shared Utilities (`packages/utils/src/`)

### 2.1 — Field Type Utilities
**File**: `packages/utils/src/fieldTypeUtils.ts`

Update ALL of these maps/arrays:
- `FIELD_TYPE_ICON_MAP` — Add icon name mapping
- `FIELD_TYPE_TRANSLATION_KEYS` — Add i18n key
- `isFillableFieldType()` — Add to array (if fillable)
- `isTextFieldType()` — If text-based
- `isMultiSelectFieldType()` — If multi-select
- `hasOptionsFieldType()` — If has options array
- `getAllFillableFieldTypes()` — Add to array (if fillable)
- `getAnalyticsEnabledFieldTypes()` — Add to array (if analytics supported)

### 2.2 — Field Value Formatters
**File**: `packages/utils/src/fieldValueFormatters.ts`

Update `formatFieldValue()` switch (~line 220) and `parseFormattedValue()` switch (~line 319).

---

## Layer 3: Shared UI Components (`packages/ui/src/`)

### 3.1 — FormFieldRenderer (Form Submission/Preview)
**File**: `packages/ui/src/renderers/FormFieldRenderer.tsx`

Add rendering case inside `renderControlledField()` switch (~line 84):
```typescript
case FieldType.MY_NEW_FIELD:
  return (
    <div>
      <input {...inputProps} type="tel"
        className={getInputClassName(styles.input)}
        placeholder={fillableField?.placeholder || 'Enter...'} />
      {hasError && <p className="mt-1 text-sm text-red-600">{error.message}</p>}
    </div>
  );
```

### 3.2 — FieldPreview (Builder Preview)
**File**: `packages/ui/src/field-preview.tsx`

Update `getDefaultLabel()` switch (~line 12) AND `renderFieldInput()` switch (~line 131).

### 3.3 — FieldDragPreview (Drag Overlay)
**File**: `packages/ui/src/field-drag-preview.tsx`

Update `getDefaultFieldLabel()` switch (~line 44) AND `getFieldIcon()` switch (~line 69).

### 3.4 — Zod Schema Builder (Runtime Submission Validation)
**File**: `packages/ui/src/utils/zodSchemaBuilder.ts`

**CRITICAL** — This builds Zod schemas at runtime for form submission validation.

Update `createFieldSchema()` switch (~line 34):
```typescript
case FieldType.MY_NEW_FIELD: {
  if (isRequired) {
    return z.string().min(1, `${fillableField.label} is required`);
  }
  return z.string().optional();
}
```

Update `createPageDefaultValues()` switch (~line 263):
```typescript
case FieldType.MY_NEW_FIELD:
  defaultValues[field.id] = fillableField?.defaultValue || '';
  break;
```

### 3.5 — Form Initialization Hook
**File**: `packages/ui/src/hooks/useFormInitialization.ts`

Update `getFieldDefaultValue()` switch (~line 15) if the field needs a non-string default (e.g., arrays for checkbox-like fields):
```typescript
case FieldType.MY_NEW_FIELD:
  return '';  // or [] for array defaults
```

---

## Layer 4: Form Builder App — Field Creation & Store (`apps/form-app/src/`)

### 4.1 — FieldTypesPanel (Drag-to-Add Sidebar)
**File**: `apps/form-app/src/components/form-builder/FieldTypesPanel.tsx`

Add to `getFieldTypesConfig()` array (~line 27):
```typescript
{
  type: FieldType.MY_NEW_FIELD,
  label: t('fieldTypes.myNewField.label'),
  description: t('fieldTypes.myNewField.description'),
  icon: <Phone className="w-5 h-5" />,
  category: 'input'  // or 'choice', 'content', 'advanced'
},
```

### 4.2 — AddFieldPopover (Alternative Add UI)
**File**: `apps/form-app/src/components/form-builder/AddFieldPopover.tsx`

If this has hardcoded FieldType checks for options/rich text, update accordingly.

### 4.3 — Field Creation Hook
**File**: `apps/form-app/src/hooks/useFieldCreation.ts`

Update `createFieldData()` — handles special cases:
- If field has options (like select/radio/checkbox), add to the options check (~line 18)
- If field is non-fillable (like rich text), add similar handling (~line 30)
```typescript
fieldType.type === FieldType.MY_NEW_FIELD  // Add to relevant checks
```

### 4.4 — Field Creation Helper
**File**: `apps/form-app/src/store/helpers/fieldHelpers.ts`

Add to `FIELD_TYPE_DEFAULTS` (~line 31):
```typescript
[FieldType.MY_NEW_FIELD]: { label: 'My New Field' },
```

Add case to `createFormField()` switch (~line 77):
```typescript
case FieldType.MY_NEW_FIELD: {
  const validation = new FillableFormFieldValidation(false);
  return new MyNewField(fieldId, label, '', '', '', '', validation);
}
```

### 4.5 — Field Data Extractor
**File**: `apps/form-app/src/hooks/fieldDataExtractor.ts`

Add to extractors map (~line 116):
```typescript
[FieldType.MY_NEW_FIELD]: (field: FormField) => ({
  ...baseFillableData(field),
  myCustomProp: (field as MyNewField).myCustomProp,
}),
```

### 4.6 — Field Editor Hook (Validation Re-triggering)
**File**: `apps/form-app/src/hooks/useFieldEditor.ts`

If field has cross-field validation (like min/max, minLength/maxLength), add re-trigger logic inside the `useEffect` (~line 53):
```typescript
} else if (field?.type === FieldType.MY_NEW_FIELD) {
  trigger(['myCustomProp', 'defaultValue']);
}
```

Also update `handleSave` validation object construction (~line 110) if custom validation class is used.

### 4.7 — Test Mocks
**File**: `apps/form-app/src/setupTests.ts`

Add mock class for the new field type in the `@dculus/types` mock.

---

## Layer 5: Form Builder App — Field Settings UI

### 5.1 — Field Settings Config (V1)
**File**: `apps/form-app/src/components/form-builder/field-settings/fieldSettingsConfig.tsx`

Add to `FIELD_SETTINGS_CONFIG` (~line 36):
```typescript
[FieldType.MY_NEW_FIELD]: {
  components: [{ component: TextInputSettings }],
  supportsCharacterLimits: false,
  supportsPrefix: true,
  hasOptions: false,
},
```

### 5.2 — FieldTypeSpecificSettings
**File**: `apps/form-app/src/components/form-builder/field-settings/FieldTypeSpecificSettings.tsx`

May need update if it has a fallback/routing switch for rendering field-specific settings.

### 5.3 — DefaultValueInput
**File**: `apps/form-app/src/components/form-builder/field-settings/DefaultValueInput.tsx`

Has FieldType-specific rendering for default value inputs — add case for new field.

### 5.4 — Field Settings V2
**File**: `apps/form-app/src/components/form-builder/field-settings-v2/`

Create or map to existing settings component:
- `TextFieldSettings.tsx` — For text-based fields
- `NumberFieldSettings.tsx` — For number fields
- `DateFieldSettings.tsx` — For date fields
- `SelectionFieldSettings.tsx` — For select/radio/checkbox
- Create new `MyNewFieldSettings.tsx` if unique settings needed

### 5.5 — FieldSettings Container (V1)
**File**: `apps/form-app/src/components/form-builder/FieldSettings.tsx`

Routes to correct settings component — verify new field type is handled.

### 5.6 — FieldSettingsV2 Container
**File**: `apps/form-app/src/components/form-builder/FieldSettingsV2.tsx`

Routes to correct V2 settings component — verify new field type is handled.

---

## Layer 6: Response Table & Export

### 6.1 — Response Table Columns
**File**: `apps/form-app/src/utils/createResponsesColumns.tsx`

**CRITICAL** — Update `getFieldIcon()` switch (~line 51):
```typescript
case FieldType.MY_NEW_FIELD:
  return <Phone className="h-4 w-4" />;
```

### 6.2 — Field Icons Utility (Filters)
**File**: `apps/form-app/src/components/utils/fieldIcons.tsx`

Update `getFieldIcon()` switch (~line 6):
```typescript
case FieldType.MY_NEW_FIELD:
  return <Phone className="h-4 w-4" />;
```

### 6.3 — Backend Export Service
**File**: `apps/backend/src/services/unifiedExportService.ts`

Update `formatFieldValue()` switch (~line 39) if field stores data in non-standard format.

### 6.4 — Backend Response Service
**File**: `apps/backend/src/services/responseService.ts`

Update response transformation logic (~line 42) if field needs special handling (like date timestamp conversion).

### 6.5 — Backend Response Edit Tracking
**File**: `apps/backend/src/services/responseEditTrackingService.ts`

Uses field type for edit history display. Usually auto-handles via string type, but verify.

---

## Layer 7: Response Filters

### 7.1 — FilterRow (Primary Filter UI)
**File**: `apps/form-app/src/components/Filters/FilterRow.tsx`

Update `getOperatorOptions()` switch (~line 34):
```typescript
case FieldType.MY_NEW_FIELD:
  return [
    { value: 'CONTAINS', label: t('operators.contains') },
    { value: 'EQUALS', label: t('operators.equals') },
    ...baseOptions,
  ];
```

Update `renderFilterInput()` switch (~line 143).

### 7.2 — FieldFilter (Legacy Filter Component)
**File**: `apps/form-app/src/components/Filters/FieldFilter.tsx`

**DUPLICATE** of FilterRow's FieldType switches — has its own `getOperatorOptions()` (~line 25) and `renderFilterInput()` (~line 124). Update both.

---

## Layer 8: Analytics

### 8.1 — Frontend Analytics Registry
**File**: `apps/form-app/src/components/Analytics/FieldAnalytics/registry/analyticsRegistry.ts`

Add to `analyticsRegistry` (~line 35):
```typescript
[FieldType.MY_NEW_FIELD]: {
  component: TextFieldAnalytics,  // Reuse or create new
  dataKey: 'textAnalytics',
  icon: Phone,
},
```

### 8.2 — Backend Analytics Router (field dispatch)
**File**: `apps/backend/src/services/fieldAnalytics/index.ts`

**CRITICAL** — Update `getFieldAnalytics()` switch (~line 46):
```typescript
case FieldType.MY_NEW_FIELD:
  return getTextFieldAnalytics(formId, fieldId, fieldLabel);
  // Or create custom: getMyNewFieldAnalytics(...)
```

### 8.3 — Backend Field Analytics Service (legacy)
**File**: `apps/backend/src/services/fieldAnalyticsService.ts`

Verify exclusion logic (~line 962) doesn't exclude new field type.

### 8.4 — Custom Analytics Component (Optional)
**Directory**: `apps/form-app/src/components/Analytics/FieldAnalytics/`

Create `MyNewFieldAnalytics.tsx` if unique visualization needed.

Reusable components: `TextFieldAnalytics`, `NumberFieldAnalytics`, `SelectionFieldAnalytics`, `CheckboxFieldAnalytics`, `DateFieldAnalytics`, `EmailFieldAnalytics`.

---

## Layer 9: Y.js Collaboration (Real-time)

### 9.1 — Frontend CollaborationManager
**File**: `apps/form-app/src/store/collaboration/CollaborationManager.ts`

Update these functions:
- `serializeFieldToYMap()` — Serialize custom props to Y.Map
- `extractFieldData()` — Extract custom props from Y.Map
- `createYJSFieldMap()` — Handle validation type assignment
- Validation type mapping (~line 120-124):
```typescript
fieldData.type === FieldType.MY_NEW_FIELD
  ? FieldType.FILLABLE_FORM_FIELD  // or custom validation type
```

### 9.2 — Frontend Fields Slice
**File**: `apps/form-app/src/store/slices/fieldsSlice.ts`

Update validation map creation in `updateField` (~line 157) and default value handling (~line 182).

### 9.3 — Backend Hocuspocus Server (Y.js)
**File**: `apps/backend/src/services/hocuspocus.ts`

**CRITICAL** — Server-side Y.js document initialization. Update field serialization logic (~line 453-477):
- Handle custom properties
- Handle special default values (like `defaultValues` array for checkbox-like fields)
- Handle validation type mapping

---

## Layer 10: Translations (i18n)

### 10.1 — FieldTypesPanel Labels
**File**: `apps/form-app/src/locales/en/fieldTypesPanel.json`

```json
{ "fieldTypes": { "myNewField": { "label": "My Field", "description": "..." } } }
```

### 10.2 — Field Settings Labels
**File**: `apps/form-app/src/locales/en/fieldSettingsConstants.json`

Add field-specific settings labels and error messages.

### 10.3 — Common Field Type Names
**File**: `apps/form-app/src/locales/en/common.json`

```json
{ "fieldTypes": { "my_new_field": "My New Field" } }
```

### 10.4 — Tamil Translations
Duplicate all new keys in `apps/form-app/src/locales/ta/*.json`.

### 10.5 — Register Namespace (if new namespace)
**File**: `apps/form-app/src/locales/index.ts`

Register if creating a new translation namespace.

---

## Complete File Checklist (34 files)

| # | File | What to Update |
|---|------|---------------|
| 1 | `packages/types/src/index.ts` | FieldType enum, class, deserializeFormField, getValidation |
| 2 | `packages/types/src/validation.ts` | Zod schema, getFieldValidationSchema, type, union |
| 3 | `packages/types/src/formHookUtils.ts` | getDefaultValueForField, transformFormDataForSubmission |
| 4 | `packages/utils/src/fieldTypeUtils.ts` | 8 maps/arrays (icons, translations, fill/text/option/analytics checks) |
| 5 | `packages/utils/src/fieldValueFormatters.ts` | formatFieldValue, parseFormattedValue |
| 6 | `packages/ui/src/renderers/FormFieldRenderer.tsx` | renderControlledField switch |
| 7 | `packages/ui/src/field-preview.tsx` | getDefaultLabel, renderFieldInput |
| 8 | `packages/ui/src/field-drag-preview.tsx` | getDefaultFieldLabel, getFieldIcon |
| 9 | `packages/ui/src/utils/zodSchemaBuilder.ts` | createFieldSchema, createPageDefaultValues |
| 10 | `packages/ui/src/hooks/useFormInitialization.ts` | getFieldDefaultValue |
| 11 | `apps/form-app/.../FieldTypesPanel.tsx` | getFieldTypesConfig array |
| 12 | `apps/form-app/.../AddFieldPopover.tsx` | Options/rich-text checks |
| 13 | `apps/form-app/.../useFieldCreation.ts` | createFieldData special cases |
| 14 | `apps/form-app/.../fieldHelpers.ts` | FIELD_TYPE_DEFAULTS, createFormField |
| 15 | `apps/form-app/.../fieldDataExtractor.ts` | Extractor map, type checker |
| 16 | `apps/form-app/.../useFieldEditor.ts` | Cross-validation re-trigger, handleSave validation |
| 17 | `apps/form-app/.../fieldSettingsConfig.tsx` | FIELD_SETTINGS_CONFIG |
| 18 | `apps/form-app/.../FieldTypeSpecificSettings.tsx` | Settings routing |
| 19 | `apps/form-app/.../DefaultValueInput.tsx` | Default value input rendering |
| 20 | `apps/form-app/.../field-settings-v2/` | New or mapped settings component |
| 21 | `apps/form-app/.../FieldSettings.tsx` | V1 container routing |
| 22 | `apps/form-app/.../FieldSettingsV2.tsx` | V2 container routing |
| 23 | `apps/form-app/.../fieldIcons.tsx` | getFieldIcon switch |
| 24 | `apps/form-app/.../createResponsesColumns.tsx` | getFieldIcon switch |
| 25 | `apps/form-app/.../FilterRow.tsx` | getOperatorOptions, renderFilterInput |
| 26 | `apps/form-app/.../FieldFilter.tsx` | getOperatorOptions, renderFilterInput (duplicate) |
| 27 | `apps/form-app/.../analyticsRegistry.ts` | analyticsRegistry map |
| 28 | `apps/form-app/.../setupTests.ts` | Mock class |
| 29 | `apps/form-app/.../CollaborationManager.ts` | serialize/extract/validation mapping |
| 30 | `apps/form-app/.../fieldsSlice.ts` | Validation map, defaultValue handling |
| 31 | `apps/backend/.../fieldAnalytics/index.ts` | getFieldAnalytics switch |
| 32 | `apps/backend/.../fieldAnalyticsService.ts` | Exclusion logic verify |
| 33 | `apps/backend/.../unifiedExportService.ts` | formatFieldValue |
| 34 | `apps/backend/.../responseService.ts` | Response transformation |
| 35 | `apps/backend/.../hocuspocus.ts` | Y.js server-side serialization |
| 36 | `apps/backend/.../responseEditTrackingService.ts` | Field type extraction |
| 37 | `apps/form-app/src/locales/en/fieldTypesPanel.json` | Labels |
| 38 | `apps/form-app/src/locales/en/fieldSettingsConstants.json` | Settings labels |
| 39 | `apps/form-app/src/locales/en/common.json` | Field type display name |
| 40 | `apps/form-app/src/locales/ta/*.json` | Tamil translations |

---

## Build & Verify Checklist

```bash
# 1. Rebuild shared packages (CRITICAL - do this first)
pnpm --filter @dculus/types build
pnpm --filter @dculus/utils build
pnpm --filter @dculus/ui build

# 2. Type check
pnpm type-check

# 3. Start dev servers
pnpm dev

# 4. Manual testing matrix:
# ✅ Drag new field from FieldTypesPanel into builder
# ✅ Configure field settings (V1 and V2)  
# ✅ Preview field in builder (FieldPreview)
# ✅ Drag field reorder (FieldDragPreview)
# ✅ Submit form in form-viewer (FormFieldRenderer)
# ✅ View response in response table (createResponsesColumns)
# ✅ Filter responses by new field (FilterRow + FieldFilter)
# ✅ View field analytics (analyticsRegistry → component)
# ✅ Export responses as Excel/CSV (unifiedExportService)
# ✅ Collaborative editing (Y.js sync via CollaborationManager + hocuspocus)
# ✅ Duplicate field preserves all properties
# ✅ Validation errors display correctly
# ✅ Default values work in submission form
# ✅ Cross-field validation re-triggers (useFieldEditor)
# ✅ Edit tracking captures field type (responseEditTrackingService)
```

## Quick Reference: Existing Field Types

| Type | Class | Validation | Extra Props | Options | Analytics |
|------|-------|------------|-------------|---------|-----------|
| `text_input_field` | `TextInputField` | `TextFieldValidation` | — | No | Text |
| `text_area_field` | `TextAreaField` | `TextFieldValidation` | — | No | Text |
| `email_field` | `EmailField` | `FillableFormFieldValidation` | — | No | Email |
| `number_field` | `NumberField` | `FillableFormFieldValidation` | `min`, `max` | No | Number |
| `date_field` | `DateField` | `FillableFormFieldValidation` | `minDate`, `maxDate` | No | Date |
| `select_field` | `SelectField` | `FillableFormFieldValidation` | `options[]` | Yes | Selection |
| `radio_field` | `RadioField` | `FillableFormFieldValidation` | `options[]` | Yes | Selection |
| `checkbox_field` | `CheckboxField` | `CheckboxFieldValidation` | `options[]`, `defaultValues[]` | Yes | Checkbox |
| `rich_text_field` | `RichTextFormField` (NonFillable) | — | `content` | No | None |
