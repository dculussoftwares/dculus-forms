import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/12-field-type-system.md`.
 *
 * Drawn as the serialization *cycle* rather than as the class tree — the tree is
 * better read as the indented list in the Markdown, whereas the thing that
 * actually catches people is the boundary crossing, and specifically that the
 * two directions are not symmetric.
 */
export const fieldTypes: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'classes',
      data: {
        label: 'Field classes in memory',
        kind: 'entry',
        file: 'packages/types/src/index.ts',
        line: 194,
        does: 'FormField splits into FillableFormField (ten concrete types) and NonFillableFormField (rich text).',
        note: 'Validation is its own parallel tree — TextFieldValidation and CheckboxFieldValidation extend FillableFormFieldValidation.',
        shared: 'Used by all three apps and the backend',
      },
    },
    {
      id: 'serialize',
      data: {
        label: 'serializeFormField',
        kind: 'effect',
        file: 'packages/types/src/index.ts',
        line: 632,
        does: 'Spreads the instance into a plain object and stamps __type alongside type.',
        note: 'Generic by design — adding a field type needs no change here at all. Anything that would require one on the write side is a design smell.',
      },
    },
    {
      id: 'yjs',
      data: {
        label: 'Y.js document',
        kind: 'store',
        file: 'apps/backend/src/services/hocuspocus.ts',
        does: 'Nested Y.Maps of primitives — Y.js has no idea the classes exist.',
        note: 'The boundary people cross accidentally: a class instance written into a Y.Map does not come back as one.',
      },
    },
    {
      id: 'postgres',
      data: {
        label: 'Postgres + GraphQL',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 142,
        does: 'Form.formSchema, FormTemplate.formSchema and every GraphQL payload carry plain JSON.',
      },
    },
    {
      id: 'deserialize',
      data: {
        label: 'deserializeFormField',
        kind: 'gate',
        file: 'packages/types/src/index.ts',
        line: 653,
        does: 'Switches on type (falling back to __type) and calls the right constructor, rebuilding validation from the field type.',
        note: 'Not generic, unlike serialization — adding a field type means adding a branch here. Miss it and the type works in the session that created it and vanishes on reload.',
        shared: 'Every persistence boundary calls this',
      },
    },
    {
      id: 'dropped',
      data: {
        label: 'Unknown type → dropped',
        kind: 'effect',
        file: 'packages/types/src/index.ts',
        line: 827,
        does: 'An unrecognised field type logs a console warning, returns null, and is filtered out of the schema.',
        note: 'Deliberate resilience — one bad row cannot break a form — but it means rolling back a deploy that introduced a field type makes those fields vanish from every loaded schema, and a later save can persist the absence.',
      },
    },
    {
      id: 'consumers',
      data: {
        label: 'Consumers',
        kind: 'effect',
        file: 'apps/backend/src/services/pdfTemplateService.ts',
        line: 369,
        does: 'Conditional stripping, thank-you rendering, PDF field binding, exports and analytics all deserialize on demand.',
        note: 'Soft-deleted fields survive the round trip on purpose, so historical responses can still resolve their labels.',
      },
    },
  ],
  edges: [
    { source: 'classes', target: 'serialize' },
    { source: 'serialize', target: 'yjs' },
    { source: 'serialize', target: 'postgres' },
    { source: 'yjs', target: 'deserialize' },
    { source: 'postgres', target: 'deserialize' },
    { source: 'deserialize', target: 'consumers' },
    { source: 'deserialize', target: 'dropped', label: 'no matching branch' },
  ],
};
