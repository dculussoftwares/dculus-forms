import { FieldType, FormField } from '@dculus/types';
import { FieldTypeConfig } from '../FieldTypesPanel';

/**
 * Returns 3-4 smart field suggestions based on the current page's fields and quiz mode.
 */
export function getSmartFieldSuggestions(
  currentFields: FormField[] = [],
  allFieldConfigs: FieldTypeConfig[] = [],
  isQuizMode = false
): FieldTypeConfig[] {
  const existingTypes = new Set(currentFields.map((f) => f.type));

  let recommendedTypes: FieldType[] = [];

  if (isQuizMode) {
    recommendedTypes = [
      FieldType.RADIO_FIELD,
      FieldType.SELECT_FIELD,
      FieldType.CHECKBOX_FIELD,
      FieldType.NUMBER_FIELD,
    ];
  } else if (currentFields.length === 0) {
    recommendedTypes = [
      FieldType.TEXT_INPUT_FIELD,
      FieldType.EMAIL_FIELD,
      FieldType.RADIO_FIELD,
      FieldType.SELECT_FIELD,
    ];
  } else if (!existingTypes.has(FieldType.EMAIL_FIELD)) {
    recommendedTypes = [
      FieldType.EMAIL_FIELD,
      FieldType.PHONE_NUMBER_FIELD,
      FieldType.RADIO_FIELD,
      FieldType.TEXT_AREA_FIELD,
    ];
  } else if (!existingTypes.has(FieldType.PHONE_NUMBER_FIELD)) {
    recommendedTypes = [
      FieldType.PHONE_NUMBER_FIELD,
      FieldType.RADIO_FIELD,
      FieldType.SELECT_FIELD,
      FieldType.DATE_FIELD,
    ];
  } else {
    recommendedTypes = [
      FieldType.RADIO_FIELD,
      FieldType.TEXT_AREA_FIELD,
      FieldType.SELECT_FIELD,
      FieldType.DATE_FIELD,
    ];
  }

  const configMap = new Map(allFieldConfigs.map((cfg) => [cfg.type, cfg]));
  return recommendedTypes
    .map((type) => configMap.get(type))
    .filter((cfg): cfg is FieldTypeConfig => Boolean(cfg));
}
