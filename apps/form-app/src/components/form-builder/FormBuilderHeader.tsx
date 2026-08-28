import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
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
    Code,
    Copy,
    Edit3,
    Eye,
    EyeOff,
    ExternalLink,
    Inbox,
    MoreVertical,
    Settings,
    Share2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useNavigate, useSearchParams } from 'react-router';
import { useFormPermissions } from '../../hooks/useFormPermissions';
import { useTranslation } from '../../hooks/useTranslation';
import { ShareModal } from '../sharing/ShareModal';
import { PermissionBadge } from './PermissionBadge';
import { SettingsTab } from './tabs';
import { CoachMark } from './coachmarks/CoachMark';
import { JSONPreview } from './JSONPreview';
import { useFormBuilderStore } from '../../store/useFormBuilderStore';
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
    /** Centered tab navigation — pass <TabNavigation /> */
    centerContent?: React.ReactNode;
    /** ⚙ Settings gear — full-screen dialog hosting SettingsTab unchanged. Hidden for VIEWER. */
    isSettingsOpen?: boolean;
    onSettingsOpenChange?: (open: boolean) => void;
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
    isSettingsOpen = false,
    onSettingsOpenChange,
}) => {
    const { t } = useTranslation('formBuilderHeader');
    const [formTitle, setFormTitle] = useState(initialFormTitle || t('defaultTitle'));
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateProgress, setDuplicateProgress] = useState(0);
    const [isJsonDebugOpen, setIsJsonDebugOpen] = useState(false);
    const permissions = useFormPermissions();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Dev-only JSON debug view (#234) — replaces the JSON tab that used to live
    // in the right panel. Hidden in production builds unless `?debug=1` is set,
    // mirroring the `?settings=1` deep-link convention used by the Settings dialog below.
    const isJsonDebugEnabled = import.meta.env.DEV || searchParams.get('debug') === '1';
    const jsonDebugPages = useFormBuilderStore((state) => state.pages);
    const jsonDebugLayout = useFormBuilderStore((state) => state.layout);
    const jsonDebugIsShuffleEnabled = useFormBuilderStore((state) => state.isShuffleEnabled);
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
                    borderBottom: '1px solid var(--tf-border)',
                }}
            >
                {/* ── Left: back + title + status ── */}
                <div className="flex items-center gap-2 px-3 min-w-0 w-72 shrink-0">
                    {onNavigateBack && (
                        <Button
                            variant="ghost"
                            onClick={onNavigateBack}
                            className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors shrink-0 p-0"
                            title={t('tooltips.back')}
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
                                className="h-8 text-sm font-medium border-0 shadow-none p-0 focus:ring-0 focus:border-transparent bg-transparent w-full text-primary"
                                autoFocus
                            />
                        ) : (
                            <Button
                                variant="ghost"
                                onClick={() => permissions.canEdit && setIsEditingTitle(true)}
                                className="group flex items-center gap-1.5 text-sm font-medium w-full min-w-0 transition-colors h-auto p-0"
                                disabled={!permissions.canEdit}
                                title={!permissions.canEdit ? t('tooltips.noEditPermission') : t('tooltips.clickToRename')}
                            >
                                <span className="truncate min-w-0">{formTitle}</span>
                                {permissions.canEdit && (
                                    <Edit3 className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                                )}
                            </Button>
                        )}
                    </div>

                    {/* Connection status — horizontal, right of title */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {isLoading ? (
                            <>
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                <span className="text-xs text-muted-foreground">{t('status.connecting')}</span>
                            </>
                        ) : isConnected ? (
                            <>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--tf-green)' }} />
                                <span className="text-xs font-medium text-[var(--tf-green)]">{t('status.live')}</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 bg-red-400 rounded-full" />
                                <span className="text-xs text-muted-foreground">{t('status.offline')}</span>
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
                    {/* Responses */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/form/${_formId}/responses`)}
                        className="h-8 px-3 text-xs"
                    >
                        <Inbox className="w-3.5 h-3.5 mr-1.5" />
                        {t('buttons.viewResponses')}
                    </Button>

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

                    {/* Collaborate — teammate access, not respondent
                        distribution. Named for its audience: "Share" used to
                        mean both, which is how a builder URL shipped under the
                        label "anyone with this link can view the form". See
                        docs/form-embed-v1-spec.md §2. */}
                    {permissions.canShareForm() && (
                        <Button
                            variant="ghost"
                            onClick={() => setShowShareModal(true)}
                            disabled={!organizationId || !currentUserId || !formShortUrl}
                            className="h-8 w-8 flex items-center justify-center rounded-lg p-0 disabled:opacity-40"
                            title={t('buttons.collaborate')}
                        >
                            <Share2 className="w-4 h-4" />
                        </Button>
                    )}

                    {/* Settings gear — hidden for VIEWER (SettingsTab would just show access-denied) */}
                    {onSettingsOpenChange && permissions.canEdit && (
                        <CoachMark id="gear" side="bottom" align="end">
                            <Button
                                variant="ghost"
                                onClick={() => onSettingsOpenChange(true)}
                                className="h-8 w-8 flex items-center justify-center rounded-lg p-0"
                                title={t('menu.formSettings')}
                                data-testid="header-settings-gear"
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                        </CoachMark>
                    )}

                    {/* More */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="h-8 w-8 flex items-center justify-center rounded-lg p-0"
                                data-testid="header-more-menu-trigger"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={handleDuplicateForm} disabled={!permissions.canEdit}>
                                <Copy className="w-4 h-4 mr-2" />
                                {t('menu.duplicateForm')}
                            </DropdownMenuItem>
                            {isJsonDebugEnabled && (
                                <DropdownMenuItem onClick={() => setIsJsonDebugOpen(true)} data-testid="header-json-debug-menu-item">
                                    <Code className="w-4 h-4 mr-2" />
                                    {t('menu.jsonDebug')}
                                </DropdownMenuItem>
                            )}
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
                            <div className="text-sm text-muted-foreground">
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

            {/* Settings overlay — full-screen Dialog hosting SettingsTab unchanged. Deep link: ?settings=1 */}
            {onSettingsOpenChange && (
                <Dialog open={isSettingsOpen} onOpenChange={onSettingsOpenChange}>
                    <DialogContent
                        className="max-w-none w-screen h-screen inset-0 top-0 left-0 translate-x-0 translate-y-0 rounded-none border-0 p-0 gap-0 flex flex-col"
                        data-testid="settings-overlay"
                    >
                        <div
                            className="flex items-center px-4 h-11 shrink-0"
                            style={{ borderBottom: '1px solid var(--tf-border-medium)' }}
                        >
                            <DialogTitle className="text-sm font-semibold leading-none tracking-normal">{t('menu.formSettings')}</DialogTitle>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <SettingsTab formId={_formId} />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* JSON debug view — dev-only, re-homed from the right panel's JSON tab (#234) */}
            {isJsonDebugEnabled && (
                <Dialog open={isJsonDebugOpen} onOpenChange={setIsJsonDebugOpen}>
                    <DialogContent className="max-w-2xl h-[70vh] flex flex-col p-0 gap-0" data-testid="json-debug-dialog">
                        <DialogTitle className="sr-only">{t('menu.jsonDebug')}</DialogTitle>
                        <JSONPreview
                            pages={jsonDebugPages}
                            layout={jsonDebugLayout}
                            isShuffleEnabled={jsonDebugIsShuffleEnabled}
                        />
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
};
