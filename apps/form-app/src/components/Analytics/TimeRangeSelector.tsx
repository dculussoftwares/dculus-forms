import React, { useState, useEffect } from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
  Card,
  CardContent
} from '@dculus/ui';
import { Calendar, RefreshCw } from 'lucide-react';
import { TimeRangePreset, TimeRange } from '../../hooks/useFormAnalytics';

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
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    if (value === 'custom' && customRange) {
      setStartDate(customRange.start.split('T')[0]);
      setEndDate(customRange.end.split('T')[0]);
      setShowCustomPicker(false);
    }
  }, [value, customRange]);

  const timeRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' }
  ];

  const handlePresetChange = (preset: string) => {
    const typedPreset = preset as TimeRangePreset;
    
    if (typedPreset === 'custom') {
      // Initialize with current custom range if it exists, or default to last 30 days
      if (customRange) {
        setStartDate(customRange.start.split('T')[0]);
        setEndDate(customRange.end.split('T')[0]);
      } else {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
      }
      setDateError('');
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onChange(typedPreset);
    }
  };

  const validateDateRange = (start: string, end: string): string => {
    if (!start || !end) return 'Please select both start and end dates';
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const today = new Date();
    
    if (startDate > endDate) return 'Start date must be before end date';
    if (endDate > today) return 'End date cannot be in the future';
    
    const maxDaysAgo = new Date();
    maxDaysAgo.setFullYear(maxDaysAgo.getFullYear() - 2); // 2 years max
    if (startDate < maxDaysAgo) return 'Start date cannot be more than 2 years ago';
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) return 'Date range cannot exceed 1 year';
    
    return '';
  };

  const handleDateChange = (type: 'start' | 'end', date: string) => {
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

    const customRange: TimeRange = {
      start: new Date(startDate).toISOString(),
      end: new Date(endDate + 'T23:59:59').toISOString() // Include the full end day
    };
    onChange('custom', customRange);
    setShowCustomPicker(false);
    setDateError('');
  };

  const handleQuickPreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setDateError('');
  };

  const getDisplayText = () => {
    if (value === 'custom' && customRange) {
      const start = new Date(customRange.start).toLocaleDateString();
      const end = new Date(customRange.end).toLocaleDateString();
      return `${start} - ${end}`;
    }
    
    const option = timeRangeOptions.find(opt => opt.value === value);
    return option?.label || 'Last 30 days';
  };

  return (
    <div className="flex items-center gap-3 relative">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Time Range:</span>
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
                  <h4 className="text-sm font-semibold text-gray-900">Select Custom Date Range</h4>
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
                  <label className="text-sm font-medium text-gray-700">Quick Presets</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Last 7 days', days: 7 },
                      { label: 'Last 14 days', days: 14 },
                      { label: 'Last 30 days', days: 30 },
                      { label: 'Last 60 days', days: 60 },
                      { label: 'Last 90 days', days: 90 }
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
                    <label className="text-sm font-medium text-gray-700">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => handleDateChange('start', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        dateError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => handleDateChange('end', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        dateError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      min={startDate}
                      max={new Date().toISOString().split('T')[0]}
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
                    <p className="text-sm text-blue-700">
                      Selected range: <strong>
                        {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                      </strong>
                    </p>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCustomPicker(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCustomApply}
                    disabled={!startDate || !endDate || !!dateError}
                  >
                    Apply Range
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
        <span className="sr-only">Refresh data</span>
      </Button>
    </div>
  );
};