import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  Button,
  Input,
  Textarea,
  LoadingSpinner,
  toastError,
  Badge,
} from '@dculus/ui';
import { cn, generateRandomString } from '@dculus/utils';
import type { LayoutCode, GradeRelease } from '@dculus/types';
import { DEFAULT_QUIZ_SETTINGS, buildAnswerKeyGrading } from '@dculus/types/quiz.js';
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
  Palette,
  Image as ImageIcon,
  Video as VideoIcon,
  Play,
  Layout as LayoutIcon,
  GraduationCap,
  PenLine,
  Clock,
  EyeOff,
} from 'lucide-react';
import { GENERATE_FORM_WITH_AI, CREATE_FORM } from '../graphql/mutations';
import { GET_TEMPLATES } from '../graphql/templates';
import { useAppConfig } from '@/hooks';
import { useTranslation } from '../hooks/useTranslation';
import { getErrorDetails } from '../utils/graphqlErrors';
import { getCdnEndpoint } from '../lib/config';
import { LayoutThumbnails } from '../components/form-builder/tabs/layout/LayoutThumbnails';
import {
  searchPexelsImages, downloadPexelsImage,
  searchPexelsVideos, downloadPexelsVideo,
} from '../services/pexelsService';
import type { PexelsPhoto, PexelsVideo } from '../services/pexelsService';
import {
  searchPixabayImages, downloadPixabayImage,
  searchPixabayVideos, downloadPixabayVideo,
} from '../services/pixabayService';
import type { PixabayImage, PixabayVideo } from '../services/pixabayService';
import AIIcon from '../components/icons/AIIcon';
import { GradientSparkles } from '../components/form-builder/GradientSparkles.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 'choice' | 'ai' | 'appearance' | 'template' | 'quiz';
type AIMode = 'quick' | 'standard' | 'professional';
type PageMode = 'single' | 'multi';
type CreationSource = 'ai' | 'quiz';
type QuizStartMode = 'blank' | 'ai';

interface AIField {
  type: string;
  label: string;
  placeholder: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  // Quiz generation only: verbatim label(s) of the correct option(s). Present
  // (non-null) => attach a pre-filled answer key when building the field JSON.
  correctAnswers?: string[] | null;
  section: string;
}

type MediaType = 'photo' | 'video';

interface SelectedImage {
  kind: 'image';
  source: 'pexels' | 'pixabay';
  downloadUrl: string;
  previewUrl: string;
  credit: string;
}

interface SelectedVideo {
  kind: 'video';
  source: 'pexels' | 'pixabay';
  video: PexelsVideo | PixabayVideo;
  previewUrl: string;
  credit: string;
}

type SelectedMedia = SelectedImage | SelectedVideo;

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
  phone: 'phone_number_field',
};

