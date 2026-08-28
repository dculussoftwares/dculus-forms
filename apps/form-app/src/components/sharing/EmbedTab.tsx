import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toastError,
  toastSuccess,
} from '@dculus/ui';
import { Check, Copy, Code2, Layers, MousePointerClick, Square } from 'lucide-react';
import type { EmbedSettings, EmbedType } from '@dculus/types/embed.js';
import { canFrameEmbed, isFramedEmbedType } from '@dculus/types/embed.js';
import { useTranslation } from '../../hooks/useTranslation';
import {
  buildPlatformSnippet,
  platformsForType,
  resolveEmbedSettings,
  type SnippetContext,
  type SnippetPlatform,
} from '../../lib/embedSnippets';
import { EmbedPreview } from './EmbedPreview';

/** Order matters: this is reading order in the picker, most-recommended first. */
const EMBED_TYPES: { type: EmbedType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'inline', icon: Layers },
  { type: 'lightbox', icon: Square },
  { type: 'iframe', icon: Code2 },
  { type: 'button', icon: MousePointerClick },
];

/** Offered in the width picker; 'custom' hands over to the free-text input. */
const WIDTH_PRESETS = ['100%', '800px', '640px', '480px'];

interface EmbedTabProps {
  viewerOrigin: string;
  shortUrl: string;
  formTitle: string;
  isPublished: boolean;
  pageCount: number;
  /** Current `settings.embed`, or null for a form that has never configured one. */
  embed?: EmbedSettings | null;
  /** Read to decide whether framed types are available at all. */
  accessControlEnabled: boolean;
  collectRespondentEmail: boolean;
  /** Persisted on copy, not on every keystroke — see docs/form-embed-v1-spec.md §14.2. */
  onPersist: (embed: EmbedSettings) => Promise<void>;
  canEdit: boolean;
}

