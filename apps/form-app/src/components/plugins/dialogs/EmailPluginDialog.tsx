import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Checkbox,
  Card,
  RichTextEditor,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Mail, Loader2 } from 'lucide-react';
import { deserializeFormSchema, FillableFormField } from '@dculus/types';
import { useTranslation } from '../../../hooks/useTranslation';

interface EmailConfig {
  recipientEmail: string;
  subject: string;
  message: string;
  sendToSubmitter?: boolean;
}

interface EmailPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    type: string;
    name: string;
    config: EmailConfig;
    events: string[];
  }) => Promise<void>;
  initialData?: {
    name: string;
    config: EmailConfig;
    events: string[];
  };
  mode?: 'create' | 'edit';
  form?: any; // Form object containing formSchema for mention fields
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

export const EmailPluginDialog: React.FC<EmailPluginDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  mode = 'create',
  form,
}) => {
  const { t } = useTranslation('emailPluginDialog');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        recipientEmail: initialData?.config?.recipientEmail || '',
        subject: initialData?.config?.subject || '',
      });
      setMessage(initialData?.config?.message || '');
      setSelectedEvents(initialData?.events || ['form.submitted']);
    }
  }, [open, initialData, reset]);

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

    setIsSubmitting(true);
    try {
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

      toastSuccess(
        mode === 'create' ? t('toasts.createSuccessTitle') : t('toasts.updateSuccessTitle'),
        mode === 'create' 
          ? t('toasts.createSuccessMessage', { values: { name: data.name } })
          : t('toasts.updateSuccessMessage', { values: { name: data.name } })
      );

      reset();
      setMessage('');
      setSelectedEvents(['form.submitted']);
      onOpenChange(false);
    } catch (error: any) {
      toastError(
        mode === 'create' ? t('toasts.createErrorTitle') : t('toasts.updateErrorTitle'),
        error.message || t('toasts.unexpectedError')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>
                {mode === 'create' ? t('header.titleCreate') : t('header.titleEdit')}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            {t('header.description')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Plugin Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {t('fields.name.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="name"
              placeholder={t('fields.name.placeholder')}
              {...register('name', { required: t('fields.name.required') })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">
              {t('fields.recipientEmail.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder={t('fields.recipientEmail.placeholder')}
              {...register('recipientEmail', {
                required: t('fields.recipientEmail.required'),
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: t('fields.recipientEmail.invalid'),
                },
              })}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-red-500">{errors.recipientEmail.message}</p>
            )}
            <p className="text-sm text-gray-500">
              {t('fields.recipientEmail.hint')}
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              {t('fields.subject.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="subject"
              placeholder={t('fields.subject.placeholder')}
              {...register('subject', { required: t('fields.subject.required') })}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          {/* Email Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              {t('fields.message.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder={t('fields.message.placeholder')}
              className="w-full min-h-[200px]"
              mentionFields={mentionFields}
            />
            <p className="text-xs text-gray-500">
              {t('fields.message.hintStart')}
              {mentionFields.length > 0 
                ? t('fields.message.hintWithFields', { values: { count: mentionFields.length } })
                : t('fields.message.hintWithoutFields')
              }
            </p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>
              {t('fields.triggerEvents.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Card className="p-4 space-y-3">
              <div className="flex items-start space-x-3">
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
                    {t('fields.triggerEvents.formSubmitted.label')}
                  </Label>
                  <p className="text-sm text-gray-500">{t('fields.triggerEvents.formSubmitted.description')}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
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
                    {t('fields.triggerEvents.testEvent.label')}
                  </Label>
                  <p className="text-sm text-gray-500">{t('fields.triggerEvents.testEvent.description')}</p>
                </div>
              </div>
            </Card>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-red-500">
                {t('fields.triggerEvents.validation')}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
