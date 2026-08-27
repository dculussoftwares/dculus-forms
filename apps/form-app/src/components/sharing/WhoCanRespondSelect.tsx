import React, { useEffect, useState } from 'react';
import { Input, Label, RadioGroup, RadioGroupItem, toastError } from '@dculus/ui';
import { Globe, Mail, Lock } from 'lucide-react';
import type { AccessControlSettings } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * The three respondent-audience presets, borrowed from Microsoft Forms' "who
 * can respond" dropdown. They are a *mirror* of the same two settings the
 * Access control page owns (`accessControl` + `collectRespondentEmail`) — never
 * a parallel store — so the two screens can't drift.
 *
 * The four representable states collapse into three presets, with the domain
 * list as a refinement of `signIn` rather than a preset of its own:
 *
 *   anyone          accessControl.enabled=false, collectRespondentEmail=false
 *   anyoneWithEmail accessControl.enabled=false, collectRespondentEmail=true
 *   signIn          accessControl.enabled=true,  allowedDomains=[] | [...]
 */
export type RespondAudience = 'anyone' | 'anyoneWithEmail' | 'signIn';

// Mirrors DOMAIN_RE in AccessControlSettings.tsx and the backend's updateForm
// validation — a domain part with no leading "@" and at least one dot.
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function toAudience(
  accessControl: AccessControlSettings | undefined | null,
  collectRespondentEmail: boolean | undefined | null
): RespondAudience {
  if (accessControl?.enabled) return 'signIn';
  return collectRespondentEmail ? 'anyoneWithEmail' : 'anyone';
}

export interface AudienceSettings {
  accessControl: AccessControlSettings;
  collectRespondentEmail: boolean;
}

export function fromAudience(audience: RespondAudience, allowedDomains: string[]): AudienceSettings {
  switch (audience) {
    case 'signIn':
      return {
        accessControl: { enabled: true, requireSignIn: true, allowedDomains },
        // Signing in always yields a verified email, so this flag is redundant
        // while accessControl is on — AccessControlSettings.tsx shows the same
        // implication by force-checking and disabling its toggle.
        collectRespondentEmail: false,
      };
    case 'anyoneWithEmail':
      return {
        accessControl: { enabled: false, requireSignIn: false, allowedDomains: [] },
        collectRespondentEmail: true,
      };
    default:
      return {
        accessControl: { enabled: false, requireSignIn: false, allowedDomains: [] },
        collectRespondentEmail: false,
      };
  }
}

interface WhoCanRespondSelectProps {
  accessControl?: AccessControlSettings;
  collectRespondentEmail?: boolean;
  /** Access control is OWNER-gated server-side (resolvers/forms.ts), so mirror that here. */
  canEdit: boolean;
  disabled?: boolean;
  onChange: (next: AudienceSettings) => void;
  onMoreOptions: () => void;
}

// Icon chips reuse the app's --tf-icon-* palette (see index.css) so the panel
// reads as part of the same family as the Settings pages, which use the same
// chip-plus-label row.
const OPTIONS: Record<RespondAudience, { icon: React.ElementType; chip: string; ink: string }> = {
  anyone: { icon: Globe, chip: 'var(--tf-icon-teal)', ink: 'var(--tf-green)' },
  anyoneWithEmail: { icon: Mail, chip: 'var(--tf-icon-salmon)', ink: 'var(--tf-dark)' },
  signIn: { icon: Lock, chip: 'var(--tf-icon-lavender)', ink: '#5c2e6b' },
};

