# The Field Type System

Form fields are **classes** in memory and **plain JSON** everywhere else — in
Postgres, in Y.js, in GraphQL payloads. Everything in this page follows from that
one split.

The rule it produces: never construct a field as a plain object literal, and never
hand a class instance to something that persists. Cross the boundary through
`serializeFormField` / `deserializeFormField`, always.

## At a glance

| | |
|---|---|
| **Entry point** | `packages/types/src/index.ts` — the class tree and the four serialization helpers |
| **Trigger** | Any read or write of a form schema, anywhere in the stack |
| **Execution** | Synchronous, pure |
| **Outcome** | Class instances in memory, plain JSON at rest |
| **Fails loudly?** | **No** — an unknown field type is dropped with a `console.warn` |

## The hierarchy

```
  FormField                       id, type, deleted
  │
  ├── FillableFormField           label, required, placeholder, hint,
  │   │                           defaultValue, prefix, validation
  │   │
  │   ├── TextInputField          TextFieldValidation (minLength, maxLength)
  │   ├── TextAreaField           TextFieldValidation
  │   ├── EmailField              + email validation
  │   ├── NumberField             + min, max
  │   ├── DateField               + minDate, maxDate
  │   ├── SelectField             + options[], multiple
  │   ├── RadioField              + options[]
  │   ├── CheckboxField           CheckboxFieldValidation
  │   │                             (minSelections, maxSelections)
  │   ├── FileUploadField
  │   └── PhoneNumberField        + defaultCountry
  │
  └── NonFillableFormField
      └── RichTextFormField       content

  Validation is its own parallel tree:

  FillableFormFieldValidation     required
  ├── TextFieldValidation         + minLength, maxLength
  └── CheckboxFieldValidation     + minSelections, maxSelections
```

Eleven concrete field types. `FieldType` also carries entries for the abstract
bases and the validation classes, which are not usable field types — the enum is
broader than the set of things you can put on a form.

## Walkthrough

### Serializing is generic; deserializing is not

```ts
export const serializeFormField = (field: FormField): any => ({
  ...field,
  __type: field.type,
});
```

A spread. Adding a field type requires **no change here** — that's called out in
the source comment.

Deserialization is the opposite: a `switch` over every type, each branch calling
the right constructor with the right arguments. Adding a field type means editing
this switch, and forgetting to is the failure mode described below.

### The discriminator is doubled

```ts
switch (data.type || data.__type) {
```

`type` is the field's own property; `__type` is the copy stamped on by
`serializeFormField`. The fallback exists because some persisted payloads carry
only one of them — `responseEditTrackingService` reads `__type` for exactly this
reason.

### Validation is reconstructed, never trusted

`getValidation` rebuilds the right validation class from the field type, and
supplies a default when `data.validation` is absent:

| Field type | Default validation |
|---|---|
| `TEXT_INPUT_FIELD`, `TEXT_AREA_FIELD` | `TextFieldValidation(false)` |
| `CHECKBOX_FIELD` | `CheckboxFieldValidation(false)` |
| everything else | `FillableFormFieldValidation(false)` |

So a field persisted without validation deserializes to a valid, non-required
instance rather than `undefined` — nothing downstream needs a null check.

### Unknown types are silently dropped

This is the most important behaviour on the page:

```ts
default:
  console.warn(`[deserializeFormField] Unknown field type "…". Skipping field.`);
  return null;
```

and in `deserializeFormSchema`:

```ts
.filter((f: FormField | null): f is FormField => f !== null)
```

A field whose type the running code doesn't recognise **disappears from the
schema**. Not an error, not a placeholder — gone, with one console line.

That's a deliberate resilience choice: one bad row can't break a whole form. But
it has a sharp edge. Deploy a new field type, let users create fields with it,
then roll back — and those fields vanish from every schema the old code loads.
The data is still in the database, but the builder won't show it, the viewer won't
render it, and a subsequent save may well persist the schema without it.

### `deleted` survives the round trip

`deserializeFormSchema` re-applies `fieldData.deleted` after constructing the
instance. Soft-deleted fields are kept in the schema so historical responses can
still resolve their labels — the responses table needs to render a column for a
field nobody can answer any more.

### Where the boundary actually sits

