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
import { useTranslation } from '../../../hooks/useTranslation';

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

export const WebhookPluginDialog: React.FC<WebhookPluginDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  mode = 'create',
}) => {
  const { t } = useTranslation('webhookPluginDialog');
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
      toastError(t('toasts.validationErrorTitle'), t('validation.noEvents'));
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
        mode === 'create' ? t('toasts.createSuccessTitle') : t('toasts.updateSuccessTitle'),
        mode === 'create'
          ? t('toasts.createSuccessMessage', { values: { name: data.name } })
          : t('toasts.updateSuccessMessage', { values: { name: data.name } })
      );

      reset();
      setCustomHeaders([]);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Webhook className="h-5 w-5 text-orange-600" />
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

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              {t('fields.url.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder={t('fields.url.placeholder')}
              {...register('url', {
                required: t('fields.url.required'),
                pattern: {
                  value: /^https:\/\/.+/,
                  message: t('fields.url.invalid'),
                },
              })}
            />
            {errors.url && (
              <p className="text-sm text-red-500">{errors.url.message}</p>
            )}
            <p className="text-sm text-gray-500">
              {t('fields.url.hint')}
            </p>
          </div>

          {/* Secret */}
          <div className="space-y-2">
            <Label htmlFor="secret">{t('fields.secret.label')}</Label>
            <Input
              id="secret"
              type="password"
              placeholder={t('fields.secret.placeholder')}
              {...register('secret')}
            />
            <p className="text-sm text-gray-500">
              {t('fields.secret.hint')}
            </p>
          </div>

          {/* Custom Headers */}
          <div className="space-y-2">
            <Label>{t('fields.customHeaders.label')}</Label>
            <Card className="p-4 space-y-3">
              {customHeaders.map((header, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={t('fields.customHeaders.keyPlaceholder')}
                    value={header.key}
                    onChange={(e) =>
                      updateCustomHeader(index, 'key', e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    placeholder={t('fields.customHeaders.valuePlaceholder')}
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
                {t('fields.customHeaders.addButton')}
              </Button>
            </Card>
            <p className="text-sm text-gray-500">
              {t('fields.customHeaders.hint')}
            </p>
          </div>

          {/* Events */}
          <div className="space-y-2">
            <Label>
              {t('fields.events.label')} <span className="text-red-500">{t('required')}</span>
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
                    {t('fields.events.formSubmitted.label')}
                  </Label>
                  <p className="text-sm text-gray-500">
                    {t('fields.events.formSubmitted.description')}
                  </p>
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
                    {t('fields.events.pluginTest.label')}
                  </Label>
                  <p className="text-sm text-gray-500">
                    {t('fields.events.pluginTest.description')}
                  </p>
                </div>
              </div>
            </Card>
            {selectedEvents.length === 0 && (
              <p className="text-sm text-red-500">
                {t('validation.noEvents')}
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
              {mode === 'create' ? t('actions.create') : t('actions.update')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
