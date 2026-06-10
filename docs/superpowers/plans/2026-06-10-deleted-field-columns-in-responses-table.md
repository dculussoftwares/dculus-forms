# Deleted Field Columns in Responses Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a field is deleted from the form builder, responses that already contain data for that field continue to show a read-only "deleted" column in the responses table.

**Architecture:** Soft-delete approach — `removeField` sets `deleted: true` on the Y.js field map instead of removing it. The builder filters `deleted` fields everywhere it renders; the response table renders them as a distinct third column group (active → deleted → unknown orphans). No DB migrations required.

**Tech Stack:** TypeScript, Yjs (Y.Map/Y.Array), Zustand, TanStack Table (`ColumnDef`), React, ExcelJS (export), Vitest (unit tests)

---

## File Map

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `deleted?: boolean` to `FormField`; update `deserializeFormSchema` to post-process flag |
| `apps/form-app/src/store/collaboration/CollaborationManager.ts` | Add `deleted` to `FieldData`; extract from Y.js; filter deleted fields from builder pages |
| `apps/form-app/src/store/slices/fieldsSlice.ts` | Soft-delete in `removeField` |
| `apps/backend/src/services/formMetadataService.ts` | Skip deleted fields in field count |
| `apps/backend/src/services/templateService.ts` | Strip deleted fields when saving templates |
| `apps/form-app/src/utils/createResponsesColumns.tsx` | Three column groups; orphan detection |
| `apps/form-app/src/pages/Responses.tsx` | Pass `responses` to `createResponsesColumns` |
| `apps/backend/src/services/unifiedExportService.ts` | Include deleted + orphan columns in export |

---

## Task 1: Add `deleted` to FormField and fix deserializeFormSchema

**Files:**
- Modify: `packages/types/src/index.ts:161-168` (FormField class)
- Modify: `packages/types/src/index.ts:761-770` (deserializeFormSchema)

- [ ] **Step 1: Add `deleted` property to FormField class**

  In `packages/types/src/index.ts`, the `FormField` class at line 161 currently reads:
  ```typescript
  export class FormField {
    id: string;
    type: FieldType;
    constructor(id: string) {
      this.id = id;
      this.type = FieldType.FORM_FIELD;
    }
  }
  ```

  Change it to:
  ```typescript
  export class FormField {
    id: string;
    type: FieldType;
    deleted?: boolean;
    constructor(id: string) {
      this.id = id;
      this.type = FieldType.FORM_FIELD;
    }
  }
  ```

- [ ] **Step 2: Update `deserializeFormSchema` to post-process the `deleted` flag**

  `serializeFormField` already spreads all field instance properties (`{ ...field, __type: field.type }`), so `deleted: true` is preserved in the stored JSON automatically. But `deserializeFormField` creates instances via constructors that don't accept `deleted`. Fix this in `deserializeFormSchema` (line 761):

  Current:
  ```typescript
  export const deserializeFormSchema = (data: any): FormSchema => {
    return {
      ...data,
      layout: data.layout,
      pages: (data.pages || []).map((page: any) => ({
        ...page,
        fields: (page.fields || []).map(deserializeFormField).filter((f: FormField | null): f is FormField => f !== null),
      })),
    };
  };
  ```

  Replace with:
  ```typescript
  export const deserializeFormSchema = (data: any): FormSchema => {
    return {
      ...data,
      layout: data.layout,
      pages: (data.pages || []).map((page: any) => ({
        ...page,
        fields: (page.fields || [])
          .map((fieldData: any) => {
            const field = deserializeFormField(fieldData);
            if (field && fieldData.deleted) field.deleted = true;
            return field;
          })
          .filter((f: FormField | null): f is FormField => f !== null),
      })),
    };
  };
  ```

