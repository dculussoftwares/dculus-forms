import { useFormPermission, PermissionLevel } from '../contexts/FormPermissionContext';

export const useFormPermissions = () => {
  const permission = useFormPermission();

  // Permission checking utilities
  const hasPermission = (requiredLevel: PermissionLevel): boolean => {
    const permissionLevels = {
      'NO_ACCESS': 0,
      'VIEWER': 1,
      'EDITOR': 2,
      'OWNER': 3,
    };

    const userLevel = permissionLevels[permission.userPermission];
    const requiredLevelValue = permissionLevels[requiredLevel];

    return userLevel >= requiredLevelValue;
  };

  // Specific permission checks
  const canAddFields = () => permission.canEdit;
  const canEditFields = () => permission.canEdit;
  const canDeleteFields = () => permission.canEdit;
  const canReorderFields = () => permission.canEdit;
  const canAddPages = () => permission.canEdit;
  const canDeletePages = () => permission.canEdit;
  const canReorderPages = () => permission.canEdit;
  const canEditLayout = () => permission.canEdit;
  const canEditSettings = () => permission.canEdit;
  const canSaveForm = () => permission.canSave;
  const canShareForm = () => permission.canManageSharing;
  const canDeleteForm = () => permission.canDelete;

  // UI helper functions
  const getPermissionMessage = (): string => {
    switch (permission.userPermission) {
      case 'VIEWER':
        return 'You have view-only access to this form. Contact the form owner to request editing permissions.';
      case 'EDITOR':
        return 'You can edit this form but cannot delete it or manage sharing settings.';
      case 'OWNER':
        return 'You have full control over this form.';
      default:
        return 'You do not have access to this form.';
    }
  };

  const getPermissionLabel = (): string => {
    switch (permission.userPermission) {
      case 'VIEWER':
        return 'View Only';
      case 'EDITOR':
        return 'Editor';
      case 'OWNER':
        return 'Owner';
      default:
        return 'No Access';
    }
  };

  const getPermissionColor = (): string => {
    switch (permission.userPermission) {
      case 'VIEWER':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'EDITOR':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'OWNER':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return {
    ...permission,
    hasPermission,
    canAddFields,
    canEditFields,
    canDeleteFields,
    canReorderFields,
    canAddPages,
    canDeletePages,
    canReorderPages,
    canEditLayout,
    canEditSettings,
    canSaveForm,
    canShareForm,
    canDeleteForm,
    getPermissionMessage,
    getPermissionLabel,
    getPermissionColor,
  };
};