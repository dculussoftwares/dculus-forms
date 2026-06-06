import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@dculus/ui';
import { Globe, TrendingUp, BarChart3, Map } from 'lucide-react';
import {
  CountryStats,
  RegionStats,
  CityStats,
} from '../../hooks/useFormAnalytics';
import { WorldMapVisualization } from './WorldMapVisualization';
import { useTranslation } from '../../hooks/useTranslation';

interface GeographicChartProps {
  data: CountryStats[];
  submissionData?: CountryStats[];
  regionData?: RegionStats[];
  regionSubmissionData?: RegionStats[];
  cityData?: CityStats[];
  citySubmissionData?: CityStats[];
  totalViews: number;
  totalSubmissions?: number;
  loading?: boolean;
}

const COLORS = [
  '#7C3AAE', // violet  — matches --chart-1
  '#0E8C70', // emerald — matches --chart-2
  '#2563EB', // blue    — matches --chart-3
  '#D97706', // amber
  '#E85D4A', // coral   — matches --chart-5
  '#9B5CB5', // soft violet
  '#1D7A64', // deep emerald
  '#1E50C8', // deep blue
];

const CustomTooltip = ({ active, payload, dataMode, t }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const metricLabel =
      dataMode === 'submissions' ? t('submissions') : t('views');
    return (
      <div className="bg-card px-3 py-2.5 border border-[var(--tf-border-medium)] rounded-xl shadow-[var(--shadow-md)] text-sm min-w-[120px]">
        <p className="font-semibold text-primary">{data.name}</p>
        <p className="text-sm text-foreground">
          {metricLabel}: {data.count} ({data.percentage.toFixed(1)}%)
        </p>
      </div>
    );
  }
  return null;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;
type GenericBreakdownEntry = CountryStats | RegionStats | CityStats;

interface GeographicBreakdownProps {
  countries: CountryStats[];
  regions: RegionStats[];
  cities: CityStats[];
  dataMode: DataMode;
  t: TranslateFn;
}