- [ ] **Step 3: Build the types package to verify no type errors**

  Run from repo root:
  ```bash
  pnpm --filter @dculus/types build
  ```
  Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/types/src/index.ts
  git commit -m "feat(types): add deleted flag to FormField and preserve through deserialization"
  ```

---

## Task 2: Soft-delete in `removeField`

**Files:**
- Modify: `apps/form-app/src/store/slices/fieldsSlice.ts:317-346`

- [ ] **Step 1: Change `removeField` from hard-delete to soft-delete**

  In `fieldsSlice.ts`, the `removeField` action at line 317 currently ends with:
  ```typescript
      if (fieldIndex !== -1) {
        fieldsArray.delete(fieldIndex, 1);
      }
    },
  ```

  Replace with:
  ```typescript
      if (fieldIndex !== -1) {
        ydoc.transact(() => {
          fieldsArray.get(fieldIndex).set('deleted', true);
        });
      }
    },
  ```

  The Y.js transaction ensures collaborators receive a single atomic update. The field stays in the `fieldsArray` with `deleted: true` — it will be excluded from the builder's rendered pages (Task 3) but preserved in the form schema JSON for the response table.

- [ ] **Step 2: Type-check the form-app**

  ```bash
  pnpm --filter form-app type-check
  ```
  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/form-app/src/store/slices/fieldsSlice.ts
  git commit -m "feat(builder): soft-delete fields instead of hard-delete"
  ```

---

## Task 3: Preserve `deleted` in Y.js path and filter builder pages

**Files:**
- Modify: `apps/form-app/src/store/collaboration/CollaborationManager.ts:14-33` (FieldData type)
- Modify: `apps/form-app/src/store/collaboration/CollaborationManager.ts:69-111` (extractFieldData)
- Modify: `apps/form-app/src/store/collaboration/CollaborationManager.ts:114-167` (deserializePagesFromYJS)

Context: `deserializePagesFromYJS` builds the `FormPage[]` that the Zustand store exposes as `pages`. All builder components (canvas, sidebar, DnD, analytics) consume `pages` from the store. Filtering deleted fields here means every builder consumer gets pre-filtered data automatically — no individual component changes needed.

The response table reads `formSchema` from a GraphQL query (not from the Zustand store), so it still receives all fields including deleted ones.

- [ ] **Step 1: Add `deleted` to the `FieldData` type**

  At line 14, `FieldData` currently ends with:
  ```typescript
    maxFileSizeMb?: number;
    maxFiles?: number;
  };
  ```

  Add `deleted` before the closing brace:
  ```typescript
    maxFileSizeMb?: number;
    maxFiles?: number;
    deleted?: boolean;
  };
  ```

- [ ] **Step 2: Extract `deleted` from the Y.js field map in `extractFieldData`**

  The `extractFieldData` function builds a `result` object ending at line ~110:
  ```typescript
    if (fieldType === FieldType.FILE_UPLOAD_FIELD) {
      // ...
    }

    return result;
  };
  ```

  Add extraction of `deleted` to the initial `result` object (around line 69). The result object currently starts:
  ```typescript
    const result: FieldData = {
      id: fieldMap.get('id') || '',
      type: fieldType || FieldType.TEXT_INPUT_FIELD,
      label: fieldMap.get('label') || '',
  ```

  Add `deleted` as the last property before the closing brace of the `result` object literal:
  ```typescript
    const result: FieldData = {
      id: fieldMap.get('id') || '',
      type: fieldType || FieldType.TEXT_INPUT_FIELD,
      label: fieldMap.get('label') || '',
      required: validation?.required || fieldMap.get('required') || false,
      placeholder: fieldMap.get('placeholder') || '',
      defaultValue,
      prefix: fieldMap.get('prefix') || '',
      hint: fieldMap.get('hint') || '',
      options: fieldMap.get('options')
        ? fieldMap.get('options').toArray()
        : undefined,
      min: validation?.minLength || fieldMap.get('min'),
      max: validation?.maxLength || fieldMap.get('max'),
      minDate: fieldMap.get('minDate'),
      maxDate: fieldMap.get('maxDate'),
      validation,
      allowedMimeTypes: fieldMap.get('allowedMimeTypes')
        ? fieldMap.get('allowedMimeTypes').toArray()
        : undefined,
      maxFileSizeMb: fieldMap.get('maxFileSizeMb'),
      maxFiles: fieldMap.get('maxFiles'),
      deleted: fieldMap.get('deleted') || undefined,
    };
  ```

