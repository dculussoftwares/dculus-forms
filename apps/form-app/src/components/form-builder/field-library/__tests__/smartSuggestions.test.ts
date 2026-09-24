import { FieldType, FormField } from '@dculus/types';
import { getSmartFieldSuggestions } from '../smartSuggestions';
import { FieldTypeConfig } from '../../FieldTypesPanel';

const mockConfigs: FieldTypeConfig[] = [
  { type: FieldType.TEXT_INPUT_FIELD, label: 'Short Text', description: '', icon: null, category: 'input' },
  { type: FieldType.TEXT_AREA_FIELD, label: 'Long Text', description: '', icon: null, category: 'input' },
  { type: FieldType.EMAIL_FIELD, label: 'Email', description: '', icon: null, category: 'input' },
  { type: FieldType.PHONE_NUMBER_FIELD, label: 'Phone', description: '', icon: null, category: 'input' },
  { type: FieldType.NUMBER_FIELD, label: 'Number', description: '', icon: null, category: 'input' },
  { type: FieldType.RADIO_FIELD, label: 'Radio', description: '', icon: null, category: 'choice' },
  { type: FieldType.SELECT_FIELD, label: 'Dropdown', description: '', icon: null, category: 'choice' },
  { type: FieldType.CHECKBOX_FIELD, label: 'Checkbox', description: '', icon: null, category: 'choice' },
  { type: FieldType.DATE_FIELD, label: 'Date', description: '', icon: null, category: 'input' },
];

describe('getSmartFieldSuggestions', () => {
  it('returns default starter fields for an empty page', () => {
    const suggestions = getSmartFieldSuggestions([], mockConfigs, false);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain(FieldType.TEXT_INPUT_FIELD);
    expect(types).toContain(FieldType.EMAIL_FIELD);
    expect(types).toContain(FieldType.RADIO_FIELD);
  });

  it('prioritizes choice and numeric fields in quiz mode', () => {
    const suggestions = getSmartFieldSuggestions([], mockConfigs, true);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain(FieldType.RADIO_FIELD);
    expect(types).toContain(FieldType.SELECT_FIELD);
    expect(types).toContain(FieldType.CHECKBOX_FIELD);
    expect(types).toContain(FieldType.NUMBER_FIELD);
  });

  it('suggests email when page has a text input field but no email field', () => {
    const fields = [{ id: 'f1', type: FieldType.TEXT_INPUT_FIELD }] as FormField[];
    const suggestions = getSmartFieldSuggestions(fields, mockConfigs, false);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain(FieldType.EMAIL_FIELD);
  });

  it('suggests phone or choice fields when email already exists', () => {
    const fields = [
      { id: 'f1', type: FieldType.TEXT_INPUT_FIELD },
      { id: 'f2', type: FieldType.EMAIL_FIELD },
    ] as FormField[];
    const suggestions = getSmartFieldSuggestions(fields, mockConfigs, false);
    const types = suggestions.map((s) => s.type);
    expect(types).toContain(FieldType.PHONE_NUMBER_FIELD);
  });
});
