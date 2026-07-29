import React from 'react';
import {
  Button,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useActiveCoachMark, type CoachMarkId } from './coachMarkStorage';

interface CoachMarkProps {
  id: CoachMarkId;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Single ref-forwarding element the callout points at (rail / Design button / gear). */
  children: React.ReactElement;
}

/**
 * One-time first-run callout anchored to a builder chrome element (rail,
 * Design button, gear). Shown at most once per id — dismissal is persisted to
 * localStorage (coachMarkStorage.ts) and shared across tabs/reloads. Coach
 * marks appear one at a time in COACH_MARK_ORDER; dismissing the active one
 * reveals the next.
 */
export const CoachMark: React.FC<CoachMarkProps> = ({ id, side = 'right', align = 'center', children }) => {
  const { t } = useTranslation('coachMarks');
  const { activeId, dismiss } = useActiveCoachMark();
  const isOpen = activeId === id;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        // Radix requests a close on Escape, an outside click, or interacting
        // with the wrapped trigger itself — treat all of those as dismissal,
        // same as the explicit "Got it" button.
        if (!open) dismiss(id);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        data-testid={`coach-mark-${id}`}
      >
        <CardHeader className="space-y-1 p-4 pb-2">
          <CardTitle className="text-sm">{t(`${id}.title`)}</CardTitle>
          <CardDescription className="text-xs">{t(`${id}.description`)}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-end p-4 pt-2">
          <Button size="sm" onClick={() => dismiss(id)} data-testid={`coach-mark-dismiss-${id}`}>
            {t('gotIt')}
          </Button>
        </CardFooter>
      </PopoverContent>
    </Popover>
  );
};

export default CoachMark;
