import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { Monitor, Globe } from 'lucide-react';
import { OSStats, BrowserStats } from '../../hooks/useFormAnalytics';

interface BrowserOSChartsProps {
  osData: OSStats[];
  browserData: BrowserStats[];
  loading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-blue-600">
          Views: {data.value} ({data.payload.percentage.toFixed(1)}%)
        </p>
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
  loading = false
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Operating Systems Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center">
              <Monitor className="h-4 w-4 mr-2 text-green-600" />
              Operating Systems
            </div>
            {osData && osData.length > 0 && (
              <span className="text-sm text-gray-500">{osData.length} systems</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : !osData || osData.length === 0 ? (
            <EmptyState 
              icon={Monitor}
              title="No OS data available"
              subtitle="Operating system data will appear here"
            />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={osData}
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
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* OS Stats List */}
              <div className="mt-4 space-y-2">
                {osData.slice(0, 5).map((os) => (
                  <div key={os.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded bg-green-500 mr-3" />
                      <span className="text-sm text-gray-700">{os.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{os.count}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({os.percentage.toFixed(1)}%)
                      </span>
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
            {browserData && browserData.length > 0 && (
              <span className="text-sm text-gray-500">{browserData.length} browsers</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState />
          ) : !browserData || browserData.length === 0 ? (
            <EmptyState 
              icon={Globe}
              title="No browser data available"
              subtitle="Browser usage data will appear here"
            />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={browserData}
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
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Browser Stats List */}
              <div className="mt-4 space-y-2">
                {browserData.slice(0, 5).map((browser) => (
                  <div key={browser.name} className="flex items-center justify-between py-1">
                    <div className="flex items-center">
                      <div className="w-3 h-3 rounded bg-blue-500 mr-3" />
                      <span className="text-sm text-gray-700">{browser.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">{browser.count}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({browser.percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};