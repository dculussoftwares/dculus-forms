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
import { useTranslation } from '../../hooks/useTranslation';
import type { ConfigFormProps } from '../core/registry';

interface CustomHeader {
  key: string;
  value: string;
}

export const WebhookConfigForm: React.FC<ConfigFormProps> = ({
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('webhookPluginConfig');
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>(
    initialData?.config?.headers
      ? Object.entries(initialData.config.headers).map(([key, value]) => ({ key, value: value as string }))
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
          ? Object.entries(initialData.config.headers).map(([key, value]) => ({ key, value: value as string }))
          : []
      );
      setSelectedEvents(initialData.events);
    }
  }, [initialData, reset]);

  const addCustomHeader = () => setCustomHeaders([...customHeaders, { key: '', value: '' }]);

  const removeCustomHeader = (index: number) =>
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));

  const updateCustomHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

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

    const headers: Record<string, string> = {};
    customHeaders.forEach((h) => { if (h.key && h.value) headers[h.key] = h.value; });

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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fbe19d' }}>
              <Webhook className="h-4 w-4" style={{ color: '#8b6a18' }} />
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
            <Label htmlFor="url">
              {t('basicInformation.url.label')} <span className="text-destructive">{t('required')}</span>
            </Label>
            <Input
              id="url"
              type="url"
              autoComplete="off"
              placeholder={t('basicInformation.url.placeholder')}
              {...register('url', {
                required: t('basicInformation.url.required'),
                pattern: { value: /^https:\/\/.+/, message: t('basicInformation.url.invalid') },
              })}
            />
            {errors.url && <p className="text-sm text-destructive">{errors.url.message as string}</p>}
            <p className="text-xs text-muted-foreground">{t('basicInformation.url.hint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">{t('basicInformation.secret.label')}</Label>
            <Input
              id="secret"
              type="password"
              autoComplete="new-password"
              placeholder={t('basicInformation.secret.placeholder')}
              {...register('secret')}
            />
            <p className="text-xs text-muted-foreground">{t('basicInformation.secret.hint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('customHeaders.title')}</CardTitle>
          <CardDescription>{t('customHeaders.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {customHeaders.map((header, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder={t('customHeaders.keyPlaceholder')}
                value={header.key}
                onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('customHeaders.valuePlaceholder')}
                value={header.value}
                onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => removeCustomHeader(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addCustomHeader} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t('customHeaders.addButton')}
          </Button>
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
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!isSaving && <Save className="mr-2 h-4 w-4" />}
          {mode === 'create' ? t('actions.create') : t('actions.update')}
        </Button>
      </div>
    </form>
  );
};
