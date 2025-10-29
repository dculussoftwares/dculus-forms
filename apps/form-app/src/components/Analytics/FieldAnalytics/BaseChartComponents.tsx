import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@dculus/ui';
import { HelpCircle } from 'lucide-react';

// Color palettes for different chart types
export const CHART_COLORS = {
  primary: [
    '#3b82f6',
    '#8b5cf6',
    '#06d6a0',
    '#f59e0b',
    '#ef4444',
    '#10b981',
    '#f97316',
    '#8b5a2b',
  ],
  secondary: [
    '#dbeafe',
    '#e7d3ff',
    '#ccfbf1',
    '#fef3c7',
    '#fecaca',
    '#d1fae5',
    '#fed7aa',
    '#e7e5e4',
  ],
  gradient: [
    '#667eea',
    '#764ba2',
    '#f093fb',
    '#f5576c',
    '#4facfe',
    '#00f2fe',
    '#43e97b',
    '#38f9d7',
  ],
};

// Helper tooltip component
interface HelpTooltipProps {
  title: string;
  description: string;
}

const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, description }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="icon"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="text-gray-400 hover:text-gray-600 h-auto w-auto p-0"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {isVisible && (
        <div className="absolute z-10 left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          <div className="font-medium mb-1">{title}</div>
          <div className="text-gray-300">{description}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
        <p className="font-medium text-gray-900 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-700">
              {entry.name}:{' '}
              {(() => {
                try {
                  return formatter
                    ? formatter(entry.value, entry.name, entry)
                    : entry.value;
                } catch (error) {
                  console.warn('Tooltip formatter error:', error);
                  return entry.value;
                }
              })()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Statistics Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  loading?: boolean;
  helpText?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  loading,
  helpText,
}) => {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-20"></div>
              {icon && <div className="h-8 w-8 bg-gray-200 rounded"></div>}
            </div>
            <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
            {subtitle && <div className="h-3 bg-gray-200 rounded w-24"></div>}
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayValue =
    typeof value === 'number' ? value.toLocaleString() : value || '--';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            {helpText && <HelpTooltip title={title} description={helpText} />}
          </div>
          {icon && <div className="text-gray-400">{icon}</div>}
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
          {trend && (
            <div
              className={`flex items-center text-sm ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              <span>
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
            </div>
          )}
        </div>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

// Enhanced Pie Chart Component
interface EnhancedPieChartProps {
  data: Array<{ name: string; value: number; percentage?: number }>;
  title: string;
  height?: number;
  showPercentage?: boolean;
  colorPalette?: string[];
  loading?: boolean;
  emptyMessage?: string;
  helpText?: string;
}

export const EnhancedPieChart: React.FC<EnhancedPieChartProps> = ({
  data,
  title,
  height = 300,
  showPercentage = true,
  colorPalette = CHART_COLORS.primary,
  loading,
  emptyMessage = 'No data available',
  helpText: _helpText,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tooltipFormatter = (value: number, _name: string, props: any) => {
    const percentage =
      props.payload.percentage ||
      (value / data.reduce((sum, item) => sum + item.value, 0)) * 100;
    return `${value} (${percentage.toFixed(1)}%)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={
                showPercentage
                  ? ({ name, percentage }: any) =>
                      `${name}: ${percentage ? percentage.toFixed(1) : '0'}%`
                  : false
              }
            >
              {data.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colorPalette[index % colorPalette.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Enhanced Bar Chart Component
interface EnhancedBarChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>;
  title: string;
  height?: number;
  horizontal?: boolean;
  colorPalette?: string[];
  loading?: boolean;
  emptyMessage?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showGrid?: boolean;
}

export const EnhancedBarChart: React.FC<EnhancedBarChartProps> = ({
  data,
  title,
  height = 300,
  horizontal = false,
  colorPalette = CHART_COLORS.primary,
  loading,
  emptyMessage = 'No data available',
  yAxisLabel,
  xAxisLabel,
  showGrid = true,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout={horizontal ? 'horizontal' : 'vertical'}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  label={
                    xAxisLabel
                      ? {
                          value: xAxisLabel,
                          position: 'insideBottom',
                          offset: -10,
                        }
                      : undefined
                  }
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={120}
                  tick={{ fontSize: 12 }}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  label={
                    xAxisLabel
                      ? {
                          value: xAxisLabel,
                          position: 'insideBottom',
                          offset: -10,
                        }
                      : undefined
                  }
                />
                <YAxis
                  label={
                    yAxisLabel
                      ? {
                          value: yAxisLabel,
                          angle: -90,
                          position: 'insideLeft',
                        }
                      : undefined
                  }
                />
              </>
            )}
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              fill={colorPalette[0]}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Enhanced Line Chart Component
interface EnhancedLineChartProps {
  data: Array<{ name: string; value: number; [key: string]: any }>;
  title: string;
  height?: number;
  color?: string;
  loading?: boolean;
  emptyMessage?: string;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showGrid?: boolean;
  showDots?: boolean;
}

export const EnhancedLineChart: React.FC<EnhancedLineChartProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS.primary[0],
  loading,
  emptyMessage = 'No data available',
  yAxisLabel,
  xAxisLabel,
  showGrid = true,
  showDots = true,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis
              dataKey="name"
              label={
                xAxisLabel
                  ? { value: xAxisLabel, position: 'insideBottom', offset: -10 }
                  : undefined
              }
            />
            <YAxis
              label={
                yAxisLabel
                  ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
                  : undefined
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={showDots ? { fill: color, strokeWidth: 2, r: 4 } : false}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: '#fff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Histogram Component for distributions
interface HistogramProps {
  data: Array<{ range: string; count: number; percentage?: number }>;
  title: string;
  height?: number;
  color?: string;
  loading?: boolean;
  emptyMessage?: string;
  showPercentage?: boolean;
}

export const Histogram: React.FC<HistogramProps> = ({
  data,
  title,
  height = 300,
  color = CHART_COLORS.primary[0],
  loading,
  emptyMessage = 'No data available',
  showPercentage = false,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tooltipFormatter = (value: number, _name: string, props: any) => {
    try {
      const percentage = props?.payload?.percentage;
      return showPercentage && percentage !== undefined && percentage !== null
        ? `${value} (${percentage.toFixed(1)}%)`
        : value?.toString() || '0';
    } catch (error) {
      console.warn('Tooltip formatter error:', error);
      return value?.toString() || '0';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Multi-series Bar Chart for comparisons
interface MultiBarChartProps {
  data: Array<{ name: string; [key: string]: any }>;
  series: Array<{ key: string; name: string; color: string }>;
  title: string;
  height?: number;
  loading?: boolean;
  emptyMessage?: string;
  stacked?: boolean;
}

export const MultiBarChart: React.FC<MultiBarChartProps> = ({
  data,
  series,
  title,
  height = 300,
  loading,
  emptyMessage = 'No data available',
  stacked = false,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                stackId={stacked ? 'stack' : undefined}
                radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};