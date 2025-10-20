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

export const EmailPluginConfig: React.FC<EmailPluginConfigProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
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
      toastError('Validation Error', 'Please select at least one event');
      return;
    }

    if (!message || message === '<p></p>' || message === '<p class="editor-paragraph"><br></p>') {
      toastError('Validation Error', 'Please enter an email message');
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
                {mode === 'create' ? 'Configure Email Notification' : 'Edit Email Notification'}
              </CardTitle>
              <CardDescription>
                Send custom email notifications when form events occur. Use @ mentions to include form data.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <p className="text-xs text-gray-500">
              A descriptive name to identify this plugin
            </p>
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
            <p className="text-xs text-gray-500">
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
        </CardContent>
      </Card>

      {/* Email Message */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Message</CardTitle>
          <CardDescription>
            Compose your email message with rich formatting and @ mentions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">
              Message Content <span className="text-red-500">*</span>
            </Label>
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder="Enter your email message here..."
              className="w-full"
              mentionFields={mentionFields}
            />
            <p className="text-xs text-gray-500">
              Use rich formatting including <strong>bold</strong>, <em>italic</em>, headings, lists, quotes, and links.
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
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trigger Events</CardTitle>
          <CardDescription>
            Select when this plugin should be triggered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {AVAILABLE_EVENTS.map((event) => (
            <div key={event.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
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
          {selectedEvents.length === 0 && (
            <p className="text-sm text-red-500 mt-2">
              Please select at least one event
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
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isSaving && <Save className="mr-2 h-4 w-4" />}
          {mode === 'create' ? 'Create Plugin' : 'Update Plugin'}
        </Button>
      </div>
    </form>
  );
};
