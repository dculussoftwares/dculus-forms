import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Alert,
  AlertDescription,
  Textarea,
} from '@dculus/ui';
import { Tag, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { GET_FORM_TAGS } from '../../graphql/queries';
import type { ConfigFormProps } from '../core/registry';

interface TagConfig {
  tagId: string;
  name: string;
  color: string;
  definition: string;
}

export const AiTaggerConfigForm: React.FC<ConfigFormProps> = ({
  form,
  initialData,
  mode,
  isSaving,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation('aiTaggerPluginConfig');

  const [pluginName, setPluginName] = useState(initialData?.name || 'AI Auto-Tagger');
  const [nameError, setNameError] = useState('');

  const { data: tagsData, loading: tagsLoading } = useQuery<any, any>(GET_FORM_TAGS, {
    variables: { formId: form?.id },
    skip: !form?.id,
    fetchPolicy: 'cache-and-network',
  });

  const formTags: Array<{ id: string; name: string; color: string }> = tagsData?.formTags ?? [];

  const [definitions, setDefinitions] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    if (initialData?.config?.tags) {
      for (const tag of initialData.config.tags as TagConfig[]) {
        map[tag.tagId] = tag.definition;
      }
    }
    return map;
  });

  const handleDefinitionChange = (tagId: string, value: string) => {
    setDefinitions((prev) => ({ ...prev, [tagId]: value }));
  };

  const handleSave = async () => {
    if (!pluginName.trim()) {
      setNameError(t('validation.nameRequired'));
      return;
    }
    setNameError('');

    const tags: TagConfig[] = formTags
      .map((tag) => ({
        tagId: tag.id,
        name: tag.name,
        color: tag.color,
        definition: definitions[tag.id] ?? '',
      }))
      .filter((tag) => tag.definition.trim().length > 0);

    await onSave({
      type: 'ai-tagger',
      name: pluginName.trim(),
      config: { tags },
      events: ['form.submitted'],
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Tag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('basicSettings.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="plugin-name">{t('basicSettings.pluginName')}</Label>
            <Input
              id="plugin-name"
              value={pluginName}
              onChange={(e) => setPluginName(e.target.value)}
              placeholder={t('basicSettings.pluginNamePlaceholder')}
            />
            {nameError && <p className="text-sm text-destructive">{nameError}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('tagDefinitions.title')}</CardTitle>
          <CardDescription>{t('tagDefinitions.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{t('tagDefinitions.hint')}</AlertDescription>
          </Alert>

          {tagsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('tagDefinitions.loading')}
            </div>
          ) : formTags.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('tagDefinitions.noTags')}</AlertDescription>
            </Alert>
          ) : (
            formTags.map((tag) => (
              <div key={tag.id} className="border rounded-lg p-4 space-y-2">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
                <div className="space-y-1.5">
                  <Label htmlFor={`def-${tag.id}`} className="text-xs text-muted-foreground">
                    {t('tagDefinitions.definitionLabel')}
                  </Label>
                  <Textarea
                    id={`def-${tag.id}`}
                    value={definitions[tag.id] ?? ''}
                    onChange={(e) => handleDefinitionChange(tag.id, e.target.value)}
                    placeholder={t('tagDefinitions.definitionPlaceholder')}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          {t('actions.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isSaving || tagsLoading}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('actions.saving')}
            </>
          ) : mode === 'create' ? (
            t('actions.create')
          ) : (
            t('actions.update')
          )}
        </Button>
      </div>
    </div>
  );
};
