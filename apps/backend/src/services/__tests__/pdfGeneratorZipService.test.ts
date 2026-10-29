import { describe, it, expect, vi, beforeEach } from 'vitest';

const { repoMock, downloadMock, filterMock } = vi.hoisted(() => ({
  repoMock: { listDownloadableResultsByGenerator: vi.fn() },
  downloadMock: vi.fn(),
  filterMock: vi.fn(),
}));

vi.mock('../../repositories/index.js', () => ({ pdfGeneratorRepository: repoMock }));
vi.mock('../fileUploadService.js', () => ({ downloadFileBuffer: downloadMock }));
vi.mock('../pdfGeneratorService.js', () => ({ filterResultsToLiveResponses: filterMock }));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { buildZipForGenerator, ZIP_LIMITS } from '../pdfGeneratorZipService.js';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ fileKey: `k${i}`, responseId: `r${i}`, filename: `f${i}.pdf` }));

describe('buildZipForGenerator limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    filterMock.mockImplementation(async (r: unknown) => r);
    downloadMock.mockResolvedValue(Buffer.from('pdf'));
  });

  it('builds a zip for a small result set', async () => {
    repoMock.listDownloadableResultsByGenerator.mockResolvedValue(rows(2));
    const zip = await buildZipForGenerator('g1');
    expect(zip.length).toBeGreaterThan(0);
  });

  it('rejects more entries than the cap without downloading anything', async () => {
    repoMock.listDownloadableResultsByGenerator.mockResolvedValue(rows(ZIP_LIMITS.maxEntries + 1));
    await expect(buildZipForGenerator('g1')).rejects.toThrow(/Too many PDFs/);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it('rejects when the aggregate size exceeds the cap', async () => {
    repoMock.listDownloadableResultsByGenerator.mockResolvedValue(rows(2));
    downloadMock.mockResolvedValue({ length: ZIP_LIMITS.maxTotalBytes + 1 });
    await expect(buildZipForGenerator('g1')).rejects.toThrow(/too large/);
  });

  it('allows only one in-flight build per generator and releases the slot afterwards', async () => {
    repoMock.listDownloadableResultsByGenerator.mockResolvedValue(rows(1));
    let release!: () => void;
    downloadMock.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(Buffer.from('x')))));
    const first = buildZipForGenerator('g1');
    await new Promise((resolve) => setTimeout(resolve, 5));
    await expect(buildZipForGenerator('g1')).rejects.toThrow(/already being prepared/);
    release();
    await first;
    await expect(buildZipForGenerator('g1')).resolves.toBeInstanceOf(Buffer);
  });
});
