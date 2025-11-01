import React from 'react';
import { RangeSettings } from './RangeSettings';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for date field range constraints (min/max dates)
 * Used by DATE field type
 */
export const DateRangeSettings: React.FC<BaseFieldSettingsProps> = (props) => {
  const constants = useFieldSettingsConstants();
  
  return (
    <RangeSettings
      {...props}
      rangeType="date"
      minFieldName="minDate"
      maxFieldName="maxDate"
      title={constants.SECTION_TITLES.DATE_RANGE}
      minLabel={constants.LABELS.MINIMUM_DATE}
      maxLabel={constants.LABELS.MAXIMUM_DATE}
      useGridLayout={false}
    />
  );
};