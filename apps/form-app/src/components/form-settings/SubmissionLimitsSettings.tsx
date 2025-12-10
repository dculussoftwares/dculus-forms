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
import type { SubmissionLimitsSettings as SubmissionLimitsSettingsType } from '@dculus/types';
import { useTranslation } from '../../hooks/useTranslation';

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
      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      onUpdateTimeWindow(
        true, 
        now.toISOString().split('T')[0], // Start date (today)
        endDate.toISOString().split('T')[0] // End date (30 days from now)
      );
    } else {
      onUpdateTimeWindow(false);
    }
  };

  const handleStartDateChange = (date: Date | undefined) => {
    const value = date ? date.toISOString().split('T')[0] : '';
    const endDate = settings.timeWindow?.endDate;
    if (endDate && value && new Date(value) > new Date(endDate)) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(
      true, 
      value, 
      settings.timeWindow?.endDate
    );
  };

  const handleEndDateChange = (date: Date | undefined) => {
    const value = date ? date.toISOString().split('T')[0] : '';
    const startDate = settings.timeWindow?.startDate;
    if (startDate && value && new Date(value) < new Date(startDate)) {
      toastError(t('validation.invalidDateRange'), t('validation.endAfterStart'));
      return;
    }
    onUpdateTimeWindow(
      true, 
      settings.timeWindow?.startDate, 
      value
    );
  };

  // Helper to check if max responses limit is reached
  const isMaxResponsesReached = settings.maxResponses?.enabled && 
    settings.maxResponses?.limit && 
    currentResponseCount >= settings.maxResponses.limit;

  // Helper to check if form is within time window
  const now = new Date();
  const isBeforeStart = settings.timeWindow?.enabled && 
    settings.timeWindow?.startDate && 
    new Date(settings.timeWindow.startDate) > now;
  const isAfterEnd = settings.timeWindow?.enabled && 
    settings.timeWindow?.endDate && 
    new Date(settings.timeWindow.endDate) < now;
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
              <p className="text-sm text-gray-600">
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
              <div className="text-sm text-gray-500">
                {t('maxResponses.responses', { 
                  values: { 
                    current: currentResponseCount, 
                    limit: settings.maxResponses?.limit || 100 
                  } 
                })}
                {isMaxResponsesReached && (
                  <span className="ml-2 text-red-600 font-medium">
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
              <p className="text-sm text-gray-600">
                {t('timeWindow.description')}
              </p>
            </div>
          </div>

          {settings.timeWindow?.enabled && (
            <div className="ml-6 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-sm">
                    {t('timeWindow.startDate')}
                  </Label>
                  <DatePicker
                    date={settings.timeWindow?.startDate ? new Date(settings.timeWindow.startDate) : undefined}
                    onDateChange={handleStartDateChange}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-sm">
                    {t('timeWindow.endDate')}
                  </Label>
                  <DatePicker
                    date={settings.timeWindow?.endDate ? new Date(settings.timeWindow.endDate) : undefined}
                    onDateChange={handleEndDateChange}
                    placeholder="Select end date"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {isOutsideTimeWindow && (
                  <span className="text-red-600 font-medium">
                    ⚠️ {isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended')}
                  </span>
                )}
                {!isOutsideTimeWindow && settings.timeWindow?.startDate && settings.timeWindow?.endDate && (
                  <span className="text-green-600 font-medium">
                    ✓ {t('timeWindow.active')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Summary */}
        {(settings.maxResponses?.enabled || settings.timeWindow?.enabled) && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium mb-2">{t('maxResponses.currentStatus')}</h4>
            <div className="space-y-1 text-sm">
              {settings.maxResponses?.enabled && (
                <div className={isMaxResponsesReached ? 'text-red-600' : 'text-green-600'}>
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
                <div className={isOutsideTimeWindow ? 'text-red-600' : 'text-green-600'}>
                  • {t('timeWindow.title')}: {isOutsideTimeWindow 
                    ? (isBeforeStart ? t('timeWindow.notStarted') : t('timeWindow.ended'))
                    : t('timeWindow.active')}
                  {settings.timeWindow?.startDate && settings.timeWindow?.endDate && (
                    <span className="text-gray-500 ml-1">
                      ({settings.timeWindow.startDate} to {settings.timeWindow.endDate})
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
            className="bg-green-600 hover:bg-green-700 text-white"
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