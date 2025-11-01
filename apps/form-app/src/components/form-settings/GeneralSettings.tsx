import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
  TypographyMuted,
} from '@dculus/ui';
import { Globe, RefreshCw, Save } from 'lucide-react';
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Globe className="mr-2 h-5 w-5" />
          {t('generalSettings.title')}
        </CardTitle>
        <CardDescription>
          {t('generalSettings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="form-title">{t('generalSettings.formTitle')}</Label>
          <Input
            id="form-title"
            defaultValue={form.title}
            placeholder={t('generalSettings.formTitlePlaceholder')}
            className={errors.title ? 'border-red-500' : ''}
          />
          {errors.title && (
            <p className="text-xs text-red-500">{errors.title}</p>
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
            <span className="text-sm text-slate-500">
              {t('generalSettings.shortUrlPrefix')}
            </span>
            <Input
              id="form-short-url"
              value={form.shortUrl}
              readOnly
              className="flex-1 bg-slate-50 cursor-default"
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
          <div className="flex items-center space-x-2">
            <div
              className={`w-3 h-3 rounded-full ${
                form.isPublished ? 'bg-green-500' : 'bg-yellow-500'
              }`}
            />
            <span className="text-sm">
              {form.isPublished ? t('generalSettings.published') : t('generalSettings.draft')}
            </span>
          </div>
        </div>
        <div className="pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('generalSettings.saving') : t('generalSettings.saveChanges')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GeneralSettings;