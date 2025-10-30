import React, { useState } from 'react';
import { Button, Input, TypographyP } from '@dculus/ui';
import { Settings, Trash2 } from 'lucide-react';
import { FormField } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import { fieldTypes } from './types';
import { getFieldLabel, isFieldRequired } from './utils';

interface FieldItemProps {
    pageId: string;
    field: FormField;
    isConnected: boolean;
    onUpdate: (pageId: string, fieldId: string, updates: Record<string, any>) => void;
    onRemove: (pageId: string, fieldId: string) => void;
    index: number;
}

export const FieldItem: React.FC<FieldItemProps> = ({
    pageId,
    field,
    isConnected,
    onUpdate,
    onRemove,
    index
}) => {
    const { t } = useTranslation('fieldItem');
    const [isEditing, setIsEditing] = useState(false);
    const [label, setLabel] = useState(getFieldLabel(field));
    const fieldIcon = fieldTypes.find(ft => ft.type === field.type)?.icon;
    const fieldType = fieldTypes.find(ft => ft.type === field.type);

    const handleLabelSave = () => {
        if (label.trim() !== getFieldLabel(field)) {
            onUpdate(pageId, field.id, { label: label.trim() });
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleLabelSave();
        } else if (e.key === 'Escape') {
            setLabel(getFieldLabel(field));
            setIsEditing(false);
        }
    };

    return (
        <div className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-600">
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    {/* Field Type Icon */}
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg flex items-center justify-center">
                        {fieldIcon && React.createElement(fieldIcon, { className: "w-5 h-5 text-blue-600 dark:text-blue-400" })}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        {/* Field Label */}
                        {isEditing ? (
                            <Input
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                onBlur={handleLabelSave}
                                onKeyDown={handleKeyDown}
                                className="text-base font-medium border-0 shadow-none p-0 h-auto focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={() => setIsEditing(true)}
                                disabled={!isConnected}
                                className="text-left text-base font-medium hover:text-blue-600 dark:hover:text-blue-400 h-auto p-0 justify-start"
                            >
                                {getFieldLabel(field)}
                                {isFieldRequired(field) && <span className="text-red-500 ml-1">*</span>}
                            </Button>
                        )}
                        
                        {/* Field Type and Description */}
                        <div className="mt-1 space-y-1">
                            <div className="flex items-center space-x-2">
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                    {fieldType?.label || field.type}
                                </span>
                                <span className="text-xs text-gray-400">#{index + 1}</span>
                            </div>
                            <TypographyP className="text-xs text-gray-500 dark:text-gray-400">
                                {fieldType?.description || t('fallback.customField')}
                            </TypographyP>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" disabled={!isConnected} className="h-8 w-8">
                        <Settings className="w-3 h-3" />
                    </Button>
                    <Button 
                        variant="ghost" 
                        onClick={() => onRemove(pageId, field.id)} 
                        disabled={!isConnected}
                        className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
};