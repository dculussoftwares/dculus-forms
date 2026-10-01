import React from 'react';
import {
  MAX_GRID_COLUMNS,
  MIN_GRID_COLUMN_PERCENT,
  sanitizeGridColumnWidths,
  setColumnCount,
  type GridField,
} from '@dculus/types';
import { Button, Input, Label, toast } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { Copy, Trash2, Ungroup } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { FieldSettingsHeader } from '../field-settings';

interface GridSettingsProps {
  field: GridField;
  isConnected: boolean;
  isReadOnly?: boolean;
}

const COLUMN_OPTIONS = Array.from({ length: MAX_GRID_COLUMNS }, (_, i) => i + 1);

const equalWidths = (count: number): number[] => setColumnCount([], count);

/** True when the draft can be stored as-is (sanitizing would not change it). */
const isValidWidths = (widths: number[]): boolean => {
  const sanitized = sanitizeGridColumnWidths(widths, widths.length);
  return sanitized.every((w, i) => w === widths[i]);
};

/**
 * Settings for a grid layout block (§8.6). Writes go straight through the grid store actions
 * (`setGridColumnWidths`, `duplicateGrid`, `ungroupGrid`, `removeGrid`), not the autosave form.
 */
export const GridSettings: React.FC<GridSettingsProps> = ({ field, isConnected, isReadOnly = false }) => {
  const { t } = useTranslation('gridLayout');
  const isEditable = isConnected && !isReadOnly;
  const {
    pages,
    setGridColumnWidths,
    duplicateGrid,
    ungroupGrid,
    removeGrid,
    restoreGrid,
    setSelectedField,
  } = useFormBuilderStore();

  const pageId = React.useMemo(
    () => pages.find((page) => page.fields.some((f) => f.id === field.id))?.id,
    [pages, field.id]
  );
  const widths = React.useMemo(() => sanitizeGridColumnWidths(field.columnWidths), [field.columnWidths]);
  const [draft, setDraft] = React.useState<string[]>(() => widths.map(String));

  // Remote or canvas edits replace the draft
  React.useEffect(() => {
    setDraft(widths.map(String));
  }, [widths]);

  const draftNumbers = draft.map((value) => Number(value));
  const draftTotal = draftNumbers.reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0);
  const draftValid = draftNumbers.every(Number.isInteger) && isValidWidths(draftNumbers);
  const draftChanged = draftNumbers.some((w, i) => w !== widths[i]);

  if (!pageId) return null;

  const commit = (next: number[]) => {
    if (isEditable) setGridColumnWidths(pageId, field.id, next);
  };

  const handleColumnCount = (count: number) => {
    if (count === widths.length) return;
    commit(setColumnCount(widths, count));
    if (count < widths.length) {
      toast({ title: t('settings.columnsMerged', { values: { column: count } }) });
    }
  };

  const handleDuplicate = () => {
    const newId = duplicateGrid(pageId, field.id);
    if (newId) setSelectedField(newId);
  };

  const handleUngroup = () => {
    ungroupGrid(pageId, field.id);
    setSelectedField(null);
  };

  const handleDelete = () => {
    const snapshot = removeGrid(pageId, field.id, { deleteChildren: true });
    if (!snapshot) return;
    setSelectedField(null);
    toast({
      title: t('settings.deleted'),
      action: {
        label: t('settings.undo'),
        onClick: () => {
          if (restoreGrid(pageId, snapshot)) setSelectedField(field.id);
        },
      },
    });
  };

  return (
    <div className="h-full flex flex-col" data-testid="grid-settings">
      <FieldSettingsHeader field={field} saveStatus="idle" isConnected={isConnected} />

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <p className="text-xs text-muted-foreground">{t('settings.description')}</p>

        {/* Column count */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('settings.columnCount')}</Label>
          <div
            role="radiogroup"
            aria-label={t('settings.columnCount')}
            className="inline-flex rounded-lg border border-[var(--tf-border-medium)] p-0.5"
          >
            {COLUMN_OPTIONS.map((count) => {
              const selected = count === widths.length;
              return (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!isEditable}
                  onClick={() => handleColumnCount(count)}
                  data-testid={`grid-column-count-${count}`}
                  className={cn(
                    'min-w-9 px-3 py-1.5 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50',
                    selected ? 'bg-primary text-primary-foreground' : 'hover:bg-[var(--tf-faint)]'
                  )}
                >
                  {count}
                </button>
              );
            })}
          </div>
        </div>

        {/* Column widths */}
        {widths.length > 1 && (
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (draftValid && draftChanged) commit(draftNumbers);
            }}
          >
            <Label className="text-sm font-medium">{t('settings.columnWidths')}</Label>
            <div className="grid grid-cols-2 gap-2">
              {draft.map((value, i) => (
                <Input
                  key={i}
                  type="number"
                  inputMode="numeric"
                  min={MIN_GRID_COLUMN_PERCENT}
                  max={100}
                  step={1}
                  value={value}
                  disabled={!isEditable}
                  aria-label={t('settings.columnWidthLabel', { values: { index: i + 1 } })}
                  data-testid={`grid-width-input-${i}`}
                  onChange={(e) => setDraft((current) => current.map((v, j) => (j === i ? e.target.value : v)))}
                />
              ))}
            </div>
            <p
              className={cn('text-xs', draftValid ? 'text-muted-foreground' : 'text-destructive')}
              role={draftValid ? undefined : 'alert'}
              data-testid="grid-widths-total"
            >
              {draftValid
                ? t('settings.widthsTotal', { values: { total: draftTotal } })
                : t('settings.widthsMustSum', { values: { min: MIN_GRID_COLUMN_PERCENT } })}
            </p>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={!isEditable || !draftValid || !draftChanged}
                data-testid="grid-apply-widths"
              >
                {t('settings.apply')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!isEditable}
                onClick={() => commit(equalWidths(widths.length))}
                data-testid="grid-distribute-equally"
              >
                {t('settings.distributeEqually')}
              </Button>
            </div>
          </form>
        )}

        {/* Actions */}
        {isEditable && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t('settings.actions')}</h4>
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={handleDuplicate} data-testid="grid-settings-duplicate">
                <Copy className="w-4 h-4" />
                {t('settings.duplicate')}
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2" onClick={handleUngroup} data-testid="grid-settings-ungroup">
                <Ungroup className="w-4 h-4" />
                {t('settings.ungroup')}
              </Button>
              <p className="text-xs text-muted-foreground -mt-1 pl-1">{t('settings.ungroupHint')}</p>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 text-destructive hover:text-destructive"
                onClick={handleDelete}
                data-testid="grid-settings-delete"
              >
                <Trash2 className="w-4 h-4" />
                {t('settings.deleteWithFields')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
