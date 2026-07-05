import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut } from 'lucide-react';
import {
  Button,
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  toastSuccess, toastError,
} from '@dculus/ui';
import { AccountSettings } from '../account/AccountSettings';
import { useAuthContext } from '../../contexts/AuthContext';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

export function ProfileSettings() {
  const { t } = useTranslation('settings');
  const { activeOrganization, user } = useAuthContext();
  const navigate = useNavigate();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const currentUserRole =
    activeOrganization?.members?.find((m: any) => m.user.id === user?.id)?.role ?? 'member';
  const isOwner = currentUserRole === 'owner';

  const handleLeaveOrg = async () => {
    if (!activeOrganization) return;
    setIsLeaving(true);
    try {
      const { error } = await organization.leave({ organizationId: activeOrganization.id });
      if (error) throw error;
      toastSuccess(t('dangerZone.leaveOrg.toasts.left.title'), t('dangerZone.leaveOrg.toasts.left.description'));
      navigate('/');
    } catch {
      toastError(t('dangerZone.leaveOrg.toasts.error.title'), t('dangerZone.leaveOrg.toasts.error.description'));
      setIsLeaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#3c323e]">{t('profile.title')}</h1>
        <p className="text-sm text-[#655d67]">{t('profile.subtitle')}</p>
      </div>

      <AccountSettings />

      {!isOwner && activeOrganization && (
        <div className="rounded-xl border border-[rgba(206,93,85,0.25)] bg-[rgba(206,93,85,0.04)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#ce5d55]">{t('dangerZone.title')}</h3>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#3c323e]">{t('dangerZone.leaveOrg.label')}</p>
              <p className="text-xs text-[#655d67] mt-0.5">{t('dangerZone.leaveOrg.description')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeaveDialogOpen(true)}
              className="shrink-0 text-[#ce5d55] border-[rgba(206,93,85,0.4)] hover:bg-[rgba(206,93,85,0.08)] hover:text-[#ce5d55] hover:border-[rgba(206,93,85,0.6)]"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              {t('dangerZone.leaveOrg.button')}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dangerZone.leaveOrg.dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dangerZone.leaveOrg.dialog.description', { values: { name: activeOrganization?.name ?? '' } })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLeaving}>{t('dangerZone.leaveOrg.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveOrg}
              disabled={isLeaving}
              className="bg-[#ce5d55] hover:bg-[#b94f47] text-white"
            >
              {isLeaving ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t('dangerZone.leaveOrg.dialog.confirm')}
                </span>
              ) : (
                t('dangerZone.leaveOrg.dialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
