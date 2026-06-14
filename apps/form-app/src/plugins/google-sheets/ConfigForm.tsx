import React, { useState, useEffect } from 'react';
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
  TableProperties,
  Loader2,
  Save,
  X,
  ExternalLink,
  CheckCircle2,
  Unlink,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { ConfigFormProps } from '../core/registry';

interface GoogleToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  email: string;
}

export const GoogleSheetsConfigForm: React.FC<ConfigFormProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('pluginGoogleSheets');

  const [pluginName, setPluginName] = useState<string>(
    initialData?.name ?? 'Google Sheets'
  );
  const [nameError, setNameError] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  const [googleToken, setGoogleToken] = useState<GoogleToken | undefined>(
    initialData?.config?.googleToken
  );
  const [spreadsheetId] = useState<string | undefined>(
    initialData?.config?.spreadsheetId
  );
  const [spreadsheetUrl] = useState<string | undefined>(
    initialData?.config?.spreadsheetUrl
  );

  // On mount: check if we just returned from Google OAuth redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('google_oauth_token=')) {
      const raw = new URLSearchParams(hash.slice(1)).get('google_oauth_token') ?? '';
      try {
        const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const token: GoogleToken = JSON.parse(atob(padded));
        console.log('[GSheets Config] ✅ token from redirect for:', token.email);
        setGoogleToken(token);
        // Clean hash from URL without triggering a navigation
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {
        console.error('[GSheets Config] token parse error:', e);
        setConnectionError(t('connection.authFailed'));
      }
    } else if (hash.includes('google_oauth_error=')) {
      const error = new URLSearchParams(hash.slice(1)).get('google_oauth_error') ?? '';
      console.warn('[GSheets Config] OAuth error from redirect:', error);
      setConnectionError(t('connection.authFailed'));
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (initialData) {
      setPluginName(initialData.name ?? 'Google Sheets');
      setGoogleToken(initialData.config?.googleToken);
    }
  }, [initialData]);

  const handleConnectGoogle = () => {
    // Redirect the current tab — avoids all popup/COOP/BroadcastChannel issues
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `/api/integrations/google/auth?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleDisconnect = () => {
    setGoogleToken(undefined);
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

    if (!googleToken) {
      setConnectionError(t('validation.notConnected'));
      return;
    }
    setConnectionError('');

    await onSave({
      type: 'google-sheets',
      name: pluginName.trim(),
      config: {
        type: 'google-sheets',
        googleToken,
        spreadsheetId,
        spreadsheetUrl,
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
            <div className="bg-green-50 p-3 rounded-xl">
              <TableProperties className="h-5 w-5 text-green-700" />
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
                <p className="text-sm font-medium text-foreground truncate">{form.title}</p>
              </div>
              {form.shortUrl && (
                <a
                  href={`${import.meta.env.VITE_FORM_VIEWER_URL}/f/${form.shortUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-800 hover:underline shrink-0"
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
            {nameError && (
              <p className="text-sm text-destructive">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('basicSettings.name.hint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Google Account connection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('connection.title')}</CardTitle>
          <CardDescription>{t('connection.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-800">
                  {t('connection.connectedAs', {
                    values: { email: googleToken.email },
                  })}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                {spreadsheetUrl ? (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-green-700 hover:text-green-800 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t('connection.openSheet')}
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
                onClick={handleConnectGoogle}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                <TableProperties className="h-4 w-4 mr-2" />
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
          disabled={isSaving || !googleToken}
          className="bg-green-700 hover:bg-green-800 text-white"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('actions.saving')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {mode === 'create' ? t('actions.create') : t('actions.update')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
