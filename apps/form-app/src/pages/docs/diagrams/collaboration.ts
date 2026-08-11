import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/07-realtime-collaboration.md`.
 *
 * The fork at the bottom is the point: the stored document feeds two consumers
 * that have nothing to do with the builder — the metadata cache, and every
 * backend read of a form's schema.
 */
export const collaboration: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'builder',
      data: {
        label: 'Form builder',
        kind: 'entry',
        file: 'apps/form-app/src/store/useFormBuilderStore.ts',
        does: 'Zustand slices hold the editing state — fields, pages, layout, selection, conditions.',
      },
    },
    {
      id: 'manager',
      data: {
        label: 'CollaborationManager',
        kind: 'effect',
        file: 'apps/form-app/src/store/collaboration/CollaborationManager.ts',
        line: 202,
        does: 'Creates the Y.Doc and the Hocuspocus provider, and observes the document at every level.',
        note: 'Observers are attached per page map, per field map and per validation map — coarser observation would turn a single title edit into a full array diff.',
      },
    },
    {
      id: 'auth',
      data: {
        label: 'WebSocket auth',
        kind: 'gate',
        file: 'apps/backend/src/services/hocuspocus.ts',
        line: 166,
        does: 'Resolves a bearer token or a session cookie into a user, then runs checkFormAccess.',
        note: 'Both credential paths are needed — session storage has no bearer token on direct URL navigation, but the upgrade request still carries cookies.',
        shared: 'Same checkFormAccess as GraphQL',
      },
    },
    {
      id: 'server',
      data: {
        label: 'Hocuspocus + Database extension',
        kind: 'effect',
        file: 'apps/backend/src/services/hocuspocus.ts',
        line: 115,
        does: 'Merges updates between clients, loads state on connect, and compacts before every save.',
        note: 'Y.encodeStateAsUpdate discards the accumulated delta chain; without it the stored blob grows without bound. store() also swallows its errors — throwing here would disconnect every other editing session.',
      },
    },
    {
      id: 'doc',
      data: {
        label: 'CollaborativeDocument',
        kind: 'store',
        file: 'apps/backend/prisma/schema.prisma',
        line: 262,
        does: 'One row per form holding the compacted Y.js state, keyed on documentName.',
        note: 'documentName is the bare form id. The collab- prefix seen in saveDocumentState is the row id, not the name.',
        shared: 'The real source of truth for form schemas',
      },
    },
    {
      id: 'metadata',
      data: {
        label: 'FormMetadata cache',
        kind: 'effect',
        file: 'apps/backend/src/services/formMetadataService.ts',
        line: 30,
        does: 'Extracts page and field counts on a 5-second debounce so list views need not parse a Y.js document.',
        note: 'Debounced because a burst of edits during typing would otherwise mean one write per keystroke.',
      },
    },
    {
      id: 'readback',
      data: {
        label: 'getFormSchemaFromHocuspocus',
        kind: 'effect',
        file: 'apps/backend/src/services/hocuspocus.ts',
        line: 369,
        does: 'Reads the stored row directly, rebuilds a Y.Doc, and returns the live schema to the rest of the backend.',
        note: 'Used by conditional stripping, thank-you rendering and the form field resolvers — because Form.formSchema is only a periodic snapshot and can lag behind in-progress edits.',
        shared: 'Read by submission and resolvers',
      },
    },
  ],
  edges: [
    { source: 'builder', target: 'manager' },
    { source: 'manager', target: 'auth', label: 'WebSocket upgrade' },
    { source: 'auth', target: 'server' },
    { source: 'server', target: 'doc' },
    { source: 'doc', target: 'metadata', async: true },
    { source: 'doc', target: 'readback' },
  ],
};
