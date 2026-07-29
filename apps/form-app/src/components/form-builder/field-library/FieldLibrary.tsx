import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { FieldType } from '@dculus/types';
import { Pin, PinOff, Plus } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import {
  DraggableFieldType,
  getCategoriesConfig,
  getFieldTypesConfig,
  type FieldTypeConfig,
} from '../FieldTypesPanel';
import {
  recordRecentFieldType,
  useFieldLibraryPinned,
  useRecentFieldTypes,
} from './fieldLibraryStorage';

const CATEGORY_ORDER: FieldTypeConfig['category'][] = [
  'input',
  'choice',
  'content',
  'advanced',
];

const groupByCategory = (
  fields: FieldTypeConfig[]
): Partial<Record<FieldTypeConfig['category'], FieldTypeConfig[]>> =>
  fields.reduce(
    (acc, field) => {
      (acc[field.category] ??= []).push(field);
      return acc;
    },
    {} as Partial<Record<FieldTypeConfig['category'], FieldTypeConfig[]>>
  );

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
};

interface FieldLibraryProps {
  /** "trigger": rail button + mega-panel popover (default mode).
   *  "docked": the persistent ~200px column, rendered only while pinned. */
  mode: 'trigger' | 'docked';
}

/**
 * FieldLibrary — replaces the permanent field-types column (#230). Both render
 * modes are fed by the same getFieldTypesConfig/getCategoriesConfig + the
 * DraggableFieldType drag source from FieldTypesPanel.tsx, so the dnd payload
 * ({type:'field-type', fieldType}) and `field-type-<label>` testids stay
 * identical to the classic panel and every existing drop handler keeps working.
 *
 * Pin state (dculus.fieldLibrary.pinned) is shared via localStorage between this
 * component's two independent mount points (the rail's trigger and PageBuilderTab's
 * docked column) since they sit in different parts of the layout tree.
 */
