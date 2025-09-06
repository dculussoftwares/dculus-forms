import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { TrendingUp, Calendar } from 'lucide-react';

interface ViewsOverTimeData {
  date: string;
  views: number;
  sessions: number;
}

interface ViewsOverTimeChartProps {
  data: ViewsOverTimeData[];
  loading?: boolean;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 mb-2">{date}</p>
        <div className="space-y-1">
          <p className="text-sm text-blue-600">
            Views: {payload[0]?.value || 0}
          </p>
          <p className="text-sm text-green-600">
            Sessions: {payload[1]?.value || 0}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

const formatXAxisDate = (tickItem: string) => {
  const date = new Date(tickItem);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

export const ViewsOverTimeChart: React.FC<ViewsOverTimeChartProps> = ({
  data,
  loading = false,
  timeRange = '30d'
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
            Views Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
            Views Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <Calendar className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No time-series data available</p>
            <p className="text-xs text-gray-400 mt-1">
              Data will appear once your form receives more activity
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalViews = data.reduce((sum, item) => sum + item.views, 0);
  const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0);
  const avgViewsPerDay = Math.round(totalViews / data.length);

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7d': return 'Past 7 days';
      case '30d': return 'Past 30 days';
      case '90d': return 'Past 90 days';
      default: return 'Custom range';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
            Views Over Time
          </div>
          <span className="text-sm text-gray-500">{getTimeRangeLabel()}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatXAxisDate}
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#viewsGradient)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#sessionsGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{totalViews}</p>
            <p className="text-xs text-gray-500">Total Views</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{totalSessions}</p>
            <p className="text-xs text-gray-500">Total Sessions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{avgViewsPerDay}</p>
            <p className="text-xs text-gray-500">Avg/Day</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-2 border-t">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
            <span className="text-sm text-gray-600">Views</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span className="text-sm text-gray-600">Sessions</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};