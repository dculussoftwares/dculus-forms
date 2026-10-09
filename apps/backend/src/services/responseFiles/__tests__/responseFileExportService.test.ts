import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Readable } from 'stream';
import JSZip from 'jszip';

vi.mock('../../../repositories/index.js', () => ({
  formRepository: { findUnique: vi.fn() },
  responseFileExportRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    updateIfRunning: vi.fn(),
    countByRequesterSince: vi.fn(),
    findRunning: vi.fn(),
  },
}));
vi.mock('../responseFileCatalog.js', () => ({ collectResponseFiles: vi.fn() }));
vi.mock('../../fileUploadService.js', () => ({ openFileStream: vi.fn() }));
vi.mock('../../temporaryFileService.js', () => ({
  uploadTemporaryStream: vi.fn(),
  getTemporaryFileDownloadUrl: vi.fn(),
  TEMP_FILE_TTL_MS: 5 * 60 * 60 * 1000,
  getTemporaryFileExpiry: (key: string) => {
    const ts = Number(/^temp-exports\/(\d+)-/.exec(key)?.[1]);
    return ts > 0 ? new Date(ts + 5 * 60 * 60 * 1000) : null;
  },
}));
vi.mock('../../../lib/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { formRepository, responseFileExportRepository } from '../../../repositories/index.js';
import { collectResponseFiles, type ResponseFileEntry } from '../responseFileCatalog.js';
import { openFileStream } from '../../fileUploadService.js';
import { getTemporaryFileDownloadUrl, uploadTemporaryStream } from '../../temporaryFileService.js';
import { audit } from '../../../lib/audit.js';
import {
  createResponseFileExportDownload,
  getResponseFileExport,
  MAX_EXPORT_FILES,
  MAX_EXPORTS_PER_HOUR,
  runResponseFileExport,
  startResponseFileExport,
} from '../responseFileExportService.js';
import { planZipEntries } from '../zipLayout.js';

const repo = vi.mocked(responseFileExportRepository);

const entry = (name: string, size = 10): ResponseFileEntry => ({
  key: `files/form-response/form-1/1700000000000-11111111-2222-3333-4444-555555555555-${name}`,
  responseId: 'resp_aaaaaaaa11111111',
  submittedAt: new Date('2026-10-08T10:00:00Z'),
  respondentEmail: null,
  fieldId: 'resume',
  fieldLabel: 'Resume',
  fieldOrder: 0,
  originalName: name,
  size,
  mimeType: 'application/pdf',
});

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'exp-1',
  formId: 'form-1',
  requestedById: 'user-1',
  status: 'completed',
  grouping: 'question',
  totalCount: 1,
  processedCount: 1,
  totalBytes: BigInt(10),
  fileKey: `temp-exports/${Date.now()}-uuid-response-files.zip`,
  filename: 'Job form files 2026-10-09.zip',
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  completedAt: new Date(),
  ...overrides,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('startResponseFileExport', () => {
  const input = { formId: 'form-1', userId: 'user-1', grouping: 'question' as const, query: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    repo.findRunning.mockResolvedValue(null);
    repo.countByRequesterSince.mockResolvedValue(0);
    repo.create.mockImplementation((async (data: any) => row({ ...data, id: 'exp-new' })) as any);
    repo.update.mockResolvedValue(row() as any);
    vi.mocked(formRepository.findUnique).mockResolvedValue({ title: 'Job form' } as any);
    vi.mocked(collectResponseFiles).mockResolvedValue({ fields: [], files: [entry('cv.pdf')] });
    vi.mocked(openFileStream).mockRejectedValue(new Error('not under test'));
    vi.mocked(uploadTemporaryStream).mockResolvedValue({ fileKey: 'temp-exports/x.zip', expiresAt: new Date() });
  });

  it('resumes the requester’s in-flight export instead of starting another', async () => {
    const running = row({ status: 'running', updatedAt: new Date() });
    repo.findRunning.mockResolvedValue(running as any);

    await expect(startResponseFileExport(input)).resolves.toBe(running);
    expect(collectResponseFiles).not.toHaveBeenCalled();
  });

  it('replaces a stalled in-flight export with a new one', async () => {
    repo.findRunning.mockResolvedValue(row({ status: 'running', updatedAt: new Date(Date.now() - 60 * 60 * 1000) }) as any);
    repo.update.mockResolvedValueOnce(row({ status: 'failed' }) as any);

    const result = await startResponseFileExport(input);

    expect(repo.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'failed' }));
    expect(result.id).toBe('exp-new');
  });

  it('resumes the winner when a concurrent request loses the one-running-export race', async () => {
    const winner = row({ id: 'exp-winner', status: 'running', updatedAt: new Date() });
    repo.findRunning.mockResolvedValueOnce(null).mockResolvedValueOnce(winner as any);
    repo.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

    await expect(startResponseFileExport(input)).resolves.toBe(winner);
    expect(openFileStream).not.toHaveBeenCalled();
  });

  it('rethrows unexpected create failures', async () => {
    repo.create.mockRejectedValue(new Error('db down'));
    await expect(startResponseFileExport(input)).rejects.toThrow('db down');
  });

  it('rate limits per user', async () => {
    repo.countByRequesterSince.mockResolvedValue(MAX_EXPORTS_PER_HOUR);
    await expect(startResponseFileExport(input)).rejects.toMatchObject({ extensions: { code: 'RATE_LIMITED' } });
  });

  it('rejects when nothing matches', async () => {
    vi.mocked(collectResponseFiles).mockResolvedValue({ fields: [], files: [] });
    await expect(startResponseFileExport(input)).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });

  it('rejects exports over the file-count or size limit', async () => {
    vi.mocked(collectResponseFiles).mockResolvedValue({
      fields: [],
      files: Array.from({ length: MAX_EXPORT_FILES + 1 }, (_, i) => entry(`f${i}.pdf`)),
    });
    await expect(startResponseFileExport(input)).rejects.toMatchObject({ extensions: { code: 'EXPORT_TOO_LARGE' } });

    vi.mocked(collectResponseFiles).mockResolvedValue({ fields: [], files: [entry('big.bin', 6 * 1024 ** 3)] });
    await expect(startResponseFileExport(input)).rejects.toMatchObject({ extensions: { code: 'EXPORT_TOO_LARGE' } });
  });

  it('records the job, audits it and starts streaming in the background', async () => {
    const result = await startResponseFileExport({ ...input, query: { responseIds: ['r1'] } });

    expect(result.id).toBe('exp-new');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        formId: 'form-1',
        requestedById: 'user-1',
        status: 'running',
        totalCount: 1,
        totalBytes: BigInt(10),
        filename: expect.stringMatching(/^Job form files \d{4}-\d{2}-\d{2}\.zip$/),
      })
    );
    expect(audit).toHaveBeenCalledWith(
      'responseFiles.exportRequested',
      'Form',
      'form-1',
      'user-1',
      expect.objectContaining({ exportId: 'exp-new', fileCount: 1, responseIds: 1 })
    );
  });
});

