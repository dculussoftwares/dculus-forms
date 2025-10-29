import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { Mail, UserPlus } from 'lucide-react';
import { organization } from '../../lib/auth-client';
import { useTranslation } from '../../hooks/useTranslation';

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onInviteSent: () => void;
}

interface ErrorMessageMapping {
  titleKey: string;
  descriptionKey?: string;
  fallbackMessage?: string;
}

const errorMappings: Record<string, { titleKey: string; descriptionKey: string }> = {
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: {
    titleKey: 'inviteDialog.errors.permission.title',
    descriptionKey: 'inviteDialog.errors.permission.description',
  },
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: {
    titleKey: 'inviteDialog.errors.alreadyInvited.title',
    descriptionKey: 'inviteDialog.errors.alreadyInvited.description',
  },
  ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: {
    titleKey: 'inviteDialog.errors.membershipLimit.title',
    descriptionKey: 'inviteDialog.errors.membershipLimit.description',
  },
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: {
    titleKey: 'inviteDialog.errors.rolePermission.title',
    descriptionKey: 'inviteDialog.errors.rolePermission.description',
  },
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: {
    titleKey: 'inviteDialog.errors.permissionExpired.title',
    descriptionKey: 'inviteDialog.errors.permissionExpired.description',
  },
  'You are not allowed to invite users to this organization': {
    titleKey: 'inviteDialog.errors.belongsToOtherOrg.title',
    descriptionKey: 'inviteDialog.errors.belongsToOtherOrg.description',
  },
  'User is already invited to this organization': {
    titleKey: 'inviteDialog.errors.alreadyInvited.title',
    descriptionKey: 'inviteDialog.errors.alreadyInvited.description',
  },
  'Organization membership limit reached': {
    titleKey: 'inviteDialog.errors.membershipLimit.title',
    descriptionKey: 'inviteDialog.errors.membershipLimit.description',
  },
  'you are not allowed to invite user with this role': {
    titleKey: 'inviteDialog.errors.rolePermission.title',
    descriptionKey: 'inviteDialog.errors.rolePermission.description',
  },
  'Inviter is no longer a member of the organization': {
    titleKey: 'inviteDialog.errors.permissionExpired.title',
    descriptionKey: 'inviteDialog.errors.permissionExpired.description',
  },
};

export const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  isOpen,
  onClose,
  organizationId,
  onInviteSent,
}) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation('settings');

  const mapErrorToMessage = (error: any): ErrorMessageMapping => {
    let errorMessage = '';
    let errorCode = '';

    if (error?.code && error?.message) {
      errorCode = error.code;
      errorMessage = error.message;
    } else if (error?.error?.code && error?.error?.message) {
      errorCode = error.error.code;
      errorMessage = error.error.message;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    if (errorCode && errorMappings[errorCode]) {
      return errorMappings[errorCode];
    }

    for (const [key, value] of Object.entries(errorMappings)) {
      if (errorMessage && errorMessage.includes(key)) {
        return value;
      }
    }

    return {
      titleKey: 'inviteDialog.errors.default.title',
      descriptionKey: errorMessage ? undefined : 'inviteDialog.errors.default.description',
      fallbackMessage: errorMessage,
    };
  };

  const showErrorToast = (mapping: ErrorMessageMapping) => {
    const title = t(mapping.titleKey);
    const description = mapping.descriptionKey ? t(mapping.descriptionKey) : mapping.fallbackMessage || t('inviteDialog.errors.default.description');
    toastError(title, description);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!email.trim()) {
      toastError(
        t('inviteDialog.errors.emailRequired.title'),
        t('inviteDialog.errors.emailRequired.description'),
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toastError(
        t('inviteDialog.errors.invalidEmail.title'),
        t('inviteDialog.errors.invalidEmail.description'),
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await organization.inviteMember({
        email: email.trim(),
        role: role as 'member' | 'admin' | 'owner',
        organizationId,
      });

      if (result && result.error) {
        console.error('Error inviting user (from result):', result.error);
        showErrorToast(mapErrorToMessage(result.error));
        return;
      }

      toastSuccess(
        t('inviteDialog.success.title'),
        t('inviteDialog.success.description', { values: { email } }),
      );
      setEmail('');
      setRole('member');
      onInviteSent();
      onClose();
    } catch (error) {
      console.error('Error inviting user (caught exception):', error);
      showErrorToast(mapErrorToMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setRole('member');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('inviteDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('inviteDialog.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('inviteDialog.emailLabel')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder={t('inviteDialog.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">{t('inviteDialog.roleLabel')}</Label>
            <Select value={role} onValueChange={setRole} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">
                  <div className="flex flex-col">
                    <span>{t('inviteDialog.roles.member.label')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('inviteDialog.roles.member.description')}
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="owner">
                  <div className="flex flex-col">
                    <span>{t('inviteDialog.roles.owner.label')}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('inviteDialog.roles.owner.description')}
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t('inviteDialog.actions.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !email.trim()}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t('inviteDialog.actions.submitting')}
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                {t('inviteDialog.actions.submit')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
