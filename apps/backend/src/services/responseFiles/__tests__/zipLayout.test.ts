import { describe, expect, it } from 'vitest';
import type { ResponseFileEntry } from '../responseFileCatalog.js';
import {
  archiveRootName,
  buildManifestCsv,
  planZipEntries,
  responseLabel,
  sanitizePathSegment,
} from '../zipLayout.js';

const file = (overrides: Partial<ResponseFileEntry> = {}): ResponseFileEntry => ({
  key: 'files/form-response/form-1/1700000000000-00000000-0000-0000-0000-000000000000-cv.pdf',
  responseId: 'resp_aaaaaaaa11111111',
  submittedAt: new Date('2026-10-08T10:00:00Z'),
  respondentEmail: null,
  fieldId: 'field-resume',
  fieldLabel: 'Resume',
  fieldOrder: 0,
  originalName: 'cv.pdf',
  size: 1024,
  mimeType: 'application/pdf',
  ...overrides,
});

describe('sanitizePathSegment', () => {
  it('neutralises traversal and separators so an entry cannot leave its folder', () => {
    expect(sanitizePathSegment('../../etc/passwd')).toBe('_.._etc_passwd');
    expect(sanitizePathSegment('..')).toBe('file');
    expect(sanitizePathSegment('a\\b/c:d')).toBe('a_b_c_d');
  });

  it('strips control characters, leading dots and trailing dots/spaces', () => {
    expect(sanitizePathSegment('\u0000.hidden\u0007 name. ')).toBe('hidden name');
  });

  it('prefixes Windows reserved names', () => {
    expect(sanitizePathSegment('CON')).toBe('_CON');
    expect(sanitizePathSegment('lpt1.txt')).toBe('_lpt1.txt');
  });

  it('falls back when nothing usable is left', () => {
    expect(sanitizePathSegment('   ', 'Question')).toBe('Question');
  });

  it('keeps the extension when truncating long names', () => {
    const result = sanitizePathSegment(`${'a'.repeat(300)}.pdf`);
    expect(Array.from(result)).toHaveLength(120);
    expect(result.endsWith('.pdf')).toBe(true);
  });

  it('keeps non-Latin names intact and truncates by code point', () => {
    expect(sanitizePathSegment('விண்ணப்பம்.pdf')).toBe('விண்ணப்பம்.pdf');
    const emoji = sanitizePathSegment('😀'.repeat(200));
    expect(Array.from(emoji)).toHaveLength(120);
  });
});

describe('planZipEntries', () => {
  const root = 'Job form files 2026-10-09';

  it('groups by question with numbered folders and response-prefixed names', () => {
    const entries = planZipEntries(
      [file(), file({ fieldId: 'field-photo', fieldLabel: 'Photo ID', fieldOrder: 1, originalName: 'id.png' })],
      'question',
      root
    );
    expect(entries.map((e) => e.path)).toEqual([
      `${root}/01 Resume/2026-10-08 111111 - cv.pdf`,
      `${root}/02 Photo ID/2026-10-08 111111 - id.png`,
    ]);
  });

  it('groups by response with question-prefixed names', () => {
    const entries = planZipEntries([file()], 'response', root);
    expect(entries[0].path).toBe(`${root}/2026-10-08 111111/Resume - cv.pdf`);
  });

  it('de-duplicates names within a folder case-insensitively', () => {
    const entries = planZipEntries([file(), file({ originalName: 'CV.pdf' }), file()], 'question', root);
    expect(entries.map((e) => e.path.split('/').pop())).toEqual([
      '2026-10-08 111111 - cv.pdf',
      '2026-10-08 111111 - CV (2).pdf',
      '2026-10-08 111111 - cv (3).pdf',
    ]);
  });

  it('sanitises owner and respondent controlled parts', () => {
    const [entry] = planZipEntries(
      [file({ fieldLabel: '../secrets', originalName: '../../evil.sh' })],
      'question',
      root
    );
    expect(entry.path).toBe(`${root}/01 .._secrets/2026-10-08 111111 - .._.._evil.sh`);
    expect(entry.path.split('/')).not.toContain('..');
  });
});

describe('labels', () => {
  it('builds a stable response label and archive root', () => {
    expect(responseLabel('resp_aaaaaaaa11111111', new Date('2026-01-02T23:00:00Z'))).toBe('2026-01-02 111111');
    expect(archiveRootName('Hiring: 2026/Q4', new Date('2026-10-09T00:00:00Z'))).toBe('Hiring_ 2026_Q4 files 2026-10-09');
  });
});

describe('buildManifestCsv', () => {
  it('lists every entry with its status, escapes CSV and blocks formula injection', () => {
    const root = 'root';
    const missingFile = file({ originalName: '=HYPERLINK("x")', respondentEmail: 'a@b.co' });
    const entries = planZipEntries([file(), missingFile], 'question', root);
    const csv = buildManifestCsv(entries, root, new Set([missingFile]));

    expect(csv.startsWith('﻿path,status,response_id')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('01 Resume/2026-10-08 111111 - cv.pdf,included,resp_aaaaaaaa11111111');
    expect(lines[2]).toContain(',missing,');
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain('a@b.co');
  });
});
