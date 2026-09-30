import { FormField, FillableFormField, FieldType, isLayoutField } from '@dculus/types';

export const isFillableFormField = (field: FormField): field is FillableFormField =>
    !isLayoutField(field) &&
    (field instanceof FillableFormField || (field as any).label !== undefined || field.type !== FieldType.FORM_FIELD);

export const getFieldLabel = (field: FormField): string =>
    isFillableFormField(field) ? (field as FillableFormField).label || 'Untitled Field' : 'Basic Field';

export const isFieldRequired = (field: FormField): boolean =>
    isFillableFormField(field) ? (field as FillableFormField).validation?.required || false : false;