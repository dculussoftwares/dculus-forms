import React from 'react';
import {
  RatingField,
  RATING_MAX_VALUE_MAX,
  RATING_MAX_VALUE_MIN,
  isNpsRatingConfig,
  normalizeRatingConfig,
  type RatingFieldFormData,
} from '@dculus/types';
import { Controller, useWatch, type FieldErrors } from 'react-hook-form';
import { Settings } from 'lucide-react';
import {
  Label,
  Checkbox,
  ToggleGroup,
  ToggleGroupItem,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@dculus/ui';
import { useFieldEditor, useTranslation } from '../../../hooks';
import {
  ValidationSummary,
  FieldSettingsHeader,
  FormInputField,
  ErrorMessage,
  useFieldSettingsConstants,
} from '../field-settings';

interface RatingFieldSettingsProps {
  field: RatingField | null;
  isConnected: boolean;
  isReadOnly?: boolean;
  onUpdate?: (updates: Record<string, any>, fieldId: string) => void;
  onFieldSwitch?: () => void;
}

const MAX_VALUE_OPTIONS = Array.from(
  { length: RATING_MAX_VALUE_MAX - RATING_MAX_VALUE_MIN + 1 },
  (_, i) => RATING_MAX_VALUE_MIN + i
);

const toggleItemClass =
  'h-8 flex-1 rounded-md border border-input px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground';

/**
 * Settings for RATING_FIELD: style (stars / numbers), start value (numbers only),
 * highest value (3-10) and the optional low/high end labels.
 * Stars always run 1..max, so choosing stars pins the start value to 1.
 */
export const RatingFieldSettings: React.FC<RatingFieldSettingsProps> = ({
  field,
  isConnected,
  isReadOnly = false,
  onUpdate,
  onFieldSwitch: _onFieldSwitch,
}) => {
  const constants = useFieldSettingsConstants();
  const { t } = useTranslation('fieldSettingsConstants');
  const isEditable = isConnected && !isReadOnly;
  const {
    form,
    errors: formErrors,
    saveStatus,
    handleSave,
  } = useFieldEditor({
    field,
    enabled: isEditable && !!onUpdate,
    onSave: (updates, fieldId) => onUpdate?.(updates, fieldId),
  });

  const { control, setValue } = form;
  const errors = formErrors as FieldErrors<RatingFieldFormData>;

  const watched = useWatch({ control }) as Partial<RatingFieldFormData>;
  const config = normalizeRatingConfig(watched ?? {});
  const isScale = config.ratingStyle === 'scale';

  if (!field) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground dark:text-gray-400">
        <div className="text-center">
          <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{constants.INFO_MESSAGES.SELECT_FIELD_TO_EDIT}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <FieldSettingsHeader field={field} saveStatus={saveStatus} isConnected={isConnected} />

      <div className="flex-1 overflow-y-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-4 space-y-6"
        >
          {/* Basic Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.BASIC_SETTINGS}
            </h4>

            <FormInputField
              name="label"
              label={constants.LABELS.LABEL}
              placeholder={constants.PLACEHOLDERS.FIELD_LABEL}
              multiline={true}
              rows={2}
              control={control}
              error={errors.label}
              disabled={!isEditable}
            />

            <FormInputField
              name="hint"
              label={constants.LABELS.HELP_TEXT}
              placeholder={constants.PLACEHOLDERS.HELP_TEXT}
              multiline={true}
              rows={2}
              control={control}
              error={errors.hint}
              disabled={!isEditable}
            />
          </div>

          {/* Rating Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {t('sectionTitles.ratingSettings')}
            </h4>

            {/* Style */}
            <div className={constants.CSS_CLASSES.INPUT_SPACING} data-testid="rating-style-setting">
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {t('labels.ratingStyle')}
              </Label>
              <Controller
                name="ratingStyle"
                control={control}
                render={({ field: cf }) => (
                  <ToggleGroup
                    type="single"
                    value={config.ratingStyle}
                    onValueChange={(next) => {
                      // A radio-like group: ignore the empty value Radix emits on re-click
                      if (!next) return;
                      cf.onChange(next);
                      // Stars always start at 1
                      if (next === 'stars') setValue('minValue', 1, { shouldDirty: true });
                    }}
                    disabled={!isEditable}
                    className="w-full gap-2"
                  >
                    <ToggleGroupItem value="stars" className={toggleItemClass} data-testid="rating-style-stars">
                      {t('ratingStyle.stars')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="scale" className={toggleItemClass} data-testid="rating-style-scale">
                      {t('ratingStyle.scale')}
                    </ToggleGroupItem>
                  </ToggleGroup>
                )}
              />
            </div>

            {/* Start value — number scale only */}
            {isScale && (
              <div className={constants.CSS_CLASSES.INPUT_SPACING} data-testid="rating-start-setting">
                <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                  {t('labels.ratingStartValue')}
                </Label>
                <Controller
                  name="minValue"
                  control={control}
                  render={({ field: cf }) => (
                    <ToggleGroup
                      type="single"
                      value={String(config.minValue)}
                      onValueChange={(next) => {
                        if (!next) return;
                        cf.onChange(Number(next));
                      }}
                      disabled={!isEditable}
                      className="w-full gap-2"
                    >
                      <ToggleGroupItem value="0" className={toggleItemClass} data-testid="rating-start-0">
                        0
                      </ToggleGroupItem>
                      <ToggleGroupItem value="1" className={toggleItemClass} data-testid="rating-start-1">
                        1
                      </ToggleGroupItem>
                    </ToggleGroup>
                  )}
                />
              </div>
            )}

            {/* Highest value */}
            <div className={constants.CSS_CLASSES.INPUT_SPACING} data-testid="rating-max-setting">
              <Label className={constants.CSS_CLASSES.LABEL_STYLE}>
                {t('labels.ratingMaxValue')}
              </Label>
              <Controller
                name="maxValue"
                control={control}
                render={({ field: cf }) => (
                  <Select
                    value={String(config.maxValue)}
                    onValueChange={(next) => cf.onChange(Number(next))}
                    disabled={!isEditable}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAX_VALUE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <ErrorMessage error={errors.maxValue} />
            </div>

            {isNpsRatingConfig(config) && (
              <p className="text-xs text-muted-foreground" data-testid="rating-nps-note">
                {t('ratingSettings.npsNote')}
              </p>
            )}

            {/* End labels */}
            <FormInputField
              name="lowLabel"
              label={t('labels.ratingLowLabel')}
              placeholder={t('placeholders.ratingLowLabel')}
              control={control}
              error={errors.lowLabel}
              disabled={!isEditable}
            />
            <FormInputField
              name="highLabel"
              label={t('labels.ratingHighLabel')}
              placeholder={t('placeholders.ratingHighLabel')}
              control={control}
              error={errors.highLabel}
              disabled={!isEditable}
            />
          </div>

          {/* Validation Settings */}
          <div className={constants.CSS_CLASSES.SECTION_SPACING}>
            <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
              {constants.SECTION_TITLES.VALIDATION}
            </h4>

            <div className="flex items-center space-x-2">
              <Controller
                name="required"
                control={control}
                render={({ field: controllerField }) => (
                  <Checkbox
                    id="field-required"
                    checked={controllerField.value || false}
                    onCheckedChange={controllerField.onChange}
                    disabled={!isEditable}
                  />
                )}
              />
              <Label htmlFor="field-required" className={constants.CSS_CLASSES.LABEL_STYLE}>
                {constants.LABELS.REQUIRED_FIELD}
              </Label>
            </div>
          </div>

          <div className="pb-4"></div>

          <ValidationSummary errors={formErrors} />
        </form>
      </div>
    </div>
  );
};

export default RatingFieldSettings;
