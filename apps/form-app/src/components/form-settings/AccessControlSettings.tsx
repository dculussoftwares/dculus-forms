import React, { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Checkbox,
  Input,
  toastError,
} from '@dculus/ui';
import { Lock, Save, Globe2, Mail } from 'lucide-react';
import type { AccessControlSettings as AccessControlSettingsType } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';

interface AccessControlSettingsProps {
  settings: AccessControlSettingsType;
  collectRespondentEmail: boolean;
  isSaving: boolean;
  onUpdate: (accessControl: AccessControlSettingsType) => void;
  onUpdateCollectRespondentEmail: (collectRespondentEmail: boolean) => void;
  onSave: () => void;
}

// Same shape as email addresses' domain part — no leading "@", must contain a dot.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

const AccessControlSettings: React.FC<AccessControlSettingsProps> = ({
  settings,
  collectRespondentEmail,
  isSaving,
  onUpdate,
  onUpdateCollectRespondentEmail,
  onSave,
}) => {
  const { t } = useTranslation('accessControlSettings');
  // Free text while typing — only parsed into settings.allowedDomains on blur/save,
  // so a trailing comma or partial domain doesn't get rejected mid-keystroke.
  const [domainsText, setDomainsText] = useState((settings.allowedDomains || []).join(', '));

  // `settings` hydrates asynchronously (GraphQL fetch resolves after the
  // initial render), so the useState initializer above captures the default
  // `[]` on first mount and never sees the real value — without this, the
  // domains field looks empty on every page load even though it's saved.
  useEffect(() => {
    setDomainsText((settings.allowedDomains || []).join(', '));
  }, [settings.allowedDomains]);

  const handleRequireSignInToggle = (enabled: boolean) => {
    onUpdate({ ...settings, enabled, requireSignIn: enabled, allowedDomains: enabled ? settings.allowedDomains : [] });
    if (!enabled) setDomainsText('');
  };

  const parseDomains = (): string[] | null => {
    const domains = domainsText
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    for (const domain of domains) {
      if (!DOMAIN_RE.test(domain)) {
        toastError(t('validation.invalidDomain'), t('validation.invalidDomainMessage', { values: { domain } }));
        return null;
      }
    }
    return domains;
  };

  const handleDomainsBlur = () => {
    const domains = parseDomains();
    if (domains) onUpdate({ ...settings, allowedDomains: domains });
  };

  const handleSave = () => {
    const domains = parseDomains();
    if (domains === null) return;
    onUpdate({ ...settings, allowedDomains: domains });
    onSave();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Lock className="mr-2 h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="require-sign-in-enabled"
              data-testid="require-sign-in-checkbox"
              checked={settings.enabled || false}
              onCheckedChange={handleRequireSignInToggle}
            />
            <div className="space-y-1">
              <Label htmlFor="require-sign-in-enabled" className="text-sm font-medium cursor-pointer">
                {t('requireSignIn.title')}
              </Label>
              <p className="text-sm text-foreground">{t('requireSignIn.description')}</p>
            </div>
          </div>

          {settings.enabled && (
            <div className="ml-6 space-y-2">
              <Label htmlFor="allowed-domains" className="text-sm flex items-center">
                <Globe2 className="mr-1 h-4 w-4" />
                {t('allowedDomains.label')}
              </Label>
              <Input
                id="allowed-domains"
                data-testid="allowed-domains-input"
                value={domainsText}
                onChange={e => setDomainsText(e.target.value)}
                onBlur={handleDomainsBlur}
                placeholder={t('allowedDomains.placeholder')}
              />
              <p className="text-xs text-muted-foreground">{t('allowedDomains.help')}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="collect-respondent-email"
              data-testid="collect-respondent-email-checkbox"
              checked={settings.enabled || collectRespondentEmail}
              disabled={settings.enabled}
              onCheckedChange={onUpdateCollectRespondentEmail}
            />
            <div className="space-y-1">
              <Label htmlFor="collect-respondent-email" className="text-sm font-medium cursor-pointer flex items-center">
                <Mail className="mr-1 h-4 w-4" />
                {t('collectEmail.title')}
              </Label>
              <p className="text-sm text-foreground">
                {settings.enabled ? t('collectEmail.impliedByRequireSignIn') : t('collectEmail.description')}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button onClick={handleSave} disabled={isSaving} data-testid="save-access-control-button">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccessControlSettings;
