import type { DocDiagram } from '../types';

/**
 * Companion diagram for `docs/architecture/11-file-storage.md`.
 *
 * The fork is the whole page: one routing table decides public-and-cacheable
 * versus private-and-pre-signed, and it defaults to private for anything it does
 * not recognise.
 */
export const fileStorage: DocDiagram = {
  direction: 'TB',
  nodes: [
    {
      id: 'upload',
      data: {
        label: 'POST /upload',
        kind: 'entry',
        file: 'apps/backend/src/routes/upload.ts',
        line: 37,
        does: 'Multipart upload from any of the three apps, behind a 50MB multer ceiling.',
        note: 'One of the few REST routes — GraphQL cannot carry multipart bodies.',
      },
    },
    {
      id: 'validate',
      data: {
        label: 'Validate',
        kind: 'gate',
        file: 'apps/backend/src/services/fileUploadService.ts',
        line: 212,
        does: 'Type allowlist, required params, auth, then MIME and size checks per type.',
        note: 'HTML, JavaScript, PHP, shell scripts and executables are blocked unconditionally, whatever a field config allows — a CDN-served HTML file is stored XSS.',
      },
    },
    {
      id: 'route',
      data: {
        label: 'Bucket routing table',
        kind: 'gate',
        file: 'apps/backend/src/services/fileUploadService.ts',
        line: 72,
        does: 'Maps each of the six upload types to a public or private bucket.',
        note: 'Unknown types default to PRIVATE. A new type someone forgets to add fails closed — unreachable rather than world-readable.',
        shared: 'The single most important default here',
      },
    },
    {
      id: 'public',
      data: {
        label: 'Public bucket',
        kind: 'external',
        file: 'apps/backend/src/services/fileUploadService.ts',
        line: 67,
        does: 'Template thumbnails, form backgrounds, avatars and org logos. ACL public-read, served via CDN.',
        note: 'Once served from the CDN, assume it is cached. Moving a type from public to private does not retract what is already out.',
      },
    },
    {
      id: 'private',
      data: {
        label: 'Private bucket',
        kind: 'external',
        file: 'apps/backend/src/services/fileUploadService.ts',
        does: 'Respondent uploads, base PDFs, generated PDFs and temporary exports. No ACL, no public URL.',
        note: 'The rule of thumb: anything a respondent produced is private.',
      },
    },
    {
      id: 'cdn',
      data: {
        label: 'CDN URL',
        kind: 'effect',
        file: 'apps/backend/src/services/fileUploadService.ts',
        line: 295,
        does: 'A durable, cacheable, unauthenticated URL stored inline wherever it is used.',
      },
    },
    {
      id: 'presigned',
      data: {
        label: 'Pre-signed URL',
        kind: 'effect',
        file: 'apps/backend/src/services/fileUploadService.ts',
        line: 395,
        does: 'Minted on demand, valid 15 minutes by default.',
        note: 'Permission is checked when the URL is minted, not when it is followed — a leaked URL works for its remaining lifetime, which is what the short expiry guards.',
        shared: 'Used by responses, PDFs and exports',
      },
    },
    {
      id: 'temp',
      data: {
        label: 'Temporary exports',
        kind: 'store',
        file: 'apps/backend/src/services/temporaryFileService.ts',
        line: 34,
        does: 'Excel and CSV exports under temp-exports/{timestamp}-{uuid}-{filename}, retained 5 hours.',
        note: 'Cleanup parses the timestamp out of the key itself — no database table. The key IS the expiry record, so changing the format silently stops cleanup.',
      },
    },
  ],
  edges: [
    { source: 'upload', target: 'validate' },
    { source: 'validate', target: 'route' },
    { source: 'route', target: 'public', label: '4 types' },
    { source: 'route', target: 'private', label: '2 types + unknown' },
    { source: 'public', target: 'cdn' },
    { source: 'private', target: 'presigned' },
    { source: 'private', target: 'temp', async: true },
  ],
};
