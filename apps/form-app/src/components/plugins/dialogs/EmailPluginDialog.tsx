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

const AVAILABLE_EVENTS = [
  {
    id: 'form.submitted',
    label: 'Form Submitted',
    description: 'Triggered when a user submits a response',
  },
  {
    id: 'plugin.test',
    label: 'Test Event',
    description: 'Manual test trigger',
  },
];

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
      toastError('Validation Error', 'Please select at least one event');
      return;
    }

    if (!message || message === '<p></p>' || message === '<p class="editor-paragraph"><br></p>') {
      toastError('Validation Error', 'Please enter an email message');
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
        mode === 'create' ? 'Email Plugin Created' : 'Email Plugin Updated',
        `"${data.name}" has been ${mode === 'create' ? 'created' : 'updated'} successfully`
      );

      reset();
      setMessage('');
      setSelectedEvents(['form.submitted']);
      onOpenChange(false);
    } catch (error: any) {
      toastError(
        mode === 'create' ? 'Failed to Create Email Plugin' : 'Failed to Update Email Plugin',
        error.message || 'An unexpected error occurred'
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
                {mode === 'create' ? 'Configure Email Notification' : 'Edit Email Notification'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Send custom email notifications when form events occur. Use @ mentions to include form data in your message.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Plugin Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Plugin Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Notify Team, Admin Alert"
              {...register('name', { required: 'Plugin name is required' })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipientEmail">
              Recipient Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="recipientEmail"
              type="email"
              placeholder="admin@example.com"
              {...register('recipientEmail', {
                required: 'Recipient email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />
            {errors.recipientEmail && (
              <p className="text-sm text-red-500">{errors.recipientEmail.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Email address to receive notifications
            </p>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Email Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="New Form Submission"
              {...register('subject', { required: 'Email subject is required' })}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          {/* Email Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              Email Message <span className="text-red-500">*</span>
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder="Enter your email message here..."
              className="w-full min-h-[200px]"
              mentionFields={mentionFields}
            />
            <p className="text-xs text-gray-500">
              This message will be sent via email. You can use rich formatting including{' '}
              <strong>bold</strong>, <em>italic</em>, headings, lists, quotes, and links.
              {mentionFields.length > 0 ? (
                <>
                  {' '}Type <strong>@</strong> to mention form fields ({mentionFields.length} available) and reference user responses.
                </>
              ) : (
                <>
                  {' '}Add some fields to your form to enable @ mentions for personalizing messages.
                </>
              )}
            </p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>
              Trigger Events <span className="text-red-500">*</span>
            </Label>
            <Card className="p-4 space-y-3">
              {AVAILABLE_EVENTS.map((event) => (
                <div key={event.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={event.id}
                    checked={selectedEvents.includes(event.id)}
                    onCheckedChange={() => toggleEvent(event.id)}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={event.id}
                      className="font-medium cursor-pointer"
                    >
                      {event.label}
                    </Label>
                    <p className="text-sm text-gray-500">{event.description}</p>
                  </div>
                </div>
              ))}
            </Card>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-red-500">
                Please select at least one event
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
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Email Plugin' : 'Update Email Plugin'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
