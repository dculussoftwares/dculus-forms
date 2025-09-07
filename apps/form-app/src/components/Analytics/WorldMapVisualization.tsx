import React from 'react';
import WorldMap from 'react-svg-worldmap';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { Globe, TrendingUp } from 'lucide-react';
import { CountryStats } from '../../hooks/useFormAnalytics';
import ISO31661 from 'iso-3166-1';

interface WorldMapVisualizationProps {
  data: CountryStats[];
  totalViews: number;
  loading?: boolean;
}

// Get the 2-letter country code from 3-letter code using iso-3166-1 library
const getCountryCode = (code3: string | undefined): string => {
  if (!code3) return '';
  
  // Use iso-3166-1 library to convert 3-letter code to 2-letter code
  const country = ISO31661.whereAlpha3(code3.toUpperCase());
  return country?.alpha2?.toLowerCase() || code3.toLowerCase();
};

// Note: Custom tooltip is not used as react-svg-worldmap handles tooltips internally

export const WorldMapVisualization: React.FC<WorldMapVisualizationProps> = ({
  data,
  loading = false
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Globe className="h-4 w-4 mr-2 text-blue-600" />
            World Map Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
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
            World Map Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex flex-col items-center justify-center text-gray-500">
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

  // Prepare data for the world map (convert to 2-letter codes)
  const mapData = data
    .map((country) => ({
      country: getCountryCode(country.code),
      value: country.count,
      name: country.name
    }))
    .filter((item) => item.country); // Filter out countries we couldn't map

  const topCountry = data[0];
  const maxValue = Math.max(...mapData.map(d => d.value));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center">
            <Globe className="h-4 w-4 mr-2 text-blue-600" />
            World Map Distribution
          </div>
          <div className="flex items-center text-sm text-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            {data.length} countries
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* World Map */}
        <div className="relative mb-6 bg-gradient-to-br from-blue-50 to-slate-50 rounded-lg border p-4">
          <div className="w-full h-80 flex items-center justify-center">
            <WorldMap
              color="#3b82f6"
              title=""
              value-suffix=" views"
              size="lg"
              data={mapData}
              tooltipBgColor="#ffffff"
              tooltipTextColor="#374151"
              borderColor="#475569"
              backgroundColor="transparent"
              strokeOpacity={0.8}
            />
          </div>
          
          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-md border">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-700">Views:</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-400"></div>
                  <span className="text-xs text-gray-600 font-medium">None</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-300 border border-blue-500"></div>
                  <span className="text-xs text-gray-600 font-medium">Low</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-blue-600 border border-blue-700"></div>
                  <span className="text-xs text-gray-600 font-medium">High</span>
                </div>
              </div>
            </div>
          </div>

          {/* Total Views Badge */}
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-md border">
            <span className="text-sm font-semibold text-gray-700">
              {mapData.reduce((sum, item) => sum + item.value, 0)} total views
            </span>
          </div>
        </div>

        {/* Top Country Summary */}
        {topCountry && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Globe className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">Top Performing Country</p>
                  <p className="text-xl font-bold text-blue-800">{topCountry.name}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-blue-800">{topCountry.count}</span>
                  <span className="text-sm text-blue-600">views</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-lg font-semibold text-green-600">
                    {topCountry.percentage.toFixed(1)}%
                  </span>
                  <span className="text-xs text-gray-500">of total</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countries List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-600" />
              Country Breakdown
            </h4>
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {data.length} total
            </div>
          </div>
          
          <div className="space-y-3">
            {data.slice(0, 5).map((country, index) => {
              const intensity = Math.max(0.2, (country.count / maxValue));
              const isTopCountry = index === 0;
              
              return (
                <div 
                  key={country.code || country.name} 
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 hover:shadow-sm hover:border-blue-200 ${
                    isTopCountry 
                      ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' 
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div 
                        className="w-5 h-5 rounded-full border-2 shadow-sm" 
                        style={{ 
                          backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                          borderColor: '#3b82f6'
                        }}
                      />
                      {isTopCountry && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div>
                      <span className={`font-medium ${isTopCountry ? 'text-blue-900' : 'text-gray-800'}`}>
                        {country.name}
                      </span>
                      {isTopCountry && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          #1
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isTopCountry ? 'text-blue-800 text-lg' : 'text-gray-900'}`}>
                        {country.count}
                      </span>
                      <span className="text-xs text-gray-500">views</span>
                    </div>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${country.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-600 min-w-[3rem]">
                        {country.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {data.length > 5 && (
            <div className="pt-4 mt-4 border-t border-gray-200">
              <button className="w-full text-sm text-gray-600 hover:text-blue-600 transition-colors duration-200 flex items-center justify-center gap-1 py-2">
                <span>Show {data.length - 5} more countries</span>
                <TrendingUp className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};