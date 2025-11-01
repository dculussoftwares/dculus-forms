import React from 'react';
import { RangeSettings } from './RangeSettings';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { BaseFieldSettingsProps } from './types';

/**
 * Settings component for number field range constraints (min/max values)
 * Used by NUMBER field type
 */
export const NumberRangeSettings: React.FC<BaseFieldSettingsProps> = (props) => {
  const constants = useFieldSettingsConstants();
  
  return (
    <RangeSettings
      {...props}
      rangeType="number"
      minFieldName="min"
      maxFieldName="max"
      title={constants.SECTION_TITLES.NUMBER_RANGE}
      minLabel={constants.LABELS.MINIMUM}
      maxLabel={constants.LABELS.MAXIMUM}
      minPlaceholder={constants.PLACEHOLDERS.MIN_PLACEHOLDER}
      maxPlaceholder={constants.PLACEHOLDERS.MAX_PLACEHOLDER}
      useGridLayout={true}
    />
  );
};