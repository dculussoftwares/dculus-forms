import { useFormBuilderStore } from '../store/useFormBuilderStore';
import { useFormPermissions } from './useFormPermissions';
import { FieldType } from '@dculus/types';
import { toastError } from '@dculus/ui';

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
    toastError(
      'Permission denied', 
      `You don't have permission to ${action.toLowerCase()}. You need ${permissions.userPermission === 'VIEWER' ? 'EDITOR' : 'OWNER'} access.`
    );
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

    // Grid layout actions (docs/grid-layout-strategy.md §7.2)
    addGrid: (...args: Parameters<typeof store.addGrid>) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Add fields');
        return undefined;
      }
      return store.addGrid(...args);
    },

    addFieldToGrid: (...args: Parameters<typeof store.addFieldToGrid>) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Add fields');
        return undefined;
      }
      return store.addFieldToGrid(...args);
    },

    duplicateGrid: (...args: Parameters<typeof store.duplicateGrid>) => {
      if (!permissions.canAddFields()) {
        handlePermissionViolation('Duplicate fields');
        return undefined;
      }
      return store.duplicateGrid(...args);
    },

    placeField: (...args: Parameters<typeof store.placeField>) => {
      if (!permissions.canReorderFields()) {
        handlePermissionViolation('Reorder fields');
        return false;
      }
      return store.placeField(...args);
    },

    setGridColumnWidths: (...args: Parameters<typeof store.setGridColumnWidths>) => {
      if (!permissions.canEditFields()) {
        handlePermissionViolation('Edit fields');
        return;
      }
      store.setGridColumnWidths(...args);
    },

    ungroupGrid: (...args: Parameters<typeof store.ungroupGrid>) => {
      if (!permissions.canEditFields()) {
        handlePermissionViolation('Edit fields');
        return;
      }
      store.ungroupGrid(...args);
    },

    removeGrid: (...args: Parameters<typeof store.removeGrid>) => {
      if (!permissions.canDeleteFields()) {
        handlePermissionViolation('Delete fields');
        return undefined;
      }
      return store.removeGrid(...args);
    },

    restoreGrid: (...args: Parameters<typeof store.restoreGrid>) => {
      if (!permissions.canDeleteFields()) {
        handlePermissionViolation('Delete fields');
        return false;
      }
      return store.restoreGrid(...args);
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