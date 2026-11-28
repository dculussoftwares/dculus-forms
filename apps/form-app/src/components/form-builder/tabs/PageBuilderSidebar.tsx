import React, { useState, useCallback } from 'react';
import { FormLayout } from '@dculus/types';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import FieldSettingsV2 from '../FieldSettingsV2';
import { IntroSettingsPanel } from '../panels/IntroSettingsPanel';
import { EndingSettingsPanel } from '../panels/EndingSettingsPanel';
import { PageSettingsPanel } from '../panels/PageSettingsPanel';
import { FormGlancePanel } from '../panels/FormGlancePanel';
import { FieldLogicSummaryRow } from '../panels/FieldLogicSummaryRow';

import { GripHorizontal } from 'lucide-react';

// =============================================================================
// RightSidebar
// =============================================================================

/**
 * RightSidebar - Contextual settings panel driven by `selection.kind`.
 * intro/thankYou/page/field each get their own pane (see
 * components/form-builder/panels/) — this component just routes between them.
 * The JSON debug view that used to live here as a second tab moved to the
 * header's dev-only ⋮ menu entry (#234) — see FormBuilderHeader.tsx.
 */
export const RightSidebar: React.FC<{
  width: number;
  onWidthChange: (width: number) => void;
  /** Opens the Design drawer scrolled to Brand & style. */
  onOpenBrand?: () => void;
}> = ({ width, onWidthChange, onOpenBrand }) => {
  const permissions = useFormPermissions();
  const [isResizing, setIsResizing] = useState(false);

  const {
    selection,
    selectedFieldId,
    updateField,
    removeField,
    isConnected,
    pages,
    layout,
    formId,
    setSelectedField,
    updateLayout,
  } = useFormBuilderStore();

  const selectedField = useFormBuilderStore((state) => {
    if (!selectedFieldId) return null;
    for (const page of state.pages) {
      const field = page.fields.find((f) => f.id === selectedFieldId);
      if (field) return field;
    }
    return null;
  });

  const selectedPage =
    selection.kind === 'page' ? pages.find((page) => page.id === selection.pageId) || null : null;

  // fieldId is explicit: pending edits can be flushed after selection has moved to another field
  const handleUpdate = (updates: Record<string, unknown>, fieldId: string) => {
    const pageWithField = useFormBuilderStore
      .getState()
      .pages.find((page) => page.fields.some((f) => f.id === fieldId));
    if (pageWithField) {
      updateField(pageWithField.id, fieldId, updates);
    }
  };

  const handleDelete = () => {
    if (selectedFieldId) {
      const pageWithField = pages.find((page) =>
        page.fields.some((f) => f.id === selectedFieldId)
      );
      if (pageWithField) {
        removeField(pageWithField.id, selectedFieldId);
        setSelectedField(null);
      }
    }
  };

  const handleLayoutUpdate = (updates: Partial<FormLayout>) => {
    if (permissions.canEditLayout()) {
      updateLayout(updates);
    }
  };

  // Resize handle functionality
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      e.preventDefault();

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = startX - e.clientX;
        const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
        onWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, onWidthChange]
  );

  const renderPropertiesPane = () => {
    if (selection.kind === 'intro') {
      return (
        <IntroSettingsPanel
          layout={layout}
          formId={formId || ''}
          canEditLayout={permissions.canEditLayout()}
          onLayoutSelect={(code) => handleLayoutUpdate({ code })}
          onLayoutUpdate={handleLayoutUpdate}
          onOpenBrand={onOpenBrand}
        />
      );
    }

    if (selection.kind === 'thankYou') {
      return (
        <EndingSettingsPanel
          layout={layout}
          pages={pages}
          canEditLayout={permissions.canEditLayout()}
          onLayoutUpdate={handleLayoutUpdate}
        />
      );
    }

    if (selection.kind === 'page' && selectedPage) {
      return <PageSettingsPanel page={selectedPage} isConnected={isConnected} />;
    }

    if (selectedField) {
      return (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <FieldSettingsV2
              field={selectedField}
              isConnected={isConnected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
          <FieldLogicSummaryRow fieldId={selectedField.id} />
        </div>
      );
    }

    return (
      <FormGlancePanel
        onOpenBrand={permissions.canEditLayout() ? onOpenBrand : undefined}
      />
    );
  };

  return (
    <div
      className="bg-white dark:bg-card flex h-full min-h-0 flex-col relative"
      style={{ borderLeft: '1px solid var(--tf-border)', width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[rgba(60,50,62,0.20)]
          ${isResizing ? 'bg-[rgba(60,50,62,0.40)]' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <GripHorizontal className="w-4 h-4 text-muted-foreground rotate-90" />
        </div>
      </div>

      {renderPropertiesPane()}
    </div>
  );
};
