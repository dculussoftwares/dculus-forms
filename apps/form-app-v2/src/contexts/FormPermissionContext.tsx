/**
 * Form Permission Context for Collaborative Form Builder
 * 
 * Provides permission-based access control for form editing operations.
 * Supports three permission levels: VIEWER, EDITOR, and OWNER.
 */

import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Permission levels for form access
 * - VIEWER: Can only view the form, no editing allowed
 * - EDITOR: Can edit fields and pages, but cannot change layout or delete form
 * - OWNER: Full control including layout changes, sharing, and deletion
 */
export type PermissionLevel = 'VIEWER' | 'EDITOR' | 'OWNER';

/**
 * Context value containing permission level and helper functions
 */
interface FormPermissionContextValue {
  /** Current user's permission level */
  userPermission: PermissionLevel;
  
  /** Check if user can edit fields and pages */
  canEdit: () => boolean;
  
  /** Check if user can edit layout (L1-L9, themes, etc.) */
  canEditLayout: () => boolean;
  
  /** Check if user can delete the form */
  canDelete: () => boolean;
  
  /** Check if user can share the form */
  canShare: () => boolean;
}

const FormPermissionContext = createContext<FormPermissionContextValue | null>(null);

/**
 * Hook to access form permissions
 * @throws Error if used outside FormPermissionProvider
 */
export const useFormPermissions = (): FormPermissionContextValue => {
  const context = useContext(FormPermissionContext);
  if (!context) {
    throw new Error('useFormPermissions must be used within FormPermissionProvider');
  }
  return context;
};

interface FormPermissionProviderProps {
  userPermission: PermissionLevel;
  children: ReactNode;
}

/**
 * Provider component for form permissions
 * 
 * @example
 * ```tsx
 * <FormPermissionProvider userPermission="EDITOR">
 *   <FormBuilder />
 * </FormPermissionProvider>
 * ```
 */
export const FormPermissionProvider: React.FC<FormPermissionProviderProps> = ({
  userPermission,
  children,
}) => {
  const canEdit = () => userPermission === 'EDITOR' || userPermission === 'OWNER';
  const canEditLayout = () => userPermission === 'OWNER';
  const canDelete = () => userPermission === 'OWNER';
  const canShare = () => userPermission === 'OWNER';

  const value: FormPermissionContextValue = {
    userPermission,
    canEdit,
    canEditLayout,
    canDelete,
    canShare,
  };

  return (
    <FormPermissionContext.Provider value={value}>
      {children}
    </FormPermissionContext.Provider>
  );
};