export const EmbedTab: React.FC<EmbedTabProps> = ({
  viewerOrigin,
  shortUrl,
  formTitle,
  isPublished,
  pageCount,
  embed,
  accessControlEnabled,
  collectRespondentEmail,
  onPersist,
  canEdit,
}) => {
  const { t } = useTranslation('embed');

  // A gated form cannot be framed, so the picker starts on the one type that
  // still works rather than on a card the owner cannot select.
  const framingAllowed = canFrameEmbed(accessControlEnabled, collectRespondentEmail);
  const stored = useMemo(() => resolveEmbedSettings(embed), [embed]);

  const [type, setType] = useState<EmbedType>(() =>
    framingAllowed ? stored.type : 'button'
  );
  const [width, setWidth] = useState(stored.width);
  const [heightMode, setHeightMode] = useState(stored.heightMode);
  const [heightPx, setHeightPx] = useState(stored.heightPx);
  const [transparent, setTransparent] = useState(stored.transparentBackground);
  const [buttonLabel, setButtonLabel] = useState(stored.buttonLabel);
  const [closeOnSubmit, setCloseOnSubmit] = useState(stored.closeOnSubmit);
  const [platform, setPlatform] = useState<SnippetPlatform>('html');
  const [copied, setCopied] = useState(false);

  // The audience selector sits above these tabs in the same panel, so framing
  // can be revoked while this tab is open. Without this the framed card stays
  // selected after it is disabled, and the owner copies a snippet that
  // `/embed/:shortUrl` will refuse to render.
  useEffect(() => {
    if (!framingAllowed && isFramedEmbedType(type)) setType('button');
  }, [framingAllowed, type]);

  const settings = useMemo(
    () =>
      resolveEmbedSettings({
        type,
        width,
        heightMode,
        heightPx,
        transparentBackground: transparent,
        buttonLabel,
        closeOnSubmit,
      }),
    [type, width, heightMode, heightPx, transparent, buttonLabel, closeOnSubmit]
  );

  const ctx: SnippetContext = useMemo(
    () => ({ viewerOrigin, shortUrl, formTitle, settings }),
    [viewerOrigin, shortUrl, formTitle, settings]
  );

  const platforms = platformsForType(type);
  const activePlatform = platforms.includes(platform) ? platform : 'html';
  const snippet = useMemo(
    () => buildPlatformSnippet(ctx, activePlatform, type),
    [ctx, activePlatform, type]
  );

  const showsLabelField = type === 'button' || type === 'lightbox';
  const showsFrameOptions = isFramedEmbedType(type);
  // The plain iframe has no script to resize it, so "fit content" is not on
  // offer there — the owner has to choose a height.
  const showsHeightChoice = type === 'inline' || type === 'lightbox';

  const handleCopy = async () => {
    // Persisting here rather than on every change matches the mental model:
    // the snippet you took is the configuration that gets stored.
    //
    // It runs BEFORE the clipboard write, and independently of whether that
    // write succeeds. `navigator.clipboard` is unavailable in a non-secure
    // context and can be denied by permission policy — and in those cases the
    // owner has still told us which configuration they want. Chaining the save
    // to the clipboard would silently discard it and leave them believing the
    // panel had remembered their choices.
    if (canEdit) {
      try {
        await onPersist({
          enabled: embed?.enabled ?? true,
          type,
          width,
          heightMode,
          heightPx,
          transparentBackground: transparent,
          buttonLabel,
          closeOnSubmit,
        });
      } catch {
        // onPersist surfaces its own error toast.
      }
    }

    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toastSuccess(t('snippet.copiedToast'));
    } catch (error) {
      console.error('Failed to copy embed snippet', error);
      // The snippet is on screen and selectable, so this is recoverable —
      // the message says the clipboard is unavailable, not that copying failed
      // in some way the owner cannot work around.
      toastError(t('snippet.copyFailed'), t('snippet.clipboardUnavailable'));
    }
  };

  return (
    <div className="space-y-5 min-w-0" data-testid="embed-tab">
      {!isPublished && (
        <Notice tone="warning" testId="embed-draft-warning">
          {t('warnings.draft')}
        </Notice>
      )}

      {!framingAllowed && (
        <Notice tone="info" testId="embed-gated-warning">
          {t('warnings.gated')}
        </Notice>
      )}
      {/* The type picker spans the full width: it is the first decision,
          and squeezing four cards into half the panel wrapped every hint
          onto three lines. Options and preview split the space below it. */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('type.label')}
        </p>
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label={t('type.label')}>
            {EMBED_TYPES.map(({ type: option, icon: Icon }) => {
              const disabled = !framingAllowed && isFramedEmbedType(option);
              const selected = type === option;
              const card = (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setType(option)}
                  data-testid={`embed-type-${option}`}
                  className={`flex flex-col items-start gap-1.5 rounded-xl p-3 text-left transition-colors ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/60'
                  }`}
                  style={{
                    border: selected
                      ? '2px solid var(--tf-green)'
                      : '1px solid var(--tf-border-medium)',
                  }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-primary">
                    {t(`type.options.${option}.label`)}
                  </span>
                  <span className="text-xs text-muted-foreground leading-snug">
                    {t(`type.options.${option}.hint`)}
                  </span>
                </button>
              );

              // The explanation belongs on the disabled card itself —
              // "why can't I pick this?" is asked at the card, not in a
              // banner somewhere above it.
              return disabled ? (
                <Tooltip key={option}>
                  {/* A disabled button emits no pointer events, so the
                      trigger has to wrap it in something that does. */}
                  <TooltipTrigger asChild>
                    <span className="block">{card}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{t('warnings.gated')}</TooltipContent>
                </Tooltip>
              ) : (
                card
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 min-w-0">
        {/* ---- left: the options for the chosen type ---- */}
        <div className="space-y-4 min-w-0">
          {showsLabelField && (
            <div className="space-y-1.5">
              <Label htmlFor="embed-button-label" className="text-sm">
                {t('options.buttonLabel')}
              </Label>
              <Input
                id="embed-button-label"
                value={buttonLabel}
                onChange={(e) => setButtonLabel(e.target.value)}
                maxLength={60}
                data-testid="embed-button-label"
              />
            </div>
          )}

          {showsFrameOptions && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="embed-width" className="text-sm">
                  {t('options.width')}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {WIDTH_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={width === preset ? 'secondary' : 'outline'}
                      onClick={() => setWidth(preset)}
                      data-testid={`embed-width-${preset}`}
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
                <Input
                  id="embed-width"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="100%"
                  className="mt-1.5"
                  data-testid="embed-width-custom"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">{t('options.height')}</Label>
                {showsHeightChoice ? (
                  <RadioGroup
                    value={heightMode}
                    onValueChange={(value) => setHeightMode(value as 'auto' | 'fixed')}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="auto" id="embed-height-auto" />
                      <Label htmlFor="embed-height-auto" className="text-sm font-normal">
                        {t('options.heightAuto')}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fixed" id="embed-height-fixed" />
                      <Label htmlFor="embed-height-fixed" className="text-sm font-normal">
                        {t('options.heightFixed')}
                      </Label>
                      <Input
                        type="number"
                        min={200}
                        max={4000}
                        value={heightPx}
                        onChange={(e) => {
                          setHeightPx(Number(e.target.value) || 600);
                          setHeightMode('fixed');
                        }}
                        className="h-8 w-24"
                        aria-label={t('options.heightFixed')}
                        data-testid="embed-height-px"
                      />
                    </div>
                  </RadioGroup>
                ) : (
                  <>
                    <Input
                      type="number"
                      min={200}
                      max={4000}
                      value={heightPx}
                      onChange={(e) => setHeightPx(Number(e.target.value) || 600)}
                      className="h-9 w-32"
                      aria-label={t('options.height')}
                      data-testid="embed-height-px"
                    />
                    <p className="text-xs text-muted-foreground">{t('options.heightFixedNote')}</p>
                  </>
                )}
              </div>

              {/* Only meaningful once a height is pinned — an auto-height frame
                  is always exactly as tall as its content. */}
              {heightMode === 'fixed' && pageCount > 1 && (
                <Notice tone="info" testId="embed-fixed-height-warning">
                  {t('warnings.fixedHeightMultiPage')}
                </Notice>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="embed-transparent" className="text-sm">
                    {t('options.transparent')}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t('options.transparentHint')}</p>
                </div>
                <Switch
                  id="embed-transparent"
                  checked={transparent}
                  onCheckedChange={setTransparent}
                  data-testid="embed-transparent"
                />
              </div>

              {type === 'lightbox' && (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="embed-close-on-submit" className="text-sm">
                      {t('options.closeOnSubmit')}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t('options.closeOnSubmitHint')}
                    </p>
                  </div>
                  <Switch
                    id="embed-close-on-submit"
                    checked={closeOnSubmit}
                    onCheckedChange={setCloseOnSubmit}
                    data-testid="embed-close-on-submit"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* ---- right: live preview ---- */}
        <EmbedPreview
          viewerOrigin={viewerOrigin}
          shortUrl={shortUrl}
          formTitle={formTitle}
          settings={settings}
          type={type}
        />
      </div>

      {/* ---- snippet ---- */}
      <div className="space-y-2 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary">{t('snippet.label')}</p>
          {platforms.length > 0 && (
            <Tabs value={activePlatform} onValueChange={(v) => setPlatform(v as SnippetPlatform)}>
              <TabsList className="h-8">
                {platforms.map((p) => (
                  <TabsTrigger key={p} value={p} className="text-xs h-6 px-2.5">
                    {t(`platform.${p}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>

        <div
          className="rounded-xl bg-white dark:bg-card p-3"
          style={{ border: '1px solid var(--tf-border-medium)' }}
        >
          <pre
            className="overflow-x-auto text-xs font-mono text-foreground whitespace-pre"
            data-testid="embed-snippet"
          >
            {snippet}
          </pre>
        </div>

        {activePlatform !== 'html' && (
          <p className="text-xs text-muted-foreground" data-testid="embed-platform-note">
            {t(`platformNote.${activePlatform}`)}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={handleCopy} data-testid="embed-copy-snippet">
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? t('snippet.copied') : t('snippet.copy')}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface NoticeProps {
  tone: 'warning' | 'info';
  testId: string;
  children: React.ReactNode;
}

/** Inline, and only when it applies — never a stacked wall of caveats. */
const Notice: React.FC<NoticeProps> = ({ tone, testId, children }) => (
  <div
    className="rounded-xl p-3 text-xs leading-relaxed"
    data-testid={testId}
    style={
      tone === 'warning'
        ? {
            backgroundColor: 'rgba(190,153,58,0.08)',
            border: '1px solid rgba(190,153,58,0.16)',
            color: '#8b6a18',
          }
        : {
            backgroundColor: 'var(--tf-overlay)',
            border: '1px solid var(--tf-border-medium)',
          }
    }
  >
    {children}
  </div>
);

export default EmbedTab;