describe('runResponseFileExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.update.mockResolvedValue(row() as any);
    repo.updateIfRunning.mockResolvedValue(true);
  });

  it('streams every file and a manifest into one ZIP, marking unreadable files missing', async () => {
    const root = 'Job form files 2026-10-09';
    const entries = planZipEntries([entry('cv.pdf'), entry('gone.pdf')], 'question', root);
    vi.mocked(openFileStream).mockImplementation(async (key: string) => {
      if (key.endsWith('gone.pdf')) throw new Error('NoSuchKey');
      return new Blob(['%PDF-1.7 hello']).stream() as ReadableStream<Uint8Array>;
    });

    let archive: Buffer | undefined;
    vi.mocked(uploadTemporaryStream).mockImplementation(async (body: Readable) => {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      archive = Buffer.concat(chunks);
      return { fileKey: 'temp-exports/1-uuid-response-files.zip', expiresAt: new Date() };
    });

    await runResponseFileExport('exp-1', entries, root);

    const zip = await JSZip.loadAsync(archive!);
    expect(Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort()).toEqual([
      `${root}/01 Resume/2026-10-08 111111 - cv.pdf`,
      `${root}/manifest.csv`,
    ]);
    expect(await zip.file(`${root}/01 Resume/2026-10-08 111111 - cv.pdf`)!.async('string')).toBe('%PDF-1.7 hello');
    const manifest = await zip.file(`${root}/manifest.csv`)!.async('string');
    expect(manifest).toContain('cv.pdf,included');
    expect(manifest).toContain('gone.pdf,missing');

    expect(repo.updateIfRunning).toHaveBeenLastCalledWith('exp-1', expect.objectContaining({
      status: 'completed',
      fileKey: 'temp-exports/1-uuid-response-files.zip',
      processedCount: 2,
    }));
  });

  it('marks the export failed when the upload fails', async () => {
    vi.mocked(openFileStream).mockResolvedValue(new Blob(['x']).stream() as ReadableStream<Uint8Array>);
    vi.mocked(uploadTemporaryStream).mockRejectedValue(new Error('R2 down'));

    await runResponseFileExport('exp-1', planZipEntries([entry('cv.pdf')], 'question', 'root'), 'root');

    expect(repo.updateIfRunning).toHaveBeenLastCalledWith('exp-1', expect.objectContaining({ status: 'failed' }));
  });

  it('fails the export once the streamed bytes outgrow the cap, whatever sizes were recorded', async () => {
    // Only byteLength is read before the cap rejects the chunk, so no real 6 GiB is allocated.
    const chunk = { byteLength: 6 * 1024 ** 3 } as Uint8Array;
    vi.mocked(openFileStream).mockImplementation(
      async () =>
        new ReadableStream<Uint8Array>({
          pull(controller) {
            controller.enqueue(chunk);
          },
        })
    );
    vi.mocked(uploadTemporaryStream).mockImplementation(async (body: Readable) => {
      body.resume(); // drain; the cap errors the stream mid-way
      await new Promise((resolve, reject) => body.on('end', resolve).on('error', reject));
      return { fileKey: 'temp-exports/never.zip', expiresAt: new Date() };
    });

    await runResponseFileExport('exp-1', planZipEntries([entry('huge.bin', 1)], 'question', 'root'), 'root');

    expect(repo.updateIfRunning).toHaveBeenLastCalledWith('exp-1', expect.objectContaining({ status: 'failed' }));
  });

  it('keeps the job alive with a time-based heartbeat during a long upload', async () => {
    vi.useFakeTimers();
    try {
      let finish!: () => void;
      vi.mocked(uploadTemporaryStream).mockImplementation(
        () => new Promise((resolve) => (finish = () => resolve({ fileKey: 'temp-exports/1-x.zip', expiresAt: new Date() })))
      );
      const run = runResponseFileExport('exp-1', [], 'root');

      await vi.advanceTimersByTimeAsync(65_000);
      expect(repo.updateIfRunning).toHaveBeenCalledWith('exp-1', { updatedAt: expect.any(Date) });

      finish();
      await run;
    } finally {
      vi.useRealTimers();
    }
  });

  it('never throws even if the failure cannot be recorded', async () => {
    vi.mocked(uploadTemporaryStream).mockRejectedValue(new Error('R2 down'));
    repo.updateIfRunning.mockRejectedValue(new Error('row gone'));

    await expect(runResponseFileExport('exp-1', [], 'root')).resolves.toBeUndefined();
    await flush();
  });
});