export const WhoCanRespondSelect: React.FC<WhoCanRespondSelectProps> = ({
  accessControl,
  collectRespondentEmail,
  canEdit,
  disabled = false,
  onChange,
  onMoreOptions,
}) => {
  const { t } = useTranslation('collectResponses');
  const audience = toAudience(accessControl, collectRespondentEmail);

  // Free text while typing — only parsed into allowedDomains on blur, so a
  // trailing comma or half-typed domain isn't rejected mid-keystroke. Same
  // approach as AccessControlSettings.tsx.
  const [domainsText, setDomainsText] = useState((accessControl?.allowedDomains || []).join(', '));

  // Settings hydrate asynchronously, so the initializer above sees `[]` on
  // first mount and would otherwise never pick up the saved domains.
  useEffect(() => {
    setDomainsText((accessControl?.allowedDomains || []).join(', '));
  }, [accessControl?.allowedDomains]);

  const parseDomains = (): string[] | null => {
    const domains = domainsText
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    for (const domain of domains) {
      if (!DOMAIN_RE.test(domain)) {
        toastError(
          t('whoCanRespond.domains.invalid'),
          t('whoCanRespond.domains.invalidMessage', { values: { domain } })
        );
        return null;
      }
    }
    return domains;
  };

  const handleAudienceChange = (value: string) => {
    const next = value as RespondAudience;
    if (next === audience) return;
    // Switching away from `signIn` intentionally drops the domain list —
    // it has no meaning without a sign-in requirement, and keeping a stale
    // list around would silently re-apply it if the user switched back.
    onChange(fromAudience(next, next === 'signIn' ? accessControl?.allowedDomains || [] : []));
  };

  const handleDomainsBlur = () => {
    const domains = parseDomains();
    if (!domains) return;
    if (domains.join(',') === (accessControl?.allowedDomains || []).join(',')) return;
    onChange(fromAudience('signIn', domains));
  };

  const isLocked = disabled || !canEdit;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-primary">{t('whoCanRespond.label')}</Label>
        <button
          type="button"
          onClick={onMoreOptions}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t('whoCanRespond.moreOptions')}
        </button>
      </div>

      <RadioGroup
        value={audience}
        onValueChange={handleAudienceChange}
        disabled={isLocked}
        className="gap-1.5"
      >
        {(['anyone', 'anyoneWithEmail', 'signIn'] as RespondAudience[]).map((option) => {
          const { icon: Icon, chip, ink } = OPTIONS[option];
          const isSelected = audience === option;
          return (
            <label
              key={option}
              htmlFor={`who-can-respond-${option}`}
              className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${
                isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
              style={{
                border: `1px solid ${isSelected ? 'var(--tf-border-strong)' : 'var(--tf-border-faint)'}`,
                backgroundColor: isSelected ? 'var(--tf-tab-bg)' : 'transparent',
                boxShadow: isSelected ? '0 1px 4px var(--tf-overlay)' : 'none',
              }}
            >
              <RadioGroupItem
                id={`who-can-respond-${option}`}
                value={option}
                data-testid={`who-can-respond-${option}`}
              />
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: chip }}
              >
                <Icon className="h-4 w-4" style={{ color: ink }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-primary">
                  {t(`whoCanRespond.options.${option}.label`)}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {t(`whoCanRespond.options.${option}.hint`)}
                </span>
              </span>
            </label>
          );
        })}
      </RadioGroup>

      {audience === 'signIn' && (
        <div className="space-y-2 rounded-xl p-3" style={{ backgroundColor: 'var(--tf-tab-bg-faint)' }}>
          <Label htmlFor="collect-allowed-domains" className="text-xs text-foreground">
            {t('whoCanRespond.domains.label')}
          </Label>
          <Input
            id="collect-allowed-domains"
            data-testid="collect-allowed-domains-input"
            value={domainsText}
            disabled={isLocked}
            onChange={(e) => setDomainsText(e.target.value)}
            onBlur={handleDomainsBlur}
            placeholder={t('whoCanRespond.domains.placeholder')}
          />
          <p className="text-xs text-muted-foreground">{t('whoCanRespond.domains.help')}</p>
        </div>
      )}

      {!canEdit && (
        <p className="text-xs text-muted-foreground">{t('whoCanRespond.ownerOnly')}</p>
      )}
    </div>
  );
};

export default WhoCanRespondSelect;
