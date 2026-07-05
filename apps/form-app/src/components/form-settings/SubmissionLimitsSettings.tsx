import React from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Checkbox,
  Input,
  DatePicker,
  toastError,
} from '@dculus/ui';
import { Shield, Save, Calendar, Users } from 'lucide-react';
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

  // Helper to check if max responses limit is reached
  const isMaxResponsesReached = settings.maxResponses?.enabled &&
    settings.maxResponses?.limit &&
    currentResponseCount >= settings.maxResponses.limit;

  // Helper to check if form is within time window
  const now = new Date();
  const isBeforeStart = !!(settings.timeWindow?.enabled && startInstant && startInstant > now);
  const isAfterEnd = !!(settings.timeWindow?.enabled && endInstant && endInstant < now);
  const isOutsideTimeWindow = isBeforeStart || isAfterEnd;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          {t('title')}
        </CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Maximum Responses Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="max-responses-enabled"
              data-testid="max-responses-enabled-checkbox"
              checked={settings.maxResponses?.enabled || false}
              onCheckedChange={handleMaxResponsesToggle}
            />
            <div className="space-y-1">
              <Label
                htmlFor="max-responses-enabled"
                className="text-sm font-medium cursor-pointer flex items-center"
              >
                <Users className="mr-1 h-4 w-4" />
                {t('maxResponses.title')}
              </Label>
              <p className="text-sm text-foreground">
                {t('maxResponses.description')}
              </p>
            </div>
          </div>

          {settings.maxResponses?.enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center space-x-2">
                <Label htmlFor="max-responses-limit" className="text-sm">
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
              <div className="text-sm text-muted-foreground">
                {t('maxResponses.responses', {
                  values: {
                    current: currentResponseCount,
                    limit: settings.maxResponses?.limit || 100
                  }
                })}
                {isMaxResponsesReached && (
                  <span className="ml-2 text-destructive font-medium">
                    ⚠️ {t('maxResponses.reached')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Time Window Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="time-window-enabled"
              data-testid="time-window-enabled-checkbox"
              checked={settings.timeWindow?.enabled || false}
              onCheckedChange={handleTimeWindowToggle}
            />
            <div className="space-y-1">
              <Label
                htmlFor="time-window-enabled"
                className="text-sm font-medium cursor-pointer flex items-center"
              >
                <Calendar className="mr-1 h-4 w-4" />
                {t('timeWindow.title')}
              </Label>
              <p className="text-sm text-foreground">
                {t('timeWindow.description')}
              </p>
            </div>
          </div>

          {settings.timeWindow?.enabled && (
            <div className="ml-6 space-y-3">
              <p className="text-xs text-muted-foreground">
                {t('timeWindow.localTimeHint')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-sm">
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
                      className="w-28"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-sm">
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
                      className="w-28"
                    />
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {isOutsideTimeWindow && (
                  <span className="text-destructive font-medium">
                    ⚠️ {isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended')}
                  </span>
                )}
                {!isOutsideTimeWindow && settings.timeWindow?.startDate && settings.timeWindow?.endDate && (
                  <span className="text-primary font-medium">
                    ✓ {t('timeWindow.active')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Summary */}
        {(settings.maxResponses?.enabled || settings.timeWindow?.enabled) && (
          <div className="mt-6 p-4 bg-background rounded-lg">
            <h4 className="text-sm font-medium mb-2">{t('maxResponses.currentStatus')}</h4>
            <div className="space-y-1 text-sm">
              {settings.maxResponses?.enabled && (
                <div className={isMaxResponsesReached ? 'text-destructive' : 'text-primary'}>
                  • {t('maxResponses.responses', {
                      values: {
                        current: currentResponseCount,
                        limit: settings.maxResponses?.limit || 100
                      }
                    })}
                  {isMaxResponsesReached ? ` (${t('maxResponses.reached')})` : ` (${t('maxResponses.active')})`}
                </div>
              )}
              {settings.timeWindow?.enabled && (
                <div className={isOutsideTimeWindow ? 'text-destructive' : 'text-primary'}>
                  • {t('timeWindow.title')}: {isOutsideTimeWindow
                    ? (isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended'))
                    : t('timeWindow.active')}
                  {startInstant && endInstant && (
                    <span className="text-muted-foreground ml-1">
                      ({startInstant.toLocaleString()} to {endInstant.toLocaleString()})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            onClick={onSave}
            disabled={isSaving}
            data-testid="save-submission-limits-button"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubmissionLimitsSettings;
