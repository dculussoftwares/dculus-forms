/**
 * OneDrive File Picker v8 (folder mode). The picker page only accepts a token for its own host
 * (SharePoint / OneDrive), not the Graph token the backend stores, so the browser signs in
 * itself with MSAL. The backend keeps using its Graph token to create the file in the folder.
 */
import { getRuntimeConfig } from '@dculus/utils';

export interface PickedFolder {
  id: string;
  name: string;
}

export interface OneDrivePickerSession {
  baseUrl: string;
  /** `interactive: false` never opens a popup and rejects when sign-in is needed. */
  getToken(resource: string | undefined, interactive: boolean): Promise<string>;
  getFolderName(folderId: string): Promise<string>;
}

const CONSUMER_PICKER_URL = 'https://onedrive.live.com/picker';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AUTHORITY_BASE = 'https://login.microsoftonline.com';

const getClientId = (): string =>
  getRuntimeConfig('VITE_MICROSOFT_CLIENT_ID', import.meta.env.VITE_MICROSOFT_CLIENT_ID) || '';

export const isOneDrivePickerConfigured = (): boolean => !!getClientId();

const createMsalClient = async (authority: string, loginHint?: string) => {
  const { PublicClientApplication, InteractionRequiredAuthError } = await import('@azure/msal-browser');

  const app = new PublicClientApplication({
    auth: {
      clientId: getClientId(),
      authority: `${AUTHORITY_BASE}/${authority}`,
      // The MSAL redirect bridge page (redirect.html).
      redirectUri: `${window.location.origin}/redirect`,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await app.initialize();

  return async (scopes: string[], interactive: boolean) => {
    const account = app.getActiveAccount() ?? app.getAllAccounts()[0];
    if (account) {
      try {
        return await app.acquireTokenSilent({ scopes, account });
      } catch (error) {
        if (!interactive || !(error instanceof InteractionRequiredAuthError)) throw error;
      }
    } else if (!interactive) {
      throw new Error('Sign in required');
    }
    const result = await app.acquireTokenPopup({ scopes, loginHint });
    app.setActiveAccount(result.account);
    return result;
  };
};

export const createOneDrivePickerSession = async (loginHint?: string): Promise<OneDrivePickerSession> => {
  const acquire = await createMsalClient('common', loginHint);

  const graphToken = await acquire(['Files.Read'], true);

  // Graph's driveType is authoritative; a personal drive's webUrl host is not a SharePoint resource.
  const driveResponse = await fetch(`${GRAPH_BASE}/me/drive?$select=webUrl,driveType`, {
    headers: { Authorization: `Bearer ${graphToken.accessToken}` },
  });
  if (!driveResponse.ok) throw new Error(`Could not find your OneDrive (${driveResponse.status})`);
  const drive = (await driveResponse.json()) as { webUrl: string; driveType: string };

  const isConsumer = drive.driveType === 'personal';
  const baseUrl = isConsumer ? CONSUMER_PICKER_URL : new URL(drive.webUrl).origin;
  // The legacy OneDrive.* scope is only valid against the consumers authority, not common.
  const acquirePickerToken = isConsumer ? await createMsalClient('consumers', loginHint) : acquire;

  return {
    baseUrl,
    getToken: async (resource, interactive) => {
      const scopes = isConsumer ? ['OneDrive.ReadWrite'] : [`${resource ?? baseUrl}/.default`];
      return (await acquirePickerToken(scopes, interactive)).accessToken;
    },
    getFolderName: async (folderId) => {
      const token = await acquire(['Files.Read'], false);
      const response = await fetch(`${GRAPH_BASE}/me/drive/items/${encodeURIComponent(folderId)}?$select=name`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (!response.ok) throw new Error(`Could not read the folder (${response.status})`);
      return ((await response.json()) as { name: string }).name;
    },
  };
};

export const buildPickerUrl = (session: OneDrivePickerSession, channelId: string, title: string): string => {
  const options = {
    sdk: '8.0',
    entry: { oneDrive: {} },
    // Present (even empty) so the host supplies the tokens.
    authentication: {},
    messaging: { origin: window.location.origin, channelId },
    typesAndSources: {
      mode: 'folders',
      locations: { oneDrive: {} },
      access: { mode: 'read-write' },
      pivots: { oneDrive: true, recent: false, shared: false, sharedLibraries: false, myOrganization: false, site: false },
    },
    selection: { mode: 'single', enablePersistence: false },
    commands: { pick: { action: 'select' } },
    title,
  };
  const query = new URLSearchParams({ filePicker: JSON.stringify(options), locale: 'en-us' });
  // OneDrive personal serves the picker at /picker itself; only SharePoint/OneDrive for Business
  // host it at /_layouts/15/FilePicker.aspx (the wrong path shows "This item might not exist").
  const pickerPath = session.baseUrl === CONSUMER_PICKER_URL ? '' : '/_layouts/15/FilePicker.aspx';
  return `${session.baseUrl}${pickerPath}?${query.toString()}`;
};
