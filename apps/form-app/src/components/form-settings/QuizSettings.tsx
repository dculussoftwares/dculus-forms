import React from 'react';
import {
  Button,
  Label,
  Switch,
  Input,
  Textarea,
  RadioGroup,
  RadioGroupItem,
  toastError,
} from '@dculus/ui';
import { GraduationCap, Save, Info } from 'lucide-react';
import type { QuizSettings as QuizSettingsType, GradeRelease } from '@dculus/types';
import { DEFAULT_QUIZ_SETTINGS } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';

interface QuizSettingsProps {
  settings: QuizSettingsType | undefined;
  isSaving: boolean;
  onUpdate: (quiz: QuizSettingsType) => void;
  onSave: () => void;
  // Epic #289 D9 (Story 17, #321): whether THIS form has some way to
  // identify the respondent later (accessControl.enabled or
  // collectRespondentEmail). Deferred grade release ('afterReview' /
  // 'scheduled') is unfulfillable without it, so those two options are
  // disabled — not hidden, so the feature stays discoverable — until the
  // owner turns on sign-in or email collection in Access Control.
  requiresIdentity: boolean;
}

// Quiz mode is off by default for a form that has never opened this panel —
// distinct from DEFAULT_QUIZ_SETTINGS (which defaults `enabled: true` for the
// "seed on first enable" case below).
const DISABLED_DISPLAY_DEFAULT: QuizSettingsType = { ...DEFAULT_QUIZ_SETTINGS, enabled: false };

