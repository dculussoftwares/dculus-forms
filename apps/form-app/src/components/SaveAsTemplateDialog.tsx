import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormRenderer,
  Input,
  Label,
  Switch,
  Textarea,
  toastError,
  toastSuccess,
} from '@dculus/ui';
import { RendererMode, slugify } from '@dculus/utils';
import { deserializeFormSchema, type FormSchema } from '@dculus/types';
import { Loader2 } from 'lucide-react';
import { CREATE_TEMPLATE_FROM_FORM } from '../graphql/templates';
import { uploadFileHTTP } from '../services/fileUploadService';
import { getCdnEndpoint } from '../lib/config';
import {
  captureTemplateThumbnail,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
} from '../lib/captureTemplateThumbnail';
import { useTranslation } from '../hooks/useTranslation';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { id: string; title: string; description?: string; formSchema?: unknown };
}

const PREVIEW_SCALE = 0.3;
const SEO_DESCRIPTION_LIMIT = 160;

/**
 * System-admin tool: save a form as a template, optionally listed on the
 * public gallery (dculus.com/forms/templates/<slug>). The thumbnail is a
 * screenshot of the form taken here in the browser; an uploaded image wins.
 */
export const SaveAsTemplateDialog: React.FC<SaveAsTemplateDialogProps> = ({ open, onOpenChange, form }) => {
  const { t } = useTranslation('saveAsTemplate');
  const cdnEndpoint = getCdnEndpoint();
  const captureRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(form.title);
  const [category, setCategory] = useState('');
  const [slug, setSlug] = useState(() => slugify(form.title));
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState(form.description ?? '');
  const [seoDescription, setSeoDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [thumbnailAlt, setThumbnailAlt] = useState('');
  const [customThumbnail, setCustomThumbnail] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createTemplateFromForm] = useMutation(CREATE_TEMPLATE_FROM_FORM);

  const customThumbnailUrl = useMemo(
    () => (customThumbnail ? URL.createObjectURL(customThumbnail) : null),
    [customThumbnail]
  );
  useEffect(() => () => {
    if (customThumbnailUrl) URL.revokeObjectURL(customThumbnailUrl);
  }, [customThumbnailUrl]);

  const formSchema = useMemo<FormSchema | null>(() => {
    try {
      return form.formSchema ? deserializeFormSchema(form.formSchema as any) : null;
    } catch {
      return null;
    }
  }, [form.formSchema]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const resolveThumbnail = async (): Promise<{ key?: string; failed: boolean }> => {
    try {
      const file =
        customThumbnail ??
        (captureRef.current ? await captureTemplateThumbnail(captureRef.current, slug || name) : null);
      if (!file) return { failed: true };
      const uploaded = await uploadFileHTTP(file, 'FormTemplate');
      return { key: uploaded.key, failed: false };
    } catch (captureError) {
      console.error('[SaveAsTemplate] Thumbnail failed, saving without one:', captureError);
      return { failed: true };
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError(t('errors.nameRequired'));
      return;
    }
    if (isPublic && !slug.trim()) {
      setError(t('errors.slugRequired'));
      return;
    }

    setSaving(true);
    try {
      const thumbnail = await resolveThumbnail();
      const { data } = await createTemplateFromForm({
        variables: {
          formId: form.id,
          input: {
            name: name.trim(),
            category: category.trim() || undefined,
            description: description.trim() || undefined,
            slug: slug.trim() || undefined,
            isPublic,
            seoDescription: seoDescription.trim() || undefined,
            thumbnailKey: thumbnail.key,
            thumbnailAlt: (thumbnailAlt.trim() || t('fields.thumbnailAlt.default', { values: { name: name.trim() } })),
          },
        },
      });

      const saved = data?.createTemplateFromForm;
      toastSuccess(
        t('toast.savedTitle'),
        saved?.isPublic
          ? t('toast.savedPublic', { values: { slug: saved.slug } })
          : t('toast.savedPrivate')
      );
      if (thumbnail.failed) {
        toastError(t('toast.noThumbnailTitle'), t('toast.noThumbnailMessage'));
      }
      onOpenChange(false);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : t('errors.generic');
      setError(message);
      toastError(t('toast.failedTitle'), message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="template-name">{t('fields.name.label')}</Label>
            <Input id="template-name" value={name} onChange={(e) => handleNameChange(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="template-category">{t('fields.category.label')}</Label>
            <Input
              id="template-category"
              value={category}
              placeholder={t('fields.category.placeholder')}
              onChange={(e) => setCategory(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-description">{t('fields.description.label')}</Label>
            <Textarea
              id="template-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
            <div>
              <Label htmlFor="template-public">{t('fields.public.label')}</Label>
              <p className="text-xs text-muted-foreground">{t('fields.public.help')}</p>
            </div>
            <Switch id="template-public" checked={isPublic} onCheckedChange={setIsPublic} disabled={saving} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-slug">{t('fields.slug.label')}</Label>
            <div className="flex items-center rounded-md border border-input text-sm">
              <span className="pl-3 text-muted-foreground whitespace-nowrap">dculus.com/forms/templates/</span>
              <Input
                id="template-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(slugify(e.target.value));
                }}
                className="border-0 shadow-none focus-visible:ring-0 pl-0.5"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template-seo">{t('fields.seoDescription.label')}</Label>
              <span className="text-xs text-muted-foreground">
                {seoDescription.length}/{SEO_DESCRIPTION_LIMIT}
              </span>
            </div>
            <Textarea
              id="template-seo"
              rows={2}
              maxLength={SEO_DESCRIPTION_LIMIT}
              placeholder={t('fields.seoDescription.placeholder')}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>{t('fields.thumbnail.label')}</Label>
            <p className="text-xs text-muted-foreground">{t('fields.thumbnail.help')}</p>
            <div className="flex flex-wrap items-start gap-4">
              {customThumbnailUrl ? (
                <img
                  src={customThumbnailUrl}
                  alt=""
                  className="rounded-md border border-border object-cover"
                  style={{ width: THUMBNAIL_WIDTH * PREVIEW_SCALE, height: THUMBNAIL_HEIGHT * PREVIEW_SCALE }}
                />
              ) : (
                <div
                  className="relative overflow-hidden rounded-md border border-border bg-white"
                  style={{ width: THUMBNAIL_WIDTH * PREVIEW_SCALE, height: THUMBNAIL_HEIGHT * PREVIEW_SCALE }}
                  aria-hidden="true"
                >
                  <div
                    style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left', pointerEvents: 'none' }}
                  >
                    {/* Captured at full size; the wrapper only scales what you see here. */}
                    <div
                      ref={captureRef}
                      className="overflow-hidden bg-white"
                      style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
                    >
                      {formSchema && (
                        <FormRenderer formSchema={formSchema} cdnEndpoint={cdnEndpoint} mode={RendererMode.PREVIEW} />
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setCustomThumbnail(e.target.files?.[0] ?? null)}
                  disabled={saving}
                  className="max-w-[16rem] text-xs"
                  aria-label={t('fields.thumbnail.upload')}
                />
                {customThumbnail && (
                  <Button variant="ghost" size="sm" onClick={() => setCustomThumbnail(null)} disabled={saving}>
                    {t('fields.thumbnail.useScreenshot')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="template-alt">{t('fields.thumbnailAlt.label')}</Label>
            <Input
              id="template-alt"
              value={thumbnailAlt}
              placeholder={t('fields.thumbnailAlt.default', { values: { name: name.trim() || form.title } })}
              onChange={(e) => setThumbnailAlt(e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="save-as-template-submit">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? t('actions.saving') : t('actions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
