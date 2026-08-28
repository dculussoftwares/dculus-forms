import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Badge, Button, Checkbox, Input } from '@dculus/ui';
import { FormPage } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { TargetFieldOption } from './conditionFieldConfig';
import { fieldVisual } from './logicVisuals';

interface TargetFieldPickerProps {
  options: TargetFieldOption[];
  selectedIds: string[];
  onChange: (fieldIds: string[]) => void;
  pages: FormPage[];
  disabled?: boolean;
  /** Index of the owning action row — used to build the stable per-target testid. */
  actionIndex: number;
}

/**
 * Multi-select target picker: chips for what's chosen, a filter box, and a
 * page-grouped checklist with per-page select-all.
 *
 * The old control was a bare `max-h-36` scroll box of unsorted checkboxes with no
 * search — on a 40-field form you scrolled a 140px window hunting for a label, and
 * the current selection was only legible by re-scanning every checkbox.
 *
 * The checklist stays inline rather than behind a popover so every target row is
 * always present in the DOM; the E2E suite clicks
 * `condition-action-target-<actionIndex>-<fieldId>` directly.
 */
export const TargetFieldPicker: React.FC<TargetFieldPickerProps> = ({
  options,
  selectedIds,
  onChange,
  pages,
  disabled,
  actionIndex,
}) => {
  const { t } = useTranslation('conditions');
  const [query, setQuery] = useState('');

  const pageLabel = (page: FormPage, pageIndex: number) =>
    page.title
      ? t('editor.pageWithTitle', { values: { number: pageIndex + 1, title: page.title } })
      : t('editor.page', { values: { number: pageIndex + 1 } });

  const toggle = (fieldId: string, checked: boolean) => {
    onChange(checked ? [...selectedIds, fieldId] : selectedIds.filter((id) => id !== fieldId));
  };

  const normalizedQuery = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const byPage = new Map<
      string,
      { key: string; label: string; options: TargetFieldOption[] }
    >();
    for (const option of options) {
      // Filtering hides rows from view but never from selection — a target that
      // no longer matches the query stays selected and stays visible as a chip.
      if (normalizedQuery && !option.label.toLowerCase().includes(normalizedQuery)) continue;
      const key = option.page.id;
      const existing = byPage.get(key);
      if (existing) existing.options.push(option);
      else
        byPage.set(key, {
          key,
          label: pageLabel(option.page, option.pageIndex),
          options: [option],
        });
    }
    return Array.from(byPage.values());
  }, [options, normalizedQuery, t]);

  const selectedOptions = selectedIds
    .map((id) => options.find((option) => option.field.id === id))
    .filter((option): option is TargetFieldOption => Boolean(option));

  return (
    <div className="space-y-2">
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((option) => {
            const visual = fieldVisual(option.field);
            return (
              <Badge
                key={option.field.id}
                variant="outline"
                className="gap-1.5 py-1 pl-1.5 pr-1.5 text-xs font-medium"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded',
                    visual.tileClass
                  )}
                >
                  <visual.Icon className="h-2.5 w-2.5" />
                </span>
                <span className="max-w-[9rem] truncate">{option.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => toggle(option.field.id, false)}
                    aria-label={t('editor.removeTarget', { values: { field: option.label } })}
                    className="rounded-full p-0.5 hover:bg-accent"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('editor.searchFields')}
          disabled={disabled}
          className="h-10 pl-8 text-sm"
        />
      </div>

      {/* A tint rather than a border: the list has to show a boundary or a
          clipped final row reads as broken content, but an outline here would put
          this list inside yet another box. */}
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg bg-[var(--tf-faint)] p-2 dark:bg-gray-800/40">
        {groups.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('editor.noFieldsFound')}
          </p>
        )}
        {groups.map((group) => {
          const groupIds = group.options.map((option) => option.field.id);
          const allSelected = groupIds.every((id) => selectedIds.includes(id));
          return (
            <div key={group.key} className="space-y-1">
              {pages.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tf-light-muted)] dark:text-gray-500">
                    {group.label}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className="h-6 px-1.5 text-[11px] font-medium"
                    onClick={() =>
                      onChange(
                        allSelected
                          ? selectedIds.filter((id) => !groupIds.includes(id))
                          : Array.from(new Set([...selectedIds, ...groupIds]))
                      )
                    }
                  >
                    {t(allSelected ? 'editor.deselectPage' : 'editor.selectPage_all')}
                  </Button>
                </div>
              )}
              {group.options.map((option) => {
                const visual = fieldVisual(option.field);
                return (
                  <label
                    key={option.field.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm hover:bg-[var(--tf-faint)] dark:hover:bg-gray-800"
                  >
                    <Checkbox
                      checked={selectedIds.includes(option.field.id)}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggle(option.field.id, checked === true)}
                      data-testid={`condition-action-target-${actionIndex}-${option.field.id}`}
                    />
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                        visual.tileClass
                      )}
                    >
                      <visual.Icon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
