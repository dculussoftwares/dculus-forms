import React, { useState } from 'react';
import type { UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import {
  FieldType,
  FIELD_TYPE_DEFAULT_GRADING_MODE,
  isGradableFieldType,
  type FieldFormData,
  type FieldGrading,
  type GradingMode,
} from '@dculus/types';
import {
  Label,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Alert,
  AlertDescription,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@dculus/ui';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFieldSettingsConstants } from '../field-settings';

// =============================================================================
// Helpers
// =============================================================================

/** Builds the default answer key for a field type the first time it's touched. */
const createDefaultGrading = (fieldType: FieldType): FieldGrading => ({
  mode: (FIELD_TYPE_DEFAULT_GRADING_MODE as Partial<Record<FieldType, GradingMode>>)[
    fieldType
  ] ?? 'manual',
  pointValue: 1,
  acceptedAnswers: [],
});

// =============================================================================
// Props
// =============================================================================

export interface GradingSettingsProps {
  fieldType: FieldType;
  /** Live current option list — only meaningful for radio/select/checkbox fields.
   * Passed explicitly (rather than re-reading `field.options`) so it stays in sync
   * with in-progress edits in the Options section above, which is what makes the
   * "renamed option" staleness warning possible. */
  options?: string[];
  // `FieldFormData` (not a per-field-type member) because every call site's `form`
  // comes from `useFieldEditor`'s `useForm<FieldFormData>(...)` — the same union
  // type regardless of which specific field is being edited.
  watch: UseFormWatch<FieldFormData>;
  setValue: UseFormSetValue<FieldFormData>;
  errors?: FieldErrors<FieldFormData>;
  isEditable: boolean;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Per-question answer-key editor (Native Quiz Story 08, GitHub issue #297).
 *
 * One shared component that adapts its UI to the field's type via
 * `FIELD_TYPE_DEFAULT_GRADING_MODE` / `isGradableFieldType` (packages/types/src/quiz.ts)
 * rather than re-deriving the mapping. Composed into SelectionFieldSettings,
 * TextFieldSettings, NumberFieldSettings and DateFieldSettings, below their existing
 * Validation section, and only rendered by the caller when `settings.quiz?.enabled`
 * is true — this component itself renders nothing when the field type isn't gradable.
 */
export const GradingSettings: React.FC<GradingSettingsProps> = ({
  fieldType,
  options = [],
  watch,
  setValue,
  errors,
  isEditable,
}) => {
  const { t } = useTranslation('quizGrading');
  const constants = useFieldSettingsConstants();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // Number mode ("target" vs "range") can't be derived purely from
  // grading.numeric.min/max: choosing "range" starts with both bounds empty, so
  // deriving the mode from their presence would immediately snap back to
  // "target" before the author can type either one. Tracks the author's explicit
  // choice until grading.numeric actually has a bound to derive from again.
  const [numberModeOverride, setNumberModeOverride] = useState<'target' | 'range' | null>(
    null
  );

  const grading: FieldGrading | undefined = watch('grading');
  // `errors.grading` doesn't type-check directly on the `FieldFormData` union:
  // some members (e.g. PhoneNumberFieldFormData) have no `grading` key at all, and
  // TS only allows property access on a union when every member has it. Every
  // member this component is actually invoked for does carry `grading` (see the
  // `gradingFormSchema` additions across all 8 relevant schemas in
  // packages/types/src/validation.ts), so narrow to just the shape this file
  // needs rather than casting to `any`.
  const gradingErrors = (errors as FieldErrors<{ grading?: FieldGrading }> | undefined)
    ?.grading;

  if (!isGradableFieldType(fieldType)) return null;

  const updateGrading = (updates: Partial<FieldGrading>) => {
    const base = grading ?? createDefaultGrading(fieldType);
    setValue(
      'grading',
      { ...base, ...updates },
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const pointValue = grading?.pointValue ?? 1;
  const acceptedAnswers = grading?.acceptedAnswers ?? [];

  const isSelection =
    fieldType === FieldType.RADIO_FIELD ||
    fieldType === FieldType.SELECT_FIELD ||
    fieldType === FieldType.CHECKBOX_FIELD;
  const isMultiple = fieldType === FieldType.CHECKBOX_FIELD;
  const isText =
    fieldType === FieldType.TEXT_INPUT_FIELD ||
    fieldType === FieldType.TEXT_AREA_FIELD ||
    fieldType === FieldType.EMAIL_FIELD;
  const isManualText = fieldType === FieldType.TEXT_AREA_FIELD;
  const isNumber = fieldType === FieldType.NUMBER_FIELD;
  const isDate = fieldType === FieldType.DATE_FIELD;

  const pointValueInput = (
    <div className={constants.CSS_CLASSES.INPUT_SPACING}>
      <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('pointsLabel')}</Label>
      <Input
        type="number"
        min={0}
        step="1"
        value={grading ? pointValue : ''}
        placeholder="1"
        disabled={!isEditable}
        onChange={(e) => {
          const raw = e.target.value;
          updateGrading({ pointValue: raw === '' ? 0 : Number(raw) });
        }}
        className="w-28"
      />
      {gradingErrors?.pointValue && (
        <p className="text-sm text-destructive dark:text-red-400">
          {String(gradingErrors.pointValue.message)}
        </p>
      )}
    </div>
  );

  const feedbackSection = (
    <Collapsible open={feedbackOpen} onOpenChange={setFeedbackOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-foreground dark:text-gray-200"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform duration-150',
              feedbackOpen && 'rotate-180'
            )}
          />
          {feedbackOpen ? t('feedback.toggleHide') : t('feedback.toggleShow')}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
            {t('feedback.whenCorrectLabel')}
          </Label>
          <Textarea
            rows={2}
            disabled={!isEditable}
            placeholder={t('feedback.whenCorrectPlaceholder')}
            value={grading?.whenCorrect ?? ''}
            onChange={(e) => updateGrading({ whenCorrect: e.target.value })}
          />
        </div>
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
            {t('feedback.whenIncorrectLabel')}
          </Label>
          <Textarea
            rows={2}
            disabled={!isEditable}
            placeholder={t('feedback.whenIncorrectPlaceholder')}
            value={grading?.whenIncorrect ?? ''}
            onChange={(e) => updateGrading({ whenIncorrect: e.target.value })}
          />
        </div>
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
            {t('feedback.generalLabel')}
          </Label>
          <Textarea
            rows={2}
            disabled={!isEditable}
            placeholder={t('feedback.generalPlaceholder')}
            value={grading?.general ?? ''}
            onChange={(e) => updateGrading({ general: e.target.value })}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  // ---------------------------------------------------------------------------
  // Selection fields — mark correct option(s) inline, no modal.
  // ---------------------------------------------------------------------------
  const renderSelection = () => {
    const nonEmptyOptions = options.filter((opt) => opt.trim().length > 0);
    const staleAnswers = acceptedAnswers.filter(
      (answer) => !nonEmptyOptions.includes(answer)
    );

    const toggleSingle = (option: string) => {
      updateGrading({ mode: 'exact', acceptedAnswers: [option] });
    };

    const toggleMultiple = (option: string, checked: boolean) => {
      const next = checked
        ? [...acceptedAnswers, option]
        : acceptedAnswers.filter((a) => a !== option);
      updateGrading({
        mode: 'set',
        acceptedAnswers: next,
        set: grading?.set ?? { scoring: 'all' },
      });
    };

    return (
      <div className="space-y-3">
        {nonEmptyOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-gray-400">
            {t('selection.noOptionsYet')}
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
              {t('selection.correctColumnLabel')}
            </Label>
            {isMultiple ? (
              <div className="space-y-2">
                {nonEmptyOptions.map((option, index) => (
                  <div key={`${option}-${index}`} className="flex items-center gap-2">
                    <Checkbox
                      id={`grading-option-${index}`}
                      checked={acceptedAnswers.includes(option)}
                      onCheckedChange={(checked) =>
                        toggleMultiple(option, checked === true)
                      }
                      disabled={!isEditable}
                      aria-label={t('selection.markCorrectMultiple')}
                    />
                    <Label
                      htmlFor={`grading-option-${index}`}
                      className="text-sm font-normal text-foreground dark:text-gray-300 cursor-pointer truncate"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            ) : (
              <RadioGroup
                value={acceptedAnswers[0] ?? ''}
                onValueChange={toggleSingle}
                className="space-y-2"
              >
                {nonEmptyOptions.map((option, index) => (
                  <div key={`${option}-${index}`} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={option}
                      id={`grading-option-${index}`}
                      disabled={!isEditable}
                      aria-label={t('selection.markCorrectSingle')}
                    />
                    <Label
                      htmlFor={`grading-option-${index}`}
                      className="text-sm font-normal text-foreground dark:text-gray-300 cursor-pointer truncate"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        )}

        {gradingErrors?.acceptedAnswers && !Array.isArray(gradingErrors.acceptedAnswers) && (
          <p className="text-sm text-destructive dark:text-red-400">
            {String(gradingErrors.acceptedAnswers.message)}
          </p>
        )}

        {staleAnswers.length > 0 && (
          <Alert
            variant="destructive"
            data-testid="grading-stale-answer-warning"
            className="py-2"
          >
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              {staleAnswers
                .map((answer) => t('selection.staleAnswerWarning', { values: { option: answer } }))
                .join(' ')}
            </AlertDescription>
          </Alert>
        )}

        {isMultiple && (
          <div className={constants.CSS_CLASSES.INPUT_SPACING}>
            <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
              {t('selection.scoringLabel')}
            </Label>
            <Select
              value={grading?.set?.scoring ?? 'all'}
              onValueChange={(value) =>
                updateGrading({
                  set: { ...(grading?.set ?? { scoring: 'all' }), scoring: value as 'all' | 'partial' | 'any' },
                })
              }
              disabled={!isEditable}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('selection.scoring.all')}</SelectItem>
                <SelectItem value="partial">{t('selection.scoring.partial')}</SelectItem>
                <SelectItem value="any">{t('selection.scoring.any')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Text fields — accepted-answers repeater + normalization switches.
  // ---------------------------------------------------------------------------
  const renderText = () => {
    if (isManualText) {
      return (
        <p className="text-sm text-muted-foreground dark:text-gray-400">
          {t('text.manualNotice')}
        </p>
      );
    }

    const updateAnswer = (index: number, value: string) => {
      const next = [...acceptedAnswers];
      next[index] = value;
      updateGrading({ mode: 'text', acceptedAnswers: next });
    };
    const addAnswer = () => {
      updateGrading({ mode: 'text', acceptedAnswers: [...acceptedAnswers, ''] });
    };
    const removeAnswer = (index: number) => {
      const next = acceptedAnswers.filter((_, i) => i !== index);
      updateGrading({ mode: 'text', acceptedAnswers: next });
    };

    const acceptedAnswersError = Array.isArray(gradingErrors?.acceptedAnswers)
      ? gradingErrors.acceptedAnswers
      : undefined;
    const acceptedAnswersGlobalError =
      gradingErrors?.acceptedAnswers && !Array.isArray(gradingErrors.acceptedAnswers)
        ? gradingErrors.acceptedAnswers
        : undefined;

    return (
      <div className="space-y-3">
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
            {t('text.acceptedAnswersLabel')}
          </Label>
          <div className="space-y-2">
            {acceptedAnswers.length === 0 && (
              <p className="text-xs text-muted-foreground dark:text-gray-400">
                {t('text.noAcceptedAnswers')}
              </p>
            )}
            {acceptedAnswers.map((answer, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    value={answer}
                    disabled={!isEditable}
                    placeholder={t('text.answerPlaceholder', { values: { index: index + 1 } })}
                    onChange={(e) => updateAnswer(index, e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!isEditable}
                    onClick={() => removeAnswer(index)}
                    className="text-xs text-muted-foreground hover:text-destructive dark:text-gray-400 flex-shrink-0"
                  >
                    {t('text.removeAnswer')}
                  </button>
                </div>
                {acceptedAnswersError?.[index] && (
                  <p className="text-sm text-destructive dark:text-red-400">
                    {String(acceptedAnswersError[index].message)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={!isEditable}
            onClick={addAnswer}
            className="text-xs font-medium text-primary hover:underline"
          >
            + {t('text.addAnswer')}
          </button>
          {acceptedAnswersGlobalError && (
            <p className="text-sm text-destructive dark:text-red-400">
              {String(acceptedAnswersGlobalError.message)}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-foreground dark:text-gray-300">
            {t('text.caseSensitive')}
          </Label>
          <Switch
            checked={grading?.text?.caseSensitive ?? false}
            disabled={!isEditable}
            onCheckedChange={(checked) =>
              updateGrading({ text: { ...(grading?.text ?? {}), caseSensitive: checked } })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-foreground dark:text-gray-300">
            {t('text.ignorePunctuation')}
          </Label>
          <Switch
            checked={grading?.text?.ignorePunctuation ?? false}
            disabled={!isEditable}
            onCheckedChange={(checked) =>
              updateGrading({ text: { ...(grading?.text ?? {}), ignorePunctuation: checked } })
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-foreground dark:text-gray-300">
            {t('text.treatAsRegex')}
          </Label>
          <Switch
            checked={grading?.text?.regex ?? false}
            disabled={!isEditable}
            onCheckedChange={(checked) =>
              updateGrading({ text: { ...(grading?.text ?? {}), regex: checked } })
            }
          />
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Number field — target + tolerance, or min/max range.
  // ---------------------------------------------------------------------------
  const renderNumber = () => {
    const hasRange = grading?.numeric?.min !== undefined || grading?.numeric?.max !== undefined;
    // Real bounds always win over the local override — otherwise a stale
    // `numberModeOverride: 'target'` (e.g. from an earlier click in this same
    // session) could hide a range a collaborator just set concurrently.
    // `numberModeOverride` only matters for the ambiguous "range chosen but
    // both bounds still empty" state, which hasRange can't distinguish from
    // "target".
    const rangeMode = hasRange ? 'range' : (numberModeOverride ?? 'target');
    const toleranceType =
      grading?.numeric?.tolerance !== undefined
        ? 'absolute'
        : grading?.numeric?.tolerancePercent !== undefined
          ? 'percent'
          : 'none';

    return (
      <div className="space-y-3">
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('number.modeLabel')}</Label>
          <Select
            // Forces a fresh mount the moment real Y.js data first arrives (grading
            // flips from undefined to defined). Without this, the *same* Select
            // instance's controlled `value` jumps target -> range on that first data
            // render — a prop change, not a click — and Radix's hidden native
            // <select> mirror (kept in sync for accessibility/native-form fallback)
            // fires a real `change` event echoing the stale pre-data value back
            // through `onValueChange`, which then calls `updateGrading` and wipes
            // `numeric` right after it was correctly populated. A remount never
            // exhibits this because the fresh instance's first value is already
            // correct — nothing "changes" for the mirror to echo.
            key={grading === undefined ? 'pending' : 'ready'}
            value={rangeMode}
            disabled={!isEditable}
            onValueChange={(value) => {
              setNumberModeOverride(value as 'target' | 'range');
              if (value === 'range') {
                updateGrading({
                  mode: 'numeric',
                  numeric: { min: grading?.numeric?.min, max: grading?.numeric?.max },
                });
              } else {
                updateGrading({
                  mode: 'numeric',
                  numeric: {
                    tolerance: grading?.numeric?.tolerance,
                    tolerancePercent: grading?.numeric?.tolerancePercent,
                  },
                });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="target">{t('number.modeTarget')}</SelectItem>
              <SelectItem value="range">{t('number.modeRange')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rangeMode === 'target' ? (
          <>
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('number.targetLabel')}</Label>
              <Input
                type="number"
                disabled={!isEditable}
                value={acceptedAnswers[0] ?? ''}
                onChange={(e) =>
                  // A blank target must stay an empty answer list, not `['']` —
                  // the engine's gradeNumeric casts with `Number(value)`, and
                  // `Number('')` is `0`, which would mark a genuine submitted 0
                  // as correct even though no target was ever set.
                  updateGrading({
                    mode: 'numeric',
                    acceptedAnswers: e.target.value === '' ? [] : [e.target.value],
                  })
                }
              />
            </div>
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {t('number.toleranceTypeLabel')}
              </Label>
              <Select
                value={toleranceType}
                disabled={!isEditable}
                onValueChange={(value) => {
                  if (value === 'none') {
                    updateGrading({ numeric: { tolerance: undefined, tolerancePercent: undefined } });
                  } else if (value === 'absolute') {
                    updateGrading({
                      numeric: { tolerance: grading?.numeric?.tolerance ?? 0, tolerancePercent: undefined },
                    });
                  } else {
                    updateGrading({
                      numeric: { tolerancePercent: grading?.numeric?.tolerancePercent ?? 0, tolerance: undefined },
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('number.toleranceNone')}</SelectItem>
                  <SelectItem value="absolute">{t('number.toleranceAbsolute')}</SelectItem>
                  <SelectItem value="percent">{t('number.tolerancePercent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {toleranceType !== 'none' && (
              <div className={constants.CSS_CLASSES.INPUT_SPACING}>
                <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                  {t('number.toleranceValueLabel')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  disabled={!isEditable}
                  value={
                    toleranceType === 'absolute'
                      ? grading?.numeric?.tolerance ?? ''
                      : grading?.numeric?.tolerancePercent ?? ''
                  }
                  onChange={(e) => {
                    const num = e.target.value === '' ? 0 : Number(e.target.value);
                    updateGrading({
                      numeric:
                        toleranceType === 'absolute'
                          ? { tolerance: num, tolerancePercent: undefined }
                          : { tolerancePercent: num, tolerance: undefined },
                    });
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('number.minLabel')}</Label>
              <Input
                type="number"
                disabled={!isEditable}
                value={grading?.numeric?.min ?? ''}
                onChange={(e) =>
                  updateGrading({
                    numeric: {
                      ...(grading?.numeric ?? {}),
                      min: e.target.value === '' ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('number.maxLabel')}</Label>
              <Input
                type="number"
                disabled={!isEditable}
                value={grading?.numeric?.max ?? ''}
                onChange={(e) =>
                  updateGrading({
                    numeric: {
                      ...(grading?.numeric ?? {}),
                      max: e.target.value === '' ? undefined : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Date field — exact date only.
  //
  // A date-range picker was dropped from this ticket's scope: the grading engine
  // (Story 02, apps/backend/src/services/quiz/gradingEngine.ts) only implements
  // exact-string matching for `mode: 'exact'` today — `gradeNumeric` casts the
  // submitted value with `Number(value)`, which is NaN for a "YYYY-MM-DD" string,
  // so a range stored under `mode: 'numeric'` would silently 0-score every
  // submission once Story 06 wires grading into submitResponse. Shipping a picker
  // for a key the engine can't grade is exactly what `gradingFormSchema`'s
  // regex/points checks exist to prevent elsewhere — so it's not offered here
  // either, until the engine gains real date-range support.
  // ---------------------------------------------------------------------------
  const renderDate = () => (
    <div className={constants.CSS_CLASSES.INPUT_SPACING}>
      <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('date.targetLabel')}</Label>
      <Input
        type="date"
        disabled={!isEditable}
        value={acceptedAnswers[0] ?? ''}
        onChange={(e) =>
          updateGrading({
            mode: 'exact',
            acceptedAnswers: e.target.value === '' ? [] : [e.target.value],
          })
        }
      />
    </div>
  );

  return (
    <div className={constants.CSS_CLASSES.SECTION_SPACING} data-testid="grading-settings-section">
      <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>{t('sectionTitle')}</h4>

      {isSelection && renderSelection()}
      {isText && renderText()}
      {isNumber && renderNumber()}
      {isDate && renderDate()}

      {!isManualText && pointValueInput}

      {feedbackSection}
    </div>
  );
};

export default GradingSettings;
