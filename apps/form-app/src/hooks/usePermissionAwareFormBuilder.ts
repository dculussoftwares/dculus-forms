import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { useFormPermissions } from './useFormPermissions';
import { FieldType } from '@dculus/types';

/**
 * Permission-aware wrapper around useFormBuilderStore
 * Enforces permission checks for all editing operations
 */
export const usePermissionAwareFormBuilder = () => {
  const store = useFormBuilderStore();
  const permissions = useFormPermissions();

  // Helper function for permission violations
  const handlePermissionViolation = (action: string) => {
    console.warn(`Permission denied: ${action} - User has ${permissions.userPermission} access`);
    // Could show a toast notification here
    // toast.error(`You don't have permission to ${action.toLowerCase()}`);
  };

  // Wrap store methods with permission checks
  const permissionAwareStore = {
    // Read-only properties (always allowed)
    ...store,

    // Editing operations - require EDITOR or OWNER permissions
    addEmptyPage: () => {
      if (!permissions.canAddPages()) {
        handlePermissionViolation('Add pages');
        return undefined;
      }
      return store.addEmptyPage();
    },

    removePage: (pageId: string) => {
      if (!permissions.canDeletePages()) {
        handlePermissionViolation('Delete pages');
        return;
      }
      store.removePage(pageId);
    },

    duplicatePage: (pageId: string) => {
      if (!permissions.canAddPages()) {
        handlePermissionViolation('Duplicate pages');
        return;
      }
      store.duplicatePage(pageId);
    },

    addField: (pageId: string, fieldType: FieldType, fieldData?: any) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Add fields');
        return;
      }
      store.addField(pageId, fieldType, fieldData);
    },

    addFieldAtIndex: (pageId: string, fieldType: FieldType, fieldData: any, insertIndex: number) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Add fields');
        return;
      }
      store.addFieldAtIndex(pageId, fieldType, fieldData, insertIndex);
    },

    updateField: (pageId: string, fieldId: string, updates: any) => {
      if (!permissions.canEditFields()) {
        handlePermissionViolation('Edit fields');
        return;
      }
      store.updateField(pageId, fieldId, updates);
    },

    removeField: (pageId: string, fieldId: string) => {
      if (!permissions.canDeleteFields()) {
        handlePermissionViolation('Delete fields');
        return;
      }
      store.removeField(pageId, fieldId);
    },

    duplicateField: (pageId: string, fieldId: string) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Duplicate fields');
        return;
      }
      store.duplicateField(pageId, fieldId);
    },

    reorderFields: (pageId: string, oldIndex: number, newIndex: number) => {
      if (!permissions.canReorderFields()) {
        handlePermissionViolation('Reorder fields');
        return;
      }
      store.reorderFields(pageId, oldIndex, newIndex);
    },

    reorderPages: (oldIndex: number, newIndex: number) => {
      if (!permissions.canReorderPages()) {
        handlePermissionViolation('Reorder pages');
        return;
      }
      store.reorderPages(oldIndex, newIndex);
    },

    moveFieldBetweenPages: (sourcePageId: string, targetPageId: string, fieldId: string, insertIndex?: number) => {
      if (!permissions.canEditFields()) {
        handlePermissionViolation('Move fields');
        return;
      }
      store.moveFieldBetweenPages(sourcePageId, targetPageId, fieldId, insertIndex);
    },

    copyFieldToPage: (sourcePageId: string, targetPageId: string, fieldId: string) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Copy fields');
        return;
      }
      store.copyFieldToPage(sourcePageId, targetPageId, fieldId);
    },

    updateLayout: (layoutUpdates: any) => {
      if (!permissions.canEditLayout()) {
        handlePermissionViolation('Edit layout');
        return;
      }
      store.updateLayout(layoutUpdates);
    },

    // Selection operations (always allowed for navigation)
    setSelectedPage: store.setSelectedPage,
    setSelectedField: store.setSelectedField,

    // Read operations (always allowed)
    getSelectedField: store.getSelectedField,
  };

  return {
    ...permissionAwareStore,
    permissions,
  };
};