import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import {
  FileSpreadsheet,
  Loader2,
  Save,
  X,
  ExternalLink,
  CheckCircle2,
  Unlink,
  FolderOpen,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiBaseUrl, getFormViewerUrl } from '../../lib/config';
import { markIntentionalNavigation } from '../../lib/intentionalNavigation';
import {
  stashPendingConfigFields,
  consumePendingConfigFields,
  beginOAuthConnect,
  verifyOAuthReturn,
  parseOAuthTokenFragment,
} from '../../lib/pendingConfigFields';
import {
  createOneDrivePickerSession,
  isOneDrivePickerConfigured,
  type OneDrivePickerSession,
  type PickedFolder,
} from '../../lib/oneDrivePicker';
import { DestinationFolderField } from '../../components/plugins/shared/DestinationFolderField';
import { OneDriveFolderPicker } from '../../components/plugins/shared/OneDriveFolderPicker';
import { createOneDriveFolder, fetchOneDriveParentFolderUrl } from '../../lib/oneDriveFolders';
import type { ConfigFormProps } from '../core/registry';

interface MicrosoftToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  email: string;
  displayName: string;
}

/** An access token past (or about to pass) its expiry can't be used for direct OneDrive calls. */
const isTokenUsable = (token: MicrosoftToken | undefined): token is MicrosoftToken =>
  !!token && new Date(token.expiresAt).getTime() > Date.now() + 30_000;

/** What the file name input starts as: the saved name, else blank for an existing file (keep its name), else the plugin name. */
const initialWorkbookName = (config: Record<string, any> | undefined, pluginName: string): string =>
  config?.workbookName ?? (config?.workbookId ? '' : pluginName);

