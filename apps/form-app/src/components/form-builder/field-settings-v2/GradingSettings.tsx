import React, { useState } from 'react';
import type { UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import {
  FieldType,
  FIELD_TYPE_DEFAULT_GRADING_MODE,
  isGradableFieldType,
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

/** epoch-ms <-> "YYYY-MM-DD" round trip for date-range grading, done in UTC so it
 * never drifts a day depending on the author's local timezone. */
const msToDateInputValue = (ms?: number): string => {
  if (ms === undefined || Number.isNaN(ms)) return '';
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate()
  ).padStart(2, '0')}`;
};
const dateInputValueToMs = (value: string): number | undefined => {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return Date.UTC(y, m - 1, d);
};

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
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  errors?: FieldErrors<any>;
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

  const grading: FieldGrading | undefined = watch('grading');
  const gradingErrors = (errors as any)?.grading;

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
    const rangeMode = hasRange ? 'range' : 'target';
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
            value={rangeMode}
            disabled={!isEditable}
            onValueChange={(value) => {
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
                  updateGrading({ mode: 'numeric', acceptedAnswers: [e.target.value] })
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
  // Date field — exact date, or a range.
  //
  // NOTE: the grading engine (Story 02, apps/backend/src/services/quiz/gradingEngine.ts)
  // only implements exact-string matching for `mode: 'exact'` today. The range option
  // below stores boundaries in `grading.numeric.min/max` (epoch ms, matching
  // NumericMatchOptions' number type) with `mode: 'numeric'` so the shape is ready for
  // the engine to grade — an authoring-side range picker without a grading path would
  // silently 0-score every range question, and that's exactly the ambiguity the
  // regex/points checks in `gradingFormSchema` exist to prevent.
  // ---------------------------------------------------------------------------
  const renderDate = () => {
    const isRange = grading?.mode === 'numeric';

    return (
      <div className="space-y-3">
        <div className={constants.CSS_CLASSES.INPUT_SPACING}>
          <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('date.modeLabel')}</Label>
          <Select
            value={isRange ? 'range' : 'exact'}
            disabled={!isEditable}
            onValueChange={(value) => {
              if (value === 'range') {
                updateGrading({ mode: 'numeric', acceptedAnswers: [], numeric: {} });
              } else {
                updateGrading({ mode: 'exact', numeric: undefined });
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exact">{t('date.modeExact')}</SelectItem>
              <SelectItem value="range">{t('date.modeRange')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isRange ? (
          <div className="grid grid-cols-2 gap-3">
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('date.fromLabel')}</Label>
              <Input
                type="date"
                disabled={!isEditable}
                value={msToDateInputValue(grading?.numeric?.min)}
                onChange={(e) =>
                  updateGrading({
                    numeric: {
                      ...(grading?.numeric ?? {}),
                      min: dateInputValueToMs(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className={constants.CSS_CLASSES.INPUT_SPACING}>
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('date.toLabel')}</Label>
              <Input
                type="date"
                disabled={!isEditable}
                value={msToDateInputValue(grading?.numeric?.max)}
                onChange={(e) =>
                  updateGrading({
                    numeric: {
                      ...(grading?.numeric ?? {}),
                      max: dateInputValueToMs(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        ) : (
          <div className={constants.CSS_CLASSES.INPUT_SPACING}>
            <Label className={constants.CSS_CLASSES.LABEL_STYLE}>{t('date.targetLabel')}</Label>
            <Input
              type="date"
              disabled={!isEditable}
              value={acceptedAnswers[0] ?? ''}
              onChange={(e) => updateGrading({ mode: 'exact', acceptedAnswers: [e.target.value] })}
            />
          </div>
        )}
      </div>
    );
  };

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
