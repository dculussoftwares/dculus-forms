import React, { useState } from 'react';
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

  const timeRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range' }
  ];

  const handlePresetChange = (preset: string) => {
    const typedPreset = preset as TimeRangePreset;
    
    if (typedPreset === 'custom') {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
      onChange(typedPreset);
    }
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      const customRange: TimeRange = {
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString()
      };
      onChange('custom', customRange);
      setShowCustomPicker(false);
    }
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
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Time Range:</span>
      </div>
      
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

      {/* Custom Date Range Picker */}
      {showCustomPicker && (
        <Card className="absolute top-full left-0 mt-2 p-4 shadow-lg z-50 border">
          <CardContent className="p-0 space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
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
                disabled={!startDate || !endDate}
              >
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};