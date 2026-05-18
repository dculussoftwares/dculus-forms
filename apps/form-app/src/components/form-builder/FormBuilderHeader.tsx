import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    Progress,
    toastError,
    toastSuccess
} from '@dculus/ui';
import {
    ArrowLeft,
    Copy,
    Edit3,
    Eye,
    EyeOff,
    ExternalLink,
    MoreVertical,
    Share2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { ShareModal } from '../sharing/ShareModal';
import { PermissionBadge } from './PermissionBadge';
import { DUPLICATE_FORM, UPDATE_FORM } from '../../graphql/mutations';
import { getFormViewerUrl } from '../../lib/config';

interface FormBuilderHeaderProps {
    formId: string;
    formTitle?: string;
    formShortUrl?: string;
    isPublished?: boolean;
    organizationId?: string;
    currentUserId?: string;
    isLoading: boolean;
    isConnected: boolean;
    onAddPage: () => void;
    onNavigateBack?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    updateLoading?: boolean;
    /** Centered tab navigation — pass <TabNavigation position="inline" /> */
    centerContent?: React.ReactNode;
}

export const FormBuilderHeader: React.FC<FormBuilderHeaderProps> = ({
    formId: _formId,
    formTitle: initialFormTitle,
    formShortUrl,
    isPublished,
    organizationId,
    currentUserId,
    isLoading,
    isConnected,
    onAddPage: _onAddPage,
    onNavigateBack,
    onPublish,
    onUnpublish,
    updateLoading = false,
    centerContent,
}) => {
    const { t } = useTranslation('formBuilderHeader');
    const [formTitle, setFormTitle] = useState(initialFormTitle || t('defaultTitle'));
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateProgress, setDuplicateProgress] = useState(0);
    const permissions = useFormPermissions();
    const navigate = useNavigate();
    const [duplicateFormMutation, { loading: isDuplicating }] = useMutation(DUPLICATE_FORM);
    const [updateFormMutation] = useMutation(UPDATE_FORM);

    useEffect(() => {
        if (initialFormTitle) setFormTitle(initialFormTitle);
    }, [initialFormTitle]);

    useEffect(() => {
        if (!isDuplicating) return undefined;
        setDuplicateProgress(10);
        const interval = setInterval(() => {
            setDuplicateProgress((prev) => prev >= 90 ? prev : prev + Math.random() * 12);
        }, 300);
        return () => clearInterval(interval);
    }, [isDuplicating]);

    useEffect(() => {
        if (!isDuplicating && duplicateProgress > 0 && duplicateProgress < 100) {
            setDuplicateProgress(100);
        }
    }, [isDuplicating, duplicateProgress]);

    useEffect(() => {
        if (!showDuplicateDialog && !isDuplicating) setDuplicateProgress(0);
    }, [showDuplicateDialog, isDuplicating]);

    const handleSaveTitle = async () => {
        const trimmedTitle = formTitle.trim();
        if (!trimmedTitle) {
            setFormTitle(initialFormTitle || t('defaultTitle'));
            setIsEditingTitle(false);
            return;
        }
        if (trimmedTitle !== initialFormTitle && permissions.canEdit) {
            try {
                await updateFormMutation({ variables: { id: _formId, input: { title: trimmedTitle } } });
                toastSuccess(t('toasts.updateTitleSuccess.title'), t('toasts.updateTitleSuccess.description'));
            } catch {
                toastError(t('toasts.updateTitleError.title'), t('toasts.updateTitleError.description'));
                setFormTitle(initialFormTitle || t('defaultTitle'));
            }
        }
        setIsEditingTitle(false);
    };

    const handleCancelEdit = () => {
        setFormTitle(initialFormTitle || t('defaultTitle'));
        setIsEditingTitle(false);
    };

    const handleDuplicateForm = () => {
        if (!permissions.canEdit) return;
        setDuplicateProgress(0);
        setShowDuplicateDialog(true);
    };

    const performDuplicate = async () => {
        if (!permissions.canEdit || isDuplicating) return;
        try {
            const { data } = await duplicateFormMutation({ variables: { id: _formId } });
            if (data?.duplicateForm) {
                setDuplicateProgress(100);
                toastSuccess(t('toasts.duplicateSuccess.title'), t('toasts.duplicateSuccess.description', { values: { title: data.duplicateForm.title } }));
                setShowDuplicateDialog(false);
                navigate(`/dashboard/form/${data.duplicateForm.id}`);
            }
        } catch {
            toastError(t('toasts.duplicateError.title'), t('toasts.duplicateError.description'));
            setDuplicateProgress(0);
        }
    };

    const handleViewLiveForm = () => {
        if (formShortUrl) window.open(getFormViewerUrl(formShortUrl), '_blank');
    };

    return (
        <>
            {/* ── Typeform-style top bar: 3-column (left | center | right) ── */}
            <header
                className="bg-white dark:bg-card sticky top-0 z-50 flex items-stretch"
                style={{
                    height: '56px',
                    borderBottom: '1px solid rgba(81,76,84,0.12)',
                }}
            >
                {/* ── Left: back + title + status ── */}
                <div className="flex items-center gap-2 px-3 min-w-0 w-72 shrink-0">
                    {onNavigateBack && (
                        <Button
                            variant="ghost"
                            onClick={onNavigateBack}
                            className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors shrink-0 p-0"
                            title="Back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Title — takes all remaining space */}
                    <div className="flex-1 min-w-0">
                        {isEditingTitle && permissions.canEdit ? (
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                onBlur={handleSaveTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(); }
                                    else if (e.key === 'Escape') { e.preventDefault(); handleCancelEdit(); }
                                }}
                                className="h-8 text-sm font-medium border-0 shadow-none p-0 focus:ring-0 focus:border-transparent bg-transparent w-full text-[#3c323e]"
                                autoFocus
                            />
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={() => permissions.canEdit && setIsEditingTitle(true)}
                                className="group flex items-center gap-1.5 text-sm font-medium w-full min-w-0 transition-colors h-auto p-0"
                                disabled={!permissions.canEdit}
                                title={!permissions.canEdit ? t('tooltips.noEditPermission') : 'Click to rename'}
                            >
                                <span className="truncate min-w-0">{formTitle}</span>
                                {permissions.canEdit && (
                                    <Edit3 className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[#655d67]" />
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Connection status — horizontal, right of title */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isLoading ? (
                            <>
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                <span className="text-xs text-[#655d67]">{t('status.connecting')}</span>
                            </>
                        ) : isConnected ? (
                            <>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#177767' }} />
                                <span className="text-xs font-medium text-[#177767]">{t('status.live')}</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 bg-red-400 rounded-full" />
                                <span className="text-xs text-[#655d67]">{t('status.offline')}</span>
                            </>
                        )}
                        <PermissionBadge />
                    </div>
                </div>

                {/* ── Center: tab navigation (passed from parent) ── */}
                <div className="flex-1 flex items-stretch justify-center">
                    {centerContent}
                </div>

                {/* ── Right: publish + view + share + more ── */}
                <div className="flex items-center gap-1.5 px-3 w-72 shrink-0 justify-end">
                    {/* Publish / Unpublish */}
                    {permissions.canEdit && (
                        isPublished ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onUnpublish}
                                disabled={updateLoading}
                                className="h-8 px-3 text-xs"
                            >
                                <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                                {updateLoading ? t('buttons.unpublishing') : t('buttons.unpublishForm')}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={onPublish}
                                disabled={updateLoading}
                                className="h-8 px-3 text-xs"
                            >
                                <Eye className="w-3.5 h-3.5 mr-1.5" />
                                {updateLoading ? t('buttons.publishing') : t('buttons.publishForm')}
                            </Button>
                        )
                    )}

                    {/* View live */}
                    {isPublished && formShortUrl && (
                        <Button
                            variant="ghost"
                            onClick={handleViewLiveForm}
                            className="h-8 w-8 flex items-center justify-center rounded-lg p-0"
                            title={t('tooltips.viewLiveFormTooltip')}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Share */}
                    {permissions.canShareForm() && (
                        <Button
                            variant="ghost"
                            onClick={() => setShowShareModal(true)}
                            disabled={!organizationId || !currentUserId || !formShortUrl}
                            className="h-8 w-8 flex items-center justify-center rounded-lg p-0 disabled:opacity-40"
                            title={t('buttons.share')}
                        >
                            <Share2 className="w-4 h-4" />
                        </Button>
                    )}

                    {/* More */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 flex items-center justify-center rounded-lg p-0"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={handleDuplicateForm} disabled={!permissions.canEdit}>
                                <Copy className="w-4 h-4 mr-2" />
                                {t('menu.duplicateForm')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Share Modal */}
            {showShareModal && organizationId && currentUserId && formShortUrl && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    formId={_formId}
                    formTitle={formTitle}
                    organizationId={organizationId}
                    currentUserId={currentUserId}
                />
            )}

            {/* Duplicate dialog */}
            <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('duplicateDialog.title')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('duplicateDialog.description')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    {isDuplicating && (
                        <div className="space-y-2">
                            <div className="text-sm text-[#655d67]">
                                {t('duplicateDialog.progressLabel')}
                            </div>
                            <Progress value={Math.min(duplicateProgress, 100)} />
                        </div>
                    )}
                    <AlertDialogFooter>
                        <div className="flex w-full justify-end space-x-2">
                            <Button variant="outline" onClick={() => { if (isDuplicating) return; setShowDuplicateDialog(false); setDuplicateProgress(0); }} disabled={isDuplicating}>
                                {t('duplicateDialog.cancel')}
                            </Button>
                            <Button onClick={performDuplicate} disabled={isDuplicating}>
                                {isDuplicating ? t('duplicateDialog.working') : t('duplicateDialog.confirm')}
                            </Button>
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
