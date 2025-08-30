import React from 'react';
import { Control } from 'react-hook-form';
import { FormField, FieldType } from '@dculus/types';
import { TextInputSettings } from './TextInputSettings';
import { PrefixSettings } from './PrefixSettings';
import { OptionsSettings } from './OptionsSettings';
import { MultipleSelectionSettings } from './MultipleSelectionSettings';
import { NumberRangeSettings } from './NumberRangeSettings';
import { DateRangeSettings } from './DateRangeSettings';
import { CharacterLimitSettings } from './CharacterLimitSettings';

interface FieldTypeSpecificSettingsProps {
  field: FormField;
  control: Control<any>;
  errors: Record<string, any>;
  isConnected: boolean;
  options: string[];
  addOption: () => void;
  updateOption: (index: number, value: string) => void;
  removeOption: (index: number) => void;
}

export const FieldTypeSpecificSettings: React.FC<FieldTypeSpecificSettingsProps> = ({
  field,
  control,
  errors,
  isConnected,
  options,
  addOption,
  updateOption,
  removeOption
}) => {
  switch (field.type) {
    case FieldType.TEXT_INPUT_FIELD:
      return (
        <>
          <TextInputSettings control={control} errors={errors} isConnected={isConnected} />
          <PrefixSettings control={control} errors={errors} isConnected={isConnected} />
          <CharacterLimitSettings control={control} errors={errors} isConnected={isConnected} />
        </>
      );

    case FieldType.TEXT_AREA_FIELD:
      return (
        <>
          <TextInputSettings control={control} errors={errors} isConnected={isConnected} />
          <PrefixSettings control={control} errors={errors} isConnected={isConnected} />
          <CharacterLimitSettings control={control} errors={errors} isConnected={isConnected} />
        </>
      );

    case FieldType.EMAIL_FIELD:
      return <TextInputSettings control={control} errors={errors} isConnected={isConnected} />;

    case FieldType.NUMBER_FIELD:
      return (
        <>
          <TextInputSettings control={control} errors={errors} isConnected={isConnected} />
          <PrefixSettings control={control} errors={errors} isConnected={isConnected} />
          <NumberRangeSettings control={control} errors={errors} isConnected={isConnected} />
        </>
      );

    case FieldType.SELECT_FIELD:
      return (
        <>
          <OptionsSettings
            options={options}
            isConnected={isConnected}
            errors={errors}
            addOption={addOption}
            updateOption={updateOption}
            removeOption={removeOption}
          />
          <MultipleSelectionSettings control={control} isConnected={isConnected} />
        </>
      );

    case FieldType.RADIO_FIELD:
      return (
        <OptionsSettings
          options={options}
          isConnected={isConnected}
          errors={errors}
          addOption={addOption}
          updateOption={updateOption}
          removeOption={removeOption}
        />
      );

    case FieldType.CHECKBOX_FIELD:
      return (
        <OptionsSettings
          options={options}
          isConnected={isConnected}
          errors={errors}
          addOption={addOption}
          updateOption={updateOption}
          removeOption={removeOption}
        />
      );

    case FieldType.DATE_FIELD:
      return <DateRangeSettings control={control} errors={errors} isConnected={isConnected} />;

    default:
      return null;
  }
};