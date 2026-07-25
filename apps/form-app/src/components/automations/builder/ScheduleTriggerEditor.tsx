import React, { useMemo, useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAutomationBuilderStore } from '../../../store/useAutomationBuilderStore';
import { UPDATE_AUTOMATION } from '../../../graphql/automations';
import { isValidCronExpression, isValidTimezone } from './scheduleCronValidation';

type Preset = 'daily' | 'weekly' | 'monthly' | 'custom';

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface ParsedPreset {
  preset: Preset;
  time: string;
  weekday: number;
  dayOfMonth: number;
  customCron: string;
}

function parseCron(cron: string | undefined | null): ParsedPreset {
  const fallback: ParsedPreset = { preset: 'daily', time: '09:00', weekday: 1, dayOfMonth: 1, customCron: '' };
  if (!cron || typeof cron !== 'string') return fallback;

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { ...fallback, preset: 'custom', customCron: cron };

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const isTime = /^\d+$/.test(minute) && /^\d+$/.test(hour);
  const time = isTime ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '09:00';

  if (isTime && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return { preset: 'daily', time, weekday: 1, dayOfMonth: 1, customCron: cron };
  }
  if (isTime && dayOfMonth === '*' && month === '*' && /^[0-6]$/.test(dayOfWeek)) {
    return { preset: 'weekly', time, weekday: Number(dayOfWeek), dayOfMonth: 1, customCron: cron };
  }
  if (isTime && /^\d+$/.test(dayOfMonth) && month === '*' && dayOfWeek === '*') {
    return { preset: 'monthly', time, weekday: 1, dayOfMonth: Number(dayOfMonth), customCron: cron };
  }
  return { preset: 'custom', time: '09:00', weekday: 1, dayOfMonth: 1, customCron: cron };
}

function buildCron(preset: Preset, time: string, weekday: number, dayOfMonth: number, customCron: string): string {
  if (preset === 'custom') return customCron.trim();

  const [hourStr, minuteStr] = time.split(':');
  const hour = Number(hourStr) || 0;
  const minute = Number(minuteStr) || 0;

  if (preset === 'daily') return `${minute} ${hour} * * *`;
  if (preset === 'weekly') return `${minute} ${hour} * * ${weekday}`;
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

interface ScheduleTriggerEditorProps {
  automationId: string;
  disabled: boolean;
}

export const ScheduleTriggerEditor: React.FC<ScheduleTriggerEditorProps> = ({ automationId, disabled }) => {
  const { t } = useTranslation('automations');
  const triggerConfig = useAutomationBuilderStore((s) => s.triggerConfig);
  const setTriggerConfig = useAutomationBuilderStore((s) => s.setTriggerConfig);
  const [updateAutomation, { loading }] = useMutation(UPDATE_AUTOMATION);

  const initial = useMemo(() => parseCron(triggerConfig?.cron), [triggerConfig?.cron]);
  const [preset, setPreset] = useState<Preset>(initial.preset);
  const [time, setTime] = useState(initial.time);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [customCron, setCustomCron] = useState(initial.customCron);
  const [timezone, setTimezone] = useState<string>(
    triggerConfig?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  const builtCron = buildCron(preset, time, weekday, dayOfMonth, customCron);
  const cronValid = isValidCronExpression(builtCron);
  const timezoneValid = !timezone || isValidTimezone(timezone);

  const handleSave = async () => {
    if (!cronValid) {
      toastError(t('builder.panel.schedule.saveErrorTitle'), t('builder.panel.schedule.invalidCron'));
      return;
    }
    if (!timezoneValid) {
      toastError(t('builder.panel.schedule.saveErrorTitle'), t('builder.panel.schedule.invalidTimezone'));
      return;
    }

    try {
      const nextTriggerConfig = { cron: builtCron, timezone: timezone || undefined };
      const result = await updateAutomation({
        variables: { id: automationId, triggerConfig: nextTriggerConfig },
      });
      if (result.error) throw result.error;
      setTriggerConfig(nextTriggerConfig);
      toastSuccess(t('builder.panel.schedule.saveSuccessTitle'), t('builder.panel.schedule.saveSuccessMessage'));
    } catch (error: any) {
      toastError(t('builder.panel.schedule.saveErrorTitle'), error.message);
    }
  };

  return (
    <fieldset disabled={disabled} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="schedule-preset">{t('builder.panel.schedule.presetLabel')}</Label>
        <Select value={preset} onValueChange={(value) => setPreset(value as Preset)}>
          <SelectTrigger id="schedule-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t('builder.panel.schedule.presets.daily')}</SelectItem>
            <SelectItem value="weekly">{t('builder.panel.schedule.presets.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('builder.panel.schedule.presets.monthly')}</SelectItem>
            <SelectItem value="custom">{t('builder.panel.schedule.presets.custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset !== 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="schedule-time">{t('builder.panel.schedule.timeLabel')}</Label>
          <Input id="schedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      )}

      {preset === 'weekly' && (
        <div className="space-y-2">
          <Label htmlFor="schedule-weekday">{t('builder.panel.schedule.weekdayLabel')}</Label>
          <Select value={String(weekday)} onValueChange={(value) => setWeekday(Number(value))}>
            <SelectTrigger id="schedule-weekday">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEEKDAY_KEYS.map((key, index) => (
                <SelectItem key={key} value={String(index)}>
                  {t(`builder.nodes.trigger.cron.weekdays.${key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {preset === 'monthly' && (
        <div className="space-y-2">
          <Label htmlFor="schedule-day-of-month">{t('builder.panel.schedule.dayOfMonthLabel')}</Label>
          <Input
            id="schedule-day-of-month"
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      )}

      {preset === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="schedule-custom-cron">{t('builder.panel.schedule.customCronLabel')}</Label>
          <Input
            id="schedule-custom-cron"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="0 9 * * *"
          />
          {!cronValid && customCron.trim().length > 0 && (
            <p className="text-xs" style={{ color: 'var(--tf-error)' }}>
              {t('builder.panel.schedule.invalidCron')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="schedule-timezone">{t('builder.panel.schedule.timezoneLabel')}</Label>
        <Input
          id="schedule-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/Chicago"
        />
        {!timezoneValid && (
          <p className="text-xs" style={{ color: 'var(--tf-error)' }}>
            {t('builder.panel.schedule.invalidTimezone')}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t('builder.panel.schedule.hint')}</p>

      <Button size="sm" onClick={handleSave} disabled={loading || !cronValid || !timezoneValid}>
        {loading ? t('builder.panel.schedule.saving') : t('builder.panel.schedule.saveButton')}
      </Button>
    </fieldset>
  );
};
