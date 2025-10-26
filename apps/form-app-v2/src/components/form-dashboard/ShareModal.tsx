import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ScrollArea,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Badge,
  toast,
  Card,
  CardContent,
} from '@dculus/ui-v2';
import { Search, X, Users, Lock, Globe, Crown, Edit, Eye, Check, Copy } from 'lucide-react';
import { useTranslate } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import {
  GET_FORM_PERMISSIONS,
  GET_ORGANIZATION_MEMBERS,
  SHARE_FORM,
  UPDATE_FORM_PERMISSION,
  REMOVE_FORM_ACCESS,
  SharingScope,
  PermissionLevel,
  type FormPermission,
  type User,
  type UserPermissionInput,
} from '../../graphql/formSharing';
import { getFormViewerUrl } from '../../lib/config';

// eslint-disable-next-line react-refresh/only-export-components
export const permissionIconFor = (permission: PermissionLevel) => {
  switch (permission) {
    case PermissionLevel.OWNER:
      return <Crown className="h-4 w-4 text-yellow-500" />;
    case PermissionLevel.EDITOR:
      return <Edit className="h-4 w-4 text-blue-500" />;
    case PermissionLevel.VIEWER:
      return <Eye className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

type TranslateFn = ReturnType<typeof useTranslate>;

// eslint-disable-next-line react-refresh/only-export-components
export const permissionLabelFor = (
  permission: PermissionLevel | string,
  translate: TranslateFn,
) => {
  switch (permission) {
    case PermissionLevel.OWNER:
      return translate('shareModal.permissions.owner');
    case PermissionLevel.EDITOR:
      return translate('shareModal.permissions.editor');
    case PermissionLevel.VIEWER:
      return translate('shareModal.permissions.viewer');
    default:
      return 'No Access';
  }
};

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formTitle: string;
  shortUrl: string;
}

export const ShareModal = ({
  open,
  onOpenChange,
  formId,
  formTitle,
  shortUrl,
}: ShareModalProps) => {
  const t = useTranslate();
  const { activeOrganization, user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sharingScope, setSharingScope] = useState<SharingScope>(
    SharingScope.PRIVATE
  );
  const [defaultPermission, setDefaultPermission] = useState<PermissionLevel>(
    PermissionLevel.VIEWER
  );
  const [selectedUsers, setSelectedUsers] = useState<
    Map<string, PermissionLevel>
  >(new Map());
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch form permissions
  const { data: permissionsData, refetch: refetchPermissions } = useQuery<{
    formPermissions: FormPermission[];
  }>(GET_FORM_PERMISSIONS, {
    variables: { formId },
    skip: !open,
  });

  // Fetch organization members
  const { data: membersData } = useQuery<{ organizationMembers: User[] }>(
    GET_ORGANIZATION_MEMBERS,
    {
      variables: { organizationId: activeOrganization?.id },
      skip: !open || !activeOrganization?.id,
    }
  );

  // Reset selected users when modal opens
  useEffect(() => {
    if (open) {
      setSelectedUsers(new Map());
      setSearchQuery('');
      setLinkCopied(false);
    }
  }, [open]);

  // Mutations
  const [shareForm, { loading: shareLoading }] = useMutation(SHARE_FORM, {
    onCompleted: () => {
      toast(t('shareModal.toast.updateSuccess.title'), {
        description: t('shareModal.toast.updateSuccess.description'),
      });
      refetchPermissions();
      setSelectedUsers(new Map());
    },
    onError: (error) => {
      toast(t('shareModal.toast.updateError.title'), {
        description:
          error.message || t('shareModal.toast.updateError.descriptionFallback'),
      });
    },
  });

  const [updatePermission] = useMutation(UPDATE_FORM_PERMISSION, {
    onCompleted: () => {
      toast(t('shareModal.toast.permissionUpdated.title'), {
        description: t('shareModal.toast.permissionUpdated.description'),
      });
      refetchPermissions();
    },
    onError: (error) => {
      toast(t('shareModal.toast.permissionError.title'), {
        description:
          error.message ||
          t('shareModal.toast.permissionError.descriptionFallback'),
      });
    },
  });

  const [removeAccess] = useMutation(REMOVE_FORM_ACCESS, {
    onCompleted: () => {
      toast(t('shareModal.toast.accessRemoved.title'), {
        description: t('shareModal.toast.accessRemoved.description'),
      });
      refetchPermissions();
    },
    onError: (error) => {
      toast(t('shareModal.toast.removeError.title'), {
        description:
          error.message || t('shareModal.toast.removeError.descriptionFallback'),
      });
    },
  });

  // Get current permissions
  const currentPermissions = permissionsData?.formPermissions || [];
  const organizationMembers = membersData?.organizationMembers || [];

  // User IDs with access
  const userIdsWithAccess = new Set(currentPermissions.map((p) => p.userId));

  // Filter available members (not already granted access and not selected)
  const availableMembers = useMemo(() => {
    return organizationMembers.filter(
      (member) =>
        member.id !== currentUser?.id &&
        !userIdsWithAccess.has(member.id) &&
        !selectedUsers.has(member.id) &&
        (member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [
    organizationMembers,
    currentUser,
    userIdsWithAccess,
    selectedUsers,
    searchQuery,
  ]);

  // Handle copy link
  const handleCopyLink = () => {
    const formViewerUrl = getFormViewerUrl(shortUrl);
    navigator.clipboard.writeText(formViewerUrl).then(() => {
      toast(t('shareModal.toast.linkCopied.title'), {
        description: t('shareModal.toast.linkCopied.description'),
      });
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  };

  // Handle share - update settings and add selected users
  const handleShare = () => {
    const userPermissions: UserPermissionInput[] = Array.from(
      selectedUsers.entries()
    ).map(([userId, permission]) => ({
      userId,
      permission,
    }));

    shareForm({
      variables: {
        input: {
          formId,
          sharingScope,
          defaultPermission:
            sharingScope === SharingScope.ALL_ORG_MEMBERS
              ? defaultPermission
              : undefined,
          userPermissions: userPermissions.length > 0 ? userPermissions : undefined,
        },
      },
    });
  };

  // Handle add user to queue
  const handleAddUser = (userId: string, permission: PermissionLevel) => {
    const newSelectedUsers = new Map(selectedUsers);
    newSelectedUsers.set(userId, permission);
    setSelectedUsers(newSelectedUsers);
  };

  // Handle remove user from queue
  const handleRemoveSelectedUser = (userId: string) => {
    const newSelectedUsers = new Map(selectedUsers);
    newSelectedUsers.delete(userId);
    setSelectedUsers(newSelectedUsers);
  };

  // Handle update permission for existing user
  const handleUpdatePermission = (
    userId: string,
    permission: PermissionLevel
  ) => {
    updatePermission({
      variables: {
        input: {
          formId,
          userId,
          permission,
        },
      },
    });
  };

  // Handle remove access
  const handleRemoveAccess = (userId: string) => {
    removeAccess({
      variables: {
        formId,
        userId,
      },
    });
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get scope icon
  const getScopeIcon = (scope: SharingScope) => {
    switch (scope) {
      case SharingScope.PRIVATE:
        return <Lock className="h-4 w-4" />;
      case SharingScope.SPECIFIC_MEMBERS:
        return <Users className="h-4 w-4" />;
      case SharingScope.ALL_ORG_MEMBERS:
        return <Globe className="h-4 w-4" />;
    }
  };

  // Get scope label
  const getScopeLabel = (scope: SharingScope) => {
    switch (scope) {
      case SharingScope.PRIVATE:
        return t('shareModal.scopeSection.private.title');
      case SharingScope.SPECIFIC_MEMBERS:
        return t('shareModal.scopeSection.specific.title');
      case SharingScope.ALL_ORG_MEMBERS:
        return t('shareModal.scopeSection.allOrg.title');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{t('shareModal.title')}</DialogTitle>
          <DialogDescription>
            {t('shareModal.description', { formTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-4">
          {/* Copy Link Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium">
                    {t('shareModal.linkSection.label')}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {getFormViewerUrl(shortUrl)}
                  </p>
                </div>
                <Button onClick={handleCopyLink} variant="outline" size="sm">
                  {linkCopied ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {linkCopied
                    ? t('shareModal.linkSection.copiedButton')
                    : t('shareModal.linkSection.copyButton')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Sharing Scope Section */}
          <div className="space-y-3">
            <Label>{t('shareModal.scopeSection.label')}</Label>
            <Select
              value={sharingScope}
              onValueChange={(value) => setSharingScope(value as SharingScope)}
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  {getScopeIcon(sharingScope)}
                  <SelectValue>{getScopeLabel(sharingScope)}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SharingScope.PRIVATE}>
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <div>
                      <div className="font-medium">
                        {t('shareModal.scopeSection.private.title')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('shareModal.scopeSection.private.description')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.SPECIFIC_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div className="font-medium">
                        {t('shareModal.scopeSection.specific.title')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('shareModal.scopeSection.specific.description')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.ALL_ORG_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <div>
                      <div className="font-medium">
                        {t('shareModal.scopeSection.allOrg.title')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t('shareModal.scopeSection.allOrg.description')}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Default Permission for All Org Members */}
            {sharingScope === SharingScope.ALL_ORG_MEMBERS && (
              <div className="space-y-2 mt-3">
                <Label>{t('shareModal.defaultPermission.label')}</Label>
                <Select
                  value={defaultPermission}
                  onValueChange={(value) =>
                    setDefaultPermission(value as PermissionLevel)
                  }
                >
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      {permissionIconFor(defaultPermission)}
                      <SelectValue>
                      {permissionLabelFor(defaultPermission, t)}
                      </SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PermissionLevel.VIEWER}>
                      <div className="flex items-center gap-2">
                        {permissionIconFor(PermissionLevel.VIEWER)}
                        {t('shareModal.permissions.viewer')}
                      </div>
                    </SelectItem>
                    <SelectItem value={PermissionLevel.EDITOR}>
                      <div className="flex items-center gap-2">
                        {permissionIconFor(PermissionLevel.EDITOR)}
                        {t('shareModal.permissions.editor')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Add Members Section */}
          {(sharingScope === SharingScope.SPECIFIC_MEMBERS ||
            sharingScope === SharingScope.ALL_ORG_MEMBERS) && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>{t('shareModal.addMembers.label')}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('shareModal.addMembers.placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Selected users queue (to be added) */}
                {selectedUsers.size > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      {t('shareModal.addMembers.toBeAdded')}
                    </Label>
                    <div className="space-y-2">
                      {Array.from(selectedUsers.entries()).map(
                        ([userId, permission]) => {
                          const user =
                            organizationMembers.find((m) => m.id === userId) ?? {
                              id: userId,
                              name: 'Unknown member',
                              email: '',
                              image: '',
                            };

                          return (
                            <div
                              key={userId}
                              className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md"
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={user.image} />
                                  <AvatarFallback>
                                    {getInitials(user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="text-sm font-medium">
                                    {user.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.email}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={permission}
                                  onValueChange={(value) =>
                                    handleAddUser(userId, value as PermissionLevel)
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <div className="flex items-center gap-2">
                                      {permissionIconFor(permission)}
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={PermissionLevel.VIEWER}>
                                      <div className="flex items-center gap-2">
                                        {permissionIconFor(PermissionLevel.VIEWER)}
                                        {t('shareModal.permissions.viewer')}
                                      </div>
                                    </SelectItem>
                                    <SelectItem value={PermissionLevel.EDITOR}>
                                      <div className="flex items-center gap-2">
                                        {permissionIconFor(PermissionLevel.EDITOR)}
                                        {t('shareModal.permissions.editor')}
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveSelectedUser(userId)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                {/* Available members to add */}
                {searchQuery && availableMembers.length > 0 && (
                  <ScrollArea className="h-48 border rounded-md">
                    <div className="p-2 space-y-1">
                      {availableMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() =>
                            handleAddUser(member.id, PermissionLevel.VIEWER)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.image} />
                              <AvatarFallback>
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">
                                {member.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {searchQuery && availableMembers.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {t('shareModal.addMembers.noResults')}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Current Permissions Section */}
          {currentPermissions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label>{t('shareModal.currentAccess.label')}</Label>
                <div className="space-y-2">
                  {currentPermissions.map((permission) => {
                    const isOwner =
                      permission.permission === PermissionLevel.OWNER;
                    const isCurrentUser = permission.userId === currentUser?.id;

                    return (
                      <div
                        key={permission.id}
                        className="flex items-center justify-between p-3 border rounded-md"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={permission.user.image} />
                            <AvatarFallback>
                              {getInitials(permission.user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {permission.user.name}
                              </span>
                              {isCurrentUser && (
                                <Badge variant="secondary" className="text-xs">
                                  {t('shareModal.currentAccess.youBadge')}
                                </Badge>
                              )}
                              {isOwner && (
                                <Badge variant="default" className="text-xs">
                                  {t('shareModal.permissions.owner')}
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {permission.user.email}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isOwner && (
                            <>
                              <Select
                                value={permission.permission}
                                onValueChange={(value) =>
                                  handleUpdatePermission(
                                    permission.userId,
                                    value as PermissionLevel
                                  )
                                }
                                disabled={isCurrentUser}
                              >
                                <SelectTrigger className="w-32">
                                  <div className="flex items-center gap-2">
                                    {permissionIconFor(permission.permission)}
                                    <SelectValue />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={PermissionLevel.VIEWER}>
                                    <div className="flex items-center gap-2">
                                      {permissionIconFor(PermissionLevel.VIEWER)}
                                      {t('shareModal.permissions.viewer')}
                                    </div>
                                  </SelectItem>
                                  <SelectItem value={PermissionLevel.EDITOR}>
                                    <div className="flex items-center gap-2">
                                      {permissionIconFor(PermissionLevel.EDITOR)}
                                      {t('shareModal.permissions.editor')}
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleRemoveAccess(permission.userId)
                                }
                                disabled={isCurrentUser}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('shareModal.footer.cancel')}
          </Button>
          <Button onClick={handleShare} disabled={shareLoading}>
            {shareLoading
              ? t('shareModal.footer.sharing')
              : t('shareModal.footer.share')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
