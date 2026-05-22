import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
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
  toastError,
} from '@dculus/ui';
import { Mail, Loader2, Save, X } from 'lucide-react';
import { deserializeFormSchema, FillableFormField } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import type { ConfigFormProps } from '../core/registry';

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

export const EmailConfigForm: React.FC<ConfigFormProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('emailPluginConfig');
  const [message, setMessage] = useState(initialData?.config?.message || '');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    initialData?.events || ['form.submitted']
  );

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

  const mentionFields = useMemo(() => extractMentionFields(form), [form]);

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        recipientEmail: initialData.config.recipientEmail,
        subject: initialData.config.subject,
      });
      setMessage(initialData.config.message);
      setSelectedEvents(initialData.events);
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
    await onSave({
      type: 'email',
      name: data.name,
      config: { recipientEmail: data.recipientEmail, subject: data.subject, message },
      events: selectedEvents,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
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
            <Label htmlFor="recipientEmail">
              {t('basicInformation.recipientEmail.label')} <span className="text-destructive">{t('required')}</span>
            </Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder={t('basicInformation.recipientEmail.placeholder')}
              {...register('recipientEmail', {
                required: t('basicInformation.recipientEmail.required'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('basicInformation.recipientEmail.invalid'),
                },
              })}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-destructive">{errors.recipientEmail.message as string}</p>
            )}
            <p className="text-xs text-muted-foreground">{t('basicInformation.recipientEmail.hint')}</p>
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
        </CardContent>
      </Card>

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

      <div className="flex items-center justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-2" />
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isSaving && <Save className="mr-2 h-4 w-4" />}
          {mode === 'create' ? t('actions.create') : t('actions.update')}
        </Button>
      </div>
    </form>
  );
};
