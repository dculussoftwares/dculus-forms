import React, { useMemo } from 'react';
import {
  Button,
  Label,
  Switch,
} from '@dculus/ui';
import { CheckCircle, Save } from 'lucide-react';
import { deserializeFormSchema, FillableFormField } from '@dculus/types';

// Use RichTextEditor which is LexicalRichTextEditor exported from @dculus/ui
import { RichTextEditor } from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';

interface ThankYouSettingsData {
  enabled: boolean;
  message: string;
}

interface ThankYouSettingsProps {
  settings: ThankYouSettingsData;
  isSaving: boolean;
  form: any; // Form object containing formSchema
  onToggleEnabled: (enabled: boolean) => void;
  onMessageChange: (message: string) => void;
  onSave: () => void;
}

// Utility function to extract mention fields from form schema
const extractMentionFields = (form: any) => {
  if (!form?.formSchema) return [];

  try {
    const schema = deserializeFormSchema(form.formSchema);
    const mentionFields: { fieldId: string; label: string }[] = [];

    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (field instanceof FillableFormField && field.label) {
          mentionFields.push({
            fieldId: field.id,
            label: field.label
          });
        }
      }
    }

    return mentionFields;
  } catch (error) {
    console.error('Error extracting mention fields:', error);
    return [];
  }
};

const ThankYouSettings: React.FC<ThankYouSettingsProps> = ({
  settings,
  isSaving,
  form,
  onToggleEnabled,
  onMessageChange,
  onSave,
}) => {
  const { t } = useTranslation('formSettings');
  // Extract mention fields from the form schema
  const mentionFields = useMemo(() => extractMentionFields(form), [form]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#c4e3ba' }}>
          <CheckCircle className="h-4 w-4" style={{ color: '#2d6236' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('thankYouSettings.title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('thankYouSettings.description')}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#c4e3ba' }}>
            <CheckCircle className="h-4 w-4" style={{ color: '#2d6236' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="thank-you-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('thankYouSettings.enabled')}
            </Label>
            <p className="text-sm text-muted-foreground">
              {t('thankYouSettings.enabledDescription')}
            </p>
          </div>
          <Switch
            id="thank-you-enabled"
            data-testid="thank-you-enabled-checkbox"
            checked={settings.enabled}
            onCheckedChange={onToggleEnabled}
          />
        </div>

        {settings.enabled && (
          <div className="px-4 pb-4 pt-1 space-y-2" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
            <Label
              htmlFor="thank-you-message"
              className="text-sm font-medium text-foreground pt-3 inline-block"
            >
              {t('thankYouSettings.messageLabel')}
            </Label>
            <div data-testid="thank-you-message-editor">
              <RichTextEditor
                value={settings.message}
                onChange={onMessageChange}
                placeholder={t('thankYouSettings.messagePlaceholder')}
                className="w-full"
                mentionFields={mentionFields}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('thankYouSettings.messageHelp')}
              {mentionFields.length > 0 ? (
                <>
                  {' '}{t('thankYouSettings.mentionHelp', { values: { count: mentionFields.length } })}
                </>
              ) : (
                <>
                  {' '}{t('thankYouSettings.noFieldsHelp')}
                </>
              )}
            </p>
          </div>
        )}
      </div>

      <div>
        <Button
          onClick={onSave}
          disabled={isSaving}
          data-testid="save-thank-you-settings-button"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('thankYouSettings.saving') : t('thankYouSettings.saveButton')}
        </Button>
      </div>
    </div>
  );
};

export default ThankYouSettings;