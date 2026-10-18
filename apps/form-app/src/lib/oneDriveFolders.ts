/**
 * OneDrive calls made straight from the browser with the connected account's Graph access token
 * (granted `Files.ReadWrite` at connect time), as the folder picker flow already does for reads.
 */
import type { PickedFolder } from './oneDrivePicker';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/** Creates a folder inside `parentId`, or in the OneDrive root when no parent is given. */
export const createOneDriveFolder = async (
  accessToken: string,
  name: string,
  parentId?: string
): Promise<PickedFolder> => {
  const parent = parentId ? `items/${encodeURIComponent(parentId)}` : 'root';
  const response = await fetch(`${GRAPH_BASE}/me/drive/${parent}/children`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    // `rename` so a same-named folder is never reused or overwritten.
    body: JSON.stringify({ name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' }),
  });
  if (!response.ok) {
    throw new Error(`OneDrive returned ${response.status}`);
  }
  const data = (await response.json()) as { id: string; name: string };
  return { id: data.id, name: data.name };
};

const fetchWebUrl = async (accessToken: string, path: string): Promise<{ webUrl?: string; parentReference?: { id?: string } } | null> => {
  const response = await fetch(`${GRAPH_BASE}/me/drive/${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return response.ok ? ((await response.json()) as { webUrl?: string; parentReference?: { id?: string } }) : null;
};

/** The web URL of the folder a file currently sits in, or null when it can't be read (deleted, expired token). */
export const fetchOneDriveParentFolderUrl = async (accessToken: string, itemId: string): Promise<string | null> => {
  try {
    const item = await fetchWebUrl(accessToken, `items/${encodeURIComponent(itemId)}?$select=parentReference`);
    const parentId = item?.parentReference?.id;
    if (!parentId) return null;
    const parent = await fetchWebUrl(accessToken, `items/${encodeURIComponent(parentId)}?$select=webUrl`);
    return parent?.webUrl || null;
  } catch {
    return null;
  }
};
