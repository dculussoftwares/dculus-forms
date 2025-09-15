import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
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
  Card,
  CardContent,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  toastSuccess,
  toastError
} from '@dculus/ui';
import {
  Users,
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
  formShortUrl: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  formId,
  formTitle,
  organizationId,
  currentUserId,
  formShortUrl
}) => {
  const [sharingScope, setSharingScope] = useState<SharingScope>(SharingScope.PRIVATE);
  const [defaultPermission, setDefaultPermission] = useState<PermissionLevel>(PermissionLevel.VIEWER);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, PermissionLevel>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

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
      toastSuccess('Form sharing settings updated successfully');
      refetchPermissions();
    },
    onError: (error) => {
      toastError('Failed to update sharing settings', error.message);
    }
  });

  const [updatePermission] = useMutation(UPDATE_FORM_PERMISSION, {
    onCompleted: () => {
      toastSuccess('User permission updated successfully');
      refetchPermissions();
    },
    onError: (error) => {
      toastError('Failed to update user permission', error.message);
    }
  });

  const [removeAccess] = useMutation(REMOVE_FORM_ACCESS, {
    onCompleted: () => {
      toastSuccess('User access removed successfully');
      refetchPermissions();
    },
    onError: (error) => {
      toastError('Failed to remove user access', error.message);
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

  // Copy link functionality
  const handleCopyLink = async () => {
    const formUrl = `${window.location.origin}/form/${formShortUrl}`;
    try {
      await navigator.clipboard.writeText(formUrl);
      setLinkCopied(true);
      toastSuccess('Form link copied to clipboard');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toastError('Failed to copy link', 'Unable to access clipboard');
    }
  };

  // Permission level icons and labels
  const getPermissionIcon = (permission: PermissionLevel) => {
    switch (permission) {
      case PermissionLevel.OWNER:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case PermissionLevel.EDITOR:
        return <Edit className="w-4 h-4 text-blue-500" />;
      case PermissionLevel.VIEWER:
        return <Eye className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getPermissionLabel = (permission: PermissionLevel) => {
    switch (permission) {
      case PermissionLevel.OWNER:
        return 'Owner';
      case PermissionLevel.EDITOR:
        return 'Editor';
      case PermissionLevel.VIEWER:
        return 'Viewer';
      default:
        return 'No Access';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share "{formTitle}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Copy Link Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Form Link</Label>
                  <p className="text-sm text-gray-500 mt-1">
                    Anyone with this link can view the form
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="ml-4"
                >
                  {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {linkCopied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sharing Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Sharing Scope</Label>
            <Select value={sharingScope} onValueChange={(value) => setSharingScope(value as SharingScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SharingScope.PRIVATE}>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Private - Only specific people
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.SPECIFIC_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Specific members
                  </div>
                </SelectItem>
                <SelectItem value={SharingScope.ALL_ORG_MEMBERS}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    All organization members
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Default Permission for Organization Members */}
          {sharingScope === SharingScope.ALL_ORG_MEMBERS && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Default Permission for Organization Members</Label>
              <Select value={defaultPermission} onValueChange={(value) => setDefaultPermission(value as PermissionLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PermissionLevel.VIEWER}>Viewer - Can view form</SelectItem>
                  <SelectItem value={PermissionLevel.EDITOR}>Editor - Can edit form</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Add People Section */}
          {(sharingScope === SharingScope.SPECIFIC_MEMBERS || sharingScope === SharingScope.ALL_ORG_MEMBERS) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Add People</Label>
              <div className="space-y-3">
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
                
                {/* Selected users to be added */}
                {selectedUsers.size > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-gray-500">To be added:</Label>
                    {Array.from(selectedUsers.entries()).map(([userId, permission]) => {
                      const user = organizationMembers.find((m: User) => m.id === userId);
                      if (!user) return null;
                      
                      return (
                        <div key={userId} className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.image} />
                              <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
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
                                <SelectItem value={PermissionLevel.VIEWER}>Viewer</SelectItem>
                                <SelectItem value={PermissionLevel.EDITOR}>Editor</SelectItem>
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
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                      onClick={() => handleAddUser(member.id, PermissionLevel.VIEWER)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.image} />
                          <AvatarFallback>{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && searchQuery && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No members found matching "{searchQuery}"
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Current Permissions */}
          {currentPermissions.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">People with access</Label>
              <div className="space-y-2">
                {currentPermissions.map((permission: FormPermission) => (
                  <div key={permission.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={permission.user.image} />
                        <AvatarFallback>{permission.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{permission.user.name}</p>
                        <p className="text-xs text-gray-500">{permission.user.email}</p>
                      </div>
                      {permission.permission === PermissionLevel.OWNER && (
                        <Badge variant="secondary" className="text-xs">
                          Owner
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
                            <SelectItem value={PermissionLevel.VIEWER}>Viewer</SelectItem>
                            <SelectItem value={PermissionLevel.EDITOR}>Editor</SelectItem>
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
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={sharing}
              className="min-w-[100px]"
            >
              {sharing ? 'Sharing...' : 'Share'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};