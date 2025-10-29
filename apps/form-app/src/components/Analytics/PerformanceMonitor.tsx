import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@dculus/ui';
import { useFieldAnalyticsCacheStats } from '../../hooks/useFieldAnalytics';
import { Activity, Database, Zap, RefreshCw } from 'lucide-react';

export const PerformanceMonitor: React.FC = () => {
  const { stats, loading, error, refreshStats } = useFieldAnalyticsCacheStats();

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Performance Monitoring Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">
            Unable to load performance statistics. Admin privileges may be required.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Field Analytics Performance
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshStats}
          disabled={loading}
          className="flex items-center gap-1 text-sm hover:text-blue-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !stats ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cache Hit Ratio */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">Hit Ratio</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {stats?.hitRatio || 0}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Cache effectiveness
              </div>
            </div>

            {/* Total Cache Entries */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Cache Entries</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.totalEntries || 0}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats?.expiredEntries || 0} expired
              </div>
            </div>

            {/* Memory Usage */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-gray-700">Memory</span>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {stats?.memoryUsageFormatted || '0KB'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Cache memory usage
              </div>
            </div>
          </div>
        )}

        {/* Performance Tips */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Performance Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Hit ratios above 80% indicate good cache performance</li>
            <li>• High memory usage may require cache cleanup</li>
            <li>• Many expired entries suggest longer TTL might be needed</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};