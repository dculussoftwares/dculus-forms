import {
  MY_DRIVE_URL,
  createGoogleDriveFolder,
  fetchGoogleDriveParentId,
  getDriveFolderUrl,
} from '../googleDrive';

const originalFetch = global.fetch;

const respond = (ok: boolean, status: number, body: unknown) =>
  jest.fn().mockResolvedValue({ ok, status, json: async () => body });

afterEach(() => {
  global.fetch = originalFetch;
});

describe('getDriveFolderUrl', () => {
  it('links to the folder when an id is known and to My Drive otherwise', () => {
    expect(getDriveFolderUrl('abc 1')).toBe('https://drive.google.com/drive/folders/abc%201');
    expect(getDriveFolderUrl()).toBe(MY_DRIVE_URL);
  });
});

describe('createGoogleDriveFolder', () => {
  it('creates a folder under the given parent', async () => {
    const fetchMock = respond(true, 200, { id: 'f1', name: 'Reports' });
    global.fetch = fetchMock as any;

    await expect(createGoogleDriveFolder('tok', 'Reports', 'parent-1')).resolves.toEqual({ id: 'f1', name: 'Reports' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/drive/v3/files');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Reports',
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['parent-1'],
    });
  });

  it('creates in My Drive when there is no parent', async () => {
    const fetchMock = respond(true, 200, { id: 'f1', name: 'Reports' });
    global.fetch = fetchMock as any;

    await createGoogleDriveFolder('tok', 'Reports');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('parents');
  });

  it('throws when Drive rejects the request', async () => {
    global.fetch = respond(false, 403, {}) as any;

    await expect(createGoogleDriveFolder('tok', 'Reports')).rejects.toThrow('403');
  });
});

describe('fetchGoogleDriveParentId', () => {
  it('returns the first parent', async () => {
    global.fetch = respond(true, 200, { parents: ['p1', 'p2'] }) as any;

    await expect(fetchGoogleDriveParentId('tok', 'file-1')).resolves.toBe('p1');
  });

  it('returns null when the file is unreadable or the call fails', async () => {
    global.fetch = respond(false, 404, {}) as any;
    await expect(fetchGoogleDriveParentId('tok', 'file-1')).resolves.toBeNull();

    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    await expect(fetchGoogleDriveParentId('tok', 'file-1')).resolves.toBeNull();
  });
});