export const MicrosoftSheetsConfigForm: React.FC<ConfigFormProps> = ({
  form,
  initialData,
  instanceKey,
  mode,
  isSaving,
  onSave,
  onCancel,
  submitLabelOverride,
}) => {
  const { t } = useTranslation('pluginMicrosoftSheets');
  const { t: tDestination } = useTranslation('pluginDestination');

  const [destinationFolder, setDestinationFolder] = useState<PickedFolder | undefined>(
    initialData?.config?.destinationFolder
  );
  const [pickerSession, setPickerSession] = useState<OneDrivePickerSession | null>(null);
  const [pluginName, setPluginName] = useState<string>(
    initialData?.name ?? 'Microsoft Excel'
  );
  // Follows the plugin name until the user types their own, so the default is never a surprise.
  const [workbookName, setWorkbookName] = useState<string>(() =>
    initialWorkbookName(initialData?.config, initialData?.name ?? 'Microsoft Excel')
  );
  const [workbookNameTouched, setWorkbookNameTouched] = useState<boolean>(
    !!initialData?.config?.workbookName || !!initialData?.config?.workbookId
  );
  const [liveFolderUrl, setLiveFolderUrl] = useState<string | null>(null);
  const [worksheetName, setWorksheetName] = useState<string>(
    initialData?.config?.worksheetName ?? 'Sheet1'
  );
  const [nameError, setNameError] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  const [microsoftToken, setMicrosoftToken] = useState<MicrosoftToken | undefined>(
    initialData?.config?.microsoftToken
  );
  // Not local state: read directly from `initialData` (fresh per selected node) rather than
  // capturing once at mount — same reasoning as google-sheets/ConfigForm.tsx's
  // spreadsheetId/spreadsheetUrl. `handleSave` below already read `workbookId`/`workbookUrl`
  // fresh from `initialData`, so this was display-only staleness (the "Open in..." link could
  // point at a sibling node's workbook after switching without saving), not a persisted leak.
  const workbookUrl = initialData?.config?.workbookUrl;
  const workbookId = initialData?.config?.workbookId;

  // NodeConfigPanel (the automation builder's host for this form) passes a brand-new
  // `initialData` object literal on every render, not just when the selected node changes —
  // so the sync effect below re-fires far more often than its name suggests. On the mount
  // that follows an OAuth redirect, both effects run in the same commit: this one first,
  // then the sync effect second, since effects run in declaration order. Left unguarded, the
  // sync effect immediately resets `microsoftToken`/`pluginName`/`worksheetName` back to
  // `initialData`'s (still last-*Saved*) values — none of the three are persisted to the node
  // until "Save action" is clicked — silently discarding what this effect just restored (the
  // token freshly parsed, the name/worksheet from the pending-fields stash). The ref is never
  // self-resetting: React StrictMode's dev-only double-invoke of effects on mount runs this
  // same pair a second time, and by then `window.location.hash` has already been stripped (so
  // the parse branch below is a no-op on that second pass) — a self-resetting guard would
  // leave that second sync-effect invocation unguarded and wipe everything anyway.
  //
  // NodeConfigPanel does NOT remount this form when the user switches to a different node of
  // the same plugin type without saving/canceling first — it renders the same ConfigForm
  // component instance with new props, since there's no `key`. So the latch must be reset
  // explicitly on a genuine node switch (tracked via `instanceKey`, NodeConfigPanel's
  // node.id), or a token/name meant for the node open during OAuth would silently leak onto
  // whatever different node the user clicks next.
  const justConnectedRef = useRef(false);
  const prevInstanceKeyRef = useRef(instanceKey);

  // On mount: check if we just returned from Microsoft OAuth redirect
  useEffect(() => {
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.slice(1));
    const returnedFromConnect = verifyOAuthReturn('microsoft-sheets');
    if (hashParams.has('microsoft_oauth_token')) {
      try {
        // Only trust a token that comes back from a Connect flow this tab started.
        const token = returnedFromConnect
          ? parseOAuthTokenFragment<MicrosoftToken>(hashParams.get('microsoft_oauth_token') ?? '', [
              'refreshToken',
              'email',
              'displayName',
            ])
          : null;
        if (!token) throw new Error('OAuth return rejected');
        setMicrosoftToken(token);
        // Restore whatever the user had typed into "Plugin Name"/"Worksheet Name" before
        // Connect navigated the tab away — those edits lived only in local React state and
        // were never saved, so the full-page redirect would otherwise silently revert them.
        // Checked by key presence, not truthiness: clearing either field to '' before Connect
        // is a valid edit that a truthiness check would fail to restore.
        const pending = consumePendingConfigFields<{ pluginName?: string; worksheetName?: string; workbookName?: string; workbookNameTouched?: boolean }>(
          'microsoft-sheets'
        );
        if (pending && 'pluginName' in pending) setPluginName(pending.pluginName ?? '');
        if (pending && 'worksheetName' in pending) setWorksheetName(pending.worksheetName ?? '');
        if (pending && 'workbookName' in pending) {
          setWorkbookName(pending.workbookName ?? '');
          setWorkbookNameTouched(!!pending.workbookNameTouched);
        }
        justConnectedRef.current = true;
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      } catch (e) {
        console.error('[MicrosoftSheets Config] token rejected:', e);
        setConnectionError(t('connection.authFailed'));
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } else if (hashParams.has('microsoft_oauth_error')) {
      const error = hashParams.get('microsoft_oauth_error') ?? '';
      console.warn('[MicrosoftSheets Config] OAuth error from redirect:', error);
      setConnectionError(t('connection.authFailed'));
      const pending = consumePendingConfigFields<{ pluginName?: string; worksheetName?: string; workbookName?: string; workbookNameTouched?: boolean }>(
        'microsoft-sheets'
      );
      if (pending && 'pluginName' in pending) setPluginName(pending.pluginName ?? '');
      if (pending && 'worksheetName' in pending) setWorksheetName(pending.worksheetName ?? '');
      if (pending && 'workbookName' in pending) {
        setWorkbookName(pending.workbookName ?? '');
        setWorkbookNameTouched(!!pending.workbookNameTouched);
      }
      if (pending) justConnectedRef.current = true;
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
    }
  }, []);

  useEffect(() => {
    if (prevInstanceKeyRef.current !== instanceKey) {
      prevInstanceKeyRef.current = instanceKey;
      justConnectedRef.current = false;
    }
    if (initialData && !justConnectedRef.current) {
      setPluginName(initialData.name ?? 'Microsoft Excel');
      setWorkbookName(initialWorkbookName(initialData.config, initialData.name ?? 'Microsoft Excel'));
      setWorkbookNameTouched(!!initialData.config?.workbookName || !!initialData.config?.workbookId);
      setWorksheetName(initialData.config?.worksheetName ?? 'Sheet1');
      setMicrosoftToken(initialData.config?.microsoftToken);
    }
  }, [initialData, instanceKey]);

  // The file may have been moved since it was created, so ask OneDrive where it is now.
  const savedFolderUrl = initialData?.config?.workbookFolderUrl as string | undefined;
  useEffect(() => {
    setLiveFolderUrl(null);
    if (!workbookId || !isTokenUsable(microsoftToken)) return;
    let cancelled = false;
    void fetchOneDriveParentFolderUrl(microsoftToken.accessToken, workbookId).then((url) => {
      if (!cancelled) setLiveFolderUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [workbookId, microsoftToken?.accessToken]);
  const folderUrl = liveFolderUrl ?? savedFolderUrl;

  // Keyed on the saved value so an unsaved pick survives parent re-renders that rebuild `initialData`.
  const savedFolderKey = JSON.stringify(initialData?.config?.destinationFolder ?? null);
  useEffect(() => {
    setDestinationFolder(initialData?.config?.destinationFolder);
  }, [savedFolderKey, instanceKey]);

  const handleConnectMicrosoft = () => {
    // Stash whatever's currently typed into "Plugin Name"/"Worksheet Name" — they're only
    // local React state until Save is clicked, and the redirect below fully reloads the page,
    // discarding them otherwise.
    stashPendingConfigFields('microsoft-sheets', { pluginName, worksheetName, workbookName, workbookNameTouched });
    // Mark this navigation as intentional first so the automation builder's beforeunload
    // guard (which would otherwise treat this like an accidental tab close) lets it through
    // unprompted.
    markIntentionalNavigation();
    const returnTo = beginOAuthConnect('microsoft-sheets', window.location.pathname + window.location.search);
    window.location.href = `${getApiBaseUrl()}/api/integrations/microsoft/auth?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleDisconnect = () => {
    setMicrosoftToken(undefined);
    // A folder belongs to the disconnected account and would not exist for the next one.
    if (!workbookId) setDestinationFolder(undefined);
    toastSuccess(
      t('toasts.disconnectedTitle'),
      t('toasts.disconnectedDescription')
    );
  };

  const handlePickFolder = async () => {
    if (!microsoftToken) return;
    try {
      setPickerSession(await createOneDrivePickerSession(microsoftToken.email));
    } catch (e) {
      toastError(tDestination('errors.pickFailed'), e instanceof Error ? e.message : '');
    }
  };

  const handleCreateFolder = async (name: string): Promise<boolean> => {
    if (!isTokenUsable(microsoftToken)) {
      toastError(tDestination('errors.createFailed'), tDestination('errors.tokenExpired'));
      return false;
    }
    try {
      setDestinationFolder(await createOneDriveFolder(microsoftToken.accessToken, name, destinationFolder?.id));
      return true;
    } catch (e) {
      toastError(tDestination('errors.createFailed'), e instanceof Error ? e.message : '');
      return false;
    }
  };

  const handlePluginNameChange = (value: string) => {
    setPluginName(value);
    if (!workbookNameTouched) setWorkbookName(value);
  };

  const handleSave = async () => {
    if (!pluginName.trim()) {
      setNameError(t('validation.nameRequired'));
      return;
    }
    setNameError('');

    if (!microsoftToken) {
      setConnectionError(t('validation.notConnected'));
      return;
    }
    setConnectionError('');

    await onSave({
      type: 'microsoft-sheets',
      name: pluginName.trim(),
      config: {
        type: 'microsoft-sheets',
        microsoftToken,
        workbookId: initialData?.config?.workbookId,
        workbookUrl: initialData?.config?.workbookUrl,
        workbookFolderUrl: savedFolderUrl,
        workbookName: workbookName.trim() || undefined,
        destinationFolder,
        worksheetName: worksheetName.trim() || 'Sheet1',
      },
      events: ['form.submitted'],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#d6f0e0' }}>
              <FileSpreadsheet className="h-4 w-4" style={{ color: '#217346' }} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle>
                {mode === 'create' ? t('header.titleCreate') : t('header.titleEdit')}
              </CardTitle>
              <CardDescription>{t('header.description')}</CardDescription>
            </div>
          </div>
          {form && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{t('header.formLabel')}</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {form.title}
                </p>
              </div>
              {form.shortUrl && (
                <a
                  href={getFormViewerUrl(form.shortUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:underline shrink-0"
                  style={{ color: '#217346' }}
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('header.viewForm')}
                </a>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Basic settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('basicSettings.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plugin-name">
              {t('basicSettings.name.label')}{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="plugin-name"
              value={pluginName}
              onChange={(e) => handlePluginNameChange(e.target.value)}
              placeholder={t('basicSettings.name.placeholder')}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <p className="text-xs text-muted-foreground">
              {t('basicSettings.name.hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="workbook-name">{t('basicSettings.workbookName.label')}</Label>
            <Input
              id="workbook-name"
              value={workbookName}
              onChange={(e) => {
                setWorkbookName(e.target.value);
                setWorkbookNameTouched(true);
              }}
              maxLength={200}
              placeholder={
                workbookId && !initialData?.config?.workbookName
                  ? t('basicSettings.workbookName.keepCurrentPlaceholder')
                  : t('basicSettings.workbookName.placeholder')
              }
            />
            <p className="text-xs text-muted-foreground">
              {t('basicSettings.workbookName.hint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="worksheet-name">{t('basicSettings.worksheet.label')}</Label>
            <Input
              id="worksheet-name"
              value={worksheetName}
              onChange={(e) => setWorksheetName(e.target.value)}
              placeholder={t('basicSettings.worksheet.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('basicSettings.worksheet.hint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Microsoft Account connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('connection.title')}</CardTitle>
          <CardDescription>{t('connection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {microsoftToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--tf-green-bg)', border: '1px solid var(--tf-green-bg-md)' }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-green)' }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--tf-green)' }}>
                    {microsoftToken.displayName}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--tf-green)' }}>{microsoftToken.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                {workbookUrl ? (
                  <div className="flex items-center gap-4">
                    <a
                      href={workbookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm hover:underline"
                      style={{ color: '#217346' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('connection.openWorkbook')}
                    </a>
                    {folderUrl && (
                      <a
                        href={folderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm hover:underline"
                        style={{ color: '#217346' }}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        {tDestination('openFolderOneDrive')}
                      </a>
                    )}
                  </div>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnect}
                  className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                >
                  <Unlink className="h-4 w-4 mr-2" />
                  {t('connection.disconnectButton')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('connection.notConnectedHint')}
              </p>
              <Button
                type="button"
                onClick={handleConnectMicrosoft}
                className="text-white hover:opacity-90"
                style={{ backgroundColor: '#217346' }}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                {t('connection.connectButton')}
              </Button>
            </div>
          )}
          {connectionError && (
            <p className="text-sm text-destructive">{connectionError}</p>
          )}
        </CardContent>
      </Card>

      {microsoftToken && (
        <>
          <DestinationFolderField
            provider="microsoft"
            folder={destinationFolder}
            locked={!!workbookId}
            pickerAvailable={isOneDrivePickerConfigured()}
            onPick={handlePickFolder}
            onClear={() => setDestinationFolder(undefined)}
            onCreate={handleCreateFolder}
          />
          <OneDriveFolderPicker
            session={pickerSession}
            onClose={() => setPickerSession(null)}
            onPicked={(folder) => {
              setDestinationFolder(folder);
              setPickerSession(null);
            }}
          />
        </>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('howItWorks.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>{t('howItWorks.step1')}</li>
            <li>{t('howItWorks.step2')}</li>
            <li>{t('howItWorks.step3')}</li>
          </ul>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          <X className="h-4 w-4 mr-2" />
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !microsoftToken}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('actions.saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {submitLabelOverride ?? (mode === 'create' ? t('actions.create') : t('actions.update'))}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
