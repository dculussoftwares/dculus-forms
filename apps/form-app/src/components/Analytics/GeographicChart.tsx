import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@dculus/ui';
import { Globe, TrendingUp, BarChart3, Map } from 'lucide-react';
import { CountryStats } from '../../hooks/useFormAnalytics';
import { WorldMapVisualization } from './WorldMapVisualization';
import { useTranslation } from '../../hooks/useTranslation';

interface GeographicChartProps {
  data: CountryStats[];
  submissionData?: CountryStats[];
  totalViews: number;
  totalSubmissions?: number;
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

const CustomTooltip = ({ active, payload, dataMode, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const metricLabel = dataMode === 'submissions' ? t('submissions') : t('views');
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{data.name}</p>
        <p className="text-sm text-gray-600">
          {metricLabel}: {data.count} ({data.percentage.toFixed(1)}%)
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

type ViewType = 'chart' | 'map';
type DataMode = 'views' | 'submissions';

export const GeographicChart: React.FC<GeographicChartProps> = ({
  data,
  submissionData = [],
  totalViews,
  totalSubmissions = 0,
  loading = false
}) => {
  const { t } = useTranslation('geographicChart');
  const [viewType, setViewType] = useState<ViewType>('map');
  const [dataMode, setDataMode] = useState<DataMode>('views');
  // Get current data based on mode
  const currentData = dataMode === 'submissions' ? submissionData : data;
  const currentTotal = dataMode === 'submissions' ? totalSubmissions : totalViews;

  // Show world map if requested
  if (viewType === 'map') {
    return (
      <div className="animate-in fade-in duration-300">
        <WorldMapVisualization
          data={currentData}
          submissionData={submissionData}
          dataMode={dataMode}
          onDataModeChange={setDataMode}
          loading={loading}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-blue-600" />
              {t('title')}
            </div>
            <div className="flex items-center gap-2">
              <DataModeToggle dataMode={dataMode} onDataModeChange={setDataMode} />
              <ViewToggleButtons viewType={viewType} onViewTypeChange={setViewType} />
            </div>
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

  if (!currentData || currentData.length === 0) {
    const emptyMessage = dataMode === 'submissions' 
      ? 'Data will appear once visitors submit your form'
      : 'Data will appear once visitors access your form';
    
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-blue-600" />
              {t('title')}
            </div>
            <div className="flex items-center gap-2">
              <DataModeToggle dataMode={dataMode} onDataModeChange={setDataMode} />
              <ViewToggleButtons viewType={viewType} onViewTypeChange={setViewType} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-gray-500">
            <Globe className="h-12 w-12 mb-3 text-gray-300" />
            <p className="text-sm">{t('noData')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {emptyMessage}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the pie chart
  const chartData = currentData.slice(0, 8).map((country, index) => ({
    ...country,
    color: COLORS[index % COLORS.length]
  }));

  // Calculate "Others" if there are more than 8 countries
  if (currentData.length > 8) {
    const othersCount = currentData.slice(8).reduce((sum, country) => sum + country.count, 0);
    const othersPercentage = (othersCount / currentTotal) * 100;
    
    chartData.push({
      name: 'Others',
      code: 'OTH',
      count: othersCount,
      percentage: othersPercentage,
      color: '#6b7280' // gray-500
    });
  }

  const topCountry = currentData[0];

  return (
    <div className="animate-in fade-in duration-300">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-blue-600" />
              {t('title')}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                {currentData.length} countries
              </div>
              <DataModeToggle dataMode={dataMode} onDataModeChange={setDataMode} />
              <ViewToggleButtons viewType={viewType} onViewTypeChange={setViewType} />
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
              <Tooltip content={<CustomTooltip dataMode={dataMode} t={t} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Top Country Summary */}
        {topCountry && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">{t('topCountry')}</p>
                <p className="text-lg font-bold text-blue-800">{topCountry.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-600">
                  {topCountry.count} {dataMode === 'submissions' ? t('submissions') : t('views')}
                </p>
                <p className="text-lg font-bold text-blue-800">
                  {topCountry.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Countries List */}
        <div className="mt-4 space-y-2">
          {currentData.slice(0, 5).map((country, index) => (
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
          
          {currentData.length > 5 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500 text-center">
                +{currentData.length - 5} more countries
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

// View toggle buttons component
interface ViewToggleButtonsProps {
  viewType: ViewType;
  onViewTypeChange: (viewType: ViewType) => void;
}

const ViewToggleButtons: React.FC<ViewToggleButtonsProps> = ({ viewType, onViewTypeChange }) => {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 border shadow-sm">
      <Button
        size="sm"
        variant={viewType === 'map' ? 'default' : 'ghost'}
        onClick={() => onViewTypeChange('map')}
        className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
          viewType === 'map' 
            ? 'bg-white shadow-sm text-blue-700 border-0' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        <Map className="h-3 w-3 mr-1.5" />
        Map View
      </Button>
      <Button
        size="sm"
        variant={viewType === 'chart' ? 'default' : 'ghost'}
        onClick={() => onViewTypeChange('chart')}
        className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
          viewType === 'chart' 
            ? 'bg-white shadow-sm text-blue-700 border-0' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        <BarChart3 className="h-3 w-3 mr-1.5" />
        Chart View
      </Button>
    </div>
  );
};

// Data mode toggle component
interface DataModeToggleProps {
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
}

const DataModeToggle: React.FC<DataModeToggleProps> = ({ dataMode, onDataModeChange }) => {
  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1 border shadow-sm">
      <Button
        size="sm"
        variant={dataMode === 'views' ? 'default' : 'ghost'}
        onClick={() => onDataModeChange('views')}
        className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
          dataMode === 'views' 
            ? 'bg-white shadow-sm text-blue-700 border-0' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        Views
      </Button>
      <Button
        size="sm"
        variant={dataMode === 'submissions' ? 'default' : 'ghost'}
        onClick={() => onDataModeChange('submissions')}
        className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
          dataMode === 'submissions' 
            ? 'bg-white shadow-sm text-orange-700 border-0' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        Submissions
      </Button>
    </div>
  );
};