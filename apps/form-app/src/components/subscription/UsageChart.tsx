import { Card } from '@dculus/ui';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Eye, FileText } from 'lucide-react';

interface UsageChartProps {
  viewsUsed: number;
  submissionsUsed: number;
  viewsLimit: number | null;
  submissionsLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export const UsageChart = ({
  viewsUsed,
  submissionsUsed,
  viewsLimit,
  submissionsLimit,
  currentPeriodStart,
  currentPeriodEnd,
}: UsageChartProps) => {
  // Generate mock daily usage data for visualization
  // In a real implementation, this would come from backend historical data
  const generateUsageData = () => {
    // Convert epoch timestamp strings to numbers (milliseconds)
    const start = new Date(Number(currentPeriodStart));
    const end = new Date(Number(currentPeriodEnd));
    const now = new Date();
    const currentDate = now > end ? end : now;

    const daysDiff = Math.ceil((currentDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysInPeriod = Math.max(daysDiff, 1);

    const data = [];

    // Simulate gradual usage accumulation over the period
    for (let i = 0; i <= Math.min(daysInPeriod, 30); i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);

      // Use a growth curve that accelerates toward current usage
      const progress = i / daysInPeriod;
      const growthFactor = Math.pow(progress, 1.5); // Slightly accelerating growth

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: Math.floor(viewsUsed * growthFactor),
        submissions: Math.floor(submissionsUsed * growthFactor),
      });
    }

    return data;
  };

  const data = generateUsageData();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="font-medium text-sm mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <Eye className="h-3 w-3 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">Views:</span>
              <span className="font-medium">{payload[0].value.toLocaleString()}</span>
              {viewsLimit && (
                <span className="text-xs text-gray-500">
                  / {viewsLimit.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-3 w-3 text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">Submissions:</span>
              <span className="font-medium">{payload[1].value.toLocaleString()}</span>
              {submissionsLimit && (
                <span className="text-xs text-gray-500">
                  / {submissionsLimit.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-1">Usage Trends</h3>
        <p className="text-sm text-gray-500">
          Daily usage from {new Date(Number(currentPeriodStart)).toLocaleDateString()} to{' '}
          {new Date(Number(currentPeriodEnd)).toLocaleDateString()}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            tickLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-sm font-medium">
                {value}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorViews)"
            name="Form Views"
          />
          <Area
            type="monotone"
            dataKey="submissions"
            stroke="#a855f7"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorSubmissions)"
            name="Form Submissions"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-3 w-3 rounded-full bg-blue-500"></div>
              <span className="font-medium">Total Views</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {viewsUsed.toLocaleString()}
            </p>
            {viewsLimit && (
              <p className="text-xs text-gray-500">
                of {viewsLimit.toLocaleString()} limit
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-3 w-3 rounded-full bg-purple-500"></div>
              <span className="font-medium">Total Submissions</span>
            </div>
            <p className="text-2xl font-bold text-purple-600">
              {submissionsUsed.toLocaleString()}
            </p>
            {submissionsLimit && (
              <p className="text-xs text-gray-500">
                of {submissionsLimit.toLocaleString()} limit
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
