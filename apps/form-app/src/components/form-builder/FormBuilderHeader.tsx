import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input
} from '@dculus/ui';
import {
    ArrowLeft,
    Copy,
    Edit3,
    MoreVertical,
    Share2,
    Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { ShareModal } from '../sharing/ShareModal';
import { PermissionBadge } from './PermissionBadge';

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
    const { t } = useTranslation('formBuilderHeader');
    const [formTitle, setFormTitle] = useState(initialFormTitle || t('defaultTitle'));
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
                                    <Button
                                        variant="ghost"
                                        onClick={() => permissions.canEdit && setIsEditingTitle(true)}
                                        className="text-lg font-semibold hover:text-gray-600 dark:hover:text-gray-300 flex items-center space-x-1 h-auto p-0"
                                        disabled={!permissions.canEdit}
                                        title={!permissions.canEdit ? t('tooltips.noEditPermission') : ""}
                                    >
                                        <span>{formTitle}</span>
                                        {permissions.canEdit && (
                                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        )}
                                    </Button>
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
                                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('status.connecting')}</span>
                                    </>
                                ) : isConnected ? (
                                    <>
                                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('status.live')}</span>
                                        <Users className="w-4 h-4 text-gray-400" />
                                    </>
                                ) : (
                                    <>
                                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                                        <span className="text-sm text-gray-600 dark:text-gray-400">{t('status.offline')}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right side - Actions */}
                    <div className="flex items-center space-x-3">
                        {permissions.canShareForm() && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-gray-600 dark:text-gray-400"
                                onClick={() => setShowShareModal(true)}
                                disabled={!organizationId || !currentUserId || !formShortUrl}
                                title={!permissions.canShareForm() ? t('tooltips.noSharePermission') : ""}
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                {t('buttons.share')}
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
                                    <Copy className="w-4 h-4 mr-2" />
                                    {t('menu.duplicateForm')}
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
