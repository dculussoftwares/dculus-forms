import React from 'react';
import { RangeSettings } from './RangeSettings';
import { FIELD_SETTINGS_CONSTANTS } from './constants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for date field range constraints (min/max dates)
 * Used by DATE field type
 */
export const DateRangeSettings: React.FC<BaseFieldSettingsProps> = (props) => {
  return (
    <RangeSettings
      {...props}
      rangeType="date"
      minFieldName="minDate"
      maxFieldName="maxDate"
      title={FIELD_SETTINGS_CONSTANTS.SECTION_TITLES.DATE_RANGE}
      minLabel={FIELD_SETTINGS_CONSTANTS.LABELS.MINIMUM_DATE}
      maxLabel={FIELD_SETTINGS_CONSTANTS.LABELS.MAXIMUM_DATE}
      useGridLayout={false}
    />
  );
};