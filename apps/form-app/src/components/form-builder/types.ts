import {
    Type,
    Mail,
    Hash,
    FileText,
    Check,
    Radio,
    Calendar,
    LucideIcon
} from 'lucide-react';
import { FieldType } from '@dculus/types';

export interface FieldTypeConfig {
    type: FieldType;
    label: string;
    icon: LucideIcon;
    description: string;
    category: string;
}

export const fieldTypes: FieldTypeConfig[] = [
    { type: FieldType.TEXT_INPUT_FIELD, label: 'Short Text', icon: Type, description: 'Perfect for names, emails, and short answers', category: 'Input' },
    { type: FieldType.TEXT_AREA_FIELD, label: 'Long Text', icon: FileText, description: 'Great for feedback, comments, and detailed responses', category: 'Input' },
    { type: FieldType.EMAIL_FIELD, label: 'Email', icon: Mail, description: 'Collect and validate email addresses', category: 'Input' },
    { type: FieldType.NUMBER_FIELD, label: 'Number', icon: Hash, description: 'For numeric values, quantities, and calculations', category: 'Input' },
    { type: FieldType.SELECT_FIELD, label: 'Dropdown', icon: Check, description: 'Let people choose from a list of options', category: 'Choice' },
    { type: FieldType.RADIO_FIELD, label: 'Multiple Choice', icon: Radio, description: 'Single selection from multiple options', category: 'Choice' },
    { type: FieldType.CHECKBOX_FIELD, label: 'Checkboxes', icon: Check, description: 'Allow multiple selections', category: 'Choice' },
    { type: FieldType.DATE_FIELD, label: 'Date', icon: Calendar, description: 'Pick a date from a calendar', category: 'Input' },
];

export const fieldCategories = {
    Input: fieldTypes.filter(f => f.category === 'Input'),
    Choice: fieldTypes.filter(f => f.category === 'Choice')
};