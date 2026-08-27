import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@apollo/client/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Checkbox,
  RichTextEditor,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  toastError,
} from '@dculus/ui';
import { Mail, Loader2, Save, X, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { deserializeFormSchema, FillableFormField, extractEmailFields as extractEmailFieldsFromSchema, type EmailFieldInfo } from '@dculus/types';
import { parseEmailList, validateEmailList } from '@dculus/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { GET_PDF_TEMPLATES } from '../../graphql/pdfTemplates';
import type { ConfigFormProps } from '../core/registry';

const NO_RECIPIENT_FIELD = '__none__';
const NO_PDF_TEMPLATE = '__none__';

const extractMentionFields = (form: any) => {
  if (!form?.formSchema) return [];
  try {
    const schema = deserializeFormSchema(form.formSchema);
    const fields: { fieldId: string; label: string }[] = [];
    for (const page of schema.pages) {
      for (const field of page.fields) {
        if (field instanceof FillableFormField && field.label) {
          fields.push({ fieldId: field.id, label: field.label });
        }
      }
    }
    return fields;
  } catch {
    return [];
  }
};

/**
 * The four __digest* scalar pseudo-fields a digest node merges into triggerData — safe to
 * offer as mentions here per graphValidator's DIGEST_SCALAR_MENTION_KEYS allow-list.
 * __digestResponses (the full response array) is deliberately excluded: substituteMentions()
 * does a flat scalar lookup, so a mention referencing it would silently stringify to garbage
 * rather than error — the response table toggle below is the supported way to list them.
 */
const digestMentionFields = (t: (key: string) => string) => [
  { fieldId: '__digestCount', label: t('digest.mentions.count') },
  { fieldId: '__digestSince', label: t('digest.mentions.since') },
  { fieldId: '__digestUntil', label: t('digest.mentions.until') },
  { fieldId: '__digestTruncated', label: t('digest.mentions.truncated') },
];

const extractEmailFields = (form: any): EmailFieldInfo[] => {
  if (!form?.formSchema) return [];
  try {
    return extractEmailFieldsFromSchema(deserializeFormSchema(form.formSchema));
  } catch {
    return [];
  }
};

export const EmailConfigForm: React.FC<ConfigFormProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
  hideEventsSection,
  readOnly,
  submitLabelOverride,
  digestContext,
}) => {
  const { t } = useTranslation('emailPluginConfig');
  const [message, setMessage] = useState(initialData?.config?.message || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    initialData?.events || ['form.submitted']
  );
  const [recipientFieldId, setRecipientFieldId] = useState<string>(
    initialData?.config?.recipientFieldId || NO_RECIPIENT_FIELD
  );
  const [attachPdfTemplateId, setAttachPdfTemplateId] = useState<string>(
    initialData?.config?.attachPdfTemplateId || NO_PDF_TEMPLATE
  );
  const [includeDigestTable, setIncludeDigestTable] = useState<boolean>(
    Boolean(initialData?.config?.includeDigestTable)
  );

  const { data: pdfTemplatesData } = useQuery(GET_PDF_TEMPLATES, {
    variables: { formId: form?.id },
    skip: !form?.id,
  });
  const pdfTemplates: { id: string; name: string }[] = pdfTemplatesData?.pdfTemplates || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      name: initialData?.name || '',
      recipientEmail: initialData?.config?.recipientEmail || '',
      subject: initialData?.config?.subject || '',
    },
  });

  const mentionFields = useMemo(() => {
    const formFieldMentions = extractMentionFields(form);
    return digestContext?.available ? [...formFieldMentions, ...digestMentionFields(t)] : formFieldMentions;
  }, [form, digestContext?.available, t]);
  const emailFields = useMemo(() => extractEmailFields(form), [form]);
  const selectedEmailField = emailFields.find((f) => f.id === recipientFieldId);

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        recipientEmail: initialData.config.recipientEmail,
        subject: initialData.config.subject,
      });
      setMessage(initialData.config.message);
      setSelectedEvents(initialData.events);
      setRecipientFieldId(initialData.config.recipientFieldId || NO_RECIPIENT_FIELD);
      setAttachPdfTemplateId(initialData.config.attachPdfTemplateId || NO_PDF_TEMPLATE);
      setIncludeDigestTable(Boolean(initialData.config.includeDigestTable));
    }
  }, [initialData, reset]);

  const toggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  const onSubmit = async (data: any) => {
    if (selectedEvents.length === 0) {
      toastError(t('toasts.validationErrorTitle'), t('validation.noEvents'));
      return;
    }
    if (!message || message === '<p></p>' || message === '<p class="editor-paragraph"><br></p>') {
      toastError(t('toasts.validationErrorTitle'), t('validation.noMessage'));
      return;
    }
    // Normalize the fixed-address list on save (trim, de-dupe, single ", " separator) so it
    // reads cleanly next time the form is opened.
    const staticEmail = parseEmailList(data.recipientEmail).join(', ');
    const hasFieldRecipient = recipientFieldId !== NO_RECIPIENT_FIELD;
    if (!staticEmail && !hasFieldRecipient) {
      toastError(t('toasts.validationErrorTitle'), t('validation.noRecipient'));
      return;
    }
    const hasPdfAttachment = attachPdfTemplateId !== NO_PDF_TEMPLATE;
    const selectedPdfTemplate = pdfTemplates.find((template) => template.id === attachPdfTemplateId);
    // pdfTemplates may not yet include the previously-saved template (query
    // still in flight) — fall back to the cached name rather than wiping it.
    const fallbackPdfTemplateName =
      attachPdfTemplateId === initialData?.config?.attachPdfTemplateId
        ? initialData?.config?.attachPdfTemplateName
        : undefined;
    await onSave({
      type: 'email',
      name: data.name,
      config: {
        recipientEmail: staticEmail || undefined,
        recipientFieldId: hasFieldRecipient ? recipientFieldId : undefined,
        recipientFieldLabel: hasFieldRecipient ? selectedEmailField?.label : undefined,
        subject: data.subject,
        message,
        attachPdfTemplateId: hasPdfAttachment ? attachPdfTemplateId : undefined,
        attachPdfTemplateName: hasPdfAttachment
          ? (selectedPdfTemplate?.name ?? fallbackPdfTemplateName)
          : undefined,
        includeDigestTable: digestContext?.available ? includeDigestTable : undefined,
      },
      events: selectedEvents,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
              <Mail className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
            </div>
            <div>
              <CardTitle>
                {mode === 'create' ? t('header.titleCreate') : t('header.titleEdit')}
              </CardTitle>
              <CardDescription>{t('header.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('basicInformation.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('basicInformation.name.label')} <span className="text-destructive">{t('required')}</span>
            </Label>
            <Input
              id="name"
              placeholder={t('basicInformation.name.placeholder')}
              {...register('name', { required: t('basicInformation.name.required') })}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message as string}</p>}
            <p className="text-xs text-muted-foreground">{t('basicInformation.name.hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientEmail">{t('basicInformation.recipientEmail.label')}</Label>
            <Input
              id="recipientEmail"
              type="email"
              multiple
              autoComplete="off"
              placeholder={t('basicInformation.recipientEmail.placeholder')}
              {...register('recipientEmail', {
                validate: (value) => {
                  if (!value || !value.trim()) return true;
                  const { valid, invalid } = validateEmailList(value);
                  if (invalid.length > 0) {
                    return t('basicInformation.recipientEmail.invalidList', {
                      values: { emails: invalid.join(', ') },
                    });
                  }
                  return valid.length > 0 || t('basicInformation.recipientEmail.invalid');
                },
              })}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-destructive">{errors.recipientEmail.message as string}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('basicInformation.recipientEmail.hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipientFieldId">{t('basicInformation.recipientField.label')}</Label>
            {emailFields.length > 0 ? (
              <>
                <Select value={recipientFieldId} onValueChange={setRecipientFieldId}>
                  <SelectTrigger id="recipientFieldId">
                    <SelectValue placeholder={t('basicInformation.recipientField.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RECIPIENT_FIELD}>
                      {t('basicInformation.recipientField.none')}
                    </SelectItem>
                    {emailFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t('basicInformation.recipientField.hint')}</p>
                {selectedEmailField && !selectedEmailField.required && (
                  <Alert style={{ backgroundColor: 'rgba(190,153,58,0.10)', borderColor: 'rgba(190,153,58,0.25)', color: '#8b6a18' }}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription style={{ color: '#8b6a18' }}>
                      {t('basicInformation.recipientField.notRequiredWarning')}
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('basicInformation.recipientField.noFieldsHint')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              {t('basicInformation.subject.label')} <span className="text-destructive">{t('required')}</span>
            </Label>
            <Input
              id="subject"
              placeholder={t('basicInformation.subject.placeholder')}
              {...register('subject', { required: t('basicInformation.subject.required') })}
            />
            {errors.subject && <p className="text-sm text-destructive">{errors.subject.message as string}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('emailMessage.title')}</CardTitle>
          <CardDescription>{t('emailMessage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">
              {t('emailMessage.label')} <span className="text-destructive">{t('required')}</span>
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder={t('emailMessage.placeholder')}
              className="w-full"
              editable={!readOnly}
              mentionFields={mentionFields}
            />
            <p className="text-xs text-muted-foreground">
              {mentionFields.length > 0 ? (
                <>
                  {t('emailMessage.hintWithFields_prefix')}{' '}
                  <strong>{t('emailMessage.bold')}</strong>,{' '}
                  <em>{t('emailMessage.italic')}</em>,{' '}
                  {t('emailMessage.hintWithFields_suffix', { values: { count: mentionFields.length } })}
                </>
              ) : (
                <>
                  {t('emailMessage.hintWithoutFields_prefix')}{' '}
                  <strong>{t('emailMessage.bold')}</strong>,{' '}
                  <em>{t('emailMessage.italic')}</em>,{' '}
                  {t('emailMessage.hintWithoutFields_suffix')}
                </>
              )}
            </p>
          </div>

          {digestContext?.available && (
            <div className="flex items-start space-x-3 p-3 rounded-lg border" style={{ borderColor: 'var(--tf-border-light)' }}>
              <Checkbox
                id="includeDigestTable"
                checked={includeDigestTable}
                onCheckedChange={(checked) => setIncludeDigestTable(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="includeDigestTable" className="font-medium cursor-pointer">
                  {t('digest.includeTable.label')}
                </Label>
                <p className="text-sm text-muted-foreground">{t('digest.includeTable.description')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
              <FileText className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
            </div>
            <div>
              <CardTitle className="text-lg">{t('pdfAttachment.title')}</CardTitle>
              <CardDescription>{t('pdfAttachment.description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {pdfTemplates.length > 0 ? (
            <>
              <Select value={attachPdfTemplateId} onValueChange={setAttachPdfTemplateId}>
                <SelectTrigger id="attachPdfTemplateId">
                  <SelectValue placeholder={t('pdfAttachment.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PDF_TEMPLATE}>{t('pdfAttachment.none')}</SelectItem>
                  {pdfTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('pdfAttachment.hint')}</p>
              {attachPdfTemplateId !== NO_PDF_TEMPLATE && form?.id && (
                <a
                  href={`/dashboard/form/${form.id}/pdf-templates/${attachPdfTemplateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {t('pdfAttachment.openInDesigner')}
                </a>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('pdfAttachment.noTemplatesHint')}</p>
          )}
        </CardContent>
      </Card>

      {!hideEventsSection && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('triggerEvents.title')}</CardTitle>
            <CardDescription>{t('triggerEvents.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { id: 'form.submitted', labelKey: 'triggerEvents.formSubmitted.label', descKey: 'triggerEvents.formSubmitted.description' },
              { id: 'plugin.test', labelKey: 'triggerEvents.testEvent.label', descKey: 'triggerEvents.testEvent.description' },
            ].map(({ id, labelKey, descKey }) => (
              <div key={id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-background transition-colors">
                <Checkbox
                  id={id}
                  checked={selectedEvents.includes(id)}
                  onCheckedChange={() => toggleEvent(id)}
                />
                <div className="flex-1">
                  <Label htmlFor={id} className="font-medium cursor-pointer">{t(labelKey)}</Label>
                  <p className="text-sm text-muted-foreground">{t(descKey)}</p>
                </div>
              </div>
            ))}
            {selectedEvents.length === 0 && (
              <p className="text-sm text-destructive mt-2">{t('triggerEvents.validation')}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-2" />
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isSaving && <Save className="mr-2 h-4 w-4" />}
          {submitLabelOverride ?? (mode === 'create' ? t('actions.create') : t('actions.update'))}
        </Button>
      </div>
    </form>
  );
};
