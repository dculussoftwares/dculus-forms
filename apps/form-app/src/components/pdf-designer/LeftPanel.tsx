import React, { useMemo, useState } from 'react';
import { FieldType } from '@dculus/types';
import { cn } from '@dculus/utils';
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Circle,
  FileText,
  Hash,
  Image as ImageIcon,
  Mail,
  Minus,
  Phone,
  QrCode,
  Search,
  Square,
  Table as TableIcon,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { FormFieldEntry } from './fieldBinding';

/**
 * Left panel of the PDF template designer: JotForm-style two-tab palette —
 * "Form fields" (bound response values) and "Elements" (static pdfme
 * elements) — styled after the form builder's FieldTypesPanel.
 */

export type ElementKey =
  | 'text'
  | 'image'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'table'
  | 'qrcode';

interface FieldVisual {
  icon: React.ReactNode;
  bg: string;
  fg: string;
}

const FIELD_VISUALS: Partial<Record<string, FieldVisual>> = {
  [FieldType.TEXT_INPUT_FIELD]: { icon: <Type />, bg: '#f8cdd8', fg: '#3c323e' },
  [FieldType.TEXT_AREA_FIELD]: { icon: <FileText />, bg: '#f8cdd8', fg: '#3c323e' },
  [FieldType.EMAIL_FIELD]: { icon: <Mail />, bg: '#f8cdd8', fg: '#3c323e' },
  [FieldType.NUMBER_FIELD]: { icon: <Hash />, bg: '#fbe19d', fg: '#8b6a18' },
  [FieldType.DATE_FIELD]: { icon: <Calendar />, bg: '#ddd6fa', fg: '#5c2e6b' },
  [FieldType.PHONE_NUMBER_FIELD]: { icon: <Phone />, bg: '#ddd6fa', fg: '#5c2e6b' },
  [FieldType.SELECT_FIELD]: { icon: <ChevronDown />, bg: '#ddd6fa', fg: '#5c2e6b' },
  [FieldType.RADIO_FIELD]: { icon: <Circle />, bg: '#ddd6fa', fg: '#5c2e6b' },
  [FieldType.CHECKBOX_FIELD]: { icon: <CheckSquare />, bg: '#dedcde', fg: '#4c414e' },
  [FieldType.FILE_UPLOAD_FIELD]: { icon: <Upload />, bg: '#fbe19d', fg: '#8b6a18' },
};

const DEFAULT_VISUAL: FieldVisual = { icon: <Type />, bg: '#dedcde', fg: '#4c414e' };

const ELEMENT_ITEMS: { key: ElementKey; labelKey: string; icon: React.ReactNode }[] = [
  { key: 'text', labelKey: 'palette.text', icon: <Type /> },
  { key: 'image', labelKey: 'palette.image', icon: <ImageIcon /> },
  { key: 'line', labelKey: 'palette.line', icon: <Minus /> },
  { key: 'rectangle', labelKey: 'palette.rectangle', icon: <Square /> },
  { key: 'ellipse', labelKey: 'palette.ellipse', icon: <Circle /> },
  { key: 'table', labelKey: 'palette.table', icon: <TableIcon /> },
  { key: 'qrcode', labelKey: 'palette.qrcode', icon: <QrCode /> },
];

const IconBox: React.FC<{ visual: FieldVisual }> = ({ visual }) => (
  <span
    className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
    style={{ backgroundColor: visual.bg, color: visual.fg }}
  >
    {visual.icon}
  </span>
);

