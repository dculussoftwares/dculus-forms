import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@apollo/client';
import {
  Button,
  Input,
  Textarea,
  LoadingSpinner,
  toastError,
  Badge,
} from '@dculus/ui';
import { cn } from '@dculus/utils';
import type { LayoutCode } from '@dculus/types';
import {
  Sparkles,
  LayoutTemplate,
  ArrowLeft,
  Zap,
  SlidersHorizontal,
  Crown,
  FileText,
  Layers,
  CheckCircle2,
  Search,
  Loader2,
  Palette,
  Image as ImageIcon,
  Layout as LayoutIcon,
} from 'lucide-react';
import { GENERATE_FORM_WITH_AI, CREATE_FORM } from '../graphql/mutations';
import { GET_TEMPLATES } from '../graphql/templates';
import { useAppConfig } from '@/hooks';
import { useTranslation } from '../hooks/useTranslation';
import { getErrorDetails } from '../utils/graphqlErrors';
import { getCdnEndpoint } from '../lib/config';
import { LayoutThumbnails } from '../components/form-builder/tabs/layout/LayoutThumbnails';
import { searchPexelsImages, downloadPexelsImage } from '../services/pexelsService';
import type { PexelsPhoto } from '../services/pexelsService';
import { searchPixabayImages, downloadPixabayImage } from '../services/pixabayService';
import type { PixabayImage } from '../services/pixabayService';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'choice' | 'ai' | 'appearance' | 'template';
type AIMode = 'quick' | 'standard' | 'professional';
type PageMode = 'single' | 'multi';

interface AIField {
  type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
}

interface SelectedImage {
  source: 'pexels' | 'pixabay';
  downloadUrl: string;
  previewUrl: string;
  credit: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AI_TYPE_MAP: Record<string, string> = {
  text: 'text_input_field',
  textarea: 'text_area_field',
  email: 'email_field',
  number: 'number_field',
  date: 'date_field',
  select: 'select_field',
  radio: 'radio_field',
  checkbox: 'checkbox_field',
  file: 'file_upload_field',
};

function buildFieldJson(f: AIField) {
  const fieldType = AI_TYPE_MAP[f.type] ?? 'text_input_field';
  const base = {
    id: `field-${crypto.randomUUID()}`,
    type: fieldType,
    label: f.label,
    placeholder: f.placeholder ?? '',
    required: f.required,
    defaultValue: '',
    prefix: '',
    hint: '',
  };
  if (['select_field', 'radio_field', 'checkbox_field'].includes(fieldType)) {
    return {
      ...base,
      options: f.options?.map(o => o.label) ?? ['Option 1', 'Option 2'],
      ...(fieldType === 'select_field' ? { multiple: false } : {}),
    };
  }
  if (fieldType === 'file_upload_field') {
    return {
      id: base.id, type: fieldType, label: f.label, required: f.required,
      hint: '', prefix: '', allowedMimeTypes: [], maxFileSizeMb: 5, maxFiles: 1,
    };
  }
  return base;
}

function buildFormSchema(fields: AIField[], pageMode: PageMode, layoutCode: LayoutCode = 'L1') {
  const layout = {
    theme: 'LIGHT', primaryColor: '#3b82f6',
    backgroundColor: '#ffffff', textColor: '#000000', spacing: 'NORMAL',
    code: layoutCode,
  };
  const fieldJsons = fields.map(buildFieldJson);

  if (pageMode === 'single') {
    return {
      pages: [{ id: `page-${Date.now()}`, title: 'Page 1', fields: fieldJsons, order: 1 }],
      layout, isShuffleEnabled: false,
    };
  }

  const PER_PAGE = 4;
  const pages: any[] = [];
  for (let i = 0; i < fieldJsons.length; i += PER_PAGE) {
    pages.push({
      id: `page-${Date.now()}-${i}`,
      title: `Page ${pages.length + 1}`,
      fields: fieldJsons.slice(i, i + PER_PAGE),
      order: pages.length + 1,
    });
  }
  return { pages, layout, isShuffleEnabled: false };
}

function extractSearchKeyword(title: string): string {
  const stopWords = new Set([
    'form', 'survey', 'questionnaire', 'application', 'registration',
    'request', 'feedback', 'the', 'a', 'an', 'of', 'for', 'with',
    'and', 'or', 'my', 'your', 'our', 'new', 'create', 'submit',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => !stopWords.has(w) && w.length > 2);
  return words.slice(0, 2).join(' ') || 'professional office';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ModeChip({
  active, onClick, icon: Icon, label, sub,
}: {
  active: boolean; onClick: () => void;
  icon: React.ElementType; label: string; sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 text-center transition-all w-full',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', active ? 'text-primary' : '')} />
      <span className="text-sm font-medium leading-none">{label}</span>
      <span className="text-[11px] leading-none opacity-70">{sub}</span>
    </button>
  );
}

function PageChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CreateFormWizard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('createFormWizard');
  const { t: tErr } = useTranslation('graphqlErrors');
  const { organizationId } = useAppConfig();
  const cdnEndpoint = getCdnEndpoint();

