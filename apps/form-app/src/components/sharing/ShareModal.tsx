import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
  Badge,
  UserAvatar,
  Separator,
  toastSuccess,
  toastError
} from '@dculus/ui';
import { useTranslation } from '../../hooks/useTranslation';
import {
  Users,
  Link as LinkIcon,
  X,
  UserPlus,
  Copy,
  Check,
  Globe,
  Lock,
  Crown,
  Edit,
  Eye,
  UserMinus
} from 'lucide-react';
import {
  GET_FORM_PERMISSIONS,
  GET_ORGANIZATION_MEMBERS,
  SHARE_FORM,
  UPDATE_FORM_PERMISSION,
  REMOVE_FORM_ACCESS,
  FormPermission,
  User,
  SharingScope,
  PermissionLevel,
  ShareFormInput,
  UserPermissionInput
} from '../../graphql/formSharing';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  organizationId: string;
  currentUserId: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  organizationId,
  currentUserId
}) => {
  const { t } = useTranslation('sharing');
  const navigate = useNavigate();
  const [sharingScope, setSharingScope] = useState<SharingScope>(SharingScope.PRIVATE);
  const [defaultPermission, setDefaultPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, PermissionLevel>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [internalLinkCopied, setInternalLinkCopied] = useState(false);

  // GraphQL queries and mutations
  const { data: permissionsData, refetch: refetchPermissions } = useQuery(
    GET_FORM_PERMISSIONS,
    { 
      variables: { formId },
      skip: !isOpen 
    }
  );

  const { data: membersData } = useQuery(
    GET_ORGANIZATION_MEMBERS,
    { 
      variables: { organizationId },
      skip: !isOpen 
    }
  );

  const [shareForm, { loading: sharing }] = useMutation(SHARE_FORM, {
    onCompleted: () => {
      toastSuccess(t('toast.success.settingsUpdated'));
      refetchPermissions();
    },
    onError: (error) => {
      toastError(t('toast.error.settingsUpdateFailed'), error.message);
    }
  });

  const [updatePermission] = useMutation(UPDATE_FORM_PERMISSION, {
    onCompleted: () => {
      toastSuccess(t('toast.success.permissionUpdated'));
      refetchPermissions();
    },
    onError: (error) => {
      toastError(t('toast.error.permissionUpdateFailed'), error.message);
    }
  });

  const [removeAccess] = useMutation(REMOVE_FORM_ACCESS, {
    onCompleted: () => {
      toastSuccess(t('toast.success.accessRemoved'));
      refetchPermissions();
    },
    onError: (error) => {
      toastError(t('toast.error.accessRemovalFailed'), error.message);
    }
  });

  // Get current form permissions and settings
  const currentPermissions = permissionsData?.formPermissions || [];
  const organizationMembers = membersData?.organizationMembers || [];

  // Filter members that can be added
  const availableMembers = organizationMembers.filter((member: User) => {
    if (member.id === currentUserId) return false; // Don't show current user
    return !currentPermissions.some((perm: FormPermission) => perm.userId === member.id);
  });

  // Filter members based on search
  const filteredMembers = availableMembers.filter((member: User) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle permission updates
  const handleUpdatePermission = async (userId: string, permission: PermissionLevel) => {
    await updatePermission({
      variables: {
        input: {
          formId,
          userId,
          permission
        }
      }
    });
  };

  const handleRemoveAccess = async (userId: string) => {
    await removeAccess({
      variables: {
        formId,
        userId
      }
    });
  };

  // Handle adding users
  const handleAddUser = (userId: string, permission: PermissionLevel) => {
    const newSelectedUsers = new Map(selectedUsers);
    newSelectedUsers.set(userId, permission);
    setSelectedUsers(newSelectedUsers);
  };

  const handleRemoveSelectedUser = (userId: string) => {
    const newSelectedUsers = new Map(selectedUsers);
    newSelectedUsers.delete(userId);
    setSelectedUsers(newSelectedUsers);
  };

  // Handle sharing scope changes
  const handleShare = async () => {
    const userPermissions: UserPermissionInput[] = Array.from(selectedUsers.entries()).map(([userId, permission]) => ({
      userId,
      permission
    }));

    const input: ShareFormInput = {
      formId,
      sharingScope,
      defaultPermission: sharingScope === SharingScope.ALL_ORG_MEMBERS ? defaultPermission : PermissionLevel.VIEWER,
      userPermissions: userPermissions.length > 0 ? userPermissions : undefined
    };

    await shareForm({ variables: { input } });
    setSelectedUsers(new Map());
  };

  // Copies the INTERNAL form-app URL (this form's dashboard), not the public
  // respondent link. Opening it requires a form-app sign-in plus a FormPermission
  // row, so it is only ever useful to teammates. The public link respondents
  // should receive is `getFormViewerUrl(shortUrl)`, surfaced by "Get Link" on the
  // form dashboard — see the hint under this card.
  const handleCopyInternalLink = async () => {
    const internalUrl = `${window.location.origin}/dashboard/form/${formId}`;
    try {
      await navigator.clipboard.writeText(internalUrl);
      setInternalLinkCopied(true);
      toastSuccess(t('toast.success.internalLinkCopied'));
      setTimeout(() => setInternalLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy internal link', error);
      toastError(t('toast.error.copyFailed'), t('toast.error.clipboardUnavailable'));
    }
  };

  // Respondent-facing access (sign-in requirement, allowed email domains) lives
  // in Form Settings, not here — this modal only governs who can EDIT the form.
  const handleGoToAccessControl = () => {
    onClose();
    navigate(`/dashboard/form/${formId}/settings?section=access-control`);
  };

  // Permission level icons and labels
  const getPermissionIcon = (permission: PermissionLevel) => {
    switch (permission) {
      case PermissionLevel.OWNER:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case PermissionLevel.EDITOR:
        return <Edit className="w-4 h-4 text-blue-500" />;
      case PermissionLevel.VIEWER:
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getPermissionLabel = (permission: PermissionLevel) => {
    switch (permission) {
      case PermissionLevel.OWNER:
        return t('modal.permissions.owner');
      case PermissionLevel.EDITOR:
        return t('modal.permissions.editor');
      case PermissionLevel.VIEWER:
        return t('modal.permissions.viewer');
      default:
        return t('modal.permissions.noAccess');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--tf-icon-lavender)' }}
            >
              <Users className="h-4 w-4" style={{ color: '#5c2e6b' }} />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-primary text-left">
                {t('modal.title', { values: { formTitle } })}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5 text-left">
                {t('modal.subtitle')}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Internal (form-app) link — explicitly NOT the respondent link */}
          <div
            className="rounded-xl bg-white dark:bg-card"
            style={{
              border: '1px solid var(--tf-border-medium)',
              boxShadow: '0 1px 4px var(--tf-overlay)',
            }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--tf-icon-gray)' }}
                >
                  <LinkIcon className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium text-primary">{t('modal.internalLink.label')}</Label>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('modal.internalLink.description')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInternalLink}
                  className="ml-4"
                >
                  {internalLinkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {internalLinkCopied
                    ? t('modal.internalLink.copiedButton')
                    : t('modal.internalLink.copyButton')}
                </Button>
              </div>
              <p
                className="text-xs text-muted-foreground mt-3 pt-3"
                style={{ borderTop: '1px solid var(--tf-border-light)' }}
              >
                {t('modal.internalLink.publicLinkHint')}
              </p>
            </div>
          </div>

          {/* Editor access scope — governs the form BUILDER, not who may respond */}
          <div
            className="rounded-xl bg-white dark:bg-card p-4 space-y-3"
            style={{
              border: '1px solid var(--tf-border-medium)',
              boxShadow: '0 1px 4px var(--tf-overlay)',
            }}
          >
            <Label className="text-sm font-medium text-primary">{t('modal.scope.label')}</Label>
            <Select value={sharingScope} onValueChange={(value) => setSharingScope(value as SharingScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SharingScope.PRIVATE}>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {t('modal.scope.private')}
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.SPECIFIC_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('modal.scope.specificMembers')}
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.ALL_ORG_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t('modal.scope.allOrgMembers')}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('modal.scope.respondentHint')}{' '}
              <button
                type="button"
                onClick={handleGoToAccessControl}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {t('modal.scope.respondentHintLink')}
              </button>
            </p>
          </div>

          {/* Default Permission for Organization Members */}
          {sharingScope === SharingScope.ALL_ORG_MEMBERS && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('modal.defaultPermission.label')}</Label>
              <Select value={defaultPermission} onValueChange={(value) => setDefaultPermission(value as PermissionLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PermissionLevel.VIEWER}>{t('modal.defaultPermission.viewer')}</SelectItem>
                  <SelectItem value={PermissionLevel.EDITOR}>{t('modal.defaultPermission.editor')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Add People Section */}
          {(sharingScope === SharingScope.SPECIFIC_MEMBERS || sharingScope === SharingScope.ALL_ORG_MEMBERS) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('modal.addPeople.label')}</Label>
              <div className="space-y-3">
                <Input
                  placeholder={t('modal.addPeople.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                
                {/* Selected users to be added */}
                {selectedUsers.size > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">{t('modal.addPeople.toBeAdded')}</Label>
                    {Array.from(selectedUsers.entries()).map(([userId, permission]) => {
                      const user = organizationMembers.find((m: User) => m.id === userId);
                      if (!user) return null;
                      
                      return (
                        <div key={userId} className="flex items-center justify-between p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--tf-tab-bg)' }}>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.name} email={user.email} image={user.image} size="md" />
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              value={permission}
                              onValueChange={(value) => handleAddUser(userId, value as PermissionLevel)}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={PermissionLevel.VIEWER}>{t('modal.permissions.viewer')}</SelectItem>
                                <SelectItem value={PermissionLevel.EDITOR}>{t('modal.permissions.editor')}</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveSelectedUser(userId)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available members */}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredMembers.map((member: User) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-2 hover:bg-background rounded-lg cursor-pointer"
                      onClick={() => handleAddUser(member.id, PermissionLevel.VIEWER)}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar name={member.name} email={member.email} image={member.image} size="md" />
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && searchQuery && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {t('modal.addPeople.noResults', { values: { query: searchQuery } })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Current Permissions */}
          {currentPermissions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{t('modal.currentPermissions.label')}</Label>
              <div className="space-y-2">
                {currentPermissions.map((permission: FormPermission) => (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ border: '1px solid var(--tf-border-medium)' }}
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar name={permission.user.name} email={permission.user.email} image={permission.user.image} size="md" />
                      <div>
                        <p className="text-sm font-medium">{permission.user.name}</p>
                        <p className="text-xs text-muted-foreground">{permission.user.email}</p>
                      </div>
                      {permission.permission === PermissionLevel.OWNER && (
                        <Badge variant="secondary" className="text-xs">
                          {t('modal.permissions.owner')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {permission.permission !== PermissionLevel.OWNER ? (
                        <Select
                          value={permission.permission}
                          onValueChange={(value) => handleUpdatePermission(permission.userId, value as PermissionLevel)}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={PermissionLevel.VIEWER}>{t('modal.permissions.viewer')}</SelectItem>
                            <SelectItem value={PermissionLevel.EDITOR}>{t('modal.permissions.editor')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1">
                          {getPermissionIcon(permission.permission)}
                          <span className="text-sm">{getPermissionLabel(permission.permission)}</span>
                        </div>
                      )}
                      {permission.permission !== PermissionLevel.OWNER && permission.userId !== currentUserId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAccess(permission.userId)}
                        >
                          <UserMinus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              {t('modal.actions.cancel')}
            </Button>
            <Button
              onClick={handleShare}
              disabled={sharing}
              className="min-w-[100px]"
            >
              {sharing ? t('modal.actions.sharing') : t('modal.actions.share')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
