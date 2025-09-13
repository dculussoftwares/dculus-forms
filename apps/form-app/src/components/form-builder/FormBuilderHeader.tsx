import React, { useState, useEffect } from 'react';
import {
    Button,
    Input,
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator
} from '@dculus/ui';
import {
    Users,
    Save,
    Eye,
    Share2,
    MoreVertical,
    Edit3,
    Copy,
    Settings,
    Palette,
    Zap,
    ArrowLeft
} from 'lucide-react';
import { ShareModal } from '../sharing/ShareModal';
import { PermissionBadge } from './PermissionBadge';
import { useFormPermissions } from '../../hooks/useFormPermissions';

interface FormBuilderHeaderProps {
    formId: string;
    formTitle?: string;
    formShortUrl?: string;
    organizationId?: string;
    currentUserId?: string;
    isLoading: boolean;
    isConnected: boolean;
    onAddPage: () => void;
    onNavigateBack?: () => void;
}

export const FormBuilderHeader: React.FC<FormBuilderHeaderProps> = ({ 
    formId: _formId, 
    formTitle: initialFormTitle,
    formShortUrl,
    organizationId,
    currentUserId,
    isLoading, 
    isConnected, 
    onAddPage: _onAddPage,
    onNavigateBack
}) => {
    const [formTitle, setFormTitle] = useState(initialFormTitle || 'Untitled Form');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const permissions = useFormPermissions();
    
    // Update local state when prop changes
    useEffect(() => {
        if (initialFormTitle) {
            setFormTitle(initialFormTitle);
        }
    }, [initialFormTitle]);
    
    return (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Left side - Back button, Form title and status */}
                    <div className="flex items-center space-x-4">
                        {onNavigateBack && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onNavigateBack}
                                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>
                        )}
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                {isEditingTitle && permissions.canEdit ? (
                                    <Input
                                        value={formTitle}
                                        onChange={(e) => setFormTitle(e.target.value)}
                                        onBlur={() => setIsEditingTitle(false)}
                                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                                        className="text-lg font-semibold border-0 shadow-none p-0 h-auto focus:ring-0"
                                        autoFocus
                                    />
                                ) : (
                                    <button
                                        onClick={() => permissions.canEdit && setIsEditingTitle(true)}
                                        className={`text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-1 ${
                                            permissions.canEdit ? 'hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer' : 'cursor-default'
                                        }`}
                                        disabled={!permissions.canEdit}
                                        title={!permissions.canEdit ? "You don't have permission to edit the form title" : ""}
                                    >
                                        <span>{formTitle}</span>
                                        {permissions.canEdit && (
                                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {/* Permission Badge and Connection Status */}
                        <div className="flex items-center space-x-3">
                            <PermissionBadge />
                            <div className="flex items-center space-x-2">
                                {isLoading ? (
                                    <>
                                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Connecting...</span>
                                    </>
                                ) : isConnected ? (
                                    <>
                                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Live</span>
                                        <Users className="w-4 h-4 text-gray-400" />
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">Offline</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center space-x-3">
                        <Button variant="ghost" size="sm" className="text-gray-600 dark:text-gray-400">
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                        </Button>
                        {permissions.canShareForm() && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 dark:text-gray-400"
                                onClick={() => setShowShareModal(true)}
                                disabled={!organizationId || !currentUserId || !formShortUrl}
                                title={!permissions.canShareForm() ? "Only form owners can manage sharing" : ""}
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                Share
                            </Button>
                        )}
                        {permissions.canSaveForm() && (
                            <Button 
                                size="sm" 
                                disabled={!isConnected}
                                title={!permissions.canSaveForm() ? "You don't have permission to save changes" : ""}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                        )}
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Form Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Palette className="w-4 h-4 mr-2" />
                                    Design
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Duplicate Form
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Share Modal */}
            {showShareModal && organizationId && currentUserId && formShortUrl && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    formId={_formId}
                    formTitle={formTitle}
                    formShortUrl={formShortUrl}
                    organizationId={organizationId}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
};