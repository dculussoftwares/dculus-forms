import React from 'react';
import { Building2 } from 'lucide-react';
import type { FormDesignTokens } from '@dculus/types';
import { Button, toastError, toastSuccess } from '@dculus/ui';
import { trackEvent } from '@dculus/utils';
import { useOrgBrandKit } from '../../../hooks/useOrgBrandKit';

type Translate = (key: string, options?: { values?: Record<string, string | number> }) => string;

interface OrgBrandKitCardProps {
  tokens: FormDesignTokens | undefined;
  canEditLayout: boolean;
  onApply: (tokens: FormDesignTokens) => void;
  t: Translate;
}

/** Share one look across every form in the organisation. */
export const OrgBrandKitCard: React.FC<OrgBrandKitCardProps> = ({ tokens, canEditLayout, onApply, t }) => {
  const { kitTokens, loading, busy, isOwner, save, remove } = useOrgBrandKit();
  if (loading || (!kitTokens && !isOwner)) return null;

  const run = async (action: () => Promise<void>, successKey: string, event: string) => {
    try {
      await action();
      trackEvent(event, {});
      toastSuccess(t(successKey));
    } catch {
      toastError(t('orgBrand.error'));
    }
  };

  return (
    <div className="mt-5 rounded-lg border p-3 space-y-2" data-testid="org-brand-kit-card">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        {t('orgBrand.title')}
      </div>
      <p className="text-xs text-muted-foreground">
        {kitTokens ? t('orgBrand.hasKit') : t('orgBrand.noKit')}
      </p>
      <div className="flex flex-wrap gap-2">
        {kitTokens && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!canEditLayout || busy}
            data-testid="org-brand-apply"
            onClick={() => {
              trackEvent('org_brand_applied', {});
              onApply(kitTokens);
            }}
          >
            {t('orgBrand.apply')}
          </Button>
        )}
        {isOwner && tokens && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            data-testid="org-brand-save"
            onClick={() => run(() => save(tokens), 'orgBrand.saved', 'org_brand_saved')}
          >
            {kitTokens ? t('orgBrand.update') : t('orgBrand.save')}
          </Button>
        )}
        {isOwner && kitTokens && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            disabled={busy}
            data-testid="org-brand-remove"
            onClick={() => run(remove, 'orgBrand.removed', 'org_brand_removed')}
          >
            {t('orgBrand.remove')}
          </Button>
        )}
      </div>
    </div>
  );
};