describe('downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTemporaryFileDownloadUrl).mockResolvedValue('https://signed-zip');
  });

  it('only shows an export to the person who started it', async () => {
    repo.findById.mockResolvedValue(row({ requestedById: 'someone-else' }) as any);
    await expect(getResponseFileExport('exp-1', 'user-1')).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });

    repo.findById.mockResolvedValue(null);
    await expect(getResponseFileExport('exp-1', 'user-1')).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });

  it('issues a short-lived link to a finished export and audits it', async () => {
    repo.findById.mockResolvedValue(row() as any);

    const result = await createResponseFileExportDownload('exp-1', 'user-1');

    expect(result).toMatchObject({ downloadUrl: 'https://signed-zip', filename: 'Job form files 2026-10-09.zip' });
    expect(getTemporaryFileDownloadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^temp-exports\/\d+-uuid-response-files\.zip$/),
      'Job form files 2026-10-09.zip',
      300
    );
    expect(audit).toHaveBeenCalledWith('responseFiles.exportDownloaded', 'Form', 'form-1', 'user-1', expect.any(Object));
  });

  it('refuses unfinished and expired exports', async () => {
    repo.findById.mockResolvedValue(row({ status: 'running', fileKey: null, updatedAt: new Date() }) as any);
    await expect(createResponseFileExportDownload('exp-1', 'user-1')).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });

    repo.findById.mockResolvedValue(row({ completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000) }) as any);
    // ...unless the key says it is still within retention
    await expect(createResponseFileExportDownload('exp-1', 'user-1')).resolves.toBeDefined();

    // Retention counts from the key's timestamp (upload start), not completion:
    // a 3h export that finished just now has only 2h left, and one that
    // started 6h ago is gone even though it completed a minute ago.
    repo.findById.mockResolvedValue(
      row({ fileKey: `temp-exports/${Date.now() - 6 * 60 * 60 * 1000}-uuid-response-files.zip`, completedAt: new Date() }) as any
    );
    await expect(createResponseFileExportDownload('exp-1', 'user-1')).rejects.toThrow('expired');
  });
});