interface LeftPanelProps {
  fields: FormFieldEntry[];
  placedCounts: Record<string, number>;
  missingFieldIds: string[];
  canEdit: boolean;
  designerReady: boolean;
  onInsertField: (field: FormFieldEntry) => void;
  onInsertElement: (element: ElementKey) => void;
  onRemoveMissing: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  fields,
  placedCounts,
  missingFieldIds,
  canEdit,
  designerReady,
  onInsertField,
  onInsertElement,
  onRemoveMissing,
}) => {
  const { t } = useTranslation('pdfTemplates');
  const [tab, setTab] = useState<'fields' | 'elements'>('fields');
  const [search, setSearch] = useState('');

  const visibleFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return fields;
    return fields.filter((f) => (f.label || '').toLowerCase().includes(query));
  }, [fields, search]);

  const disabled = !canEdit || !designerReady;

  const itemClass =
    'flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs text-left transition-colors text-[#4c414e] dark:text-gray-200 hover:bg-[rgba(87,84,91,0.06)] dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <aside
      className="w-72 shrink-0 rounded-xl bg-white dark:bg-card overflow-y-auto flex flex-col"
      style={{
        border: '1px solid var(--tf-border-medium)',
        boxShadow: '0 1px 4px var(--tf-overlay)',
      }}
    >
      {/* Tabs */}
      <div
        className="flex shrink-0 px-2 pt-1"
        style={{ borderBottom: '1px solid rgba(81,76,84,0.12)' }}
      >
        {(
          [
            { id: 'fields', label: t('leftPanel.fieldsTab') },
            { id: 'elements', label: t('leftPanel.elementsTab') },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            data-testid={`pdf-designer-panel-tab-${id}`}
            className={cn(
              'relative flex-1 px-2 py-2 text-xs font-medium rounded-t-lg transition-colors',
              tab === id
                ? 'text-[#3c323e] dark:text-white bg-[rgba(87,84,91,0.06)] dark:bg-white/5'
                : 'text-[#655d67] dark:text-gray-400 hover:text-[#4c414e] dark:hover:text-gray-200'
            )}
          >
            {label}
            {tab === id && (
              <span className="absolute left-0 right-0 h-[2px] bg-[#3c323e] dark:bg-white" style={{ bottom: -1 }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'fields' ? (
        <div className="p-3 flex flex-col gap-2 min-h-0">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('fieldsPanel.description')}
          </p>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#655d67] dark:text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fieldsPanel.searchPlaceholder')}
              data-testid="pdf-designer-field-search"
              className="w-full h-8 pl-8 pr-2.5 rounded-lg text-xs bg-white/80 dark:bg-white/5 text-[#4c414e] dark:text-gray-200 placeholder:text-[#655d67] dark:placeholder:text-gray-500 border border-[rgba(81,76,84,0.15)] dark:border-white/10 focus:outline-none focus:border-[rgba(81,76,84,0.35)]"
            />
          </div>

          {missingFieldIds.length > 0 && (
            <div
              className="rounded-lg px-2.5 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900"
              data-testid="pdf-designer-missing-fields"
            >
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                {t('fieldsPanel.missingFields', {
                  values: { count: missingFieldIds.length },
                })}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={onRemoveMissing}
                  disabled={!designerReady}
                  data-testid="pdf-designer-remove-missing"
                  className="flex items-center gap-1 mt-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:underline disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('fieldsPanel.removeMissingButton')}
                </button>
              )}
            </div>
          )}

          {fields.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('fieldsPanel.noFields')}</p>
          ) : visibleFields.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('fieldsPanel.noSearchResults')}</p>
          ) : (
            <div className="space-y-0.5">
              {visibleFields.map((field) => {
                const count = placedCounts[field.id] ?? 0;
                const label = field.label.trim() || t('fieldsPanel.untitledField');
                return (
                  <button
                    key={field.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onInsertField(field)}
                    title={label}
                    data-testid={`pdf-designer-insert-${field.id}`}
                    className={itemClass}
                  >
                    <IconBox visual={FIELD_VISUALS[field.type] ?? DEFAULT_VISUAL} />
                    <span className="truncate flex-1">{label}</span>
                    {count > 0 && (
                      <span
                        className="shrink-0 min-w-5 px-1 py-0.5 rounded-md text-center text-[10px] font-medium bg-[#f6fafd] text-[#01487f] dark:bg-sky-950 dark:text-sky-300"
                        title={t('fieldsPanel.placedCount', { values: { count } })}
                      >
                        ×{count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-2 min-h-0">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t('elementsPanel.description')}
          </p>
          <div className="space-y-0.5">
            {ELEMENT_ITEMS.map(({ key, labelKey, icon }) => (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => onInsertElement(key)}
                data-testid={`pdf-designer-insert-element-${key}`}
                className={itemClass}
              >
                <IconBox visual={{ icon, bg: '#dedcde', fg: '#4c414e' }} />
                <span className="truncate flex-1">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
