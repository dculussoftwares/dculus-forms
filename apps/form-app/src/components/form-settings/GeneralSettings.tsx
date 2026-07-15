import React from 'react';
import {
  Button,
  Input,
  Label,
  Textarea,
  TypographyMuted,
} from '@dculus/ui';
import { Globe, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface GeneralSettingsProps {
  form: any;
  errors: { [key: string]: string };
  isSaving: boolean;
  onSave: () => void;
  onRegenerateShortUrl: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  form,
  errors,
  isSaving,
  onSave,
  onRegenerateShortUrl,
}) => {
  const { t } = useTranslation('formSettings');
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-teal)' }}>
          <Globe className="h-4 w-4" style={{ color: 'var(--tf-green)' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('generalSettings.title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('generalSettings.description')}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-card p-5 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="space-y-2">
          <Label htmlFor="form-title">{t('generalSettings.formTitle')}</Label>
          <Input
            id="form-title"
            defaultValue={form.title}
            placeholder={t('generalSettings.formTitlePlaceholder')}
            className={errors.title ? 'border-destructive' : ''}
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-description">{t('generalSettings.formDescription')}</Label>
          <Textarea
            id="form-description"
            defaultValue={form.description || ''}
            placeholder={t('generalSettings.formDescriptionPlaceholder')}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-short-url">{t('generalSettings.shortUrl')}</Label>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              {t('generalSettings.shortUrlPrefix')}
            </span>
            <Input
              id="form-short-url"
              value={form.shortUrl}
              readOnly
              className="flex-1 bg-background cursor-default"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRegenerateShortUrl}
              disabled={isSaving}
              title={t('generalSettings.regenerateUrlTooltip')}
            >
              <RefreshCw
                className={`h-4 w-4 ${isSaving ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
          <TypographyMuted className="text-xs">
            {t('generalSettings.shortUrlHelp')}
          </TypographyMuted>
        </div>
        <div className="space-y-2">
          <Label htmlFor="form-status">{t('generalSettings.publicationStatus')}</Label>
          <div>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={
                form.isPublished
                  ? { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }
                  : { backgroundColor: 'rgba(190,153,58,0.10)', color: '#be993a', border: '1px solid rgba(190,153,58,0.25)' }
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {form.isPublished ? t('generalSettings.published') : t('generalSettings.draft')}
            </span>
          </div>
        </div>
      </div>

      <div>
        <Button
          onClick={onSave}
          disabled={isSaving}
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('generalSettings.saving') : t('generalSettings.saveChanges')}
        </Button>
      </div>
    </div>
  );
};

export default GeneralSettings;