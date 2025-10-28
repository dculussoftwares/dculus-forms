import { createContext, useContext, type ReactNode } from 'react';

export type PermissionLevel = 'OWNER' | 'EDITOR' | 'VIEWER' | 'NO_ACCESS';

export interface FormPermissionContextValue {
  userPermission: PermissionLevel;
  canEdit: boolean;
  canView: boolean;
  canManageSharing: boolean;
  canDelete: boolean;
  canSave: boolean;
  isReadOnly: boolean;
}

const FormPermissionContext = createContext<FormPermissionContextValue | undefined>(undefined);

interface FormPermissionProviderProps {
  children: ReactNode;
  userPermission: PermissionLevel;
}

export const FormPermissionProvider = ({
  children,
  userPermission,
}: FormPermissionProviderProps) => {
  const canEdit = userPermission === 'OWNER' || userPermission === 'EDITOR';
  const canView = userPermission !== 'NO_ACCESS';
  const canManageSharing =
    userPermission === 'OWNER' || userPermission === 'EDITOR' || userPermission === 'VIEWER';
  const canDelete = userPermission === 'OWNER';
  const canSave = canEdit;
  const isReadOnly = userPermission === 'VIEWER';

  const value: FormPermissionContextValue = {
    userPermission,
    canEdit,
    canView,
    canManageSharing,
    canDelete,
    canSave,
    isReadOnly,
  };

  return (
    <FormPermissionContext.Provider value={value}>
      {children}
    </FormPermissionContext.Provider>
  );
};

export const useFormPermission = () => {
  const context = useContext(FormPermissionContext);
  if (context === undefined) {
    throw new Error('useFormPermission must be used within a FormPermissionProvider');
  }
  return context;
};
