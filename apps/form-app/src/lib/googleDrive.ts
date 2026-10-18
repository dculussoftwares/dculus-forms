/**
 * Drive calls made straight from the browser with the connected account's access token, the same
 * token the folder picker uses. `drive.file` is enough: it covers folders this app creates and
 * files it created.
 */
import type { PickedFolder } from './googlePicker';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export const MY_DRIVE_URL = 'https://drive.google.com/drive/my-drive';

export const getDriveFolderUrl = (folderId?: string): string =>
  folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : MY_DRIVE_URL;

/** Creates a folder inside `parentId`, or in My Drive when no parent is given. */
export const createGoogleDriveFolder = async (
  accessToken: string,
  name: string,
  parentId?: string
): Promise<PickedFolder> => {
  const response = await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  if (!response.ok) {
    throw new Error(`Google Drive returned ${response.status}`);
  }
  const data = (await response.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
};

/** The folder a file currently sits in, or null when it can't be read (moved out of reach, deleted, expired token). */
export const fetchGoogleDriveParentId = async (accessToken: string, fileId: string): Promise<string | null> => {
  try {
    const response = await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}?fields=parents`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { parents?: string[] };
    return data.parents?.[0] ?? null;
  } catch {
    return null;
  }
};
