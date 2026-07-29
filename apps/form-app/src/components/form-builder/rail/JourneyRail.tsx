import React, { useMemo } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, ScrollArea } from '@dculus/ui';
import { cn } from '@dculus/utils';
import { Plus, PanelLeft, PartyPopper } from 'lucide-react';
import { useFormBuilderStore } from '../../../store/useFormBuilderStore';
import { useFormPermissions } from '../../../hooks/useFormPermissions';
import { useTranslation } from '../../../hooks/useTranslation';
import { FieldLibrary } from '../field-library/FieldLibrary';
import { RailPageGroup } from './RailPageGroup';
import { CoachMark } from '../coachmarks/CoachMark';

/**
 * JourneyRail — the Content tab's leftmost column: the respondent's journey
 * (Intro → Pages with numbered field chips → Thank You). Selecting any entry
 * drives PageBuilderTab's canvas mode and the URL (?screen=…&field=…) via the
 * shared `selection` store slice.
 */
export const JourneyRail: React.FC = () => {
  const { t } = useTranslation('journeyRail');
  const permissions = useFormPermissions();

  const pages = useFormBuilderStore((state) => state.pages);
  const isConnected = useFormBuilderStore((state) => state.isConnected);
  const selection = useFormBuilderStore((state) => state.selection);
  const setSelection = useFormBuilderStore((state) => state.setSelection);
  const addEmptyPage = useFormBuilderStore((state) => state.addEmptyPage);

  const startNumbers = useMemo(() => {
    const numbers: number[] = [];
    let running = 1;
    for (const page of pages) {
      numbers.push(running);
      running += page.fields.length;
    }
    return numbers;
  }, [pages]);

  const handleAddPage = () => {
    if (permissions.canAddPages()) {
      addEmptyPage();
    }
  };

  return (
    <CoachMark id="rail" side="right" align="start">
      <div
        data-testid="journey-rail"
        className="flex h-full w-[236px] shrink-0 flex-col overflow-hidden bg-white dark:bg-card"
        style={{ borderRight: '1px solid var(--tf-border)' }}
      >
        <div className="p-3 pb-1">
          <FieldLibrary mode="trigger" />
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 px-3 pb-4">
            {/* INTRO */}
            <div className="mb-1 mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
              {t('intro.sectionTitle')}
            </div>
            <button
              type="button"
              data-testid="rail-intro"
              aria-pressed={selection.kind === 'intro'}
              onClick={() => setSelection({ kind: 'intro' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                selection.kind === 'intro'
                  ? 'border-[var(--tf-border-strong)] bg-[var(--tf-faint)] text-[var(--tf-dark)]'
                  : 'border-[var(--tf-border-medium)] text-[var(--tf-text)] hover:border-[var(--tf-border-strong)]'
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--tf-icon-lavender)] text-[#5c2e6b]">
                <PanelLeft className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{t('intro.cardLabel')}</span>
            </button>

            {/* PAGES */}
            <div className="mb-1 mt-3 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
                {t('pages.sectionTitle')}
              </span>
              {permissions.canAddPages() && (
                <Button
                  variant="ghost"
                  onClick={handleAddPage}
                  data-testid="add-page-button"
                  title={t('pages.addPage')}
                  className="h-6 w-6 rounded-md p-0 text-[var(--tf-muted)] hover:text-[var(--tf-dark)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <SortableContext
              items={pages.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-1.5" data-testid="pages-list">
                {pages.map((page, index) => (
                  <RailPageGroup
                    key={page.id}
                    page={page}
                    index={index}
                    startNumber={startNumbers[index]}
                    isSelected={
                      (selection.kind === 'page' ||
                        selection.kind === 'field') &&
                      selection.pageId === page.id
                    }
                    isConnected={isConnected}
                  />
                ))}
              </div>
            </SortableContext>

            {pages.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-xs text-[var(--tf-muted)]">
                  {t('pages.noPages')}
                </p>
                {permissions.canAddPages() && (
                  <Button
                    variant="ghost"
                    onClick={handleAddPage}
                    className="mt-1 h-auto p-0 text-xs font-medium text-[var(--tf-dark)] underline-offset-2 hover:underline"
                  >
                    {t('pages.createFirstPage')}
                  </Button>
                )}
              </div>
            )}

            {/* THANK YOU */}
            <div className="mb-1 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-muted)]">
              {t('thankYou.sectionTitle')}
            </div>
            <button
              type="button"
              data-testid="rail-thankyou"
              aria-pressed={selection.kind === 'thankYou'}
              onClick={() => setSelection({ kind: 'thankYou' })}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors',
                selection.kind === 'thankYou'
                  ? 'border-[var(--tf-border-strong)] bg-[var(--tf-faint)] text-[var(--tf-dark)]'
                  : 'border-[var(--tf-border-medium)] text-[var(--tf-text)] hover:border-[var(--tf-border-strong)]'
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--tf-icon-teal)] text-[var(--tf-green)]">
                <PartyPopper className="h-3.5 w-3.5" />
              </span>
              <span className="truncate">{t('thankYou.cardLabel')}</span>
            </button>
          </div>
        </ScrollArea>
      </div>
    </CoachMark>
  );
};

export default JourneyRail;
