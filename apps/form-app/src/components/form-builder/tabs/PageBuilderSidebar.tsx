import React, { useState, useCallback, useRef } from 'react';
import { ScrollArea, Button } from '@dculus/ui';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks';
import FieldSettingsV2 from '../FieldSettingsV2';
import { JSONPreview } from '../JSONPreview';

import { GripHorizontal, Settings, Code } from 'lucide-react';

// =============================================================================
// RightSidebar
// =============================================================================

/**
 * RightSidebar - Shows field settings and JSON preview with resizable width.
 * Pages now live in the journey rail (see components/form-builder/rail) — this
 * sidebar is purely contextual: field properties when a field is selected,
 * otherwise an empty state, plus a JSON debug view.
 */
export const RightSidebar: React.FC<{
  width: number;
  onWidthChange: (width: number) => void;
}> = ({ width, onWidthChange }) => {
  const { t } = useTranslation('pageBuilderTab');
  const [activeTab, setActiveTab] = useState<'properties' | 'json'>('properties');
  const [isResizing, setIsResizing] = useState(false);
  const prevSelectedFieldIdRef = useRef<string | null>(null);

  const { selectedFieldId, updateField, removeField, isConnected, pages, layout, isShuffleEnabled, setSelectedField } =
    useFormBuilderStore();

  const selectedField = useFormBuilderStore((state) => {
    if (!selectedFieldId) return null;
    for (const page of state.pages) {
      const field = page.fields.find((f) => f.id === selectedFieldId);
      if (field) return field;
    }
    return null;
  });

  // Auto-switch to properties when a field is newly selected (but not on field move)
  React.useEffect(() => {
    if (selectedFieldId && selectedFieldId !== prevSelectedFieldIdRef.current) {
      // Switch to properties when a different field is selected
      setActiveTab('properties');
    }
    prevSelectedFieldIdRef.current = selectedFieldId;
  }, [selectedFieldId]);

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
          { id: 'json' as const, icon: Code, label: 'JSON' },
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

      {activeTab === 'properties' && selectedField ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <FieldSettingsV2
            field={selectedField}
            isConnected={isConnected}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {activeTab === 'properties' ? (
            /* Properties Tab Content — empty state (intro/thankYou selections land
               here too until the contextual right panel ticket, #229) */
            <div className="flex flex-col items-center justify-center h-64 p-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--tf-icon-gray)] flex items-center justify-center mb-3">
                <Settings className="w-4.5 h-4.5 text-[#655d67]" />
              </div>
              <p className="text-sm font-medium text-[#4c414e] dark:text-gray-300">{t('emptyState.title')}</p>
              <p className="text-xs text-[#655d67] dark:text-gray-500 mt-1">Click a field to edit its settings</p>
            </div>
          ) : (
            /* JSON Tab Content */
            <div className="h-full">
              <JSONPreview
                pages={pages}
                layout={layout}
                isShuffleEnabled={isShuffleEnabled}
              />
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
};
