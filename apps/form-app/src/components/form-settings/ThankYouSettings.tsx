import React, { useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Checkbox,
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CheckCircle className="mr-2 h-5 w-5" />
          {t('thankYouSettings.title')}
        </CardTitle>
        <CardDescription>
          {t('thankYouSettings.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="thank-you-enabled"
            data-testid="thank-you-enabled-checkbox"
            checked={settings.enabled}
            onCheckedChange={onToggleEnabled}
          />
          <div className="space-y-1">
            <Label
              htmlFor="thank-you-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              {t('thankYouSettings.enabled')}
            </Label>
            <p className="text-sm text-gray-600">
              {t('thankYouSettings.enabledDescription')}
            </p>
          </div>
        </div>

        {settings.enabled && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <Label
                htmlFor="thank-you-message"
                className="text-sm font-medium"
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
              <p className="text-xs text-gray-500">
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
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="save-thank-you-settings-button"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('thankYouSettings.saving') : t('thankYouSettings.saveButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ThankYouSettings;