// datetime-local inputs work in unqualified local time; releaseAt is stored
// as an ISO 8601 string with offset, so both directions need a conversion.
const toDatetimeLocal = (iso: string | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const fromDatetimeLocal = (value: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const QuizSettings: React.FC<QuizSettingsProps> = ({
  settings,
  isSaving,
  onUpdate,
  onSave,
  requiresIdentity,
}) => {
  const { t } = useTranslation('quizSettings');
  const quiz = settings ?? DISABLED_DISPLAY_DEFAULT;

  const handleEnableToggle = (enabled: boolean) => {
    if (!enabled) {
      if (!window.confirm(t('disableConfirm'))) return;
      onUpdate({ ...quiz, enabled: false });
      return;
    }
    // First-ever enable (settings.quiz was absent): seed from the shared
    // defaults rather than the display-only DISABLED_DISPLAY_DEFAULT.
    onUpdate(settings ? { ...settings, enabled: true } : { ...DEFAULT_QUIZ_SETTINGS, enabled: true });
  };

  const updateVisibility = (key: keyof QuizSettingsType['respondentVisibility'], value: boolean) => {
    onUpdate({ ...quiz, respondentVisibility: { ...quiz.respondentVisibility, [key]: value } });
  };

  const handleGradeReleaseChange = (value: string) => {
    const gradeRelease = value as GradeRelease;
    onUpdate({
      ...quiz,
      gradeRelease,
      releaseAt: gradeRelease === 'scheduled' ? quiz.releaseAt : undefined,
    });
  };

  const handleSave = () => {
    if (quiz.enabled && quiz.gradeRelease === 'scheduled' && !quiz.releaseAt) {
      toastError(t('gradeRelease.releaseAt.label'), t('gradeRelease.releaseAt.required'));
      return;
    }
    onSave();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
          <GraduationCap className="h-4 w-4" style={{ color: '#5c2e6b' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
      </div>

      {/* Enable quiz mode */}
      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <GraduationCap className="h-4 w-4" style={{ color: '#5c2e6b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="quiz-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('enable.title')}
            </Label>
            <p className="text-sm text-muted-foreground">{t('enable.description')}</p>
          </div>
          <Switch
            id="quiz-enabled"
            data-testid="quiz-enabled-checkbox"
            checked={quiz.enabled}
            onCheckedChange={handleEnableToggle}
          />
        </div>

        {quiz.enabled && (
          <div className="mx-4 mb-4 flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--tf-tab-bg)', color: 'var(--tf-muted)' }}>
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {t('keysPreservedNotice')}
          </div>
        )}
      </div>

      {quiz.enabled && (
        <>
          {/* Pass threshold */}
          <div className="rounded-xl bg-white dark:bg-card p-4 space-y-2" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
            <Label htmlFor="quiz-pass-threshold" className="text-sm font-medium">
              {t('passThreshold.label')}
            </Label>
            <div className="flex items-center gap-2 max-w-[160px]">
              <Input
                id="quiz-pass-threshold"
                data-testid="quiz-pass-threshold-input"
                type="number"
                min={0}
                max={100}
                value={quiz.passThresholdPercent ?? 60}
                onChange={(e) => onUpdate({ ...quiz, passThresholdPercent: Number(e.target.value) })}
              />
              <span className="text-sm text-muted-foreground">{t('passThreshold.suffix')}</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('passThreshold.help')}</p>
          </div>

          {/* Grade release */}
          <div className="rounded-xl bg-white dark:bg-card p-4 space-y-3" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
            <Label className="text-sm font-medium">{t('gradeRelease.label')}</Label>
            <RadioGroup value={quiz.gradeRelease} onValueChange={handleGradeReleaseChange}>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="immediate" id="quiz-release-immediate" className="mt-1" />
                <Label htmlFor="quiz-release-immediate" className="font-normal cursor-pointer">
                  <span className="block text-sm font-medium">{t('gradeRelease.immediate')}</span>
                  <span className="block text-xs text-muted-foreground">{t('gradeRelease.immediateDescription')}</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem
                  value="afterReview"
                  id="quiz-release-afterReview"
                  className="mt-1"
                  disabled={!requiresIdentity}
                  data-testid="quiz-release-afterReview-radio"
                />
                <Label
                  htmlFor="quiz-release-afterReview"
                  className={requiresIdentity ? 'font-normal cursor-pointer' : 'font-normal cursor-not-allowed opacity-60'}
                >
                  <span className="block text-sm font-medium">{t('gradeRelease.afterReview')}</span>
                  <span className="block text-xs text-muted-foreground">{t('gradeRelease.afterReviewDescription')}</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem
                  value="scheduled"
                  id="quiz-release-scheduled"
                  className="mt-1"
                  disabled={!requiresIdentity}
                  data-testid="quiz-release-scheduled-radio"
                />
                <Label
                  htmlFor="quiz-release-scheduled"
                  className={requiresIdentity ? 'font-normal cursor-pointer' : 'font-normal cursor-not-allowed opacity-60'}
                >
                  <span className="block text-sm font-medium">{t('gradeRelease.scheduled')}</span>
                  <span className="block text-xs text-muted-foreground">{t('gradeRelease.scheduledDescription')}</span>
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="never" id="quiz-release-never" className="mt-1" />
                <Label htmlFor="quiz-release-never" className="font-normal cursor-pointer">
                  <span className="block text-sm font-medium">{t('gradeRelease.never')}</span>
                  <span className="block text-xs text-muted-foreground">{t('gradeRelease.neverDescription')}</span>
                </Label>
              </div>
            </RadioGroup>

            {!requiresIdentity && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--tf-tab-bg)', color: 'var(--tf-muted)' }}
                data-testid="quiz-release-identity-hint"
              >
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {t('gradeRelease.identityRequiredHint')}
              </div>
            )}

            {quiz.gradeRelease === 'scheduled' && (
              <div className="pl-6 space-y-1">
                <Label htmlFor="quiz-release-at" className="text-sm">{t('gradeRelease.releaseAt.label')}</Label>
                <Input
                  id="quiz-release-at"
                  data-testid="quiz-release-at-input"
                  type="datetime-local"
                  className="max-w-[260px]"
                  value={toDatetimeLocal(quiz.releaseAt)}
                  onChange={(e) => onUpdate({ ...quiz, releaseAt: fromDatetimeLocal(e.target.value) })}
                />
                {!quiz.releaseAt && (
                  <p className="text-xs" style={{ color: 'var(--tf-error)' }}>{t('gradeRelease.releaseAt.required')}</p>
                )}
              </div>
            )}
          </div>

          {/* Respondent visibility */}
          <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
            <div className="p-4 pb-2">
              <Label className="text-sm font-medium">{t('visibility.title')}</Label>
              <p className="text-sm text-muted-foreground">{t('visibility.description')}</p>
            </div>

            {([
              'totalScore',
              'perQuestionCorrectness',
              'correctAnswers',
              'pointValues',
              'feedback',
              'passFailBadge',
            ] as const).map((key) => (
              <div key={key} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`quiz-visibility-${key}`} className="text-sm font-medium text-primary cursor-pointer">
                    {t(`visibility.${key}.title`)}
                  </Label>
                  <p className="text-sm text-muted-foreground">{t(`visibility.${key}.description`)}</p>
                </div>
                <Switch
                  id={`quiz-visibility-${key}`}
                  data-testid={`quiz-visibility-${key}-checkbox`}
                  checked={quiz.respondentVisibility[key]}
                  onCheckedChange={(checked) => updateVisibility(key, checked)}
                />
              </div>
            ))}
          </div>

          {/* Result messages */}
          <div className="rounded-xl bg-white dark:bg-card p-4 space-y-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
            <Label className="text-sm font-medium">{t('resultMessages.title')}</Label>
            <div className="space-y-2">
              <Label htmlFor="quiz-result-message-pass" className="text-sm">{t('resultMessages.pass.label')}</Label>
              <Textarea
                id="quiz-result-message-pass"
                data-testid="quiz-result-message-pass-input"
                placeholder={t('resultMessages.pass.placeholder')}
                value={quiz.resultMessagePass || ''}
                onChange={(e) => onUpdate({ ...quiz, resultMessagePass: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-result-message-fail" className="text-sm">{t('resultMessages.fail.label')}</Label>
              <Textarea
                id="quiz-result-message-fail"
                data-testid="quiz-result-message-fail-input"
                placeholder={t('resultMessages.fail.placeholder')}
                value={quiz.resultMessageFail || ''}
                onChange={(e) => onUpdate({ ...quiz, resultMessageFail: e.target.value })}
              />
            </div>
          </div>
        </>
      )}

      <div>
        <Button onClick={handleSave} disabled={isSaving} data-testid="save-quiz-settings-button">
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
};

export default QuizSettings;
