import { Mail, Clock, Webhook, CalendarClock, FilePlus2, type LucideIcon } from 'lucide-react';

/**
 * Starter templates offered in the create dialog (gap I). Mirrors the backend catalogue in
 * apps/backend/src/services/automation/templates.ts — the graph itself is built server-side, so
 * this list only carries what the picker needs to render. Ids must stay in sync by hand; an id the
 * backend does not know is rejected with the list of ones it does.
 */
export interface AutomationTemplateOption {
  /** Matches the backend template id. `blank` is the only one that leaves the trigger up to the user. */
  id: string;
  icon: LucideIcon;
  triggerType: string;
}

export const AUTOMATION_TEMPLATE_OPTIONS: AutomationTemplateOption[] = [
  { id: 'blank', icon: FilePlus2, triggerType: 'form.submitted' },
  { id: 'confirmation-email', icon: Mail, triggerType: 'form.submitted' },
  { id: 'follow-up-email', icon: Clock, triggerType: 'form.submitted' },
  { id: 'notify-webhook', icon: Webhook, triggerType: 'form.submitted' },
  { id: 'weekly-digest', icon: CalendarClock, triggerType: 'schedule' },
];

export const BLANK_TEMPLATE_ID = 'blank';
