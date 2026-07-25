/**
 * Small presentational helper (#201) that turns a standard 5-field cron expression into a
 * human-readable summary for the TriggerNode card and the schedule config panel. Not a full
 * cron parser — recognizes the daily/weekly/monthly shapes the preset UI itself produces, and
 * falls back to showing the raw expression for anything else (custom cron).
 */

type Translate = (key: string, options?: { values?: Record<string, any> }) => string;

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function formatTime(hour: string, minute: string): string | null {
  if (!/^\d+$/.test(hour) || !/^\d+$/.test(minute)) return null;
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function describeCron(cron: string | undefined | null, t: Translate): string {
  if (!cron || typeof cron !== 'string') return t('builder.nodes.trigger.cron.notConfigured');

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return t('builder.nodes.trigger.cron.custom', { values: { cron } });

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const time = formatTime(hour, minute);

  if (time && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return t('builder.nodes.trigger.cron.daily', { values: { time } });
  }

  if (time && dayOfMonth === '*' && month === '*' && /^[0-6]$/.test(dayOfWeek)) {
    const dayKey = WEEKDAY_KEYS[Number(dayOfWeek)];
    return t('builder.nodes.trigger.cron.weekly', {
      values: { day: t(`builder.nodes.trigger.cron.weekdays.${dayKey}`), time },
    });
  }

  if (time && /^\d+$/.test(dayOfMonth) && month === '*' && dayOfWeek === '*') {
    return t('builder.nodes.trigger.cron.monthly', { values: { day: dayOfMonth, time } });
  }

  return t('builder.nodes.trigger.cron.custom', { values: { cron } });
}
