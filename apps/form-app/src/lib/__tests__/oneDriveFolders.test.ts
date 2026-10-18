import {
  createOneDriveFolder,
  fetchOneDriveParentFolderUrl,
} from '../oneDriveFolders';

const originalFetch = global.fetch;

const respond = (ok: boolean, status: number, body: unknown) => ({ ok, status, json: async () => body });

afterEach(() => {
  global.fetch = originalFetch;
});

describe('createOneDriveFolder', () => {
  it('creates a folder under the given parent without reusing a same-named one', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond(true, 201, { id: 'f1', name: 'Reports' }));
    global.fetch = fetchMock as any;

    await expect(createOneDriveFolder('tok', 'Reports', 'parent-1')).resolves.toEqual({ id: 'f1', name: 'Reports' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.microsoft.com/v1.0/me/drive/items/parent-1/children');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      name: 'Reports',
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    });
  });

  it('creates in the OneDrive root when there is no parent', async () => {
    const fetchMock = jest.fn().mockResolvedValue(respond(true, 201, { id: 'f1', name: 'Reports' }));
    global.fetch = fetchMock as any;

    await createOneDriveFolder('tok', 'Reports');

    expect(fetchMock.mock.calls[0][0]).toBe('https://graph.microsoft.com/v1.0/me/drive/root/children');
  });

  it('throws when OneDrive rejects the request', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(false, 403, {})) as any;

    await expect(createOneDriveFolder('tok', 'Reports')).rejects.toThrow('403');
  });
});

describe('fetchOneDriveParentFolderUrl', () => {
  it('resolves the web URL of the parent folder', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(respond(true, 200, { parentReference: { id: 'p1' } }))
      .mockResolvedValueOnce(respond(true, 200, { webUrl: 'https://x/folder' })) as any;

    await expect(fetchOneDriveParentFolderUrl('tok', 'file-1')).resolves.toBe('https://x/folder');
  });

  it('returns null when the item is unreadable or the call fails', async () => {
    global.fetch = jest.fn().mockResolvedValue(respond(false, 404, {})) as any;
    await expect(fetchOneDriveParentFolderUrl('tok', 'file-1')).resolves.toBeNull();

    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as any;
    await expect(fetchOneDriveParentFolderUrl('tok', 'file-1')).resolves.toBeNull();
  });
});
