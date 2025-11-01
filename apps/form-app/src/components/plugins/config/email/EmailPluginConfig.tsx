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
import { useTranslation } from '../../../../hooks/useTranslation';

interface EmailConfig {
  recipientEmail: string;
  subject: string;
  message: string;
}

interface EmailPluginConfigProps {
  form: any;
  initialData?: {
    name: string;
    config: EmailConfig;
    events: string[];
  };
  mode: 'create' | 'edit';
  isSaving: boolean;
  onSave: (data: {
    type: string;
    name: string;
    config: EmailConfig;
    events: string[];
  }) => Promise<void>;
  onCancel: () => void;
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
            label: field.label,
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

export const EmailPluginConfig: React.FC<EmailPluginConfigProps> = ({
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

  // Extract mention fields from form schema
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
    if (selectedEvents.includes(eventId)) {
      setSelectedEvents(selectedEvents.filter((e) => e !== eventId));
    } else {
      setSelectedEvents([...selectedEvents, eventId]);
    }
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
      config: {
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        message: message,
      },
      events: selectedEvents,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Card */}
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
              <CardDescription>
                {t('header.description')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('basicInformation.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plugin Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('basicInformation.name.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="name"
              placeholder={t('basicInformation.name.placeholder')}
              {...register('name', { required: t('basicInformation.name.required') })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
            <p className="text-xs text-gray-500">
              {t('basicInformation.name.hint')}
            </p>
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">
              {t('basicInformation.recipientEmail.label')} <span className="text-red-500">{t('required')}</span>
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
              <p className="text-sm text-red-500">{errors.recipientEmail.message}</p>
            )}
            <p className="text-xs text-gray-500">
              {t('basicInformation.recipientEmail.hint')}
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              {t('basicInformation.subject.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="subject"
              placeholder={t('basicInformation.subject.placeholder')}
              {...register('subject', { required: t('basicInformation.subject.required') })}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('emailMessage.title')}</CardTitle>
          <CardDescription>
            {t('emailMessage.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">
              {t('emailMessage.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder={t('emailMessage.placeholder')}
              className="w-full"
              mentionFields={mentionFields}
            />
            <p className="text-xs text-gray-500" dangerouslySetInnerHTML={{ 
              __html: mentionFields.length > 0 
                ? t('emailMessage.hintWithFields', { values: { count: mentionFields.length } })
                : t('emailMessage.hintWithoutFields')
            }} />
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('triggerEvents.title')}</CardTitle>
          <CardDescription>
            {t('triggerEvents.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="form.submitted"
              checked={selectedEvents.includes('form.submitted')}
              onCheckedChange={() => toggleEvent('form.submitted')}
            />
            <div className="flex-1">
              <Label
                htmlFor="form.submitted"
                className="font-medium cursor-pointer"
              >
                {t('triggerEvents.formSubmitted.label')}
              </Label>
              <p className="text-sm text-gray-500">{t('triggerEvents.formSubmitted.description')}</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <Checkbox
              id="plugin.test"
              checked={selectedEvents.includes('plugin.test')}
              onCheckedChange={() => toggleEvent('plugin.test')}
            />
            <div className="flex-1">
              <Label
                htmlFor="plugin.test"
                className="font-medium cursor-pointer"
              >
                {t('triggerEvents.testEvent.label')}
              </Label>
              <p className="text-sm text-gray-500">{t('triggerEvents.testEvent.description')}</p>
            </div>
          </div>
          {selectedEvents.length === 0 && (
            <p className="text-sm text-red-500 mt-2">
              {t('triggerEvents.validation')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
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
