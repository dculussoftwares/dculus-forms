import React, { useState, useEffect } from 'react';
import {
  Button,
  Label,
  Switch,
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#fbe19d' }}>
          <Lock className="h-4 w-4" style={{ color: '#8b6a18' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
      </div>

      {/* Require Sign In */}
      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <Globe2 className="h-4 w-4" style={{ color: '#5c2e6b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="require-sign-in-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('requireSignIn.title')}
            </Label>
            <p className="text-sm text-muted-foreground">{t('requireSignIn.description')}</p>
          </div>
          <Switch
            id="require-sign-in-enabled"
            data-testid="require-sign-in-checkbox"
            checked={settings.enabled || false}
            onCheckedChange={handleRequireSignInToggle}
          />
        </div>

        {settings.enabled && (
          <div className="px-4 pb-4 pt-3 space-y-2" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
            <Label htmlFor="allowed-domains" className="text-sm text-foreground pt-3 inline-block">
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

      {/* Collect Respondent Email */}
      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
            <Mail className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="collect-respondent-email" className="text-sm font-medium text-primary cursor-pointer">
              {t('collectEmail.title')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {settings.enabled ? t('collectEmail.impliedByRequireSignIn') : t('collectEmail.description')}
            </p>
          </div>
          <Switch
            id="collect-respondent-email"
            data-testid="collect-respondent-email-checkbox"
            checked={settings.enabled || collectRespondentEmail}
            disabled={settings.enabled}
            onCheckedChange={onUpdateCollectRespondentEmail}
          />
        </div>
      </div>

      <div>
        <Button onClick={handleSave} disabled={isSaving} data-testid="save-access-control-button">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
};

export default AccessControlSettings;
