import React, { useState, useEffect } from 'react';
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
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Plus, Trash2, Loader2, Webhook } from 'lucide-react';

interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

interface WebhookPluginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    type: string;
    name: string;
    config: WebhookConfig;
    events: string[];
  }) => Promise<void>;
  initialData?: {
    name: string;
    config: WebhookConfig;
    events: string[];
  };
  mode?: 'create' | 'edit';
}

interface CustomHeader {
  key: string;
  value: string;
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

export const WebhookPluginDialog: React.FC<WebhookPluginDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  mode = 'create',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>(
    initialData?.config?.headers
      ? Object.entries(initialData.config.headers).map(([key, value]) => ({
          key,
          value,
        }))
      : []
  );
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
      url: initialData?.config?.url || '',
      secret: initialData?.config?.secret || '',
    },
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || '',
        url: initialData?.config?.url || '',
        secret: initialData?.config?.secret || '',
      });
      setCustomHeaders(
        initialData?.config?.headers
          ? Object.entries(initialData.config.headers).map(([key, value]) => ({
              key,
              value,
            }))
          : []
      );
      setSelectedEvents(initialData?.events || ['form.submitted']);
    }
  }, [open, initialData, reset]);

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  const updateCustomHeader = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

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

    setIsSubmitting(true);
    try {
      // Convert custom headers array to object
      const headers: Record<string, string> = {};
      customHeaders.forEach((header) => {
        if (header.key && header.value) {
          headers[header.key] = header.value;
        }
      });

      await onSave({
        type: 'webhook',
        name: data.name,
        config: {
          url: data.url,
          secret: data.secret || undefined,
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        },
        events: selectedEvents,
      });

      toastSuccess(
        mode === 'create' ? 'Webhook Created' : 'Webhook Updated',
        `"${data.name}" has been ${mode === 'create' ? 'created' : 'updated'} successfully`
      );

      reset();
      setCustomHeaders([]);
      setSelectedEvents(['form.submitted']);
      onOpenChange(false);
    } catch (error: any) {
      toastError(
        mode === 'create' ? 'Failed to Create Webhook' : 'Failed to Update Webhook',
        error.message || 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Webhook className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle>
                {mode === 'create' ? 'Configure Webhook' : 'Edit Webhook'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription>
            Send HTTP POST requests to external URLs when form events occur. Perfect for custom integrations and automation.
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
              placeholder="e.g., CRM Integration, Slack Notification"
              {...register('name', { required: 'Plugin name is required' })}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              Webhook URL <span className="text-red-500">*</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com/webhook"
              {...register('url', {
                required: 'Webhook URL is required',
                pattern: {
                  value: /^https:\/\/.+/,
                  message: 'URL must start with https://',
                },
              })}
            />
            {errors.url && (
              <p className="text-sm text-red-500">{errors.url.message}</p>
            )}
            <p className="text-sm text-gray-500">
              Only HTTPS URLs are allowed for security
            </p>
          </div>

          {/* Secret */}
          <div className="space-y-2">
            <Label htmlFor="secret">Secret (Optional)</Label>
            <Input
              id="secret"
              type="password"
              placeholder="Enter secret for HMAC signature"
              {...register('secret')}
            />
            <p className="text-sm text-gray-500">
              Used to generate HMAC-SHA256 signature in X-Webhook-Signature header
            </p>
          </div>

          {/* Custom Headers */}
          <div className="space-y-2">
            <Label>Custom Headers (Optional)</Label>
            <Card className="p-4 space-y-3">
              {customHeaders.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Header name (e.g., X-API-Key)"
                    value={header.key}
                    onChange={(e) =>
                      updateCustomHeader(index, 'key', e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder="Header value"
                    value={header.value}
                    onChange={(e) =>
                      updateCustomHeader(index, 'value', e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeCustomHeader(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addCustomHeader}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Header
              </Button>
            </Card>
            <p className="text-sm text-gray-500">
              Add custom HTTP headers (e.g., API keys, authorization tokens)
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
              {mode === 'create' ? 'Create Webhook' : 'Update Webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
