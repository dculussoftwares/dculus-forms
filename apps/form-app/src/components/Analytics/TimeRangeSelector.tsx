import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Card,
  CardContent,
  DatePicker,
  Label
} from '@dculus/ui';
import { Calendar, RefreshCw } from 'lucide-react';
import { TimeRangePreset, TimeRange } from '../../hooks/useFormAnalytics';
import { useTranslation } from '../../hooks/useTranslation';

interface TimeRangeSelectorProps {
  value: TimeRangePreset;
  customRange?: TimeRange | null;
  onChange: (preset: TimeRangePreset, customRange?: TimeRange) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  value,
  customRange,
  onChange,
  onRefresh,
  loading = false
}) => {
  const { t } = useTranslation('timeRangeSelector');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (value === 'custom' && customRange) {
      setStartDate(new Date(customRange.start));
      setEndDate(new Date(customRange.end));
      setShowCustomPicker(false);
    }
  }, [value, customRange]);

  const timeRangeOptions = [
    { value: '7d', label: t('presets.last7Days') },
    { value: '30d', label: t('presets.last30Days') },
    { value: '90d', label: t('presets.last90Days') },
    { value: 'custom', label: t('presets.customRange') }
  ];

  const handlePresetChange = (preset: string) => {
    const typedPreset = preset as TimeRangePreset;

    if (typedPreset === 'custom') {
      // Initialize with current custom range if it exists, or default to last 30 days
      if (customRange) {
        setStartDate(new Date(customRange.start));
        setEndDate(new Date(customRange.end));
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setStartDate(start);
        setEndDate(end);
      }
      setDateError('');
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onChange(typedPreset);
    }
  };

  const validateDateRange = (start: Date | undefined, end: Date | undefined): string => {
    if (!start || !end) return t('validation.selectBothDates');

    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    if (start > end) return t('validation.startBeforeEnd');
    if (end > today) return t('validation.endNotFuture');

    const maxDaysAgo = new Date();
    maxDaysAgo.setFullYear(maxDaysAgo.getFullYear() - 2); // 2 years max
    if (start < maxDaysAgo) return t('validation.startNotTooOld');

    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) return t('validation.rangeNotExceed');

    return '';
  };

  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      setStartDate(date);
      const error = validateDateRange(date, endDate);
      setDateError(error);
    } else {
      setEndDate(date);
      const error = validateDateRange(startDate, date);
      setDateError(error);
    }
  };

  const handleCustomApply = () => {
    const error = validateDateRange(startDate, endDate);
    if (error) {
      setDateError(error);
      return;
    }

    if (!startDate || !endDate) return;

    // Set end date to end of day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const customRange: TimeRange = {
      start: startDate.toISOString(),
      end: endOfDay.toISOString()
    };
    onChange('custom', customRange);
    setShowCustomPicker(false);
    setDateError('');
  };

  const handleQuickPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setStartDate(start);
    setEndDate(end);
    setDateError('');
  };

  const getDisplayText = () => {
    if (value === 'custom' && customRange) {
      const start = new Date(customRange.start).toLocaleDateString();
      const end = new Date(customRange.end).toLocaleDateString();
      return `${start} - ${end}`;
    }
    
    const option = timeRangeOptions.find(opt => opt.value === value);
    return option?.label || t('presets.last30Days');
  };

  return (
    <div className="flex items-center gap-3 relative">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">{t('label')}</span>
      </div>
      
      <div className="relative">
        <Select value={value} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-44">
            <SelectValue>
              <span className="text-sm">{getDisplayText()}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {timeRangeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom Date Range Picker */}
        {showCustomPicker && (
          <div className="absolute top-full left-0 mt-2 z-50">
            <Card className="w-96 shadow-lg border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">{t('customPicker.title')}</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomPicker(false)}
                    className="h-6 w-6 p-0"
                  >
                    ✕
                  </Button>
                </div>
                
                {/* Quick Presets */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">{t('customPicker.quickPresetsLabel')}</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: t('presets.last7Days'), days: 7 },
                      { label: t('presets.last14Days'), days: 14 },
                      { label: t('presets.last30Days'), days: 30 },
                      { label: t('presets.last60Days'), days: 60 },
                      { label: t('presets.last90Days'), days: 90 }
                    ].map((preset) => (
                      <Button
                        key={preset.days}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickPreset(preset.days)}
                        className="text-xs"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{t('customPicker.startDateLabel')}</Label>
                    <DatePicker
                      date={startDate}
                      onDateChange={(date) => handleDateChange('start', date)}
                      maxDate={new Date()}
                      placeholder={t('customPicker.startDatePlaceholder')}
                      error={!!dateError}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">{t('customPicker.endDateLabel')}</Label>
                    <DatePicker
                      date={endDate}
                      onDateChange={(date) => handleDateChange('end', date)}
                      minDate={startDate}
                      maxDate={new Date()}
                      placeholder={t('customPicker.endDatePlaceholder')}
                      error={!!dateError}
                    />
                  </div>
                </div>

                {/* Error Message */}
                {dateError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{dateError}</p>
                  </div>
                )}

                {/* Date Range Info */}
                {startDate && endDate && !dateError && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p 
                      className="text-sm text-blue-700"
                      dangerouslySetInnerHTML={{ 
                        __html: t('customPicker.selectedRange', { 
                          values: { 
                            days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1 
                          } 
                        }) 
                      }}
                    />
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomPicker(false)}
                  >
                    {t('customPicker.cancelButton')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCustomApply}
                    disabled={!startDate || !endDate || !!dateError}
                  >
                    {t('customPicker.applyButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="h-9"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        <span className="sr-only">{t('refreshButton')}</span>
      </Button>
    </div>
  );
};