function buildFieldJson(f: AIField) {
  const fieldType = AI_TYPE_MAP[f.type] ?? 'text_input_field';
  const base = {
    id: `f${generateRandomString(9)}`,
    type: fieldType,
    label: f.label,
    placeholder: f.placeholder ?? '',
    required: f.required,
    defaultValue: '',
    prefix: '',
    hint: '',
  };
  if (['select_field', 'radio_field', 'checkbox_field'].includes(fieldType)) {
    const grading = f.correctAnswers?.length
      ? buildAnswerKeyGrading(fieldType, f.correctAnswers)
      : undefined;
    return {
      ...base,
      options: f.options?.map(o => o.label) ?? ['Option 1', 'Option 2'],
      ...(fieldType === 'select_field' ? { multiple: false } : {}),
      ...(grading ? { grading } : {}),
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

function buildFormSchema(
  fields: AIField[],
  pageMode: PageMode,
  layoutCode: LayoutCode = 'L1',
  layoutOverrides?: { content?: string; customCTAButtonName?: string }
) {
  const layout = {
    theme: 'LIGHT', primaryColor: '#3b82f6',
    backgroundColor: '#ffffff', textColor: '#000000', spacing: 'NORMAL',
    code: layoutCode,
    ...(layoutOverrides?.content ? { content: layoutOverrides.content } : {}),
    ...(layoutOverrides?.customCTAButtonName ? { customCTAButtonName: layoutOverrides.customCTAButtonName } : {}),
  };
  const fieldJsons = fields.map(buildFieldJson);

  if (pageMode === 'single') {
    return {
      pages: [{ id: `p${generateRandomString(9)}`, title: 'Page 1', fields: fieldJsons, order: 1, showPageName: true }],
      layout, isShuffleEnabled: false,
    };
  }

  // Group consecutive fields sharing the same AI-assigned section name onto one page,
  // using that section name as the page title.
  const pages: any[] = [];
  let start = 0;
  while (start < fields.length) {
    const section = fields[start].section?.trim() || `Page ${pages.length + 1}`;
    let end = start + 1;
    while (end < fields.length && (fields[end].section?.trim() || '') === section) {
      end++;
    }
    pages.push({
      id: `p${generateRandomString(9)}`,
      title: section,
      fields: fieldJsons.slice(start, end),
      order: pages.length + 1,
      showPageName: true,
    });
    start = end;
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
  active, onClick, icon: Icon, label, sub, disabled, title,
}: {
  active: boolean; onClick: () => void;
  icon: React.ElementType; label: string; sub: string;
  disabled?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 text-center transition-all w-full',
        disabled
          ? 'border-border bg-muted/40 text-muted-foreground/50 cursor-not-allowed'
          : active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      <Icon className={cn('h-4 w-4', !disabled && active ? 'text-primary' : '')} />
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
  // Which choice-step card led into the shared 'appearance' step — determines
  // whether settings.quiz is attached at creation and where "Back" returns to.
  const [creationSource, setCreationSource] = useState<CreationSource>('ai');

  // Quiz step
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTitleError, setQuizTitleError] = useState('');
  const [quizPassThresholdError, setQuizPassThresholdError] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizStartMode, setQuizStartMode] = useState<QuizStartMode>('blank');
  const [quizPrompt, setQuizPrompt] = useState('');
  const [quizPromptError, setQuizPromptError] = useState('');
  const [quizPassThreshold, setQuizPassThreshold] = useState<number>(DEFAULT_QUIZ_SETTINGS.passThresholdPercent ?? 60);
  const [quizGradeRelease, setQuizGradeRelease] = useState<GradeRelease>(DEFAULT_QUIZ_SETTINGS.gradeRelease);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // AI step
  const [prompt, setPrompt] = useState('');
  const [aiMode, setAIMode] = useState<AIMode>('standard');
  const [pageMode, setPageMode] = useState<PageMode>('single');
  const [promptError, setPromptError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // AI-generated results — held until the appearance step creates the form
  const [aiGeneratedFields, setAiGeneratedFields] = useState<AIField[]>([]);
  const [aiSuggestedTitle, setAiSuggestedTitle] = useState('');
  const [aiGeneratedLayout, setAiGeneratedLayout] = useState<{ content: string; customCTAButtonName: string } | null>(null);

  // Appearance step
  const [selectedLayoutCode, setSelectedLayoutCode] = useState<LayoutCode>('L1');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [imageTab, setImageTab] = useState<'pexels' | 'pixabay'>('pexels');
  const [pexelsImages, setPexelsImages] = useState<PexelsPhoto[]>([]);
  const [pixabayImages, setPixabayImages] = useState<PixabayImage[]>([]);
  const [pexelsVideos, setPexelsVideos] = useState<PexelsVideo[]>([]);
  const [pixabayVideos, setPixabayVideos] = useState<PixabayVideo[]>([]);
  const [pexelsLoading, setPexelsLoading] = useState(false);
  const [pixabayLoading, setPixabayLoading] = useState(false);
  const [pexelsVideoLoading, setPexelsVideoLoading] = useState(false);
  const [pixabayVideoLoading, setPixabayVideoLoading] = useState(false);
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  // Prevent duplicate image/video fetches across re-renders
  const imageFetchedForTitle = useRef('');
  const videoFetchedForTitle = useRef('');

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

  // Video search is fetched lazily — only once the user switches to the Videos
  // tab — so we don't burn Pexels/Pixabay video quota on every wizard run.
  useEffect(() => {
    if (step !== 'appearance' || !aiSuggestedTitle || mediaType !== 'video') return;
    if (videoFetchedForTitle.current === aiSuggestedTitle) return;
    videoFetchedForTitle.current = aiSuggestedTitle;

    const keyword = extractSearchKeyword(aiSuggestedTitle);

    setPexelsVideoLoading(true);
    searchPexelsVideos(keyword, 1, 9)
      .then(res => setPexelsVideos(res.videos ?? []))
      .catch(() => setPexelsVideos([]))
      .finally(() => setPexelsVideoLoading(false));

    setPixabayVideoLoading(true);
    searchPixabayVideos(keyword, 1, 9)
      .then(res => setPixabayVideos(res.hits ?? []))
      .catch(() => setPixabayVideos([]))
      .finally(() => setPixabayVideoLoading(false));
  }, [step, aiSuggestedTitle, mediaType]);

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

      const { suggestedTitle, fields, layout: generatedLayout } = genData.generateFormWithAI;
      setAiGeneratedFields(fields);
      setAiSuggestedTitle(suggestedTitle);
      if (generatedLayout) setAiGeneratedLayout(generatedLayout);
      setSelectedMedia(null);
      setIsGenerating(false);
      setStep('appearance');
    } catch (err: any) {
      setIsGenerating(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('ai.errors.failed'), tErr(messageKey) || t('ai.errors.failedDesc'));
    }
  }, [prompt, aiMode, organizationId, generateForm, t, tErr]);

  // Quiz step — "Continue" branches into blank creation or AI generation,
  // both of which land on the shared 'appearance' step (no parallel flow).
  const handleQuizContinue = useCallback(async () => {
    if (!quizTitle.trim()) {
      setQuizTitleError(t('quiz.errors.titleRequired'));
      return;
    }
    setQuizTitleError('');

    if (!Number.isFinite(quizPassThreshold) || quizPassThreshold < 0 || quizPassThreshold > 100) {
      setQuizPassThresholdError(t('quiz.errors.passThresholdInvalid'));
      return;
    }
    setQuizPassThresholdError('');

    if (quizStartMode === 'blank') {
      setAiGeneratedFields([]);
      setAiSuggestedTitle(quizTitle.trim());
      setAiGeneratedLayout(null);
      setSelectedMedia(null);
      setCreationSource('quiz');
      setStep('appearance');
      return;
    }

    if (!quizPrompt.trim()) {
      setQuizPromptError(t('quiz.errors.promptRequired'));
      return;
    }
    setQuizPromptError('');
    setIsGeneratingQuiz(true);

    try {
      // REUSE the existing AI generation mutation — only the prompt is
      // quiz-framed, no forked AI pipeline (epic #289, Story 09).
      const framedPrompt = t('quiz.aiPromptTemplate', { values: { topic: quizPrompt.trim() } });
      const { data: genData } = await generateForm({
        variables: { prompt: framedPrompt, organizationId, mode: aiMode, quiz: true },
      });

      const { fields, layout: generatedLayout } = genData.generateFormWithAI;
      setAiGeneratedFields(fields);
      setAiSuggestedTitle(quizTitle.trim());
      if (generatedLayout) setAiGeneratedLayout(generatedLayout);
      setSelectedMedia(null);
      setCreationSource('quiz');
      setIsGeneratingQuiz(false);
      setStep('appearance');
    } catch (err: any) {
      setIsGeneratingQuiz(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('quiz.errors.failed'), tErr(messageKey) || t('quiz.errors.failedDesc'));
    }
  }, [quizTitle, quizPassThreshold, quizStartMode, quizPrompt, aiMode, organizationId, generateForm, t, tErr]);

  const handleCreateFormWithAppearance = useCallback(async () => {
    setIsCreatingForm(true);

    try {
      const formSchema = buildFormSchema(aiGeneratedFields, pageMode, selectedLayoutCode, aiGeneratedLayout ?? undefined);

      const input: Record<string, unknown> = {
        title: aiSuggestedTitle,
        formSchema,
        organizationId,
      };

      // Only the quiz path attaches settings.quiz — the AI path's payload
      // stays byte-identical to before (additive guarantee, epic #289).
      if (creationSource === 'quiz') {
        input.description = quizDescription.trim() || undefined;
        input.settings = {
          quiz: {
            enabled: true,
            passThresholdPercent: quizPassThreshold,
            gradeRelease: quizGradeRelease,
            respondentVisibility: DEFAULT_QUIZ_SETTINGS.respondentVisibility,
          },
        };
      }

      const { data: formData } = await createForm({
        variables: { input },
      });

      const formId = formData.createForm.id;
      let pendingBgKey: string | undefined;
      let pendingBgVideoKey: string | undefined;
      let pendingBgDominantColor: string | undefined;

      if (selectedMedia) {
        try {
          if (selectedMedia.kind === 'image') {
            const result = selectedMedia.source === 'pexels'
              ? await downloadPexelsImage(selectedMedia.downloadUrl, formId)
              : await downloadPixabayImage(selectedMedia.downloadUrl, formId);
            pendingBgKey = result.key;
            pendingBgDominantColor = result.dominantColor;
          } else {
            const result = selectedMedia.source === 'pexels'
              ? await downloadPexelsVideo(selectedMedia.video as PexelsVideo, formId)
              : await downloadPixabayVideo(selectedMedia.video as PixabayVideo, formId);
            pendingBgVideoKey = result.key;
            pendingBgDominantColor = result.dominantColor;
          }
        } catch {
          // Media download failed — not fatal; user can add it later
        }
      }

      navigate(`/dashboard/form/${formId}/builder/page-builder`, {
        state: (pendingBgKey || pendingBgVideoKey)
          ? {
              pendingBackgroundKey: pendingBgKey,
              pendingBackgroundVideoKey: pendingBgVideoKey,
              pendingBackgroundDominantColor: pendingBgDominantColor,
            }
          : undefined,
      });
    } catch (err: any) {
      setIsCreatingForm(false);
      const { messageKey } = getErrorDetails(err);
      toastError(t('appearance.errors.failed'), tErr(messageKey) || t('appearance.errors.failedDesc'));
    }
  }, [aiGeneratedFields, aiSuggestedTitle, aiGeneratedLayout, pageMode, selectedLayoutCode, selectedMedia, organizationId, createForm, navigate, t, tErr, creationSource, quizDescription, quizPassThreshold, quizGradeRelease]);

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
      setStep(creationSource === 'quiz' ? 'quiz' : 'ai');
    } else {
      setStep('choice');
    }
  }, [step, navigate, creationSource]);

  // ── Media selection toggle ───────────────────────────────────────────────

  const handleSelectPexels = useCallback((photo: PexelsPhoto) => {
    setSelectedMedia(prev =>
      prev?.kind === 'image' && prev.source === 'pexels' && prev.downloadUrl === photo.src.large2x
        ? null
        : { kind: 'image', source: 'pexels', downloadUrl: photo.src.large2x, previewUrl: photo.src.medium, credit: photo.photographer }
    );
  }, []);

  const handleSelectPixabay = useCallback((image: PixabayImage) => {
    const downloadUrl = image.fullHDURL ?? image.largeImageURL;
    setSelectedMedia(prev =>
      prev?.kind === 'image' && prev.source === 'pixabay' && prev.downloadUrl === downloadUrl
        ? null
        : { kind: 'image', source: 'pixabay', downloadUrl, previewUrl: image.webformatURL, credit: image.user }
    );
  }, []);

  const handleSelectPexelsVideo = useCallback((video: PexelsVideo) => {
    setSelectedMedia(prev =>
      prev?.kind === 'video' && prev.source === 'pexels' && (prev.video as PexelsVideo).id === video.id
        ? null
        : { kind: 'video', source: 'pexels', video, previewUrl: video.image, credit: '' }
    );
  }, []);

  const handleSelectPixabayVideo = useCallback((video: PixabayVideo) => {
    setSelectedMedia(prev =>
      prev?.kind === 'video' && prev.source === 'pixabay' && (prev.video as PixabayVideo).id === video.id
        ? null
        : { kind: 'video', source: 'pixabay', video, previewUrl: video.videos.tiny.thumbnail, credit: video.user }
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
      <div className="flex-1 flex items-start justify-center p-6 py-8 overflow-y-auto">

        {/* ── Step 1: Choice ─────────────────────────────────────────────── */}
        {step === 'choice' && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">
                {t('choice.subheading')}
              </p>
              <h1 className="text-3xl font-bold text-foreground">
                {t('choice.heading')}
              </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* AI Card — highlighted, blue (matches AI accent used across the app) */}
              <button
                type="button"
                onClick={() => { setCreationSource('ai'); setStep('ai'); }}
                className="relative group text-left p-7 rounded-2xl border-2 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{ borderColor: 'rgba(37,99,235,0.35)', backgroundColor: 'rgba(59,130,246,0.06)' }}
              >
                <span className="absolute top-4 right-4">
                  <Badge className="text-[10px] px-2 py-0.5 border-0" style={{ backgroundColor: 'rgb(37,99,235)', color: '#fff' }}>
                    {t('choice.ai.badge')}
                  </Badge>
                </span>

                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: 'rgba(37,99,235,0.15)' }}>
                  <AIIcon className="h-6 w-6 text-[rgb(37,99,235)]" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('choice.ai.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('choice.ai.description')}
                </p>
              </button>

              {/* Template Card — lavender */}
              <button
                type="button"
                onClick={() => setStep('template')}
                className="relative group text-left p-7 rounded-2xl border-2 border-border bg-card hover:border-[#5c2e6b]/40 hover:bg-[var(--tf-icon-lavender)]/30 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
                  <LayoutTemplate className="h-6 w-6" style={{ color: '#5c2e6b' }} />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('choice.template.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('choice.template.description')}
                </p>
              </button>

              {/* Quiz Card — teal, a peer of the other two (not a promotion) */}
              <button
                type="button"
                onClick={() => { setCreationSource('quiz'); setStep('quiz'); }}
                className="relative group text-left p-7 rounded-2xl border-2 border-border bg-card hover:border-[var(--tf-green)]/40 hover:bg-[var(--tf-icon-teal)]/30 transition-all hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl" style={{ backgroundColor: 'var(--tf-icon-teal)' }}>
                  <GraduationCap className="h-6 w-6" style={{ color: 'var(--tf-green)' }} />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('choice.quiz.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('choice.quiz.description')}
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

        {/* ── Step 2C: Quiz ──────────────────────────────────────────────── */}
        {step === 'quiz' && (
          <div className="w-full max-w-xl">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold text-foreground">{t('quiz.heading')}</h1>
              </div>
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('quiz.titleLabel')}
                </label>
                <Input
                  placeholder={t('quiz.titlePlaceholder')}
                  value={quizTitle}
                  onChange={e => { setQuizTitle(e.target.value); setQuizTitleError(''); }}
                  disabled={isGeneratingQuiz}
                  className={cn(quizTitleError && 'border-destructive')}
                />
                {quizTitleError && (
                  <p className="text-xs text-destructive">{quizTitleError}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t('quiz.descriptionLabel')}
                </label>
                <Textarea
                  placeholder={t('quiz.descriptionPlaceholder')}
                  value={quizDescription}
                  onChange={e => setQuizDescription(e.target.value)}
                  rows={2}
                  disabled={isGeneratingQuiz}
                  className="resize-none"
                />
              </div>

              {/* Start mode */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('quiz.startMode.label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <ModeChip
                    active={quizStartMode === 'blank'} onClick={() => setQuizStartMode('blank')}
                    icon={PenLine} label={t('quiz.startMode.blank')} sub={t('quiz.startMode.blankSub')}
                  />
                  <ModeChip
                    active={quizStartMode === 'ai'} onClick={() => setQuizStartMode('ai')}
                    icon={AIIcon} label={t('quiz.startMode.ai')} sub={t('quiz.startMode.aiSub')}
                  />
                </div>
              </div>

              {/* AI prompt — only shown when generating with AI */}
              {quizStartMode === 'ai' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t('quiz.aiPromptLabel')}
                  </label>
                  <Textarea
                    placeholder={t('quiz.aiPromptPlaceholder')}
                    value={quizPrompt}
                    onChange={e => { setQuizPrompt(e.target.value); setQuizPromptError(''); }}
                    rows={2}
                    disabled={isGeneratingQuiz}
                    className={cn('resize-none', quizPromptError && 'border-destructive')}
                  />
                  {quizPromptError && (
                    <p className="text-xs text-destructive">{quizPromptError}</p>
                  )}
                </div>
              )}

              {/* Pass threshold */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('quiz.passThreshold.label')}</label>
                <div className="flex items-center gap-2 max-w-[160px]">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quizPassThreshold}
                    onChange={e => { setQuizPassThreshold(e.target.valueAsNumber); setQuizPassThresholdError(''); }}
                    disabled={isGeneratingQuiz}
                    className={cn(quizPassThresholdError && 'border-destructive')}
                  />
                  <span className="text-sm text-muted-foreground">{t('quiz.passThreshold.suffix')}</span>
                </div>
                {quizPassThresholdError && (
                  <p className="text-xs text-destructive">{quizPassThresholdError}</p>
                )}
              </div>

              {/* Grade release */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('quiz.gradeRelease.label')}</label>
                <div className="grid grid-cols-3 gap-2">
                  <ModeChip
                    active={quizGradeRelease === 'immediate'} onClick={() => setQuizGradeRelease('immediate')}
                    icon={CheckCircle2} label={t('quiz.gradeRelease.immediate')} sub=""
                  />
                  <ModeChip
                    active={quizGradeRelease === 'afterReview'} onClick={() => setQuizGradeRelease('afterReview')}
                    icon={Clock} label={t('quiz.gradeRelease.afterReview')} sub=""
                    disabled title={t('quiz.gradeRelease.afterReviewDisabledHint')}
                  />
                  <ModeChip
                    active={quizGradeRelease === 'never'} onClick={() => setQuizGradeRelease('never')}
                    icon={EyeOff} label={t('quiz.gradeRelease.never')} sub=""
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('quiz.gradeRelease.afterReviewDisabledHint')}
                </p>
              </div>

              {/* Continue button */}
              <Button
                onClick={handleQuizContinue}
                disabled={isGeneratingQuiz}
                className="w-full h-11 text-base font-medium"
                size="lg"
              >
                {isGeneratingQuiz ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('quiz.generating')}</>
                ) : (
                  <><GraduationCap className="mr-2 h-4 w-4" />{t('quiz.continue')}</>
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
                  scrollAreaClassName="h-[320px]"
                />
              </div>

              {/* ── Media picker ─────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {mediaType === 'video' ? (
                      <VideoIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    {t('appearance.mediaLabel')}
                  </h2>
                  <span className="text-xs text-muted-foreground">{t('appearance.optional')}</span>
                </div>

                {/* Media type toggle */}
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant={mediaType === 'photo' ? 'default' : 'outline'}
                    onClick={() => setMediaType('photo')}
                  >
                    {t('appearance.mediaType.photos')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mediaType === 'video' ? 'default' : 'outline'}
                    onClick={() => setMediaType('video')}
                  >
                    {t('appearance.mediaType.videos')}
                  </Button>
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

                {/* Pexels photos */}
                {imageTab === 'pexels' && mediaType === 'photo' && (
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
                            const isSelected = selectedMedia?.kind === 'image' && selectedMedia.source === 'pexels' && selectedMedia.downloadUrl === photo.src.large2x;
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

                {/* Pexels videos */}
                {imageTab === 'pexels' && mediaType === 'video' && (
                  <div>
                    {pexelsVideoLoading ? (
                      <div className="flex items-center justify-center h-44">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : pexelsVideos.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">{t('appearance.noVideos')}</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          {pexelsVideos.map(video => {
                            const isSelected = selectedMedia?.kind === 'video' && selectedMedia.source === 'pexels' && (selectedMedia.video as PexelsVideo).id === video.id;
                            return (
                              <button
                                key={video.id}
                                type="button"
                                onClick={() => handleSelectPexelsVideo(video)}
                                className={cn(
                                  'relative overflow-hidden rounded-lg aspect-video border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                  isSelected
                                    ? 'border-primary shadow-md'
                                    : 'border-transparent hover:border-primary/50'
                                )}
                              >
                                <img
                                  src={video.image}
                                  alt={`Pexels video ${video.id}`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Play className="h-6 w-6 text-white/90" />
                                </div>
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
                          Videos provided by{' '}
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

                {/* Pixabay photos */}
                {imageTab === 'pixabay' && mediaType === 'photo' && (
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
                          const isSelected = selectedMedia?.kind === 'image' && selectedMedia.source === 'pixabay' && selectedMedia.downloadUrl === (image.fullHDURL ?? image.largeImageURL);
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

                {/* Pixabay videos */}
                {imageTab === 'pixabay' && mediaType === 'video' && (
                  <div>
                    {pixabayVideoLoading ? (
                      <div className="flex items-center justify-center h-44">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : pixabayVideos.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">{t('appearance.noVideos')}</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {pixabayVideos.map(video => {
                          const isSelected = selectedMedia?.kind === 'video' && selectedMedia.source === 'pixabay' && (selectedMedia.video as PixabayVideo).id === video.id;
                          return (
                            <button
                              key={video.id}
                              type="button"
                              onClick={() => handleSelectPixabayVideo(video)}
                              className={cn(
                                'relative overflow-hidden rounded-lg aspect-video border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                isSelected
                                  ? 'border-primary shadow-md'
                                  : 'border-transparent hover:border-primary/50'
                              )}
                            >
                              <img
                                src={video.videos.tiny.thumbnail}
                                alt={video.tags}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play className="h-6 w-6 text-white/90" />
                              </div>
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
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {selectedMedia ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {selectedMedia.kind === 'video' ? t('appearance.videoSelected') : t('appearance.imageSelected')}
                    {selectedMedia.credit && (
                      <span className="text-muted-foreground font-normal">
                        {' '}— {selectedMedia.credit}
                      </span>
                    )}
                  </span>
                ) : (
                  t('appearance.noMediaSelected')
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
                  <><GradientSparkles size={16} className="mr-2" />{t('appearance.create')}</>
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
                  const bgVideoKey = template.formSchema?.layout?.backgroundVideoKey;
                  const bgVideoUrl = bgVideoKey && cdnEndpoint ? `${cdnEndpoint}/${bgVideoKey}` : null;
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
                        {bgVideoUrl ? (
                          <video
                            src={bgVideoUrl}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            muted
                            loop
                            autoPlay
                            playsInline
                            preload="metadata"
                          />
                        ) : bgImageUrl ? (
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
