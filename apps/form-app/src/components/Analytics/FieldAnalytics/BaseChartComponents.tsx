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
import { cn } from '@dculus/utils';
import { HelpCircle } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

// Color palettes for different chart types — Typeform design system aligned
export const CHART_COLORS = {
  primary: [
    '#7C3AAE', // Violet  (matches --chart-1 hue)
    '#0E8C70', // Emerald (matches --chart-2 hue)
    '#2563EB', // Blue    (matches --chart-3 hue)
    '#D97706', // Amber
    '#E85D4A', // Coral   (matches --chart-5 hue)
    '#9B5CB5', // Soft violet
    '#1D7A64', // Deep emerald
    '#1E50C8', // Deep blue
  ],
  secondary: [
    '#f0ebff', // Light violet
    '#e6f7f4', // Light emerald
    '#e8f0fe', // Light blue
    '#fef3e2', // Light amber
    '#fdecea', // Light coral
    '#ede9fe', // Soft violet
    '#d1fae5', // Soft emerald
    '#dbeafe', // Soft blue
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
        className="text-muted-foreground hover:text-foreground h-auto w-auto p-0"
        aria-label={`Help: ${title}`}
      >
        <HelpCircle className="h-4 w-4" />
      </Button>

      {isVisible && (
        <div className="absolute z-10 left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          <div className="font-medium mb-1">{title}</div>
          <div className="text-[var(--tf-light-muted)]">{description}</div>
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
      <div className="bg-card px-3 py-2.5 border border-[var(--tf-border-medium)] rounded-xl shadow-[var(--shadow-md)] text-sm min-w-[140px]">
        {label && (
          <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1.5">
            {label}
          </p>
        )}
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground font-medium">
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
              <div className="h-4 bg-[#ebe9ec] rounded w-20"></div>
              {icon && <div className="h-8 w-8 bg-[#ebe9ec] rounded"></div>}
            </div>
            <div className="h-8 bg-[#ebe9ec] rounded w-16 mb-2"></div>
            {subtitle && <div className="h-3 bg-[#ebe9ec] rounded w-24"></div>}
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
            <p className="text-sm font-medium text-foreground">{title}</p>
            {helpText && <HelpTooltip title={title} description={helpText} />}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-primary">{displayValue}</p>
          {trend && (
            <div
              className={`flex items-center text-sm ${
                trend.isPositive ? 'text-primary' : 'text-destructive'
              }`}
            >
              <span>
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
              </span>
            </div>
          )}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
};

export const FieldAnalyticsLoader: React.FC<{ statCount?: number; chartCount?: number }> = ({
  statCount = 4, chartCount = 2,
}) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: statCount }).map((_, i) => (
        <StatCard key={i} title="…" value="--" loading />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: chartCount }).map((_, i) => (
        <div key={i} className="animate-pulse h-96 bg-[#ebe9ec] rounded-xl" />
      ))}
    </div>
  </div>
);

interface FieldAnalyticsEmptyProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const FieldAnalyticsEmpty: React.FC<FieldAnalyticsEmptyProps> = ({ icon, title, subtitle }) => (
  <Card className="w-full">
    <CardContent className="p-8">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-[#f0ebff] mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-primary mb-2">{title}</h3>
        {subtitle && <p className="text-foreground max-w-md mx-auto">{subtitle}</p>}
      </div>
    </CardContent>
  </Card>
);

interface MetricItemProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: React.ReactNode;
  className?: string;
  progress?: number;
  progressColor?: string;
}

export const MetricItem: React.FC<MetricItemProps> = ({
  icon, value, label, className = '', progress, progressColor = 'bg-primary/50',
}) => (
  <div className={cn('flex items-center gap-3 p-3 rounded-lg', className)}>
    {icon}
    <div className="flex-1 min-w-0">
      <div className="text-lg font-bold text-primary">{value}</div>
      <div className="text-sm text-foreground">{label}</div>
      {progress !== undefined && (
        <div className="w-full bg-[#ebe9ec] rounded-full h-2 mt-2">
          <div
            className={cn('h-2 rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  </div>
);

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
  emptyMessage,
  helpText: _helpText,
}) => {
  const { t: tCommon } = useTranslation('common');
  const finalEmptyMessage = emptyMessage ?? tCommon('noDataAvailable');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded-xl"></div>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {finalEmptyMessage}
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
  emptyMessage,
  yAxisLabel,
  xAxisLabel,
  showGrid = true,
}) => {
  const { t: tCommon } = useTranslation('common');
  const finalEmptyMessage = emptyMessage ?? tCommon('noDataAvailable');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded-xl"></div>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {finalEmptyMessage}
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
            {showGrid && <CartesianGrid stroke="rgba(81,76,84,0.06)" strokeDasharray="0" vertical={false} />}
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={{ fill: '#a09aa2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
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
                  tick={{ fontSize: 11, fill: '#a09aa2' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#a09aa2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
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
                  tick={{ fill: '#a09aa2', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
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
  emptyMessage,
  yAxisLabel,
  xAxisLabel,
  showGrid = true,
  showDots = true,
}) => {
  const { t: tCommon } = useTranslation('common');
  const finalEmptyMessage = emptyMessage ?? tCommon('noDataAvailable');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded-xl"></div>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {finalEmptyMessage}
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
            {showGrid && <CartesianGrid stroke="rgba(81,76,84,0.06)" strokeDasharray="0" vertical={false} />}
            <XAxis
              dataKey="name"
              tick={{ fill: '#a09aa2', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              label={
                xAxisLabel
                  ? { value: xAxisLabel, position: 'insideBottom', offset: -10 }
                  : undefined
              }
            />
            <YAxis
              tick={{ fill: '#a09aa2', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
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
  emptyMessage,
  showPercentage = false,
}) => {
  const { t: tCommon } = useTranslation('common');
  const finalEmptyMessage = emptyMessage ?? tCommon('noDataAvailable');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded-xl"></div>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {finalEmptyMessage}
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
            <CartesianGrid stroke="rgba(81,76,84,0.06)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: '#a09aa2', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a09aa2', fontSize: 11 }} axisLine={false} tickLine={false} />
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
  emptyMessage,
  stacked = false,
}) => {
  const { t: tCommon } = useTranslation('common');
  const finalEmptyMessage = emptyMessage ?? tCommon('noDataAvailable');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-[#ebe9ec] rounded-xl"></div>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            {finalEmptyMessage}
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
            <CartesianGrid stroke="rgba(81,76,84,0.06)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#a09aa2', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a09aa2', fontSize: 11 }} axisLine={false} tickLine={false} />
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