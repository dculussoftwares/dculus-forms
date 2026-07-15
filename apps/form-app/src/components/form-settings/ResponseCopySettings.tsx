import React, { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Button,
  Label,
  Switch,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  RadioGroup,
  RadioGroupItem,
} from '@dculus/ui';
import { Mail, Save, AlertTriangle } from 'lucide-react';
import { deserializeFormSchema, extractEmailFields, type ResponseCopySettings as ResponseCopySettingsData } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import { GET_PDF_TEMPLATES } from '../../graphql/pdfTemplates';

const NO_PDF_TEMPLATE = '__none__';

interface ResponseCopySettingsProps {
  form: any; // Form object containing formSchema
  settings: ResponseCopySettingsData;
  isSaving: boolean;
  onUpdateSetting: (key: keyof ResponseCopySettingsData, value: any) => void;
  onSave: () => void;
}

const ResponseCopySettings: React.FC<ResponseCopySettingsProps> = ({
  form,
  settings,
  isSaving,
  onUpdateSetting,
  onSave,
}) => {
  const { t } = useTranslation('responseCopySettings');

  const emailFields = useMemo(() => {
    if (!form?.formSchema) return [];
    try {
      return extractEmailFields(deserializeFormSchema(form.formSchema));
    } catch {
      return [];
    }
  }, [form]);

  const { data: pdfTemplatesData } = useQuery(GET_PDF_TEMPLATES, {
    variables: { formId: form?.id },
    skip: !form?.id,
  });
  const pdfTemplates: { id: string; name: string }[] = pdfTemplatesData?.pdfTemplates || [];

  const hasEmailFields = emailFields.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
          <Mail className="h-4 w-4" style={{ color: '#5c2e6b' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <Mail className="h-4 w-4" style={{ color: '#5c2e6b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="response-copy-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('enabled')}
            </Label>
            <p className="text-sm text-muted-foreground">{t('enabledDescription')}</p>
          </div>
          <Switch
            id="response-copy-enabled"
            data-testid="response-copy-enabled-checkbox"
            checked={settings.enabled}
            disabled={!hasEmailFields}
            onCheckedChange={(checked) => onUpdateSetting('enabled', checked)}
          />
        </div>

        {!hasEmailFields && (
          <div
            className="mx-4 mb-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'rgba(190,153,58,0.10)', color: '#8b6a18', border: '1px solid rgba(190,153,58,0.25)' }}
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {t('noEmailFieldWarning')}
          </div>
        )}

        {settings.enabled && hasEmailFields && (
          <div className="px-4 pb-4 pt-4 space-y-6" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('mode.label')}</Label>
              <RadioGroup
                value={settings.mode}
                onValueChange={(value) => onUpdateSetting('mode', value)}
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="always" id="response-copy-mode-always" className="mt-1" />
                  <Label htmlFor="response-copy-mode-always" className="font-normal cursor-pointer">
                    <span className="block text-sm font-medium">{t('mode.always')}</span>
                    <span className="block text-xs text-muted-foreground">{t('mode.alwaysDescription')}</span>
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="respondentChoice" id="response-copy-mode-choice" className="mt-1" />
                  <Label htmlFor="response-copy-mode-choice" className="font-normal cursor-pointer">
                    <span className="block text-sm font-medium">{t('mode.respondentChoice')}</span>
                    <span className="block text-xs text-muted-foreground">{t('mode.respondentChoiceDescription')}</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-copy-email-field">{t('emailField.label')}</Label>
              <Select
                value={settings.emailFieldId}
                onValueChange={(value) => onUpdateSetting('emailFieldId', value)}
              >
                <SelectTrigger id="response-copy-email-field">
                  <SelectValue placeholder={t('emailField.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {emailFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('emailField.hint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-copy-pdf-template">{t('pdfTemplate.label')}</Label>
              {pdfTemplates.length > 0 ? (
                <>
                  <Select
                    value={settings.pdfTemplateId || NO_PDF_TEMPLATE}
                    onValueChange={(value) =>
                      onUpdateSetting('pdfTemplateId', value === NO_PDF_TEMPLATE ? undefined : value)
                    }
                  >
                    <SelectTrigger id="response-copy-pdf-template">
                      <SelectValue placeholder={t('pdfTemplate.placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PDF_TEMPLATE}>{t('pdfTemplate.none')}</SelectItem>
                      {pdfTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t('pdfTemplate.hint')}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">{t('pdfTemplate.noTemplatesHint')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="response-copy-subject">{t('subject.label')}</Label>
              <Input
                id="response-copy-subject"
                placeholder={t('subject.placeholder', { values: { formTitle: form?.title || '' } })}
                value={settings.subject || ''}
                onChange={(e) => onUpdateSetting('subject', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('subject.hint')}</p>
            </div>
          </div>
        )}
      </div>

      <div>
        <Button
          onClick={onSave}
          disabled={isSaving}
          data-testid="save-response-copy-settings-button"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('saving') : t('saveButton')}
        </Button>
      </div>
    </div>
  );
};

export default ResponseCopySettings;
