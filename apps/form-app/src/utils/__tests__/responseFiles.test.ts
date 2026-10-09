import {
  buildFileFolders,
  fileKind,
  fileNameFromKey,
  formatBytes,
  isPreviewable,
  responseLabel,
} from '../responseFiles';

const file = (overrides: Partial<{ responseId: string; submittedAt: string; respondentEmail: string | null; fieldId: string }>) => ({
  responseId: 'resp_aaaaaaaa11111111',
  submittedAt: '2026-10-08T10:00:00.000Z',
  respondentEmail: null,
  fieldId: 'resume',
  ...overrides,
});

describe('responseFiles utils', () => {
  it('detects file kinds from MIME type first, then extension', () => {
    expect(fileKind('photo.bin', 'image/png')).toBe('image');
    expect(fileKind('cv.PDF')).toBe('pdf');
    expect(fileKind('budget.xlsx', 'application/octet-stream')).toBe('spreadsheet');
    expect(fileKind('notes')).toBe('other');
  });

  it('only previews types the server serves inline', () => {
    expect(isPreviewable('image/jpeg')).toBe(true);
    expect(isPreviewable('application/pdf')).toBe(true);
    expect(isPreviewable('image/svg+xml')).toBe(false);
    expect(isPreviewable('text/html')).toBe(false);
    expect(isPreviewable(null)).toBe(false);
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
    expect(formatBytes(1536, 'en')).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024, 'en')).toBe('25 MB');
    expect(formatBytes(null)).toBe('—');
  });

  it('recovers names and labels', () => {
    expect(fileNameFromKey('files/form-response/f1/1700000000000-11111111-2222-3333-4444-555555555555-cv.pdf')).toBe('cv.pdf');
    expect(responseLabel('resp_aaaaaaaa11111111', '2026-10-08T10:00:00.000Z')).toBe('2026-10-08 111111');
  });

  it('builds one folder per question in form order, keeping empty ones', () => {
    const files = [file({ fieldId: 'photo' }), file({})];
    const folders = buildFileFolders(files, [{ fieldId: 'resume', label: 'Resume' }, { fieldId: 'photo', label: 'Photo' }, { fieldId: 'id', label: 'ID' }], 'QUESTION');

    expect(folders.map((f) => [f.label, f.files.length])).toEqual([
      ['01 Resume', 1],
      ['02 Photo', 1],
      ['03 ID', 0],
    ]);
  });

  it('builds one folder per response, newest first', () => {
    const files = [
      file({ responseId: 'old_00000001', submittedAt: '2026-10-01T00:00:00.000Z' }),
      file({ responseId: 'new_00000002', submittedAt: '2026-10-09T00:00:00.000Z', respondentEmail: 'a@b.co' }),
      file({ responseId: 'old_00000001', submittedAt: '2026-10-01T00:00:00.000Z', fieldId: 'photo' }),
    ];
    const folders = buildFileFolders(files, [], 'RESPONSE');

    expect(folders.map((f) => [f.label, f.detail, f.files.length])).toEqual([
      ['2026-10-09 000002', 'a@b.co', 1],
      ['2026-10-01 000001', null, 2],
    ]);
  });
});