- [ ] **Step 3: Post-process `deleted` on the field instance and filter deleted fields from builder pages**

  In `deserializePagesFromYJS` (line 121-157), the fields mapping currently ends with:
  ```typescript
          return deserializeFormField({
            ...fieldData,
            validation: validationObj,
          });
        })
        .filter((f): f is FormField => f !== null)
  ```

  Replace with:
  ```typescript
          const field = deserializeFormField({
            ...fieldData,
            validation: validationObj,
          });
          if (field && fieldData.deleted) field.deleted = true;
          return field;
        })
        .filter((f): f is FormField => f !== null && !f.deleted)
  ```

  The `!f.deleted` filter here is what keeps deleted fields out of the builder's store state.

- [ ] **Step 4: Type-check**

  ```bash
  pnpm --filter form-app type-check
  ```
  Expected: exits 0.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/form-app/src/store/collaboration/CollaborationManager.ts
  git commit -m "feat(collaboration): propagate deleted flag from YJS and exclude deleted fields from builder store"
  ```

---

## Task 4: Fix field count in formMetadataService

**Files:**
- Modify: `apps/backend/src/services/formMetadataService.ts:28-34`

Context: `extractFormStatsFromYDoc` counts fields by summing `fieldsArray.length` across all pages. After the soft-delete change, deleted fields remain in the array, so this count must skip them.

- [ ] **Step 1: Change field count to skip deleted fields**

  Current code at line 28:
  ```typescript
      if (pagesArray) {
        pagesArray.forEach((pageMap) => {
          const fieldsArray = pageMap.get('fields') as Y.Array<any>;
          fieldCount += fieldsArray?.length || 0;
        });
      }
  ```

  Replace with:
  ```typescript
      if (pagesArray) {
        pagesArray.forEach((pageMap) => {
          const fieldsArray = pageMap.get('fields') as Y.Array<Y.Map<any>>;
          if (fieldsArray) {
            fieldsArray.forEach((fieldMap) => {
              if (fieldMap.get('deleted') !== true) fieldCount++;
            });
          }
        });
      }
  ```

- [ ] **Step 2: Type-check the backend**

  ```bash
  pnpm --filter backend type-check
  ```
  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/backend/src/services/formMetadataService.ts
  git commit -m "fix(metadata): exclude soft-deleted fields from form field count"
  ```

---

## Task 5: Strip deleted fields when saving templates

**Files:**
- Modify: `apps/backend/src/services/templateService.ts`

Context: Templates are reusable form skeletons. A deleted field from a specific form instance should not pollute a template derived from it.

- [ ] **Step 1: Add `stripDeletedFields` helper and apply in create/update**

  At the top of `templateService.ts`, after the existing imports, add a helper function and update `createTemplate` and `updateTemplate` to use it.

  Add after line 8 (after the last import):
  ```typescript
  import { FillableFormField } from '@dculus/types';
  ```

  Wait — `FormSchema` and `serializeFormSchema` are already imported. Add the helper function before `getAllTemplates`:

  After line 35 (`export interface UpdateTemplateInput {`...closing brace), add:
  ```typescript
  const stripDeletedFields = (schema: FormSchema): FormSchema => ({
    ...schema,
    pages: schema.pages.map((page) => ({
      ...page,
      fields: page.fields.filter((f) => !f.deleted),
    })),
  });
  ```

  Then in `createTemplate` (line 82), change:
  ```typescript
      formSchema: serializeFormSchema(templateData.formSchema) as any,
  ```
  to:
  ```typescript
      formSchema: serializeFormSchema(stripDeletedFields(templateData.formSchema)) as any,
  ```

  And in `updateTemplate` (line 107), change:
  ```typescript
      if (templateData.formSchema) updateData.formSchema = serializeFormSchema(templateData.formSchema);
  ```
  to:
  ```typescript
      if (templateData.formSchema) updateData.formSchema = serializeFormSchema(stripDeletedFields(templateData.formSchema));
  ```

