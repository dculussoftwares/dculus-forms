import React from 'react';
import { FormInputField } from './FormInputField';
import { useFieldSettingsConstants } from './useFieldSettingsConstants';
import { BaseFieldSettingsProps } from './types';

interface RangeSettingsProps extends BaseFieldSettingsProps {
  /** Type of range input */
  rangeType: 'number' | 'date';
  /** Field name for minimum value */
  minFieldName: string;
  /** Field name for maximum value */
  maxFieldName: string;
  /** Section title */
  title: string;
  /** Minimum label */
  minLabel: string;
  /** Maximum label */
  maxLabel: string;
  /** Minimum placeholder */
  minPlaceholder?: string;
  /** Maximum placeholder */
  maxPlaceholder?: string;
  /** Whether to use grid layout (side by side) */
  useGridLayout?: boolean;
}

/**
 * Reusable range settings component for min/max value pairs
 * Abstracts common pattern between NumberRangeSettings and DateRangeSettings
 */
export const RangeSettings: React.FC<RangeSettingsProps> = ({
  control,
  errors,
  isConnected,
  rangeType,
  minFieldName,
  maxFieldName,
  title,
  minLabel,
  maxLabel,
  minPlaceholder,
  maxPlaceholder,
  useGridLayout = false,
}) => {
  const constants = useFieldSettingsConstants();
  const containerClass = useGridLayout 
    ? "grid grid-cols-2 gap-3"
    : "space-y-3";

  return (
    <div className={constants.CSS_CLASSES.SECTION_SPACING}>
      <h4 className={constants.CSS_CLASSES.SECTION_TITLE}>
        {title}
      </h4>
      
      <div className={containerClass}>
        <FormInputField
          name={minFieldName}
          label={minLabel}
          placeholder={minPlaceholder}
          type={rangeType}
          control={control}
          error={errors[minFieldName]}
          disabled={!isConnected}
        />
        
        <FormInputField
          name={maxFieldName}
          label={maxLabel}
          placeholder={maxPlaceholder}
          type={rangeType}
          control={control}
          error={errors[maxFieldName]}
          disabled={!isConnected}
        />
      </div>
    </div>
  );
};