  // ── Wizard state ─────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('choice');

  // AI step
  const [prompt, setPrompt] = useState('');
  const [aiMode, setAIMode] = useState<AIMode>('standard');
  const [pageMode, setPageMode] = useState<PageMode>('single');
  const [promptError, setPromptError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI-generated results — held until the appearance step creates the form
  const [aiGeneratedFields, setAiGeneratedFields] = useState<AIField[]>([]);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState('');

  // Appearance step
  const [selectedLayoutCode, setSelectedLayoutCode] = useState<LayoutCode>('L1');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [imageTab, setImageTab] = useState<'pexels' | 'pixabay'>('pexels');
  const [pexelsImages, setPexelsImages] = useState<PexelsPhoto[]>([]);
  const [pixabayImages, setPixabayImages] = useState<PixabayImage[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pixabayLoading, setPixabayLoading] = useState(false);
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  // Prevent duplicate image fetches across re-renders
  const imageFetchedForTitle = useRef('');

  // Template step
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateTitleError, setTemplateTitleError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [isCreatingFromTemplate, setIsCreatingFromTemplate] = useState(false);

  // ── GraphQL ──────────────────────────────────────────────────────────────
  const { data: templatesData, loading: templatesLoading } = useQuery(GET_TEMPLATES, {
    skip: step !== 'template',
  });

  const [generateForm] = useMutation(GENERATE_FORM_WITH_AI);
  const [createForm] = useMutation(CREATE_FORM);

  // ── Derived ──────────────────────────────────────────────────────────────
  const templates: any[] = templatesData?.templates ?? [];

  const categories = ['all', ...Array.from(new Set(templates.map((t: any) => t.category).filter(Boolean)))];

  const filteredTemplates = templates.filter((t: any) => {
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesSearch = !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // ── Image search for appearance step ─────────────────────────────────────
  useEffect(() => {
    if (step !== 'appearance' || !aiSuggestedTitle) return;
    if (imageFetchedForTitle.current === aiSuggestedTitle) return;
    imageFetchedForTitle.current = aiSuggestedTitle;

    const keyword = extractSearchKeyword(aiSuggestedTitle);

    setPexelsLoading(true);
    searchPexelsImages(keyword, 1, 9)
      .then(res => setPexelsImages(res.photos ?? []))
      .catch(() => setPexelsImages([]))
      .finally(() => setPexelsLoading(false));

    setPixabayLoading(true);
    searchPixabayImages(keyword, 1, 9)
      .then(res => setPixabayImages(res.hits ?? []))
      .catch(() => setPixabayImages([]))
      .finally(() => setPixabayLoading(false));
  }, [step, aiSuggestedTitle]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSelectTemplate = useCallback((template: any) => {
    setSelectedTemplate(template);
    setTemplateTitle(template.name);
    setTemplateTitleError('');
  }, []);

  const handleGenerateWithAI = useCallback(async () => {
    if (!prompt.trim()) {
      setPromptError(t('ai.errors.promptRequired'));
      return;
    }
    setPromptError('');
    setIsGenerating(true);

    try {
      const { data: genData } = await generateForm({
        variables: { prompt: prompt.trim(), organizationId, mode: aiMode },
      });

      const { suggestedTitle, fields } = genData.generateFormWithAI;
      setAiGeneratedFields(fields);
      setAiSuggestedTitle(suggestedTitle);
      setSelectedImage(null);
      setIsGenerating(false);
      setStep('appearance');
    } catch (err: any) {
      setIsGenerating(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('ai.errors.failed'), tErr(messageKey) || t('ai.errors.failedDesc'));
    }
  }, [prompt, aiMode, organizationId, generateForm, t, tErr]);

  const handleCreateFormWithAppearance = useCallback(async () => {
    setIsCreatingForm(true);

    try {
      const formSchema = buildFormSchema(aiGeneratedFields, pageMode, selectedLayoutCode);

      const { data: formData } = await createForm({
        variables: {
          input: {
            title: aiSuggestedTitle,
            formSchema,
            organizationId,
          },
        },
      });

      const formId = formData.createForm.id;
      let pendingBgKey: string | undefined;

      if (selectedImage) {
        try {
          const download = selectedImage.source === 'pexels'
            ? downloadPexelsImage(selectedImage.downloadUrl, formId)
            : downloadPixabayImage(selectedImage.downloadUrl, formId);
          const result = await download;
          pendingBgKey = result.key;
        } catch {
          // Image download failed — not fatal; user can add it later
        }
      }

      navigate(`/dashboard/form/${formId}/builder/page-builder`, {
        state: pendingBgKey ? { pendingBackgroundKey: pendingBgKey } : undefined,
      });
    } catch (err: any) {
      setIsCreatingForm(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('appearance.errors.failed'), tErr(messageKey) || t('appearance.errors.failedDesc'));
    }
  }, [aiGeneratedFields, aiSuggestedTitle, pageMode, selectedLayoutCode, selectedImage, organizationId, createForm, navigate, t, tErr]);

  const handleCreateFromTemplate = useCallback(async () => {
    if (!templateTitle.trim()) {
      setTemplateTitleError(t('template.errors.titleRequired'));
      return;
    }
    setTemplateTitleError('');
    setIsCreatingFromTemplate(true);

    try {
      const { data: formData } = await createForm({
        variables: {
          input: {
            title: templateTitle.trim(),
            templateId: selectedTemplate.id,
            organizationId,
          },
        },
      });
      navigate(`/dashboard/form/${formData.createForm.id}`);
    } catch (err: any) {
      setIsCreatingFromTemplate(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('template.errors.failed'), tErr(messageKey) || t('template.errors.failedDesc'));
    }
  }, [templateTitle, selectedTemplate, organizationId, createForm, navigate, t, tErr]);

  const handleBack = useCallback(() => {
    if (step === 'choice') {
      navigate('/forms');
    } else if (step === 'appearance') {
      setStep('ai');
    } else {
      setStep('choice');
    }
  }, [step, navigate]);

  // ── Image selection toggle ────────────────────────────────────────────────

  const handleSelectPexels = useCallback((photo: PexelsPhoto) => {
    setSelectedImage(prev =>
      prev?.source === 'pexels' && prev.downloadUrl === photo.src.large
        ? null
        : { source: 'pexels', downloadUrl: photo.src.large, previewUrl: photo.src.medium, credit: photo.photographer }
    );
  }, []);

  const handleSelectPixabay = useCallback((image: PixabayImage) => {
    setSelectedImage(prev =>
      prev?.source === 'pixabay' && prev.downloadUrl === image.largeImageURL
        ? null
        : { source: 'pixabay', downloadUrl: image.largeImageURL, previewUrl: image.webformatURL, credit: image.user }
    );
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <header className="flex items-center h-14 px-6 border-b border-border shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">

        {/* ── Step 1: Choice ─────────────────────────────────────────────── */}
        {step === 'choice' && (
          <div className="w-full max-w-3xl">
            <div className="text-center mb-10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
                {t('choice.subheading')}
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                {t('choice.heading')}
              </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* AI Card — highlighted */}
              <button
                type="button"
                onClick={() => setStep('ai')}
                className="relative group text-left p-7 rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="absolute top-4 right-4">
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5">
                    {t('choice.ai.badge')}
                  </Badge>
                </span>

                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('choice.ai.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('choice.ai.description')}
                </p>
              </button>

              {/* Template Card */}
              <button
                type="button"
                onClick={() => setStep('template')}
                className="relative group text-left p-7 rounded-2xl border-2 border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted">
                  <LayoutTemplate className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('choice.template.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('choice.template.description')}
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2A: AI Config ─────────────────────────────────────────── */}
        {step === 'ai' && (
          <div className="w-full max-w-xl">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{t('ai.heading')}</h1>
              </div>
            </div>

            <div className="space-y-6">
              {/* Prompt */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('ai.promptLabel')}
                </label>
                <Textarea
                  placeholder={t('ai.promptPlaceholder')}
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setPromptError(''); }}
                  rows={3}
                  disabled={isGenerating}
                  className={cn('resize-none', promptError && 'border-destructive')}
                />
                {promptError && (
                  <p className="text-xs text-destructive">{promptError}</p>
                )}
              </div>

              {/* Mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('ai.complexity')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <ModeChip
                    active={aiMode === 'quick'} onClick={() => setAIMode('quick')}
                    icon={Zap} label={t('ai.modes.quick')} sub={t('ai.modes.quickSub')}
                  />
                  <ModeChip
                    active={aiMode === 'standard'} onClick={() => setAIMode('standard')}
                    icon={SlidersHorizontal} label={t('ai.modes.standard')} sub={t('ai.modes.standardSub')}
                  />
                  <ModeChip
                    active={aiMode === 'professional'} onClick={() => setAIMode('professional')}
                    icon={Crown} label={t('ai.modes.professional')} sub={t('ai.modes.professionalSub')}
                  />
                </div>
              </div>

              {/* Pages */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('ai.pages')}</label>
                <div className="flex gap-2">
                  <PageChip active={pageMode === 'single'} onClick={() => setPageMode('single')} label={t('ai.pageTypes.single')} />
                  <PageChip active={pageMode === 'multi'} onClick={() => setPageMode('multi')} label={t('ai.pageTypes.multi')} />
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="w-full h-11 text-base font-medium"
                size="lg"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('ai.generating')}</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />{t('ai.generate')}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2B: Appearance ────────────────────────────────────────── */}
        {step === 'appearance' && (
          <div className="w-full max-w-5xl">
            {/* Heading */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Palette className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{t('appearance.heading')}</h1>
              </div>
              <p className="text-sm text-muted-foreground">{t('appearance.subheading')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">

              {/* ── Layout picker ─────────────────────────────────────── */}
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <LayoutIcon className="h-4 w-4 text-muted-foreground" />
                  {t('appearance.layoutLabel')}
                </h2>
                <LayoutThumbnails
                  currentLayoutCode={selectedLayoutCode}
                  onLayoutSelect={setSelectedLayoutCode}
                  scrollAreaClassName="h-auto"
                />
              </div>

              {/* ── Image picker ──────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    {t('appearance.imageLabel')}
                  </h2>
                  <span className="text-xs text-muted-foreground">{t('appearance.optional')}</span>
                </div>

                {/* Source tabs */}
                <div className="flex gap-0 mb-3 border-b border-border">
                  {(['pexels', 'pixabay'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setImageTab(tab)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px capitalize',
                        imageTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {tab === 'pexels' ? 'Pexels' : 'Pixabay'}
                    </button>
                  ))}
                </div>

                {/* Pexels images */}
                {imageTab === 'pexels' && (
                  <div>
                    {pexelsLoading ? (
                      <div className="flex items-center justify-center h-44">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : pexelsImages.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">{t('appearance.noImages')}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {pexelsImages.map(photo => {
                            const isSelected = selectedImage?.source === 'pexels' && selectedImage.downloadUrl === photo.src.large;
                            return (
                              <button
                                key={photo.id}
                                type="button"
                                onClick={() => handleSelectPexels(photo)}
                                className={cn(
                                  'relative overflow-hidden rounded-lg aspect-video border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                  isSelected
                                    ? 'border-primary shadow-md'
                                    : 'border-transparent hover:border-primary/50'
                                )}
                              >
                                <img
                                  src={photo.src.medium}
                                  alt={photo.alt || photo.photographer}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                {isSelected && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <CheckCircle2 className="h-6 w-6 text-white drop-shadow" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Photos provided by{' '}
                          <a
                            href="https://www.pexels.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:text-foreground"
                          >
                            Pexels
                          </a>
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Pixabay images */}
                {imageTab === 'pixabay' && (
                  <div>
                    {pixabayLoading ? (
                      <div className="flex items-center justify-center h-44">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : pixabayImages.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">{t('appearance.noImages')}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {pixabayImages.map(image => {
                          const isSelected = selectedImage?.source === 'pixabay' && selectedImage.downloadUrl === image.largeImageURL;
                          return (
                            <button
                              key={image.id}
                              type="button"
                              onClick={() => handleSelectPixabay(image)}
                              className={cn(
                                'relative overflow-hidden rounded-lg aspect-video border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                isSelected
                                  ? 'border-primary shadow-md'
                                  : 'border-transparent hover:border-primary/50'
                              )}
                            >
                              <img
                                src={image.webformatURL}
                                alt={image.tags}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {isSelected && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <CheckCircle2 className="h-6 w-6 text-white drop-shadow" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer: status + create button */}
            <div className="mt-8 flex items-center justify-between pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {selectedImage ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t('appearance.imageSelected')}
                    {selectedImage.credit && (
                      <span className="text-muted-foreground font-normal">
                        {' '}— {selectedImage.credit}
                      </span>
                    )}
                  </span>
                ) : (
                  t('appearance.noImageSelected')
                )}
              </div>
              <Button
                onClick={handleCreateFormWithAppearance}
                disabled={isCreatingForm}
                className="h-11 px-8 text-base font-medium"
                size="lg"
              >
                {isCreatingForm ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('appearance.creating')}</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" />{t('appearance.create')}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Template Browser ───────────────────────────────────── */}
        {step === 'template' && (
          <div className="w-full max-w-5xl">
            {/* Heading row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-2xl font-bold text-foreground">{t('template.heading')}</h1>
              </div>
              {/* Search */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('template.search')}
                  value={templateSearch}
                  onChange={e => setTemplateSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize',
                    categoryFilter === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {cat === 'all' ? t('template.categories.all') : cat}
                </button>
              ))}
            </div>

            {templatesLoading && (
              <div className="flex items-center justify-center py-20">
                <LoadingSpinner />
              </div>
            )}

            {!templatesLoading && filteredTemplates.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{t('template.noTemplates')}</p>
                <p className="text-sm mt-1">{t('template.noTemplatesDesc')}</p>
              </div>
            )}

            {/* Template grid */}
            {!templatesLoading && filteredTemplates.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                {filteredTemplates.map((template: any) => {
                  const bgImageKey = template.formSchema?.layout?.backgroundImageKey;
                  const bgImageUrl = bgImageKey && cdnEndpoint ? `${cdnEndpoint}/${bgImageKey}` : null;
                  const isSelected = selectedTemplate?.id === template.id;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      className={cn(
                        'group relative text-left rounded-xl overflow-hidden border-2 transition-all',
                        isSelected
                          ? 'border-primary shadow-md'
                          : 'border-border hover:border-primary/40 hover:shadow-sm'
                      )}
                    >
                      {/* Preview image */}
                      <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-50 relative overflow-hidden">
                        {bgImageUrl ? (
                          <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                            style={{ backgroundImage: `url(${bgImageUrl})` }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground/30" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <CheckCircle2 className="h-7 w-7 text-primary" />
                          </div>
                        )}
                        {template.category && (
                          <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40 text-white capitalize font-medium">
                            {template.category}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-foreground leading-tight line-clamp-1">
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected template confirm bar */}
            {selectedTemplate && (
              <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border pt-4 pb-2 mt-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      {t('template.confirmTitle')}
                    </label>
                    <Input
                      value={templateTitle}
                      onChange={e => { setTemplateTitle(e.target.value); setTemplateTitleError(''); }}
                      placeholder={t('template.confirmTitlePlaceholder')}
                      disabled={isCreatingFromTemplate}
                      className={cn('h-9', templateTitleError && 'border-destructive')}
                    />
                    {templateTitleError && (
                      <p className="text-xs text-destructive">{templateTitleError}</p>
                    )}
                  </div>
                  <Button
                    onClick={handleCreateFromTemplate}
                    disabled={isCreatingFromTemplate}
                    className="h-9 shrink-0"
                  >
                    {isCreatingFromTemplate ? (
                      <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />{t('template.creating')}</>
                    ) : (
                      <><Layers className="mr-2 h-3.5 w-3.5" />{t('template.confirmCreate')}</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateFormWizard;
