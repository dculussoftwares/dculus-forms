import { FieldType } from '@dculus/types';
import {
  analyticsRegistry,
  getAnalyticsComponent,
  getAnalyticsDataKey,
  getAnalyticsIcon,
  getSupportedFieldTypes,
  hasAnalyticsSupport,
} from '../analyticsRegistry';
import { TextFieldAnalytics } from '../../TextFieldAnalytics';
import { NumberFieldAnalytics } from '../../NumberFieldAnalytics';
import { SelectionFieldAnalytics } from '../../SelectionFieldAnalytics';
import { CheckboxFieldAnalytics } from '../../CheckboxFieldAnalytics';
import { DateFieldAnalytics } from '../../DateFieldAnalytics';
import { EmailFieldAnalytics } from '../../EmailFieldAnalytics';
import {
  BarChart3,
  Calendar,
  CheckSquare,
  CircleDot,
  FileText,
  Hash,
  ListOrdered,
  Mail,
} from 'lucide-react';

describe('analyticsRegistry', () => {
  const registryExpectations = [
    {
      fieldType: FieldType.TEXT_INPUT_FIELD,
      component: TextFieldAnalytics,
      dataKey: 'textAnalytics',
      icon: FileText,
    },
    {
      fieldType: FieldType.TEXT_AREA_FIELD,
      component: TextFieldAnalytics,
      dataKey: 'textAnalytics',
      icon: FileText,
    },
    {
      fieldType: FieldType.NUMBER_FIELD,
      component: NumberFieldAnalytics,
      dataKey: 'numberAnalytics',
      icon: Hash,
    },
    {
      fieldType: FieldType.SELECT_FIELD,
      component: SelectionFieldAnalytics,
      dataKey: 'selectionAnalytics',
      icon: ListOrdered,
    },
    {
      fieldType: FieldType.RADIO_FIELD,
      component: SelectionFieldAnalytics,
      dataKey: 'selectionAnalytics',
      icon: CircleDot,
    },
    {
      fieldType: FieldType.CHECKBOX_FIELD,
      component: CheckboxFieldAnalytics,
      dataKey: 'checkboxAnalytics',
      icon: CheckSquare,
    },
    {
      fieldType: FieldType.DATE_FIELD,
      component: DateFieldAnalytics,
      dataKey: 'dateAnalytics',
      icon: Calendar,
    },
    {
      fieldType: FieldType.EMAIL_FIELD,
      component: EmailFieldAnalytics,
      dataKey: 'emailAnalytics',
      icon: Mail,
    },
  ] as const;

  test('maps each supported field type to the correct metadata', () => {
    registryExpectations.forEach(({ fieldType, component, dataKey, icon }) => {
      expect(hasAnalyticsSupport(fieldType)).toBe(true);
      expect(analyticsRegistry[fieldType]).toMatchObject({
        component,
        dataKey,
        icon,
      });
      expect(getAnalyticsComponent(fieldType)).toBe(component);
      expect(getAnalyticsDataKey(fieldType)).toBe(dataKey);
      expect(getAnalyticsIcon(fieldType)).toBe(icon);
    });
  });

  test('lists all supported field types', () => {
    const expectedTypes = registryExpectations.map(entry => entry.fieldType).sort();
    const actualTypes = getSupportedFieldTypes().sort();

    expect(actualTypes).toEqual(expectedTypes);
  });

  test('falls back gracefully for unsupported field types', () => {
    const unsupportedFieldType = 'unsupported_field_type' as FieldType;

    expect(hasAnalyticsSupport(unsupportedFieldType)).toBe(false);
    expect(getAnalyticsComponent(unsupportedFieldType)).toBeUndefined();
    expect(getAnalyticsDataKey(unsupportedFieldType)).toBeUndefined();
    expect(getAnalyticsIcon(unsupportedFieldType)).toBe(BarChart3);
  });
});
