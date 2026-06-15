import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
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
import { Tag, AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { GET_FORM_TAGS } from '../../graphql/queries';
import { CREATE_TAG, DELETE_TAG } from '../../graphql/mutations';
import type { ConfigFormProps } from '../core/registry';

// ── Colour palette for new tags ───────────────────────────────────────────────

const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#6b7280', // gray
];

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

  // ── Inline tag creation state ─────────────────────────────────────────────
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[4]); // default blue
  const [createError, setCreateError] = useState('');

  const { data: tagsData, loading: tagsLoading, refetch: refetchTags } = useQuery(GET_FORM_TAGS, {
    variables: { formId: form?.id },
    skip: !form?.id,
    fetchPolicy: 'cache-and-network',
  });

  const formTags: Array<{ id: string; name: string; color: string }> = tagsData?.formTags ?? [];

  const [createTag, { loading: creatingTag }] = useMutation(CREATE_TAG, {
    onCompleted: (data) => {
      if (!data?.createTag) return;
      // Eagerly add a blank definition slot for the new tag so it's ready to fill in
      const newTag = data.createTag as { id: string; name: string; color: string };
      setDefinitions((prev) => ({ ...prev, [newTag.id]: '' }));
      setNewTagName('');
      setCreateError('');
      refetchTags();
    },
    onError: (err) => {
      setCreateError(err.message);
    },
  });

  const [deleteTag, { loading: deletingTag }] = useMutation(DELETE_TAG, {
    onCompleted: () => {
      refetchTags();
    },
    onError: (err) => {
      setCreateError(err.message);
    },
  });

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

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setCreateError(t('createTag.nameRequired'));
      return;
    }
    if (!form?.id) return;
    setCreateError('');
    await createTag({ variables: { formId: form.id, name: trimmed, color: newTagColor } });
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!form?.id) return;
    await deleteTag({ variables: { id: tagId, formId: form.id } });
    setDefinitions((prev) => {
      const next = { ...prev };
      delete next[tagId];
      return next;
    });
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
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-3 rounded-xl">
              <Tag className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic settings */}
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

      {/* Inline tag creation */}
      <Card>
        <CardHeader>
          <CardTitle>{t('createTag.sectionTitle')}</CardTitle>
          <CardDescription>{t('createTag.sectionDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="new-tag-name">{t('createTag.namePlaceholder')}</Label>
              <Input
                id="new-tag-name"
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value);
                  if (createError) setCreateError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                placeholder={t('createTag.namePlaceholder')}
                disabled={creatingTag}
              />
            </div>

            {/* Colour swatches */}
            <div className="space-y-1.5">
              <Label>{t('createTag.colorLabel')}</Label>
              <div className="flex gap-1.5 flex-wrap">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      newTagColor === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleCreateTag}
              disabled={creatingTag || !newTagName.trim() || !form?.id}
              className="shrink-0"
            >
              {creatingTag ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              {t('createTag.addButton')}
            </Button>
          </div>

          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
        </CardContent>
      </Card>

      {/* Tag definitions */}
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
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteTag(tag.id)}
                    disabled={deletingTag}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                    aria-label={t('createTag.deleteTag')}
                    title={t('createTag.deleteTag')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
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

      {/* Action buttons */}
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
