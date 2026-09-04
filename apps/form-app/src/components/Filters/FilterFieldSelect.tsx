import React from 'react';
import { Trophy, Smartphone, User, History, Percent, FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@dculus/ui';
import { FillableFormField } from '@dculus/types';
import { getFieldIcon } from '../utils/fieldIcons';
import {
  MetaFilterField,
  MetaFilterSection,
  META_FILTER_SECTION_ORDER,
  groupMetaFieldsBySection,
} from './metaFilterFields';

/** Matches useTranslation's translate signature. */
type TranslateFn = (key: string, options?: { values?: Record<string, string | number> }) => string;

export type FilterableField = FillableFormField | MetaFilterField;

export function isMetaFilterField(field: FilterableField): field is MetaFilterField {
  return (field as MetaFilterField).kind !== undefined;
}

const META_SECTION_ICON: Record<MetaFilterSection, React.ReactNode> = {
  quiz: <Trophy className="h-4 w-4" />,
  submission: <Smartphone className="h-4 w-4" />,
  respondent: <User className="h-4 w-4" />,
  editHistory: <History className="h-4 w-4" />,
  response: <Percent className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
};

export function getMetaFieldLabel(field: MetaFilterField, t: TranslateFn): string {
  return t(field.labelKey, field.labelValues ? { values: field.labelValues } : undefined);
}

const truncateLabel = (label: string, maxLength = 50): string =>
  label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;

interface FilterFieldSelectProps {
  fields: FillableFormField[];
  metaFields?: MetaFilterField[];
  value: string;
  onChange: (fieldId: string) => void;
  t: TranslateFn;
  triggerClassName?: string;
  testId?: string;
}

/**
 * The field picker shared by every filter-row UI in the app (Responses page's FilterRow,
 * automation ConditionRulesEditor, automation DigestFiltersEditor) — a real form field
 * list plus, grouped into labeled sub-sections, whichever response meta-filters
 * (quiz/submission/respondent/edit-history/response/PDF) the caller passes in. A single
 * shared component so the three filter UIs can never drift on how sections are grouped,
 * ordered, or rendered.
 */
export const FilterFieldSelect: React.FC<FilterFieldSelectProps> = ({
  fields,
  metaFields = [],
  value,
  onChange,
  t,
  triggerClassName,
  testId,
}) => {
  const currentField = fields.find((f) => f.id === value);
  const currentMeta = !currentField ? metaFields.find((m) => m.id === value) : undefined;
  const grouped = groupMetaFieldsBySection(metaFields);

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className={triggerClassName} data-testid={testId}>
        <SelectValue placeholder={t('placeholders.selectField')}>
          {currentField && (
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">{getFieldIcon(currentField.type)}</div>
              <span className="truncate" title={currentField.label}>
                {truncateLabel(currentField.label)}
              </span>
            </div>
          )}
          {currentMeta && (
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 text-muted-foreground">{META_SECTION_ICON[currentMeta.section]}</div>
              <span className="truncate">{truncateLabel(getMetaFieldLabel(currentMeta, t))}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {fields.length > 0 && (
          <SelectGroup>
            {metaFields.length > 0 && <SelectLabel>{t('metaSections.formFields')}</SelectLabel>}
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground flex-shrink-0">{getFieldIcon(field.type)}</div>
                  <span className="truncate" title={field.label}>
                    {truncateLabel(field.label)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {META_FILTER_SECTION_ORDER.map((section) => {
          const items = grouped.get(section);
          if (!items || items.length === 0) return null;
          return (
            <SelectGroup key={section}>
              <SelectLabel>{t(`metaSections.${section}`)}</SelectLabel>
              {items.map((field) => (
                <SelectItem key={field.id} value={field.id}>
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground flex-shrink-0">{META_SECTION_ICON[field.section]}</div>
                    <span className="truncate">{truncateLabel(getMetaFieldLabel(field, t))}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
};
