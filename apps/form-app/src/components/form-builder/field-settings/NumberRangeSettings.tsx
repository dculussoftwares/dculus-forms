import React from 'react';
import { RangeSettings } from './RangeSettings';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for number field range constraints (min/max values)
 * Used by NUMBER field type
 */
export const NumberRangeSettings: React.FC<BaseFieldSettingsProps> = (props) => {
  return (
    <RangeSettings
      {...props}
      rangeType="number"
      minFieldName="min"
      maxFieldName="max"
      title={FIELD_SETTINGS_CONSTANTS.SECTION_TITLES.NUMBER_RANGE}
      minLabel={FIELD_SETTINGS_CONSTANTS.LABELS.MINIMUM}
      maxLabel={FIELD_SETTINGS_CONSTANTS.LABELS.MAXIMUM}
      minPlaceholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.MIN_PLACEHOLDER}
      maxPlaceholder={FIELD_SETTINGS_CONSTANTS.PLACEHOLDERS.MAX_PLACEHOLDER}
      useGridLayout={true}
    />
  );
};