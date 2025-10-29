import React, { useState } from 'react';
import {
    Button,
    Input,
    TypographyP,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from '@dculus/ui';
import {
    MoreVertical,
    Settings,
    Copy,
    Trash2,
    FileText
} from 'lucide-react';
import { FormField, FormPage } from '@dculus/types';
import { FieldItem } from './FieldItem';
import { AddFieldPopover } from './AddFieldPopover';
import { FieldTypeConfig } from './types';

interface PageCardProps {
    page: FormPage;
    index: number;
    isConnected: boolean;
    onUpdateField: (pageId: string, fieldId: string, updates: Record<string, any>) => void;
    onRemoveField: (pageId: string, fieldId: string) => void;
    onAddField: (pageId: string, fieldType: FieldTypeConfig) => void;
}

export const PageCard: React.FC<PageCardProps> = ({
    page,
    index,
    isConnected,
    onUpdateField,
    onRemoveField,
    onAddField
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [pageTitle, setPageTitle] = useState(page.title || `Page ${index + 1}`);
    
    const handleTitleSave = () => {
        // TODO: Implement page title update
        setIsEditingTitle(false);
    };
    
    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Page Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                            {index + 1}
                        </div>
                        <div>
                            {isEditingTitle ? (
                                <Input
                                    value={pageTitle}
                                    onChange={(e) => setPageTitle(e.target.value)}
                                    onBlur={handleTitleSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleTitleSave();
                                        if (e.key === 'Escape') {
                                            setPageTitle(page.title || `Page ${index + 1}`);
                                            setIsEditingTitle(false);
                                        }
                                    }}
                                    className="text-lg font-semibold border-0 shadow-none p-0 h-auto focus:ring-2 focus:ring-purple-500"
                                    autoFocus
                                />
                            ) : (
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsEditingTitle(true)}
                                    disabled={!isConnected}
                                    className="text-lg font-semibold hover:text-purple-600 dark:hover:text-purple-400 h-auto p-0"
                                >
                                    {page.title || `Page ${index + 1}`}
                                </Button>
                            )}
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {page.fields?.length || 0} {(page.fields?.length || 0) === 1 ? 'field' : 'fields'}
                            </div>
                        </div>
                    </div>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                                <Settings className="w-4 h-4 mr-2" />
                                Page Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate Page
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 dark:text-red-400">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Page
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Fields List */}
            <div className="p-6">
                <div className="space-y-4">
                    {page.fields && page.fields.length > 0 ? (
                        page.fields.map((field: FormField, fieldIndex) => (
                            <FieldItem 
                                key={field.id} 
                                pageId={page.id} 
                                field={field} 
                                isConnected={isConnected} 
                                onUpdate={onUpdateField} 
                                onRemove={onRemoveField}
                                index={fieldIndex}
                            />
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <FileText className="w-8 h-8 text-gray-400" />
                            </div>
                            <TypographyP className="text-gray-500 dark:text-gray-400 mb-4">
                                This page doesn't have any fields yet
                            </TypographyP>
                        </div>
                    )}
                    
                    {/* Add Field Button */}
                    <AddFieldPopover pageId={page.id} isConnected={isConnected} onAddField={onAddField} />
                </div>
            </div>
        </div>
    );
};