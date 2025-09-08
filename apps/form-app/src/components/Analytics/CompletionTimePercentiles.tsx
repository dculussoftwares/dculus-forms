import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@dculus/ui';
import { Clock, TrendingUp } from 'lucide-react';
import { CompletionTimePercentiles as PercentilesData } from '../../hooks/useFormAnalytics';

interface CompletionTimePercentilesProps {
  data: PercentilesData | null;
  averageTime: number | null;
  loading?: boolean;
}

// Helper function to format completion time from seconds to human-readable format
const formatCompletionTime = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return 'N/A';
  
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
};

interface PercentileCardProps {
  label: string;
  value: number | null;
  description: string;
  color: string;
  bgColor: string;
}

const PercentileCard: React.FC<PercentileCardProps> = ({ 
  label, 
  value, 
  description, 
  color, 
  bgColor 
}) => (
  <div className={`${bgColor} rounded-lg p-4 border`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className={`text-lg font-bold ${color} mt-1`}>
          {formatCompletionTime(value)}
        </p>
      </div>
      <Clock className={`h-5 w-5 ${color} opacity-60`} />
    </div>
    <p className="text-xs text-gray-500 mt-2">{description}</p>
  </div>
);

export const CompletionTimePercentiles: React.FC<CompletionTimePercentilesProps> = ({
  data,
  averageTime,
  loading = false
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Completion Time Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="bg-gray-100 rounded-lg p-4 border">
                  <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-12 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data && !averageTime) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Completion Time Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No completion time data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentiles = [
    {
      label: 'Average',
      value: averageTime,
      description: 'Mean completion time',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50'
    },
    {
      label: '50th Percentile (Median)',
      value: data?.p50 || null,
      description: '50% complete faster',
      color: 'text-green-700',
      bgColor: 'bg-green-50'
    },
    {
      label: '75th Percentile',
      value: data?.p75 || null,
      description: '75% complete faster',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50'
    },
    {
      label: '90th Percentile',
      value: data?.p90 || null,
      description: '90% complete faster',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50'
    },
    {
      label: '95th Percentile',
      value: data?.p95 || null,
      description: '95% complete faster',
      color: 'text-red-700',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Completion Time Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {percentiles.map((percentile, index) => (
            <PercentileCard
              key={index}
              {...percentile}
            />
          ))}
        </div>
        
        {/* Insights */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">Insights</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {averageTime && data?.p50 && (
              <p>
                • The median completion time ({formatCompletionTime(data.p50)}) is{' '}
                {averageTime > data.p50 ? 'shorter' : 'longer'} than the average ({formatCompletionTime(averageTime)})
              </p>
            )}
            {data?.p90 && data?.p50 && (
              <p>
                • 90% of users complete in {formatCompletionTime(data.p90)} or less
              </p>
            )}
            {data?.p95 && data?.p90 && (
              <p>
                • The slowest 5% take {formatCompletionTime(data.p95)} or more to complete
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};