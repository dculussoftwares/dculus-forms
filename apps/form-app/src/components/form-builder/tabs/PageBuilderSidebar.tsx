import React, { useState, useCallback, useRef } from 'react';
import { FormLayout } from '@dculus/types';
import { ScrollArea, Button } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks';
import FieldSettingsV2 from '../FieldSettingsV2';
import { JSONPreview } from '../JSONPreview';
import { IntroSettingsPanel } from '../panels/IntroSettingsPanel';
import { EndingSettingsPanel } from '../panels/EndingSettingsPanel';
import { PageSettingsPanel } from '../panels/PageSettingsPanel';
import { FieldLogicSummaryRow } from '../panels/FieldLogicSummaryRow';

import { GripHorizontal, Settings, Code } from 'lucide-react';

// =============================================================================
// RightSidebar
// =============================================================================

/**
 * RightSidebar - Contextual settings panel driven by `selection.kind`, plus a
 * JSON debug view. intro/thankYou/page/field each get their own pane (see
 * components/form-builder/panels/) — this component just routes between them.
 */
export const RightSidebar: React.FC<{
  width: number;
  onWidthChange: (width: number) => void;
}> = ({ width, onWidthChange }) => {
  const { t } = useTranslation('pageBuilderTab');
  const permissions = useFormPermissions();
  const [activeTab, setActiveTab] = useState<'properties' | 'json'>('properties');
  const [isResizing, setIsResizing] = useState(false);
  const prevSelectionKeyRef = useRef<string | null>(null);

  const {
    selection,
    selectedFieldId,
    updateField,
    removeField,
    isConnected,
    pages,
    layout,
    formId,
    isShuffleEnabled,
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

  // Auto-switch to properties whenever the selection itself changes (new field,
  // new page, or a different pane like intro/thankYou) — but not on incidental
  // re-renders that don't actually change what's selected.
  const selectionKey = `${selection.kind}:${selection.pageId ?? ''}:${selection.fieldId ?? ''}`;
  React.useEffect(() => {
    if (selectionKey !== prevSelectionKeyRef.current) {
      setActiveTab('properties');
    }
    prevSelectionKeyRef.current = selectionKey;
  }, [selectionKey]);

  const handleUpdate = (updates: Record<string, unknown>) => {
    if (selectedFieldId) {
      const pageWithField = pages.find((page) =>
        page.fields.some((f) => f.id === selectedFieldId)
      );
      if (pageWithField) {
        updateField(pageWithField.id, selectedFieldId, updates);
      }
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
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--tf-icon-gray)] flex items-center justify-center mb-3">
            <Settings className="w-4.5 h-4.5 text-[#655d67]" />
          </div>
          <p className="text-sm font-medium text-[#4c414e] dark:text-gray-300">{t('emptyState.title')}</p>
          <p className="text-xs text-[#655d67] dark:text-gray-500 mt-1">{t('emptyState.description')}</p>
        </div>
      </ScrollArea>
    );
  };

  return (
    <div
      className="bg-white dark:bg-card flex flex-col relative"
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

      {/* Tab Navigation */}
      {/* Typeform-style underline tab row */}
      <div className="flex" style={{ borderBottom: '1px solid var(--tf-border)' }}>
        {([
          { id: 'properties' as const, icon: Settings, label: t('tabs.field') },
          { id: 'json' as const, icon: Code, label: t('tabs.json') },
        ] as const).map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            variant="ghost"
            onClick={() => setActiveTab(id)}
            className="relative flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors h-auto rounded-none"
            style={{ color: activeTab === id ? 'var(--tf-dark)' : 'var(--tf-muted)' }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full" style={{ backgroundColor: 'var(--tf-dark)' }} />
            )}
          </Button>
        ))}
      </div>

      {activeTab === 'properties' ? (
        renderPropertiesPane()
      ) : (
        <ScrollArea className="flex-1">
          <div className="h-full">
            <JSONPreview
              pages={pages}
              layout={layout}
              isShuffleEnabled={isShuffleEnabled}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
