/**
 * One delete path for a grid and its questions (docs/grid-layout-strategy.md §8.6, §8.7): the canvas
 * toolbar, the settings panel and the keyboard all soft-delete through `removeGrid` and offer Undo,
 * plus "Ungroup instead", which brings the questions back without their columns.
 */
import React from 'react';
import { toast } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';

/** `canEdit` is the caller's own editability (permissions, connection, read-only mode). */
export const useDeleteGridWithUndo = (canEdit: boolean) => {
  const { t } = useTranslation('gridLayout');
  // The toast outlives the component that raised it and editability can change, so re-check at click time
  const canEditRef = React.useRef(canEdit);
  canEditRef.current = canEdit;

  return React.useCallback(
    (pageId: string, gridId: string): boolean => {
      if (!canEditRef.current) return false;
      const { removeGrid, selectedFieldId, setSelectedField } = useFormBuilderStore.getState();
      const snapshot = removeGrid(pageId, gridId, { deleteChildren: true });
      if (!snapshot) return false;
      if (selectedFieldId === gridId) setSelectedField(null);

      const canRestore = () => canEditRef.current && useFormBuilderStore.getState().isConnected;

      toast({
        title: t('block.deleted'),
        action: {
          label: t('block.undo'),
          onClick: () => {
            if (!canRestore()) return;
            if (useFormBuilderStore.getState().restoreGrid(pageId, snapshot)) {
              useFormBuilderStore.getState().setSelectedField(gridId);
            }
          },
        },
        secondaryAction: {
          label: t('block.ungroupInstead'),
          onClick: () => {
            if (!canRestore()) return;
            const { restoreGrid, ungroupGrid } = useFormBuilderStore.getState();
            if (restoreGrid(pageId, snapshot)) ungroupGrid(pageId, gridId);
          },
        },
      });
      return true;
    },
    [t]
  );
};