| Location | Form | Notes |
|---|---|---|
| Zustand store, React components | **Classes** | Methods and `instanceof` work |
| `Form.formSchema` column | JSON | Periodic snapshot |
| Y.js document | JSON | Nested `Y.Map`s, not class instances |
| GraphQL payloads | JSON | |
| PDF binding, exports, analytics | JSON, then deserialized on demand | |

Y.js is the one people forget. The collaborative document holds nested maps of
primitives — Y.js has no idea your classes exist, and a class instance written
into a `Y.Map` does not survive as one.

## Invariants & design decisions

- **Classes in memory, JSON at rest.** Every crossing goes through the
  serialization helpers.
- **Serialization stays generic.** Anything requiring a per-type change on the
  *write* side is a design smell — the spread must keep working.
- **Deserialization defaults validation rather than leaving it undefined.**
  Removes a null check from every consumer.
- **An unrecognised field type is skipped, not thrown.** One bad field can't take
  down a form.
- **`deleted` is preserved.** Historical responses need their field definitions.
- **The discriminator is `type` with a `__type` fallback.** Both are written;
  both are accepted.

## Shared surfaces

What this exposes:

| Exported surface | Consumed by | Contract they rely on | Breaks them if… |
|---|---|---|---|
| The class tree | form-app, form-viewer, backend, PDF binding | `instanceof` and property names | A property is renamed without a data migration |
| `serializeFormField` / `deserializeFormField` | Every persistence boundary | Round-trips losslessly for known types | A constructor argument order changes |
| `serializeFormSchema` / `deserializeFormSchema` | Y.js sync, submission, exports, analytics | Preserves `layout` and `deleted` | A new top-level schema key isn't spread through |
| `FieldType` | Everything, including the AI tools' `TYPE_MAP` | String values match persisted data | A value is renamed |
| `FillableFormFieldValidation` subclasses | Viewer validation, builder settings panels | The subclass matches the field type | A type's validation class changes without migration |

What this depends on:

Nothing. `@dculus/types` is the base of the dependency graph — which is why a
change here ripples into all three apps and the backend at once.

## Data touched

None directly. This is a pure transformation layer over data owned elsewhere:
`Form.formSchema`, `CollaborativeDocument.state`, `FormTemplate.formSchema`.

## Failure & retry behavior

| Situation | What happens |
|---|---|
| Unknown field type | `console.warn`, field returned as `null`, filtered out of the schema |
| Missing `validation` | A sensible default instance is constructed |
| Missing `options` on a select/radio | Defaults per the constructor; no throw |
| Malformed page or schema | `(data.pages \|\| [])` guards; an empty schema rather than a crash |

Nothing here throws. That's the design, and also the risk.

## Configuration

None. No env vars, no flags — a pure library.

## Related pages

- [Real-Time Collaboration](./07-realtime-collaboration.md) — the Y.js document
  structure these classes are flattened into.
- [The Life of a Submission](./01-submission-lifecycle.md) — deserialization on
  the submission path, for conditional stripping and thank-you rendering.
- [PDF Generation](./06-pdf-generation.md) — a consumer that resolves field labels
  and formats values from a deserialized schema.

## Gotchas

- **An unknown field type disappears silently.** The single most dangerous
  behaviour here. Rolling back a deploy that introduced a field type makes every
  field of that type vanish from loaded schemas — and a later save can persist
  that absence.
- **Adding a field type means editing the `deserializeFormField` switch.**
  Serialization needs nothing; deserialization needs a branch. Miss it and the
  field type works in the builder session that created it and vanishes on reload.
- **`FieldType` contains non-field entries.** `FORM_FIELD`,
  `FILLABLE_FORM_FIELD`, `NON_FILLABLE_FORM_FIELD`, and the two validation types
  are in the enum but aren't usable field types. Don't iterate the enum to build a
  field-type picker.
- **`PhoneNumberField` exists.** `CLAUDE.md`'s hierarchy predates it and lists ten
  types; there are eleven.
- **Y.js stores plain data, not instances.** A class written into a `Y.Map` comes
  back as a plain object. This is the boundary people cross accidentally.
- **`__type` and `type` can disagree** on hand-edited or partially-migrated data.
  `type` wins.
