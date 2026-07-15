import React from 'react';
import {
  Button,
  Label,
  Switch,
  Input,
  DatePicker,
  toastError,
} from '@dculus/ui';
import { Shield, Save, Calendar, Users, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatTimeForInput, combineDateAndTime } from '@dculus/utils';
import type { SubmissionLimitsSettings as SubmissionLimitsSettingsType } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';
import { parseTimeWindowInstant } from '../../lib/timeWindowDateTime';

interface SubmissionLimitsSettingsProps {
  settings: SubmissionLimitsSettingsType;
  isSaving: boolean;
  currentResponseCount?: number; // Current number of responses for display
  onUpdateMaxResponses: (enabled: boolean, limit?: number) => void;
  onUpdateTimeWindow: (enabled: boolean, startDate?: string, endDate?: string) => void;
  onSave: () => void;
}

// Small pill used to show the live status of an enabled limit (Active / Reached / Ended...)
const StatusBadge: React.FC<{ tone: 'positive' | 'negative'; children: React.ReactNode }> = ({ tone, children }) => (
  <span
    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
    style={
      tone === 'positive'
        ? { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }
        : { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-md)' }
    }
  >
    {tone === 'positive' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
    {children}
  </span>
);

const SubmissionLimitsSettings: React.FC<SubmissionLimitsSettingsProps> = ({
  settings,
  isSaving,
  currentResponseCount = 0,
  onUpdateMaxResponses,
  onUpdateTimeWindow,
  onSave,
}) => {
  const { t } = useTranslation('submissionLimitsSettings');

  const handleMaxResponsesToggle = (enabled: boolean) => {
    if (enabled) {
      onUpdateMaxResponses(true, settings.maxResponses?.limit || 100);
    } else {
      onUpdateMaxResponses(false);
    }
  };

  const handleMaxResponsesLimitChange = (value: string) => {
    const limit = parseInt(value, 10);
    if (isNaN(limit) || limit < 1) {
      toastError(t('validation.invalidLimit'), t('validation.limitMustBePositive'));
      return;
    }
    if (limit > 10000) {
      toastError(t('validation.invalidLimit'), t('validation.limitExceeded'));
      return;
    }
    onUpdateMaxResponses(true, limit);
  };

  const handleTimeWindowToggle = (enabled: boolean) => {
    if (enabled) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      end.setHours(23, 59, 0, 0);
      onUpdateTimeWindow(true, start.toISOString(), end.toISOString());
    } else {
      onUpdateTimeWindow(false);
    }
  };

  // Parsed instants for the currently-saved start/end values (handles both
  // legacy YYYY-MM-DD and full ISO datetime formats).
  const startInstant = settings.timeWindow?.startDate
    ? parseTimeWindowInstant(settings.timeWindow.startDate)
    : undefined;
  const endInstant = settings.timeWindow?.endDate
    ? parseTimeWindowInstant(settings.timeWindow.endDate)
    : undefined;
  const startTimeValue = startInstant ? formatTimeForInput(startInstant) : '00:00';
  const endTimeValue = endInstant ? formatTimeForInput(endInstant) : '23:59';

  const handleStartDateChange = (date: Date | undefined) => {
    const combined = date ? combineDateAndTime(date, startTimeValue) : undefined;
    if (combined && endInstant && combined > endInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, combined ? combined.toISOString() : '', settings.timeWindow?.endDate);
  };

  const handleStartTimeChange = (time: string) => {
    if (!startInstant) return;
    const combined = combineDateAndTime(startInstant, time);
    if (endInstant && combined > endInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, combined.toISOString(), settings.timeWindow?.endDate);
  };

  const handleEndDateChange = (date: Date | undefined) => {
    const combined = date ? combineDateAndTime(date, endTimeValue) : undefined;
    if (combined && startInstant && combined < startInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, settings.timeWindow?.startDate, combined ? combined.toISOString() : '');
  };

  const handleEndTimeChange = (time: string) => {
    if (!endInstant) return;
    const combined = combineDateAndTime(endInstant, time);
    if (startInstant && combined < startInstant) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(true, settings.timeWindow?.startDate, combined.toISOString());
  };

  const maxResponsesLimit = settings.maxResponses?.limit || 100;
  // Helper to check if max responses limit is reached
  const isMaxResponsesReached = !!(settings.maxResponses?.enabled &&
    settings.maxResponses?.limit &&
    currentResponseCount >= settings.maxResponses.limit);
  const maxResponsesProgress = Math.min(100, (currentResponseCount / maxResponsesLimit) * 100);

  // Helper to check if form is within time window
  const now = new Date();
  const isBeforeStart = !!(settings.timeWindow?.enabled && startInstant && startInstant > now);
  const isAfterEnd = !!(settings.timeWindow?.enabled && endInstant && endInstant < now);
  const isOutsideTimeWindow = isBeforeStart || isAfterEnd;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
          <Shield className="h-4 w-4" style={{ color: 'var(--tf-dark)' }} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-primary">{t('title')}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
      </div>

      {/* Maximum Responses */}
      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#fbe19d' }}>
            <Users className="h-4 w-4" style={{ color: '#8b6a18' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="max-responses-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('maxResponses.title')}
            </Label>
            <p className="text-sm text-muted-foreground">{t('maxResponses.description')}</p>
          </div>
          <Switch
            id="max-responses-enabled"
            data-testid="max-responses-enabled-checkbox"
            checked={settings.maxResponses?.enabled || false}
            onCheckedChange={handleMaxResponsesToggle}
          />
        </div>

        {settings.maxResponses?.enabled && (
          <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
            <div className="flex items-center gap-2 pt-3">
              <Label htmlFor="max-responses-limit" className="text-sm text-foreground">
                {t('maxResponses.label')}
              </Label>
              <Input
                id="max-responses-limit"
                data-testid="max-responses-limit-input"
                type="number"
                min="1"
                max="10000"
                value={settings.maxResponses?.limit || 100}
                onChange={(e) => handleMaxResponsesLimitChange(e.target.value)}
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tf-border-light)' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${maxResponsesProgress}%`,
                    backgroundColor: isMaxResponsesReached ? 'var(--tf-error)' : 'var(--tf-green)',
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t('maxResponses.responses', {
                    values: { current: currentResponseCount, limit: settings.maxResponses?.limit || 100 }
                  })}
                </span>
                <StatusBadge tone={isMaxResponsesReached ? 'negative' : 'positive'}>
                  {isMaxResponsesReached ? t('maxResponses.reached') : t('maxResponses.active')}
                </StatusBadge>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Time Window */}
      <div className="rounded-xl bg-white dark:bg-card" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
        <div className="flex items-center gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
            <Calendar className="h-4 w-4" style={{ color: '#5c2e6b' }} />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="time-window-enabled" className="text-sm font-medium text-primary cursor-pointer">
              {t('timeWindow.title')}
            </Label>
            <p className="text-sm text-muted-foreground">{t('timeWindow.description')}</p>
          </div>
          <Switch
            id="time-window-enabled"
            data-testid="time-window-enabled-checkbox"
            checked={settings.timeWindow?.enabled || false}
            onCheckedChange={handleTimeWindowToggle}
          />
        </div>

        {settings.timeWindow?.enabled && (
          <div className="px-4 pb-4 pt-1 space-y-3" style={{ borderTop: '1px solid var(--tf-border-light)' }}>
            <p className="text-xs text-muted-foreground pt-3">
              {t('timeWindow.localTimeHint')}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="start-date" className="text-sm text-foreground">
                  {t('timeWindow.startDate')}
                </Label>
                <div className="flex gap-2">
                  <DatePicker
                    id="time-window-start-date"
                    name="time-window-start-date"
                    date={startInstant}
                    onDateChange={handleStartDateChange}
                    placeholder="Select start date"
                  />
                  <Input
                    type="time"
                    data-testid="time-window-start-time-input"
                    value={startTimeValue}
                    disabled={!startInstant}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="w-28 h-12 rounded-xl border-2"
                    style={{ borderColor: 'var(--tf-border-medium)' }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-date" className="text-sm text-foreground">
                  {t('timeWindow.endDate')}
                </Label>
                <div className="flex gap-2">
                  <DatePicker
                    id="time-window-end-date"
                    name="time-window-end-date"
                    date={endInstant}
                    onDateChange={handleEndDateChange}
                    placeholder="Select end date"
                  />
                  <Input
                    type="time"
                    data-testid="time-window-end-time-input"
                    value={endTimeValue}
                    disabled={!endInstant}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className="w-28 h-12 rounded-xl border-2"
                    style={{ borderColor: 'var(--tf-border-medium)' }}
                  />
                </div>
              </div>
            </div>
            {settings.timeWindow?.startDate && settings.timeWindow?.endDate && (
              <div className="flex justify-end">
                <StatusBadge tone={isOutsideTimeWindow ? 'negative' : 'positive'}>
                  {isOutsideTimeWindow ? (isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended')) : t('timeWindow.active')}
                </StatusBadge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Summary */}
      {(settings.maxResponses?.enabled || settings.timeWindow?.enabled) && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--tf-faint)', border: '1px solid var(--tf-border-light)' }}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
            {t('maxResponses.currentStatus')}
          </h4>
          <div className="space-y-2 text-sm">
            {settings.maxResponses?.enabled && (
              <div className="flex items-center gap-2 text-foreground">
                <StatusBadge tone={isMaxResponsesReached ? 'negative' : 'positive'}>
                  {isMaxResponsesReached ? t('maxResponses.reached') : t('maxResponses.active')}
                </StatusBadge>
                <span>
                  {t('maxResponses.responses', {
                    values: { current: currentResponseCount, limit: settings.maxResponses?.limit || 100 }
                  })}
                </span>
              </div>
            )}
            {settings.timeWindow?.enabled && (
              <div className="flex items-center gap-2 text-foreground">
                <StatusBadge tone={isOutsideTimeWindow ? 'negative' : 'positive'}>
                  {isOutsideTimeWindow
                    ? (isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended'))
                    : t('timeWindow.active')}
                </StatusBadge>
                {startInstant && endInstant && (
                  <span className="text-muted-foreground">
                    {startInstant.toLocaleString()} — {endInstant.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <Button
          onClick={onSave}
          disabled={isSaving}
          data-testid="save-submission-limits-button"
        >
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
};

export default SubmissionLimitsSettings;
