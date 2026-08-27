import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  Separator,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Copy, Check, ExternalLink, AlertTriangle, Send } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useFormSettings } from '../../hooks/useFormSettings';
import type { FormSettings } from '@dculus/types';
import { WhoCanRespondSelect, type AudienceSettings } from './WhoCanRespondSelect';

interface CollectResponsesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
  /** Public respondent URL, already built with getFormViewerUrl(). */
  formUrl: string;
  isPublished: boolean;
  /** `form.settings` straight from GET_FORM_BY_ID — null for a form that has never saved settings. */
  settings?: FormSettings | null;
  /** OWNER / EDITOR / VIEWER — access control is OWNER-gated server-side. */
  userPermission?: string | null;
  onPublish?: () => void;
  publishLoading?: boolean;
}

/**
 * The respondent-facing distribution surface — "Collect responses".
 *
 * Deliberately separate from ShareModal, which is the *teammate*-facing surface
 * ("Collaborate"). Both used to be called "Share", and that overload is what let
 * the builder URL ship under the label "Anyone with this link can view the form".
 * See docs/form-embed-v1-spec.md §2.
 *
 * The Embed and QR tabs land here next; the layout leaves room for them.
 */
export const CollectResponsesPanel: React.FC<CollectResponsesPanelProps> = ({
  open,
  onOpenChange,
  formId,
  formTitle,
  formUrl,
  isPublished,
  settings: initialSettings,
  userPermission,
  onPublish,
  publishLoading = false,
}) => {
  const { t } = useTranslation('collectResponses');
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { settings, isSaving, updateAccessControl, updateCollectRespondentEmail, saveSettings } =
    useFormSettings({ formId, initialSettings });

  // The audience presets change `accessControl` and `collectRespondentEmail`
  // together, but both updaters are functional setState calls — so the save has
  // to happen on the *next* render, once both have landed. Flipping this flag in
  // the same batch gives us exactly that: the effect below re-runs with a
  // `settings` closure that already holds both changes.
  const [pendingSave, setPendingSave] = useState(false);

  useEffect(() => {
    if (!pendingSave) return;
    setPendingSave(false);
    saveSettings({
      accessControl: settings.accessControl,
      collectRespondentEmail: settings.collectRespondentEmail,
    })
      .then(() => toastSuccess(t('whoCanRespond.saved')))
      .catch(() => {
        // useFormSettings' mutation onError already raised a toast with the
        // specific reason (e.g. non-owner changing access control).
      });
    // Intentionally keyed on the flag alone: `settings` is read from the
    // closure (fresh, since the flag flips in the same batch as the update),
    // but adding it to the deps would re-fire the save on every unrelated
    // settings change.
  }, [pendingSave]);

  const handleAudienceChange = (next: AudienceSettings) => {
    updateAccessControl(next.accessControl);
    updateCollectRespondentEmail(next.collectRespondentEmail);
    setPendingSave(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      toastSuccess(t('link.copiedToast'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy form link', error);
      toastError(t('link.copyFailed'), t('link.clipboardUnavailable'));
    }
  };

  const handleMoreOptions = () => {
    onOpenChange(false);
    navigate(`/dashboard/form/${formId}/settings?section=access-control`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="collect-responses-panel">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--tf-icon-teal)' }}
            >
              <Send className="h-4 w-4" style={{ color: 'var(--tf-green)' }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-primary text-left">
                {t('title')}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5 text-left">
                {t('subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {!isPublished && (
            <div
              className="flex items-start gap-3 rounded-xl p-3"
              data-testid="collect-responses-draft-warning"
              style={{
                backgroundColor: 'rgba(190,153,58,0.08)',
                border: '1px solid rgba(190,153,58,0.16)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: '#fbe19d' }}
              >
                <AlertTriangle className="h-4 w-4" style={{ color: '#8b6a18' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">{t('draft.title')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('draft.description')}</p>
              </div>
              {onPublish && (
                <Button size="sm" onClick={onPublish} disabled={publishLoading} className="shrink-0">
                  {publishLoading ? t('draft.publishing') : t('draft.publish')}
                </Button>
              )}
            </div>
          )}

          <WhoCanRespondSelect
            accessControl={settings.accessControl}
            collectRespondentEmail={settings.collectRespondentEmail}
            canEdit={userPermission === 'OWNER'}
            disabled={isSaving}
            onChange={handleAudienceChange}
            onMoreOptions={handleMoreOptions}
          />

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">{t('link.label')}</p>
            <div
              className="flex items-center gap-2 rounded-xl bg-white dark:bg-card p-2"
              style={{
                border: '1px solid var(--tf-border-medium)',
                boxShadow: '0 1px 4px var(--tf-overlay)',
              }}
            >
              <p className="flex-1 min-w-0 truncate text-sm font-mono text-foreground" title={formUrl}>
                {formUrl}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                data-testid="collect-responses-copy-link"
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="ml-1.5">{copied ? t('link.copied') : t('link.copy')}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('link.help')}</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close')}
            </Button>
            <Button onClick={() => window.open(formUrl, '_blank', 'noopener')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('link.open')}
            </Button>
          </div>
        </div>

        {/* formTitle is intentionally unused in the body — the dialog title is
            generic so the panel reads the same from every entry point. Kept in
            the props for the Embed tab's snippet `title` attribute. */}
        <span className="sr-only">{formTitle}</span>
      </DialogContent>
    </Dialog>
  );
};

export default CollectResponsesPanel;
