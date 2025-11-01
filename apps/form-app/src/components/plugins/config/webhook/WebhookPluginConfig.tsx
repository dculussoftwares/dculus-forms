import React, { useState, useEffect } from 'react';
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
  toastError,
} from '@dculus/ui';
import { Webhook, Loader2, Save, X, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../../../../hooks/useTranslation';

interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

interface WebhookPluginConfigProps {
  initialData?: {
    name: string;
    config: WebhookConfig;
    events: string[];
  };
  mode: 'create' | 'edit';
  isSaving: boolean;
  onSave: (data: {
    type: string;
    name: string;
    config: WebhookConfig;
    events: string[];
  }) => Promise<void>;
  onCancel: () => void;
}

interface CustomHeader {
  key: string;
  value: string;
}

export const WebhookPluginConfig: React.FC<WebhookPluginConfigProps> = ({
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('webhookPluginConfig');
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

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        url: initialData.config.url,
        secret: initialData.config.secret || '',
      });
      setCustomHeaders(
        initialData.config.headers
          ? Object.entries(initialData.config.headers).map(([key, value]) => ({
              key,
              value,
            }))
          : []
      );
      setSelectedEvents(initialData.events);
    }
  }, [initialData, reset]);

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
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Webhook className="h-5 w-5 text-orange-600" />
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

          {/* Webhook URL */}
          <div className="space-y-2">
            <Label htmlFor="url">
              {t('basicInformation.url.label')} <span className="text-red-500">{t('required')}</span>
            </Label>
            <Input
              id="url"
              type="url"
              placeholder={t('basicInformation.url.placeholder')}
              {...register('url', {
                required: t('basicInformation.url.required'),
                pattern: {
                  value: /^https:\/\/.+/,
                  message: t('basicInformation.url.invalid'),
                },
              })}
            />
            {errors.url && (
              <p className="text-sm text-red-500">{errors.url.message}</p>
            )}
            <p className="text-xs text-gray-500">
              {t('basicInformation.url.hint')}
            </p>
          </div>

          {/* Secret */}
          <div className="space-y-2">
            <Label htmlFor="secret">{t('basicInformation.secret.label')}</Label>
            <Input
              id="secret"
              type="password"
              placeholder={t('basicInformation.secret.placeholder')}
              {...register('secret')}
            />
            <p className="text-xs text-gray-500">
              {t('basicInformation.secret.hint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Custom Headers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('customHeaders.title')}</CardTitle>
          <CardDescription>
            {t('customHeaders.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customHeaders.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t('customHeaders.keyPlaceholder')}
                value={header.key}
                onChange={(e) =>
                  updateCustomHeader(index, 'key', e.target.value)
                }
                className="flex-1"
              />
              <Input
                placeholder={t('customHeaders.valuePlaceholder')}
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
            {t('customHeaders.addButton')}
          </Button>
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
        <Button type="submit" disabled={isSaving} className="bg-orange-600 hover:bg-orange-700">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isSaving && <Save className="mr-2 h-4 w-4" />}
          {mode === 'create' ? t('actions.create') : t('actions.update')}
        </Button>
      </div>
    </form>
  );
};
