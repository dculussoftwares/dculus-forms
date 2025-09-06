import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { Globe, TrendingUp } from 'lucide-react';
import { CountryStats } from '../../hooks/useFormAnalytics';

interface GeographicChartProps {
  data: CountryStats[];
  totalViews: number;
  loading?: boolean;
}

const COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          Views: {data.count} ({data.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null; // Don't show labels for slices < 5%
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      className="text-xs font-medium"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const GeographicChart: React.FC<GeographicChartProps> = ({
  data,
  totalViews,
  loading = false
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Globe className="h-4 w-4 mr-2 text-blue-600" />
            Geographic Distribution
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
            <Globe className="h-4 w-4 mr-2 text-blue-600" />
            Geographic Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <Globe className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm">No geographic data available</p>
            <p className="text-xs text-gray-400 mt-1">
              Data will appear once visitors access your form
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the pie chart
  const chartData = data.slice(0, 8).map((country, index) => ({
    ...country,
    color: COLORS[index % COLORS.length]
  }));

  // Calculate "Others" if there are more than 8 countries
  if (data.length > 8) {
    const othersCount = data.slice(8).reduce((sum, country) => sum + country.count, 0);
    const othersPercentage = (othersCount / totalViews) * 100;
    
    chartData.push({
      name: 'Others',
      code: 'OTH',
      count: othersCount,
      percentage: othersPercentage,
      color: '#6b7280' // gray-500
    });
  }

  const topCountry = data[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center">
            <Globe className="h-4 w-4 mr-2 text-blue-600" />
            Geographic Distribution
          </div>
          <div className="flex items-center text-sm text-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            {data.length} countries
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Top Country Summary */}
        {topCountry && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Top Country</p>
                <p className="text-lg font-bold text-blue-800">{topCountry.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">{topCountry.count} views</p>
                <p className="text-lg font-bold text-blue-800">
                  {topCountry.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Countries List */}
        <div className="mt-4 space-y-2">
          {data.slice(0, 5).map((country, index) => (
            <div key={country.code || country.name} className="flex items-center justify-between py-1">
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-3" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-700">{country.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900">
                  {country.count}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({country.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          ))}
          
          {data.length > 5 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 text-center">
                +{data.length - 5} more countries
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};