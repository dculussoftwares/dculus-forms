import React, { useState } from 'react';
import {
    Button,
    TypographyP,
    Popover,
    PopoverTrigger,
    PopoverContent
} from '@dculus/ui';
import { Plus } from 'lucide-react';
import { fieldCategories, FieldTypeConfig } from './types';

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
    
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    className="w-full h-12 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all duration-200"
                    disabled={!isConnected}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add field
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="p-4">
                    <TypographyP className="font-medium text-sm mb-3">Choose a field type</TypographyP>
                    
                    {Object.entries(fieldCategories).map(([category, fields]) => (
                        <div key={category} className="mb-4 last:mb-0">
                            <TypographyP className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                {category}
                            </TypographyP>
                            <div className="grid grid-cols-1 gap-1">
                                {fields.map((fieldType) => (
                                    <button
                                        key={fieldType.type}
                                        onClick={() => {
                                            onAddField(pageId, fieldType);
                                            setIsOpen(false);
                                        }}
                                        className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left w-full"
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
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};