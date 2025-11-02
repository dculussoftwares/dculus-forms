import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@dculus/ui';
import { Monitor, Globe } from 'lucide-react';
import { OSStats, BrowserStats } from '../../hooks/useFormAnalytics';
import { useTranslation } from '../../hooks/useTranslation';

type DataMode = 'views' | 'submissions' | 'combined';

interface BrowserOSChartsProps {
  osData: OSStats[];
  browserData: BrowserStats[];
  osSubmissionData?: OSStats[];
  browserSubmissionData?: BrowserStats[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label, dataMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            let color = entry.color;
            let metricLabel = '';
            let value = entry.value;
            let percentage = entry.payload.percentage;

            if (entry.dataKey === 'views' || (dataMode === 'views' && entry.dataKey === 'count')) {
              metricLabel = 'Views';
              color = '#3b82f6';
            } else if (entry.dataKey === 'submissions' || (dataMode === 'submissions' && entry.dataKey === 'count')) {
              metricLabel = 'Submissions';
              color = '#f59e0b';
            } else if (entry.dataKey === 'count' && dataMode === 'combined') {
              // For combined mode, we need to check the data structure
              metricLabel = 'Views';
              color = '#3b82f6';
            } else if (entry.dataKey === 'submissionCount') {
              metricLabel = 'Submissions';
              color = '#f59e0b';
              percentage = entry.payload.submissionPercentage;
            }

            return (
              <p key={index} className="text-sm" style={{ color }}>
                {metricLabel}: {value} ({percentage?.toFixed(1)}%)
              </p>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

const EmptyState = ({ icon: Icon, title, subtitle }: { 
  icon: React.ElementType, 
  title: string, 
  subtitle: string 
}) => (
  <div className="h-48 flex flex-col items-center justify-center text-gray-500">
    <Icon className="h-10 w-10 mb-3 text-gray-300" />
    <p className="text-sm font-medium">{title}</p>
    <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
  </div>
);

const LoadingState = () => (
  <div className="h-48 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
);

export const BrowserOSCharts: React.FC<BrowserOSChartsProps> = ({
  osData,
  browserData,
  osSubmissionData = [],
  browserSubmissionData = [],
  loading = false
}) => {
  const [dataMode, setDataMode] = useState<DataMode>('views');
  const { t } = useTranslation('browserOSCharts');

  // Helper function to merge view and submission data
  const mergeData = (viewData: (OSStats | BrowserStats)[], submissionData: (OSStats | BrowserStats)[]) => {
    const merged = new Map();
    
    // Add view data
    viewData.forEach(item => {
      merged.set(item.name, {
        name: item.name,
        count: item.count,
        percentage: item.percentage,
        submissionCount: 0,
        submissionPercentage: 0
      });
    });
    
    // Add submission data
    submissionData.forEach(item => {
      if (merged.has(item.name)) {
        const existing = merged.get(item.name);
        existing.submissionCount = item.count;
        existing.submissionPercentage = item.percentage;
      } else {
        merged.set(item.name, {
          name: item.name,
          count: 0,
          percentage: 0,
          submissionCount: item.count,
          submissionPercentage: item.percentage
        });
      }
    });
    
    return Array.from(merged.values());
  };

  const getCurrentOSData = () => {
    if (dataMode === 'views') return osData;
    if (dataMode === 'submissions') return osSubmissionData;
    return mergeData(osData, osSubmissionData);
  };

  const getCurrentBrowserData = () => {
    if (dataMode === 'views') return browserData;
    if (dataMode === 'submissions') return browserSubmissionData;
    return mergeData(browserData, browserSubmissionData);
  };

  const currentOSData = getCurrentOSData();
  const currentBrowserData = getCurrentBrowserData();
  return (
    <div className="space-y-6">
      {/* Shared Header with Data Mode Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Browser & Operating System Analytics</h3>
        <DataModeToggle dataMode={dataMode} onDataModeChange={setDataMode} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operating Systems Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center">
                <Monitor className="h-4 w-4 mr-2 text-green-600" />
                Operating Systems
              </div>
              {currentOSData && currentOSData.length > 0 && (
                <span className="text-sm text-gray-500">{currentOSData.length} systems</span>
              )}
            </CardTitle>
          </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : !currentOSData || currentOSData.length === 0 ? (
            <EmptyState 
              icon={Monitor}
              title={t('noOSData')}
              subtitle={`${dataMode === 'submissions' ? 'Submission' : 'View'} operating system data will appear here`}
            />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentOSData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip dataMode={dataMode} />} />
                    {dataMode === 'combined' ? (
                      <>
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Views" />
                        <Bar dataKey="submissionCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Submissions" />
                      </>
                    ) : (
                      <Bar 
                        dataKey="count" 
                        fill={dataMode === 'submissions' ? '#f59e0b' : '#10b981'} 
                        radius={[4, 4, 0, 0]} 
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* OS Stats List */}
              <div className="mt-4 space-y-2">
                {currentOSData.slice(0, 5).map((os) => (
                  <div key={os.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded mr-3 ${
                        dataMode === 'submissions' ? 'bg-orange-500' : 'bg-green-500'
                      }`} />
                      <span className="text-sm text-gray-700">{os.name}</span>
                    </div>
                    <div className="text-right">
                      {dataMode === 'combined' ? (
                        <div className="space-y-1">
                          <div>
                            <span className="text-sm font-medium text-blue-600">{os.count}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({os.percentage.toFixed(1)}%) views
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-orange-600">{os.submissionCount || 0}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({(os.submissionPercentage || 0).toFixed(1)}%) submissions
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-900">{os.count}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({os.percentage.toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Browsers Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2 text-blue-600" />
              Browsers
            </div>
            {currentBrowserData && currentBrowserData.length > 0 && (
              <span className="text-sm text-gray-500">{currentBrowserData.length} browsers</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : !currentBrowserData || currentBrowserData.length === 0 ? (
            <EmptyState 
              icon={Globe}
              title={t('noBrowserData')}
              subtitle={`${dataMode === 'submissions' ? 'Submission' : 'View'} browser usage data will appear here`}
            />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={currentBrowserData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip dataMode={dataMode} />} />
                    {dataMode === 'combined' ? (
                      <>
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Views" />
                        <Bar dataKey="submissionCount" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Submissions" />
                      </>
                    ) : (
                      <Bar 
                        dataKey="count" 
                        fill={dataMode === 'submissions' ? '#f59e0b' : '#3b82f6'} 
                        radius={[4, 4, 0, 0]} 
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Browser Stats List */}
              <div className="mt-4 space-y-2">
                {currentBrowserData.slice(0, 5).map((browser) => (
                  <div key={browser.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded mr-3 ${
                        dataMode === 'submissions' ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm text-gray-700">{browser.name}</span>
                    </div>
                    <div className="text-right">
                      {dataMode === 'combined' ? (
                        <div className="space-y-1">
                          <div>
                            <span className="text-sm font-medium text-blue-600">{browser.count}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({browser.percentage.toFixed(1)}%) views
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-orange-600">{browser.submissionCount || 0}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({(browser.submissionPercentage || 0).toFixed(1)}%) submissions
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-900">{browser.count}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            ({browser.percentage.toFixed(1)}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
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
      <Button
        size="sm"
        variant={dataMode === 'combined' ? 'default' : 'ghost'}
        onClick={() => onDataModeChange('combined')}
        className={`h-8 px-3 text-xs font-medium transition-all duration-200 ${
          dataMode === 'combined' 
            ? 'bg-white shadow-sm text-purple-700 border-0' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-200'
        }`}
      >
        Combined
      </Button>
    </div>
  );
};