const GeographicBreakdown: React.FC<GeographicBreakdownProps> = ({
  countries,
  regions,
  cities,
  dataMode,
  t,
}) => {
  const metricLabel =
    dataMode === 'submissions' ? t('submissions') : t('views');

  const sections: Array<{
    key: string;
    title: string;
    data: GenericBreakdownEntry[];
    formatName: (entry: GenericBreakdownEntry) => string;
    formatMeta?: (entry: GenericBreakdownEntry) => string | undefined;
  }> = [
    {
      key: 'countries',
      title: t('breakdown.countries'),
      data: countries,
      formatName: (entry) => (entry as CountryStats).name,
      formatMeta: (entry) => (entry as CountryStats).code?.toUpperCase(),
    },
    {
      key: 'regions',
      title: t('breakdown.regions'),
      data: regions,
      formatName: (entry) => (entry as RegionStats).name,
      formatMeta: (entry) => (entry as RegionStats).countryCode?.toUpperCase(),
    },
    {
      key: 'cities',
      title: t('breakdown.cities'),
      data: cities,
      formatName: (entry) => (entry as CityStats).name,
      formatMeta: (entry) => {
        const city = entry as CityStats;
        const parts = [city.region, city.countryCode?.toUpperCase()].filter(
          Boolean
        );
        return parts.length ? parts.join(' • ') : undefined;
      },
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {sections.map((section) => (
        <Card key={section.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-primary">
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {section.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('breakdown.empty')}</p>
            ) : (
              <div className="space-y-3">
                {section.data.slice(0, 5).map((entry, index) => {
                  const meta = section.formatMeta
                    ? section.formatMeta(entry)
                    : undefined;
                  return (
                    <div
                      key={`${section.key}-${index}`}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-primary">
                          {section.formatName(entry)}
                        </p>
                        {meta && (
                          <p className="text-xs text-muted-foreground">{meta}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">
                          {entry.count}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.percentage.toFixed(1)}% · {metricLabel}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {section.data.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {t('breakdown.more', {
                      values: { count: section.data.length - 5 },
                    })}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
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
  regionData = [],
  regionSubmissionData = [],
  cityData = [],
  citySubmissionData = [],
  totalViews,
  totalSubmissions = 0,
  loading = false,
}) => {
  const { t } = useTranslation('geographicChart');
  const [viewType, setViewType] = useState<ViewType>('map');
  const [dataMode, setDataMode] = useState<DataMode>('views');
  // Get current data based on mode
  const currentData = dataMode === 'submissions' ? submissionData : data;
  const currentRegions =
    dataMode === 'submissions' ? regionSubmissionData : regionData;
  const currentCities =
    dataMode === 'submissions' ? citySubmissionData : cityData;
  const currentTotal =
    dataMode === 'submissions' ? totalSubmissions : totalViews;

  // Show world map if requested
  if (viewType === 'map') {
    return (
      <div className="animate-in fade-in duration-300 space-y-4">
        <WorldMapVisualization
          data={currentData}
          submissionData={submissionData}
          dataMode={dataMode}
          onDataModeChange={setDataMode}
          loading={loading}
          headerActions={
            <ViewToggleButtons
              viewType={viewType}
              onViewTypeChange={setViewType}
            />
          }
        />
        <GeographicBreakdown
          countries={currentData}
          regions={currentRegions}
          cities={currentCities}
          dataMode={dataMode}
          t={t}
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
              <Globe className="h-4 w-4 mr-2 text-[#7C3AAE]" />
              {t('title')}
            </div>
            <div className="flex items-center gap-3">
              <DataModeToggle
                dataMode={dataMode}
                onDataModeChange={setDataMode}
              />
              <ViewToggleButtons
                viewType={viewType}
                onViewTypeChange={setViewType}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C3AAE]"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentData || currentData.length === 0) {
    const emptyMessage =
      dataMode === 'submissions'
        ? 'Data will appear once visitors submit your form'
        : 'Data will appear once visitors access your form';

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-[#7C3AAE]" />
              {t('title')}
            </div>
            <div className="flex items-center gap-3">
              <DataModeToggle
                dataMode={dataMode}
                onDataModeChange={setDataMode}
              />
              <ViewToggleButtons
                viewType={viewType}
                onViewTypeChange={setViewType}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
            <Globe className="h-12 w-12 mb-3 text-[var(--tf-light-muted)]" />
            <p className="text-sm">{t('noData')}</p>
            <p className="text-xs text-muted-foreground mt-1">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the pie chart
  const chartData = currentData.slice(0, 8).map((country, index) => ({
    ...country,
    color: COLORS[index % COLORS.length],
  }));

  // Calculate "Others" if there are more than 8 countries
  if (currentData.length > 8) {
    const othersCount = currentData
      .slice(8)
      .reduce((sum, country) => sum + country.count, 0);
    const othersPercentage = (othersCount / currentTotal) * 100;

    chartData.push({
      name: 'Others',
      code: 'OTH',
      count: othersCount,
      percentage: othersPercentage,
      color: '#6b7280', // gray-500
    });
  }

  const topCountry = currentData[0];

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-[#7C3AAE]" />
              {t('title')}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm text-primary">
                <TrendingUp className="h-3 w-3 mr-1" />
                {currentData.length} countries
              </div>
              <DataModeToggle
                dataMode={dataMode}
                onDataModeChange={setDataMode}
              />
              <ViewToggleButtons
                viewType={viewType}
                onViewTypeChange={setViewType}
              />
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
                  fill="#7C3AAE"
                  dataKey="count"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={<CustomTooltip dataMode={dataMode} t={t} />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Country Summary */}
          {topCountry && (
            <div className="mt-4 p-3 bg-[#f0ebff] rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3c323e]">
                    {t('topCountry')}
                  </p>
                  <p className="text-lg font-bold text-[#3c323e]">
                    {topCountry.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#7C3AAE]">
                    {topCountry.count}{' '}
                    {dataMode === 'submissions' ? t('submissions') : t('views')}
                  </p>
                  <p className="text-lg font-bold text-[#3c323e]">
                    {topCountry.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Countries List */}
          <div className="mt-4 space-y-2">
            {currentData.slice(0, 5).map((country, index) => (
              <div
                key={country.code || country.name}
                className="flex items-center justify-between py-1"
              >
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-3"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-foreground">{country.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-primary">
                    {country.count}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({country.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}

            {currentData.length > 5 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  +{currentData.length - 5} more countries
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <GeographicBreakdown
        countries={currentData}
        regions={currentRegions}
        cities={currentCities}
        dataMode={dataMode}
        t={t}
      />
    </div>
  );
};

// View toggle buttons component
interface ViewToggleButtonsProps {
  viewType: ViewType;
  onViewTypeChange: (viewType: ViewType) => void;
}

const ViewToggleButtons: React.FC<ViewToggleButtonsProps> = ({
  viewType,
  onViewTypeChange,
}) => {
  const { t } = useTranslation('geographicChart');

  return (
    <Tabs
      value={viewType}
      onValueChange={(value) => onViewTypeChange(value as ViewType)}
      className="w-fit"
    >
      <TabsList>
        <TabsTrigger value="map" className="flex items-center gap-2">
          <Map className="h-3 w-3" />
          {t('viewToggle.map')}
        </TabsTrigger>
        <TabsTrigger value="chart" className="flex items-center gap-2">
          <BarChart3 className="h-3 w-3" />
          {t('viewToggle.chart')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

// Data mode toggle component
interface DataModeToggleProps {
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
}

const DataModeToggle: React.FC<DataModeToggleProps> = ({
  dataMode,
  onDataModeChange,
}) => {
  const { t } = useTranslation('geographicChart');

  return (
    <Tabs
      value={dataMode}
      onValueChange={(value) => onDataModeChange(value as DataMode)}
      className="w-fit"
    >
      <TabsList>
        <TabsTrigger value="views">{t('views')}</TabsTrigger>
        <TabsTrigger value="submissions">{t('submissions')}</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
