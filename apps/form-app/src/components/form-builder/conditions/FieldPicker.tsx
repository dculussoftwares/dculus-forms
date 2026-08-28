import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@dculus/ui';
import { FormPage } from '@dculus/types';
import { cn } from '@dculus/utils';
import { useTranslation } from '../../../hooks/useTranslation';
import { TriggerFieldOption, fieldDisplayLabel } from './conditionFieldConfig';
import { fieldVisual } from './logicVisuals';

interface FieldPickerProps {
  options: TriggerFieldOption[];
  value: string;
  onChange: (fieldId: string) => void;
  pages: FormPage[];
  disabled?: boolean;
  'data-testid'?: string;
}

/**
 * Searchable, page-grouped trigger-field picker.
 *
 * Replaces a flat `Select` whose trigger truncated to "Multi-Line Text Area…" —
 * unusable on a form with several similarly-named fields, and with no way to find
 * a field on page 7 except scrolling. Items render the field-type icon so the list
 * reads the same way the journey rail does.
 *
 * `CommandItem` renders `role="option"`, so the existing E2E pattern
 * (click the testid, then `getByRole('option', { name })`) keeps working.
 */
export const FieldPicker: React.FC<FieldPickerProps> = ({
  options,
  value,
  onChange,
  pages,
  disabled,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('conditions');
  const [open, setOpen] = useState(false);

  const pageLabel = (page: FormPage, pageIndex: number) =>
    page.title
      ? t('editor.pageWithTitle', { values: { number: pageIndex + 1, title: page.title } })
      : t('editor.page', { values: { number: pageIndex + 1 } });

  const groups = useMemo(() => {
    const byPage = new Map<string, { label: string; options: TriggerFieldOption[] }>();
    for (const option of options) {
      const key = option.page.id;
      const existing = byPage.get(key);
      if (existing) existing.options.push(option);
      else byPage.set(key, { label: pageLabel(option.page, option.pageIndex), options: [option] });
    }
    return Array.from(byPage.values());
  }, [options, t]);

  const selected = options.find((option) => option.field.id === value);
  const selectedVisual = fieldVisual(selected?.field ?? null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={testId}
          className="h-10 w-full justify-between px-3 font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                  selectedVisual.tileClass
                )}
              >
                <selectedVisual.Icon className="h-3 w-3" />
              </span>
              <span className="min-w-0 truncate text-sm">{fieldDisplayLabel(selected.field, t('chip.untitledField'))}</span>
            </span>
          ) : (
            <span className="truncate text-sm text-muted-foreground">{t('editor.selectField')}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('editor.searchFields')} className="text-sm" />
          <CommandList>
            <CommandEmpty className="py-5 text-center text-sm text-muted-foreground">
              {t('editor.noFieldsFound')}
            </CommandEmpty>
            {groups.map((group) => (
              <CommandGroup
                key={group.label}
                heading={pages.length > 1 ? group.label : undefined}
              >
                {group.options.map(({ field }) => {
                  const visual = fieldVisual(field);
                  const label = fieldDisplayLabel(field, t('chip.untitledField'));
                  return (
                    <CommandItem
                      key={field.id}
                      // cmdk matches typed text against `value`; the id keeps it
                      // unique when two fields share a label.
                      value={`${label} ${visual.typeLabel} ${field.id}`}
                      onSelect={() => {
                        onChange(field.id);
                        setOpen(false);
                      }}
                      className="gap-2.5 py-2 text-sm"
                    >
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                          visual.tileClass
                        )}
                      >
                        <visual.Icon className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {field.id === value && <Check className="h-4 w-4 shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
