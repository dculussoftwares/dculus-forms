import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@dculus/ui';
import { toastSuccess, toastError } from '@dculus/ui';
import { Bot } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import {
  AI_MODEL_CONFIGS_QUERY,
  UPDATE_AI_MODEL_CONFIG_MUTATION,
} from '../graphql/aiModelConfig';

interface AIModelOption {
  id: string;
  label: string;
}

interface AIModelConfig {
  id: string;
  plan: string;
  primaryModel: string;
  fastModel: string;
}

export default function AIModelSettings() {
  const { t } = useTranslation('aiModelConfig');

  const { data, loading } = useQuery<{
    aiModelConfigs: AIModelConfig[];
    aiSupportedModels: AIModelOption[];
  }>(AI_MODEL_CONFIGS_QUERY);

  const [updateConfig] = useMutation(UPDATE_AI_MODEL_CONFIG_MUTATION);

  const [overrides, setOverrides] = useState<Record<string, { primaryModel: string; fastModel: string }>>({});
  const [saving, setSaving] = useState(false);

  const configs = data?.aiModelConfigs ?? [];
  const models = data?.aiSupportedModels ?? [];

  function getField(plan: string, field: 'primaryModel' | 'fastModel'): string {
    return overrides[plan]?.[field] ?? configs.find(c => c.plan === plan)?.[field] ?? '';
  }

  function setField(plan: string, field: 'primaryModel' | 'fastModel', value: string) {
    setOverrides(prev => ({
      ...prev,
      [plan]: {
        primaryModel: getField(plan, 'primaryModel'),
        fastModel: getField(plan, 'fastModel'),
        [field]: value,
      },
    }));
  }

  const changedPlans = configs.filter(c =>
    overrides[c.plan] !== undefined
  );

  async function handleSave() {
    if (changedPlans.length === 0) {
      toastError(t('noChanges'), '');
      return;
    }
    setSaving(true);
    try {
      for (const c of changedPlans) {
        await updateConfig({
          variables: {
            plan: c.plan,
            primaryModel: getField(c.plan, 'primaryModel'),
            fastModel: getField(c.plan, 'fastModel'),
          },
        });
      }
      setOverrides({});
      toastSuccess(t('success'), '');
    } catch {
      toastError(t('error'), '');
    } finally {
      setSaving(false);
    }
  }

  const PLAN_ORDER = ['free', 'starter', 'advanced'];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-50 p-3 rounded-xl">
          <Bot className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-xs font-medium text-muted-foreground px-1 pb-1 border-b">
                <span>{t('columns.plan')}</span>
                <span>{t('columns.primaryModel')}</span>
                <span>{t('columns.fastModel')}</span>
              </div>

              {PLAN_ORDER.map(plan => (
                <div key={plan} className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium capitalize">
                    {t(`plans.${plan as 'free' | 'starter' | 'advanced'}`)}
                  </span>

                  <Select
                    value={getField(plan, 'primaryModel')}
                    onValueChange={v => setField(plan, 'primaryModel', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={getField(plan, 'fastModel')}
                    onValueChange={v => setField(plan, 'fastModel', v)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving} size="sm">
                  {saving ? t('saving') : t('save')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
