/**
 * Google Picker folder chooser. `drive.file` is enough: a folder chosen here is the one Drive
 * folder the app is then allowed to create files in.
 */
import { getRuntimeConfig } from '@dculus/utils';

export interface PickedFolder {
  id: string;
  name: string;
}

interface PickerDocument {
  id: string;
  name: string;
}

interface PickerResponse {
  action: string;
  docs?: PickerDocument[];
}

interface PickerView {
  setSelectFolderEnabled(enabled: boolean): PickerView;
  setIncludeFolders(include: boolean): PickerView;
  setMimeTypes(types: string): PickerView;
}

interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GooglePickerNamespace {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId: string) => PickerView;
  ViewId: { FOLDERS: string };
  Action: { PICKED: string; CANCEL: string };
}

declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void };
    google?: { picker?: GooglePickerNamespace };
  }
}

const API_LOADER_URL = 'https://apis.google.com/js/api.js';

let pickerLibrary: Promise<GooglePickerNamespace> | undefined;

const loadPickerLibrary = (): Promise<GooglePickerNamespace> => {
  pickerLibrary ??= new Promise<GooglePickerNamespace>((resolve, reject) => {
    const fail = (message: string) => {
      pickerLibrary = undefined;
      reject(new Error(message));
    };
    const loadPicker = () =>
      window.gapi!.load('picker', () => {
        const picker = window.google?.picker;
        if (picker) resolve(picker);
        else fail('Google Picker failed to initialise');
      });

    if (window.gapi) {
      loadPicker();
      return;
    }
    const script = document.createElement('script');
    script.src = API_LOADER_URL;
    script.async = true;
    script.onload = loadPicker;
    script.onerror = () => fail('Google Picker script failed to load');
    document.head.appendChild(script);
  });
  return pickerLibrary;
};

const getPickerCredentials = () => ({
  apiKey: getRuntimeConfig('VITE_GOOGLE_PICKER_API_KEY', import.meta.env.VITE_GOOGLE_PICKER_API_KEY) || '',
  appId: getRuntimeConfig('VITE_GOOGLE_APP_ID', import.meta.env.VITE_GOOGLE_APP_ID) || '',
});

export const isGoogleFolderPickerConfigured = (): boolean => {
  const { apiKey, appId } = getPickerCredentials();
  return !!apiKey && !!appId;
};

/** Resolves the chosen folder, or null when the user cancels. */
export const pickGoogleDriveFolder = async (accessToken: string, title: string): Promise<PickedFolder | null> => {
  const { apiKey, appId } = getPickerCredentials();
  const picker = await loadPickerLibrary();

  return new Promise<PickedFolder | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');

    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setTitle(title)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) {
          const doc = response.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (response.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build()
      .setVisible(true);
  });
};
