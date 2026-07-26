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
} from '@dculus/ui';
import {
  FileSpreadsheet,
  Loader2,
  Save,
  X,
  ExternalLink,
  CheckCircle2,
  Unlink,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { getApiBaseUrl } from '../../lib/config';
import { markIntentionalNavigation } from '../../lib/intentionalNavigation';
import { stashPendingConfigFields, consumePendingConfigFields } from '../../lib/pendingConfigFields';
import type { ConfigFormProps } from '../core/registry';

interface MicrosoftToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  email: string;
  displayName: string;
}

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

  const [pluginName, setPluginName] = useState<string>(
    initialData?.name ?? 'Microsoft Excel'
  );
  const [worksheetName, setWorksheetName] = useState<string>(
    initialData?.config?.worksheetName ?? 'Sheet1'
  );
  const [nameError, setNameError] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  const [microsoftToken, setMicrosoftToken] = useState<MicrosoftToken | undefined>(
    initialData?.config?.microsoftToken
  );
  const [workbookUrl] = useState<string | undefined>(
    initialData?.config?.workbookUrl
  );

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
    if (hash.includes('microsoft_oauth_token=')) {
      const raw = new URLSearchParams(hash.slice(1)).get('microsoft_oauth_token') ?? '';
      try {
        const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const token: MicrosoftToken = JSON.parse(atob(padded));
        setMicrosoftToken(token);
        // Restore whatever the user had typed into "Plugin Name"/"Worksheet Name" before
        // Connect navigated the tab away — those edits lived only in local React state and
        // were never saved, so the full-page redirect would otherwise silently revert them.
        const pending = consumePendingConfigFields<{ pluginName?: string; worksheetName?: string }>(
          'microsoft-sheets'
        );
        if (pending?.pluginName) setPluginName(pending.pluginName);
        if (pending?.worksheetName) setWorksheetName(pending.worksheetName);
        justConnectedRef.current = true;
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      } catch (e) {
        console.error('[MicrosoftSheets Config] token parse error:', e);
        setConnectionError(t('connection.authFailed'));
      }
    } else if (hash.includes('microsoft_oauth_error=')) {
      const error =
        new URLSearchParams(hash.slice(1)).get('microsoft_oauth_error') ?? '';
      console.warn('[MicrosoftSheets Config] OAuth error from redirect:', error);
      setConnectionError(t('connection.authFailed'));
      const pending = consumePendingConfigFields<{ pluginName?: string; worksheetName?: string }>(
        'microsoft-sheets'
      );
      if (pending?.pluginName) setPluginName(pending.pluginName);
      if (pending?.worksheetName) setWorksheetName(pending.worksheetName);
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
      setWorksheetName(initialData.config?.worksheetName ?? 'Sheet1');
      setMicrosoftToken(initialData.config?.microsoftToken);
    }
  }, [initialData, instanceKey]);

  const handleConnectMicrosoft = () => {
    // Stash whatever's currently typed into "Plugin Name"/"Worksheet Name" — they're only
    // local React state until Save is clicked, and the redirect below fully reloads the page,
    // discarding them otherwise.
    stashPendingConfigFields('microsoft-sheets', { pluginName, worksheetName });
    // Mark this navigation as intentional first so the automation builder's beforeunload
    // guard (which would otherwise treat this like an accidental tab close) lets it through
    // unprompted.
    markIntentionalNavigation();
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `${getApiBaseUrl()}/api/integrations/microsoft/auth?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleDisconnect = () => {
    setMicrosoftToken(undefined);
    toastSuccess(
      t('toasts.disconnectedTitle'),
      t('toasts.disconnectedDescription')
    );
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
                  href={`${import.meta.env.VITE_FORM_VIEWER_URL}/f/${form.shortUrl}`}
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
              onChange={(e) => setPluginName(e.target.value)}
              placeholder={t('basicSettings.name.placeholder')}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
            <p className="text-xs text-muted-foreground">
              {t('basicSettings.name.hint')}
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