export const FieldLibrary: React.FC<FieldLibraryProps> = ({ mode }) => {
  const permissions = useFormPermissions();
  const { t } = useTranslation('fieldLibrary');
  const { t: tFieldTypes } = useTranslation('fieldTypesPanel');
  const [pinned, setPinned] = useFieldLibraryPinned();
  const recent = useRecentFieldTypes();
  const { selectedPageId, addField } = useFormBuilderStore();
  const { createFieldData } = useFieldCreation();

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canAdd = permissions.canAddFields();

  const FIELD_TYPES = useMemo(() => getFieldTypesConfig(tFieldTypes), [tFieldTypes]);
  const CATEGORIES = useMemo(() => getCategoriesConfig(tFieldTypes), [tFieldTypes]);

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? FIELD_TYPES.filter((field) => field.label.toLowerCase().includes(query))
        : FIELD_TYPES,
    [FIELD_TYPES, query]
  );
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const recentFieldTypes = useMemo(
    () =>
      recent
        .map((type) => FIELD_TYPES.find((field) => field.type === type))
        .filter((field): field is FieldTypeConfig => Boolean(field)),
    [recent, FIELD_TYPES]
  );

  const handleAdd = (fieldType: FieldTypeConfig) => {
    if (!selectedPageId) return;
    addField(selectedPageId, fieldType.type as FieldType, createFieldData(fieldType));
    recordRecentFieldType(fieldType.type as FieldType);
    setIsOpen(false);
    setSearch('');
  };

  // "/" opens the mega-panel with search focused, from anywhere in the Content
  // tab while not already typing. Only relevant for the trigger (unpinned)
  // instance — when pinned the library is already visible, docked, with no
  // search field.
  useEffect(() => {
    if (mode !== 'trigger' || !canAdd || pinned) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || isTypingTarget(e.target)) return;
      e.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, canAdd, pinned]);

  if (!canAdd) return null;

  if (mode === 'docked') {
    if (!pinned) return null;
    return (
      <div
        data-testid="field-library-docked"
        className="flex h-full w-[200px] shrink-0 flex-col overflow-hidden bg-white dark:bg-card"
        style={{ borderRight: '1px solid var(--tf-border)' }}
      >
        <div
          className="flex items-center gap-2 px-3 py-3.5"
          style={{ borderBottom: '1px solid var(--tf-border)' }}
        >
          <p className="flex-1 text-xs font-semibold uppercase tracking-wider text-[#655d67]">
            {t('dockedTitle')}
          </p>
          <Button
            variant="ghost"
            data-testid="field-library-unpin-button"
            title={t('unpin')}
            onClick={() => setPinned(false)}
            className="h-7 w-7 rounded-md p-0 text-[var(--tf-muted)] hover:text-[var(--tf-dark)]"
          >
            <PinOff className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-5 p-3">
            {CATEGORY_ORDER.map((category) => {
              const fields = grouped[category];
              if (!fields?.length) return null;
              return (
                <div key={category}>
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        CATEGORIES[category].color
                      )}
                    >
                      {CATEGORIES[category].label}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {fields.map((fieldType) => (
                      <DraggableFieldType
                        key={fieldType.type}
                        fieldType={fieldType}
                        categories={CATEGORIES}
                        onAdd={() => handleAdd(fieldType)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[0]) handleAdd(filtered[0]);
    } else if (e.key === 'Escape') {
      if (search) {
        e.stopPropagation();
        setSearch('');
      }
      // Otherwise let the Escape event bubble to Radix's dismissable layer,
      // which closes the popover.
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (pinned) {
          // The rail button always stays visible; while pinned, it toggles
          // the dock off instead of opening a redundant popover (same tile
          // types would otherwise get two DraggableFieldType instances with
          // the same dnd-kit id mounted at once).
          if (open) setPinned(false);
          return;
        }
        setIsOpen(open);
        if (!open) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          data-testid="rail-add-content-button"
          className="h-9 w-full justify-center gap-1.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          {t('trigger')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[520px] w-[560px] overflow-y-auto p-0"
        align="start"
        side="right"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3.5"
          style={{ borderBottom: '1px solid var(--tf-border)' }}
        >
          <p className="flex-1 text-xs font-semibold uppercase tracking-wider text-[#655d67]">
            {t('title')}
          </p>
          <Button
            variant="ghost"
            data-testid="field-library-pin-button"
            title={t('pin')}
            onClick={() => {
              // Close the popover as part of pinning — otherwise it stays open
              // alongside the newly-mounted docked column, mounting the same
              // field types twice (two DraggableFieldType instances sharing a
              // dnd-kit id) at once.
              setPinned(true);
              setIsOpen(false);
              setSearch('');
            }}
            className="h-7 gap-1 rounded-md px-2 text-xs font-medium text-[var(--tf-muted)] hover:text-[var(--tf-dark)]"
          >
            <Pin className="h-3.5 w-3.5" />
            {t('pin')}
          </Button>
        </div>

        <div className="p-4">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('search.placeholder')}
            data-testid="field-library-search"
            className="mb-4"
          />

          {!query && recentFieldTypes.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
                {t('recentlyUsed')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {recentFieldTypes.map((fieldType) => (
                  <DraggableFieldType
                    key={`recent-${fieldType.type}`}
                    fieldType={fieldType}
                    categories={CATEGORIES}
                    idPrefix="recent-"
                    onAdd={() => handleAdd(fieldType)}
                  />
                ))}
              </div>
            </div>
          )}

          {CATEGORY_ORDER.map((category) => {
            const fields = grouped[category];
            if (!fields?.length) return null;
            return (
              <div key={category} className="mb-4 last:mb-0">
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
                  {CATEGORIES[category].label}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {fields.map((fieldType) => (
                    <DraggableFieldType
                      key={fieldType.type}
                      fieldType={fieldType}
                      categories={CATEGORIES}
                      onAdd={() => handleAdd(fieldType)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-1 text-xs text-[var(--tf-muted)]">
              {t('search.empty', { values: { query: search } })}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FieldLibrary;
