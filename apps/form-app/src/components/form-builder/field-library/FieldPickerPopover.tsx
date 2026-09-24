import React, { useMemo, useRef, useState } from 'react';
import {
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@dculus/ui';
import { cn } from '@dculus/utils';
import { FieldType } from '@dculus/types';
import { Sparkles } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { useFieldCreation } from '../../../hooks/useFieldCreation';
import { useQuizMode } from '../../../contexts/QuizModeContext';
import {
  DraggableFieldType,
  getCategoriesConfig,
  getFieldTypesConfig,
  type FieldTypeConfig,
} from '../FieldTypesPanel';
import {
  recordRecentFieldType,
  useRecentFieldTypes,
} from './fieldLibraryStorage';
import { getSmartFieldSuggestions } from './smartSuggestions';

const CATEGORY_ORDER: FieldTypeConfig['category'][] = [
  'input',
  'choice',
  'content',
  'advanced',
];

interface FieldPickerPopoverProps {
  pageId: string;
  insertIndex?: number;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  idPrefix?: string;
  title?: string;
}

export const FieldPickerPopover: React.FC<FieldPickerPopoverProps> = ({
  pageId,
  insertIndex,
  children,
  align = 'center',
  side = 'bottom',
  sideOffset = 8,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  idPrefix = 'picker-',
  title,
}) => {
  const permissions = useFormPermissions();
  const canAdd = permissions.canAddFields();
  const { t } = useTranslation('fieldLibrary');
  const { t: tFieldTypes } = useTranslation('fieldTypesPanel');

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setIsOpen = (next: boolean) => {
    if (setControlledOpen) setControlledOpen(next);
    else setUncontrolledOpen(next);
  };

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { addField, addFieldAtIndex, pages, setSelectedField } = useFormBuilderStore();
  const { createFieldData } = useFieldCreation();
  const { enabled: isQuizModeEnabled } = useQuizMode();
  const recent = useRecentFieldTypes();

  const currentPage = useMemo(
    () => pages.find((p) => p.id === pageId),
    [pages, pageId]
  );

  const FIELD_TYPES = useMemo(() => getFieldTypesConfig(tFieldTypes), [tFieldTypes]);
  const CATEGORIES = useMemo(() => getCategoriesConfig(tFieldTypes), [tFieldTypes]);

  const smartSuggestions = useMemo(
    () => getSmartFieldSuggestions(currentPage?.fields || [], FIELD_TYPES, isQuizModeEnabled),
    [currentPage?.fields, FIELD_TYPES, isQuizModeEnabled]
  );

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    return FIELD_TYPES.filter((field) => {
      const matchesSearch = query
        ? field.label.toLowerCase().includes(query) ||
          field.description.toLowerCase().includes(query)
        : true;
      const matchesCategory =
        selectedCategory === 'all' || field.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [FIELD_TYPES, query, selectedCategory]);

  const grouped = useMemo(() => {
    return filtered.reduce(
      (acc, field) => {
        (acc[field.category] ??= []).push(field);
        return acc;
      },
      {} as Partial<Record<FieldTypeConfig['category'], FieldTypeConfig[]>>
    );
  }, [filtered]);

  const recentFieldTypes = useMemo(
    () =>
      recent
        .map((type) => FIELD_TYPES.find((field) => field.type === type))
        .filter((field): field is FieldTypeConfig => Boolean(field)),
    [recent, FIELD_TYPES]
  );

  const handleSelectField = (fieldType: FieldTypeConfig) => {
    if (!pageId) return;

    const previousFieldIds = new Set(currentPage?.fields.map((f) => f.id) ?? []);
    const fieldData = createFieldData(fieldType);

    if (insertIndex !== undefined) {
      addFieldAtIndex(pageId, fieldType.type as FieldType, fieldData, insertIndex);
    } else {
      addField(pageId, fieldType.type as FieldType, fieldData);
    }

    recordRecentFieldType(fieldType.type as FieldType);
    setIsOpen(false);
    setSearch('');
    setSelectedCategory('all');

    // Auto-select newly created field
    setTimeout(() => {
      const updatedPage = useFormBuilderStore
        .getState()
        .pages.find((p) => p.id === pageId);
      if (!updatedPage) return;
      const newField =
        updatedPage.fields.find((f) => !previousFieldIds.has(f.id)) ||
        (insertIndex !== undefined
          ? updatedPage.fields[insertIndex]
          : updatedPage.fields[updatedPage.fields.length - 1]);
      if (newField) {
        setSelectedField(newField.id);
      }
    }, 80);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[0]) handleSelectField(filtered[0]);
    } else if (e.key === 'Escape') {
      if (search) {
        e.stopPropagation();
        setSearch('');
      }
    }
  };

  if (!canAdd) return null;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        setIsOpen(next);
        if (!next) {
          setSearch('');
          setSelectedCategory('all');
        }
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="flex flex-col h-[520px] max-h-[85vh] w-[560px] overflow-hidden p-0 shadow-2xl rounded-2xl border-[var(--tf-border-medium)] dark:border-gray-700 bg-white dark:bg-card"
        align={align}
        side={side}
        sideOffset={sideOffset}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchInputRef.current?.focus();
        }}
      >
        {/* Pinned Header */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-3 bg-[var(--tf-faint)]/60 dark:bg-gray-800/40 border-b border-[var(--tf-border)]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#655d67] dark:text-gray-300">
              {title || t('title')}
            </span>
            {insertIndex !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--tf-icon-lavender)] text-[#5c2e6b] font-medium">
                {t('insertHere')}
              </span>
            )}
          </div>
        </div>

        {/* Pinned Search & Tabs */}
        <div className="shrink-0 p-4 pb-2 border-b border-[var(--tf-border)]/40 bg-white dark:bg-card">
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('search.placeholder')}
            data-testid={`${idPrefix}search`}
            className="mb-3 h-9 text-sm rounded-lg"
          />

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full transition-colors whitespace-nowrap',
                selectedCategory === 'all'
                  ? 'bg-[#3c323e] text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-[var(--tf-faint)] text-[var(--tf-muted)] hover:text-[var(--tf-dark)] hover:bg-[var(--tf-tab-bg)]'
              )}
            >
              {t('allCategories')}
            </button>
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  'text-xs font-medium px-2.5 py-1 rounded-full transition-colors whitespace-nowrap',
                  selectedCategory === category
                    ? 'bg-[#3c323e] text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-[var(--tf-faint)] text-[var(--tf-muted)] hover:text-[var(--tf-dark)] hover:bg-[var(--tf-tab-bg)]'
                )}
              >
                {CATEGORIES[category]?.label || category}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Field List with native smooth scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
            {/* Smart Suggestions Strip (Shown when not searching and on 'all' category) */}
            {!query && selectedCategory === 'all' && smartSuggestions.length > 0 && (
              <div className="rounded-xl p-3 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-amber-500/5 border border-purple-500/10">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                  <span>{t('suggested')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {smartSuggestions.map((fieldType) => (
                    <DraggableFieldType
                      key={`suggested-${fieldType.type}`}
                      fieldType={fieldType}
                      categories={CATEGORIES}
                      idPrefix={`${idPrefix}sug-`}
                      onAdd={() => handleSelectField(fieldType)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recently Used */}
            {!query && selectedCategory === 'all' && recentFieldTypes.length > 0 && (
              <div>
                <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
                  {t('recentlyUsed')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {recentFieldTypes.map((fieldType) => (
                    <DraggableFieldType
                      key={`recent-${fieldType.type}`}
                      fieldType={fieldType}
                      categories={CATEGORIES}
                      idPrefix={`${idPrefix}rec-`}
                      onAdd={() => handleSelectField(fieldType)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Categorized Fields */}
            {CATEGORY_ORDER.map((category) => {
              const fields = grouped[category];
              if (!fields?.length) return null;
              return (
                <div key={category} className="space-y-2">
                  <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
                    {CATEGORIES[category]?.label || category}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {fields.map((fieldType) => (
                      <DraggableFieldType
                        key={fieldType.type}
                        fieldType={fieldType}
                        categories={CATEGORIES}
                        idPrefix={idPrefix}
                        onAdd={() => handleSelectField(fieldType)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-[var(--tf-muted)]">
                {t('search.empty', { values: { query: search } })}
              </div>
            )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
export default FieldPickerPopover;
