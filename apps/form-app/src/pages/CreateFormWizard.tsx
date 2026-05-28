import React, { useState, useCallback } from 'react';
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
import {
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
} from 'lucide-react';
import { GENERATE_FORM_WITH_AI, CREATE_FORM } from '../graphql/mutations';
import { GET_TEMPLATES } from '../graphql/templates';
import { useAppConfig } from '@/hooks';
import { useTranslation } from '../hooks/useTranslation';
import { getErrorDetails } from '../utils/graphqlErrors';
import { getCdnEndpoint } from '../lib/config';
import AIIcon from '../components/icons/AIIcon';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'choice' | 'ai' | 'template';
type AIMode = 'quick' | 'standard' | 'professional';
type PageMode = 'single' | 'multi';

interface AIField {
  type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
}

// ─── Field schema builder ─────────────────────────────────────────────────────

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

function buildFormSchema(fields: AIField[], pageMode: PageMode) {
  const layout = {
    theme: 'LIGHT', primaryColor: '#3b82f6',
    backgroundColor: '#ffffff', textColor: '#000000', spacing: 'NORMAL',
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
      const formSchema = buildFormSchema(fields, pageMode);

      const { data: formData } = await createForm({
        variables: {
          input: {
            title: suggestedTitle,
            formSchema,
            organizationId,
          },
        },
      });

      navigate(`/dashboard/form/${formData.createForm.id}/builder/page-builder`);
    } catch (err: any) {
      setIsGenerating(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('ai.errors.failed'), tErr(messageKey) || t('ai.errors.failedDesc'));
    }
  }, [prompt, aiMode, pageMode, organizationId, generateForm, createForm, navigate, t, tErr]);

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header bar */}
      <header className="flex items-center h-14 px-6 border-b border-border shrink-0">
        <button
          onClick={() => step === 'choice' ? navigate('/forms') : setStep('choice')}
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
                  <AIIcon className="h-6 w-6 text-primary" />
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
                <AIIcon className="h-5 w-5 text-primary" />
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
                  <><AIIcon className="mr-2 h-4 w-4" />{t('ai.generate')}</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2B: Template Browser ──────────────────────────────────── */}
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
                      data-testid="template-card"
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
