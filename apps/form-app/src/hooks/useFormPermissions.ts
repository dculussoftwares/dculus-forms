import { useFormPermission, PermissionLevel } from '../contexts/FormPermissionContext';
import { useTranslation } from './useTranslation';

export const useFormPermissions = () => {
  const permission = useFormPermission();
  const { t } = useTranslation('permissions');

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
        return t('messages.viewerAccess');
      case 'EDITOR':
        return t('messages.editorAccess');
      case 'OWNER':
        return t('messages.ownerAccess');
      default:
        return t('messages.noAccessToForm');
    }
  };

  const getPermissionLabel = (): string => {
    switch (permission.userPermission) {
      case 'VIEWER':
        return t('roles.viewer');
      case 'EDITOR':
        return t('roles.editor');
      case 'OWNER':
        return t('roles.owner');
      default:
        return t('roles.noAccess');
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