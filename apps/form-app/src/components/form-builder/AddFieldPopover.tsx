import React, { useState } from 'react';
import {
    Button,
    TypographyP,
    Popover,
    PopoverTrigger,
    PopoverContent
} from '@dculus/ui';
import { Plus } from 'lucide-react';
import { FieldTypeConfig } from './types';
import { useTranslation } from '../../hooks/useTranslation';
import { FieldType } from '@dculus/types';
import {
    Type,
    FileText,
    Mail,
    Hash,
    Check,
    Radio,
    Calendar
} from 'lucide-react';

const getFieldTypesConfig = (t: (key: string) => string): FieldTypeConfig[] => [
    {
        type: FieldType.TEXT_INPUT_FIELD,
        label: t('fieldTypes.shortText.label'),
        description: t('fieldTypes.shortText.description'),
        icon: Type,
        category: 'Input'
    },
    {
        type: FieldType.TEXT_AREA_FIELD,
        label: t('fieldTypes.longText.label'),
        description: t('fieldTypes.longText.description'),
        icon: FileText,
        category: 'Input'
    },
    {
        type: FieldType.EMAIL_FIELD,
        label: t('fieldTypes.email.label'),
        description: t('fieldTypes.email.description'),
        icon: Mail,
        category: 'Input'
    },
    {
        type: FieldType.NUMBER_FIELD,
        label: t('fieldTypes.number.label'),
        description: t('fieldTypes.number.description'),
        icon: Hash,
        category: 'Input'
    },
    {
        type: FieldType.DATE_FIELD,
        label: t('fieldTypes.date.label'),
        description: t('fieldTypes.date.description'),
        icon: Calendar,
        category: 'Input'
    },
    {
        type: FieldType.SELECT_FIELD,
        label: t('fieldTypes.dropdown.label'),
        description: t('fieldTypes.dropdown.description'),
        icon: Check,
        category: 'Choice'
    },
    {
        type: FieldType.RADIO_FIELD,
        label: t('fieldTypes.radio.label'),
        description: t('fieldTypes.radio.description'),
        icon: Radio,
        category: 'Choice'
    },
    {
        type: FieldType.CHECKBOX_FIELD,
        label: t('fieldTypes.checkbox.label'),
        description: t('fieldTypes.checkbox.description'),
        icon: Check,
        category: 'Choice'
    }
];

const getCategoriesConfig = (t: (key: string) => string) => ({
    Input: t('categories.input'),
    Choice: t('categories.choice')
});

interface AddFieldPopoverProps {
    pageId: string;
    isConnected: boolean;
    onAddField: (pageId: string, fieldType: FieldTypeConfig) => void;
}

export const AddFieldPopover: React.FC<AddFieldPopoverProps> = ({ 
    pageId, 
    isConnected, 
    onAddField 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const { t } = useTranslation('addFieldPopover');
    const { t: fieldT } = useTranslation('fieldTypesPanel');
    
    const fieldTypes = getFieldTypesConfig(fieldT);
    const categories = getCategoriesConfig(fieldT);
    
    // Group fields by category
    const groupedFields = fieldTypes.reduce((acc, field) => {
        if (!acc[field.category]) {
            acc[field.category] = [];
        }
        acc[field.category].push(field);
        return acc;
    }, {} as Record<string, FieldTypeConfig[]>);
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    className="w-full h-12 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200"
                    disabled={!isConnected}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    {t('addButton')}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4">
                    <TypographyP className="font-medium text-sm mb-3">{t('chooseFieldType')}</TypographyP>
                    
                    {Object.entries(groupedFields).map(([category, fields]) => (
                        <div key={category} className="mb-4 last:mb-0">
                            <TypographyP className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                {categories[category as keyof typeof categories]}
                            </TypographyP>
                            <div className="grid grid-cols-1 gap-1">
                                {fields.map((fieldType) => (
                                    <Button
                                        key={fieldType.type}
                                        variant="ghost"
                                        onClick={() => {
                                            onAddField(pageId, fieldType);
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center space-x-3 p-3 h-auto justify-start w-full"
                                    >
                                        <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <fieldType.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                {fieldType.label}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                {fieldType.description}
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};