- [ ] **Step 2: Type-check the backend**

  ```bash
  pnpm --filter backend type-check
  ```
  Expected: exits 0.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/backend/src/services/templateService.ts
  git commit -m "fix(templates): strip soft-deleted fields before saving as template"
  ```

---

## Task 6: Three-group response table columns

**Files:**
- Modify: `apps/form-app/src/utils/createResponsesColumns.tsx`
- Modify: `apps/form-app/src/pages/Responses.tsx`

Context: The response table currently calls `createFieldColumns(deserializedSchema, t)` which iterates only active fields. We need three groups: (1) active fields, (2) soft-deleted fields with an amber "deleted" badge, (3) unknown orphan field IDs in `response.data` that don't match any field in the schema. Deleted and orphan columns are read-only (no sort, no filter).

- [ ] **Step 1: Add `responses` to `CreateResponsesColumnsOptions`**

  In `createResponsesColumns.tsx`, the interface at line 74 currently ends with:
  ```typescript
    onDeleteResponse: (responseId: string) => void;
    t: (
      key: string,
      options?: { values?: Record<string, string | number>; defaultValue?: string }
    ) => string;
  }
  ```

  Add `responses` before `t`:
  ```typescript
    onDeleteResponse: (responseId: string) => void;
    responses?: FormResponse[];
    t: (
      key: string,
      options?: { values?: Record<string, string | number>; defaultValue?: string }
    ) => string;
  }
  ```

- [ ] **Step 2: Replace `createFieldColumns` with three-group version**

  The current `createFieldColumns` function (lines 420-501) iterates all fields and returns one list. Replace it entirely with:

  ```typescript
  const createFieldColumns = (
    formSchema: FormSchema,
    responses: FormResponse[],
    t: CreateResponsesColumnsOptions['t']
  ): ColumnDef<FormResponse>[] => {
    const activeColumns: ColumnDef<FormResponse>[] = [];
    const deletedColumns: ColumnDef<FormResponse>[] = [];

    // --- Group 1: active fields; Group 2: soft-deleted fields ---
    formSchema.pages.forEach((page) => {
      page.fields.forEach((field) => {
        if (!(field instanceof FillableFormField)) return;

        const isDeleted = field.deleted === true;

        // TFColumnHeader only accepts title: string, so deleted columns use a custom header
        const col: ColumnDef<FormResponse> = {
          accessorKey: `data.${field.id}`,
          id: `field-${field.id}`,
          header: isDeleted
            ? () => (
                <div className="flex items-center gap-1.5">
                  <FieldIconChip fieldType={field.type} />
                  <span className="text-[13px] text-muted-foreground italic truncate">{field.label}</span>
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                    deleted
                  </span>
                </div>
              )
            : ({ column }) => (
                <TFColumnHeader
                  column={column}
                  icon={<FieldIconChip fieldType={field.type} />}
                  title={field.label}
                />
              ),
          cell: ({ row }) => {
            const value = row.original.data[field.id];

            if (!isDeleted && field.type === FieldType.FILE_UPLOAD_FIELD) {
              const keys: string[] = Array.isArray(value) ? value : [];
              if (keys.length === 0) {
                return (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm italic">{t('table.fieldResponses.noResponse')}</span>
                  </div>
                );
              }
              return (
                <div className="flex flex-col gap-1">
                  {keys.map((key, idx) => (
                    <FileDownloadLink key={idx} s3Key={key} />
                  ))}
                </div>
              );
            }

            const formattedValue = formatFieldValueUtil(value, field.type);
            if (!formattedValue) {
              return (
                <div className="flex items-center space-x-2 text-muted-foreground">
                  {getFieldIcon(field.type)}
                  <span className="text-sm italic">{t('table.fieldResponses.noResponse')}</span>
                </div>
              );
            }
            return (
              <div className="flex items-center space-x-2">
                <div className="text-muted-foreground">{getFieldIcon(field.type)}</div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block" title={formattedValue}>
                    {formattedValue}
                  </span>
                </div>
              </div>
            );
          },
          enableSorting: !isDeleted,
          enableHiding: true,
          size: 200,
        };

        if (isDeleted) {
          deletedColumns.push(col);
        } else {
          activeColumns.push(col);
        }
      });
    });

    // --- Group 3: orphan field IDs (historical deletions before this feature) ---
    const knownFieldIds = new Set(
      formSchema.pages.flatMap((p) => p.fields.map((f) => f.id))
    );
    const orphanIds = new Set(
      responses.flatMap((r) => Object.keys(r.data)).filter((id) => !knownFieldIds.has(id))
    );

    const orphanColumns: ColumnDef<FormResponse>[] = Array.from(orphanIds).map((fieldId) => ({
      accessorKey: `data.${fieldId}`,
      id: `orphan-${fieldId}`,
      header: () => (
        <span className="text-muted-foreground italic flex items-center gap-1.5">
          Unknown field
          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 not-italic">
            deleted
          </span>
        </span>
      ),
      cell: ({ row }) => {
        const value = row.original.data[fieldId];
        if (value === undefined || value === null || value === '') {
          return <span className="text-sm italic text-muted-foreground">—</span>;
        }
        return (
          <span className="text-sm font-medium truncate block" title={String(value)}>
            {String(value)}
          </span>
        );
      },
      enableSorting: false,
      enableHiding: true,
      size: 200,
    }));

    return [...activeColumns, ...deletedColumns, ...orphanColumns];
  };
  ```

- [ ] **Step 3: Update `createResponsesColumns` to pass `responses` through**

  In the main `createResponsesColumns` function (line 645), destructure `responses` from options:
  ```typescript
  export const createResponsesColumns = ({
    formSchema,
    formId,
    pluginsData,
    locale,
    formTags = [],
    onPluginClick,
    onDeleteResponse,
    responses = [],
    t,
  }: CreateResponsesColumnsOptions): ColumnDef<FormResponse>[] => {
  ```

  Then find the line that calls `createFieldColumns` — currently:
  ```typescript
    const fieldColumns = createFieldColumns(deserializedSchema, t);
  ```

  Change it to:
  ```typescript
    const fieldColumns = createFieldColumns(deserializedSchema, responses, t);
  ```

- [ ] **Step 4: Pass responses to `createResponsesColumns` in Responses.tsx**

  In `apps/form-app/src/pages/Responses.tsx`, `responses` is currently declared at line 259 (`const responses = responsePagination?.data || []`) but the `columns` useMemo is at line 223. Using `responses` in the useMemo deps array before its declaration would cause a temporal dead zone error.

  Fix: add a `responses` declaration **before** the `columns` useMemo, derived directly from `responsesData` (which is already declared before the useMemo via `useQuery`):

  Add this line immediately before the `columns` useMemo (before line 223):
  ```typescript
  const responses: FormResponse[] = responsesData?.responsesByForm?.data ?? [];
  ```

  Then make sure `FormResponse` is imported from `@dculus/types` in this file. Check the existing imports — it likely already is (it's used in types elsewhere). If not, add it.

  Then update the `columns` useMemo to pass `responses` and add it to the deps:
  ```typescript
    const columns = useMemo(
      () => createResponsesColumns({
        formSchema: formData?.form?.formSchema,
        formId: actualFormId!,
        pluginsData,
        locale,
        formTags: userFormTags,
        responses,
        onPluginClick: (pluginType, metadata, responseId) => {
          responsesState.setPluginDialogState({ pluginType, metadata, responseId });
        },
        onDeleteResponse: handleDeleteResponse,
        t,
      }),
      [formData, pluginsData, formTags, locale, actualFormId, responses, t]
    );
  ```

  The existing `const responses = responsePagination?.data || []` at line 259 can remain — it's still used downstream by other parts of the page. The new declaration above is a separate early reference for the columns useMemo.

- [ ] **Step 5: Type-check**

  ```bash
  pnpm --filter form-app type-check
  ```
  Expected: exits 0.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/form-app/src/utils/createResponsesColumns.tsx apps/form-app/src/pages/Responses.tsx
  git commit -m "feat(responses): show deleted field columns in responses table"
  ```

---

## Task 7: Include deleted fields in CSV/Excel export

**Files:**
- Modify: `apps/backend/src/services/unifiedExportService.ts:113-175`

Context: `extractFieldInfo` builds the `fieldInfo` map (fieldId → label) and `orderedFieldIds` list used by both `generateCsvContent` and `generateExcelContent`. Updating this function makes both formats work automatically.

- [ ] **Step 1: Update `extractFieldInfo` to include deleted fields and orphan IDs**

  The current function at line 113 handles two branches: empty schema (extract from responses) and non-empty schema (extract from schema). Both branches need to include deleted fields.

  Replace the entire `extractFieldInfo` function with:

  ```typescript
  const extractFieldInfo = (
    formSchema: FormSchema,
    responses: FormResponse[]
  ): { fieldInfo: Record<string, string>; orderedFieldIds: string[] } => {
    const fieldInfo: Record<string, string> = {};
    let orderedFieldIds: string[] = [];

    if (formSchema.pages.length === 0 && responses.length > 0) {
      logger.info(
        'Unified Export - Form schema is empty, extracting field info from response data...'
      );
      const allFieldIds = new Set<string>();
      responses.forEach((response) => {
        Object.keys(response.data).forEach((fieldId) => allFieldIds.add(fieldId));
      });
      orderedFieldIds = Array.from(allFieldIds).sort();
      orderedFieldIds.forEach((fieldId) => {
        let label = fieldId;
        if (fieldId.includes('field-')) {
          const parts = fieldId.split('-');
          label = parts.length > 2 ? `Field ${parts[2]}` : `Field ${fieldId.slice(0, 8)}`;
        } else if (fieldId.length > 20) {
          label = `Field ${fieldId.slice(0, 8)}`;
        }
        fieldInfo[fieldId] = label;
      });
    } else {
      // Active and soft-deleted fields from schema
      formSchema.pages.forEach((page) => {
        page.fields.forEach((field) => {
          if (field.type && field.id && 'label' in field && (field as any).label) {
            const label = (field as any).label;
            fieldInfo[field.id] = field.deleted
              ? `${label} (deleted)`
              : label;
            orderedFieldIds.push(field.id);
          }
        });
      });

      // Orphan field IDs: in response data but not in schema at all
      const knownIds = new Set(orderedFieldIds);
      const orphanIds = new Set<string>();
      responses.forEach((response) => {
        Object.keys(response.data).forEach((id) => {
          if (!knownIds.has(id)) orphanIds.add(id);
        });
      });
      orphanIds.forEach((id) => {
        fieldInfo[id] = 'Unknown field (deleted)';
        orderedFieldIds.push(id);
      });
    }

    return { fieldInfo, orderedFieldIds };
  };
  ```

  Note: `FormResponse` is already imported via `@dculus/types`. Verify that `FormSchema` is also already imported — it is (`import { ... FormSchema ... } from '@dculus/types'`). The `field.deleted` property is now available because of Task 1.

- [ ] **Step 2: Verify both `generateCsvContent` and `generateExcelContent` work unchanged**

  Both functions call `extractFieldInfo(formSchema, responses)` and iterate `orderedFieldIds`. Because `extractFieldInfo` now includes deleted + orphan IDs in `orderedFieldIds` and labels them with `"(deleted)"` suffix, both export formats automatically get the new columns with no further changes.

  Read the field-type lookup in `generateCsvContent` (line 264-274). It looks up field type via `page.fields.find(f => f.id === fieldId)`. For deleted fields, this will find the field (since it's still in the schema). For orphan fields, it will not find a type — `fieldType` will be `undefined`, which is already handled (falls through to `formatFieldValue(value, undefined, 'csv')`).

  No changes needed in either function.

- [ ] **Step 3: Type-check the backend**

  ```bash
  pnpm --filter backend type-check
  ```
  Expected: exits 0.

- [ ] **Step 4: Run backend unit tests**

  ```bash
  pnpm test:unit
  ```
  Expected: all pass. The existing `unifiedExportService.test.ts` should still pass since the function signature is unchanged and the extra columns only appear when fields are deleted.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/backend/src/services/unifiedExportService.ts
  git commit -m "feat(export): include soft-deleted and orphan fields in CSV/Excel export"
  ```

---

## Task 8: Smoke test end-to-end

- [ ] **Step 1: Start dev environment**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: Create a form with two fields, submit a response, then delete one field**

  1. Open `http://localhost:3000`
  2. Create a new form with a "Name" text field and an "Email" email field
  3. Open the form viewer (`http://localhost:5173`) and submit a response filling both fields
  4. Return to the form builder, delete the "Email" field

- [ ] **Step 3: Verify the responses table**

  Open the Responses tab for the form. Verify:
  - "Name" column appears as a normal active column
  - "Email" column appears to the right of "Name" with an amber "deleted" badge
  - The submitted email value is visible in the deleted column
  - Newly submitted responses (with only "Name" filled) show "—" in the "Email" deleted column

- [ ] **Step 4: Verify the builder no longer shows the deleted field**

  Return to the form builder. Verify:
  - The "Email" field is gone from the builder canvas and field list
  - The field count in the page header shows 1 (not 2)

- [ ] **Step 5: Verify export includes the deleted column**

  Export the responses as CSV or Excel. Verify:
  - The file has an "Email (deleted)" column header
  - The submitted email value is in that column
