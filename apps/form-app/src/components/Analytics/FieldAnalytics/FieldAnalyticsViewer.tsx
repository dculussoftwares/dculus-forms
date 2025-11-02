import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, Button } from '@dculus/ui';
import { useFieldAnalyticsManager, FieldAnalyticsData, useFieldAnalyticsCache } from '@/hooks/useFieldAnalytics.ts';
import { usePerformanceMonitor, useMemoryTracker } from '@/hooks/usePerformanceMonitor.ts';
import { TextFieldAnalytics } from './TextFieldAnalytics';
import { NumberFieldAnalytics } from './NumberFieldAnalytics';
import { SelectionFieldAnalytics } from './SelectionFieldAnalytics';
import { CheckboxFieldAnalytics } from './CheckboxFieldAnalytics';
import { DateFieldAnalytics } from './DateFieldAnalytics';
import { EmailFieldAnalytics } from './EmailFieldAnalytics';
import { useTranslation } from '../../../hooks/useTranslation';
import { 
  FileText, 
  Hash, 
  Mail, 
  Calendar, 
  ListOrdered, 
  CheckSquare, 
  CircleDot, 
  RefreshCw, 
  BarChart3, 
  TrendingUp,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

interface FieldAnalyticsViewerProps {
  formId: string;
  initialSelectedFieldId?: string | null;
}

// Field Type Icons
const getFieldTypeIcon = (fieldType: string) => {
  switch (fieldType) {
    case 'text_input_field':
    case 'text_area_field':
      return <FileText className="h-5 w-5" />;
    case 'number_field':
      return <Hash className="h-5 w-5" />;
    case 'email_field':
      return <Mail className="h-5 w-5" />;
    case 'date_field':
      return <Calendar className="h-5 w-5" />;
    case 'select_field':
      return <ListOrdered className="h-5 w-5" />;
    case 'radio_field':
      return <CircleDot className="h-5 w-5" />;
    case 'checkbox_field':
      return <CheckSquare className="h-5 w-5" />;
    default:
      return <BarChart3 className="h-5 w-5" />;
  }
};

// Field Type Display Names
const getFieldTypeDisplayName = (fieldType: string, t: (key: string) => string) => {
  switch (fieldType) {
    case 'text_input_field': return t('fieldAnalyticsViewer.fieldTypes.text_input_field');
    case 'text_area_field': return t('fieldAnalyticsViewer.fieldTypes.text_area_field');
    case 'number_field': return t('fieldAnalyticsViewer.fieldTypes.number_field');
    case 'email_field': return t('fieldAnalyticsViewer.fieldTypes.email_field');
    case 'date_field': return t('fieldAnalyticsViewer.fieldTypes.date_field');
    case 'select_field': return t('fieldAnalyticsViewer.fieldTypes.select_field');
    case 'radio_field': return t('fieldAnalyticsViewer.fieldTypes.radio_field');
    case 'checkbox_field': return t('fieldAnalyticsViewer.fieldTypes.checkbox_field');
    default: return t('fieldAnalyticsViewer.fieldTypes.unknown');
  }
};

// Mini Chart Colors
const MINI_CHART_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6B7280'];

// Mini Preview Charts
const MiniWordCloud: React.FC<{ words: Array<{ word: string; count: number }> }> = ({ words }) => {
  if (!words || words.length === 0) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center">
        <FileText className="h-12 w-12 mx-auto mb-2" />
        <p className="text-sm">{useTranslation('fieldAnalyticsViewer').t('miniCharts.noWordData')}</p>
      </div>
    </div>
  );
  
  const topWords = words.slice(0, 10);
  const maxCount = Math.max(...topWords.map(w => w.count));
  
  return (
    <div className="flex flex-wrap gap-3 items-center justify-center h-full p-4">
      {topWords.map((word) => {
        const size = Math.max(16, Math.min(36, 16 + (word.count / maxCount) * 20));
        const opacity = Math.max(0.6, word.count / maxCount);
        return (
          <span
            key={word.word}
            className="px-2 py-1 text-blue-600 font-semibold hover:scale-110 transition-transform cursor-default"
            style={{ 
              fontSize: `${size}px`,
              opacity: opacity
            }}
            title={`"${word.word}" appears ${word.count} times`}
          >
            {word.word}
          </span>
        );
      })}
    </div>
  );
};

const MiniBarChart: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center">
        <BarChart3 className="h-12 w-12 mx-auto mb-2" />
        <p className="text-sm">{useTranslation('fieldAnalyticsViewer').t('miniCharts.noChartData')}</p>
      </div>
    </div>
  );
  
  return (
    <div className="h-full w-full p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.slice(0, 6)} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={false}
            tickLine={false}
          />
          <Bar 
            dataKey="value" 
            fill="#3B82F6" 
            radius={[4, 4, 0, 0]}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const MiniPieChart: React.FC<{ data: Array<{ name: string; value: number }> }> = ({ data }) => {
  if (!data || data.length === 0) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center">
        <CircleDot className="h-12 w-12 mx-auto mb-2" />
        <p className="text-sm">{useTranslation('fieldAnalyticsViewer').t('miniCharts.noSelectionData')}</p>
      </div>
    </div>
  );
  
  const chartData = data.slice(0, 5);
  
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex items-center gap-8">
        {/* Pie Chart */}
        <div className="flex-shrink-0">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
              >
                {chartData.map((_entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={MINI_CHART_COLORS[index % MINI_CHART_COLORS.length]}
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))' }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: MINI_CHART_COLORS[index % MINI_CHART_COLORS.length] }}
              />
              <span className="text-sm text-gray-700 font-medium">
                {item.name}: {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MiniPreviewChart: React.FC<{ field: FieldAnalyticsData }> = ({ field }) => {
  const { t: tCommon } = useTranslation('common');
  
  // Get real preview data from analytics data
  const getRealPreviewData = (field: FieldAnalyticsData) => {
    switch (field.fieldType) {
      case 'text_input_field':
      case 'text_area_field':
        if (field.textAnalytics?.wordCloud && field.textAnalytics.wordCloud.length > 0) {
          return { 
            type: 'wordcloud' as const, 
            data: field.textAnalytics.wordCloud.slice(0, 5).map(item => ({
              word: item.word,
              count: item.count
            }))
          };
        }
        break;
      
      case 'number_field':
        if (field.numberAnalytics?.distribution && field.numberAnalytics.distribution.length > 0) {
          return { 
            type: 'bar' as const, 
            data: field.numberAnalytics.distribution.slice(0, 5).map(item => ({
              name: item.range,
              value: item.count
            }))
          };
        }
        break;
      
      case 'email_field':
        if (field.emailAnalytics?.domains && field.emailAnalytics.domains.length > 0) {
          return { 
            type: 'bar' as const, 
            data: field.emailAnalytics.domains.slice(0, 5).map(item => ({
              name: item.domain.length > 10 ? `${item.domain.substring(0, 10)}...` : item.domain,
              value: item.count
            }))
          };
        }
        break;
      
      case 'date_field':
        if (field.dateAnalytics?.monthlyDistribution && field.dateAnalytics.monthlyDistribution.length > 0) {
          return { 
            type: 'bar' as const, 
            data: field.dateAnalytics.monthlyDistribution.slice(0, 5).map(item => ({
              name: item.month,
              value: item.count
            }))
          };
        }
        break;
      
      case 'select_field':
      case 'radio_field':
        if (field.selectionAnalytics?.options && field.selectionAnalytics.options.length > 0) {
          return { 
            type: 'pie' as const, 
            data: field.selectionAnalytics.options.slice(0, 4).map(item => ({
              name: item.option.length > 15 ? `${item.option.substring(0, 15)}...` : item.option,
              value: item.count
            }))
          };
        }
        break;
      
      case 'checkbox_field':
        if (field.checkboxAnalytics?.individualOptions && field.checkboxAnalytics.individualOptions.length > 0) {
          return { 
            type: 'bar' as const, 
            data: field.checkboxAnalytics.individualOptions.slice(0, 4).map(item => ({
              name: item.option.length > 12 ? `${item.option.substring(0, 12)}...` : item.option,
              value: item.count
            }))
          };
        }
        break;
      
      default:
        return null;
    }
    return null;
  };

  const previewData = getRealPreviewData(field);
  if (!previewData) {
    return (
      <div className="flex items-center justify-center h-16 text-gray-400 text-sm">
        {tCommon('noDataAvailable')}
      </div>
    );
  }

  switch (previewData.type) {
    case 'wordcloud':
      return <MiniWordCloud words={previewData.data as Array<{ word: string; count: number }>} />;
    case 'bar':
      return <MiniBarChart data={previewData.data as Array<{ name: string; value: number }>} />;
    case 'pie':
      return <MiniPieChart data={previewData.data as Array<{ name: string; value: number }>} />;
    default:
      return null;
  }
};

// Field Selection Grid
const FieldSelectionGrid: React.FC<{
  fields: FieldAnalyticsData[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  totalFormResponses: number;
  t: (key: string) => string;
}> = ({ fields, selectedFieldId, onFieldSelect, totalFormResponses: _totalFormResponses, t }) => {
  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('fieldList.noFieldsTitle')}</h3>
          <p className="text-gray-600">
            {t('fieldList.noFieldsDescription')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getResponseRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100';
    if (rate >= 60) return 'text-yellow-600 bg-yellow-100';
    if (rate >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {fields.map((field) => {
        const isSelected = selectedFieldId === field.fieldId;
        
        return (
          <Card 
            key={field.fieldId}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:ring-1 hover:ring-gray-300'
            }`}
            onClick={() => onFieldSelect(field.fieldId)}
          >
            <CardContent className="p-6">
              <div className="flex items-stretch gap-6">
                {/* Left side - Field Info */}
                <div 
                  className="flex-shrink-0 w-80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-lg ${
                      isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getFieldTypeIcon(field.fieldType)}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-lg">
                        {field.fieldLabel || `Field ${field.fieldId}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {getFieldTypeDisplayName(field.fieldType, t)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{t('fieldList.responses')}</span>
                      </div>
                      <div className="font-bold text-lg text-gray-900">
                        {field.totalResponses}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{t('fieldList.responseRate')}</span>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                        getResponseRateColor(field.responseRate)
                      }`}>
                        {field.responseRate.toFixed(1)}%
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{t('fieldList.lastUpdated')}</span>
                      </div>
                      <div className="font-medium text-sm text-gray-900">
                        {new Date(field.lastUpdated).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side - Chart Preview */}
                <div 
                  className="flex-1 min-h-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="h-full bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{t('fieldList.dataPreview')}</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onFieldSelect(field.fieldId);
                        }}
                        className="text-xs rounded-full"
                      >
                        {t('fieldList.clickToExplore')}
                      </Button>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-h-[200px]">
                      <MiniPreviewChart field={field} />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Analytics Content Renderer
const AnalyticsContent: React.FC<{
  field: FieldAnalyticsData;
  totalFormResponses: number;
  loading: boolean;
  t: (key: string) => string;
}> = ({ field, totalFormResponses, loading, t }) => {
  const renderAnalytics = () => {
    switch (field.fieldType) {
      case 'text_input_field':
      case 'text_area_field':
        return field.textAnalytics ? (
          <TextFieldAnalytics
            data={field.textAnalytics}
            fieldLabel={field.fieldLabel}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No text analytics data available
          </div>
        );

      case 'number_field':
        return field.numberAnalytics ? (
          <NumberFieldAnalytics
            data={field.numberAnalytics}
            fieldLabel={field.fieldLabel}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No number analytics data available
          </div>
        );

      case 'select_field':
      case 'radio_field':
        return field.selectionAnalytics ? (
          <SelectionFieldAnalytics
            data={field.selectionAnalytics}
            fieldLabel={field.fieldLabel}
            fieldType={field.fieldType === 'select_field' ? 'select' : 'radio'}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No selection analytics data available
          </div>
        );

      case 'checkbox_field':
        return field.checkboxAnalytics ? (
          <CheckboxFieldAnalytics
            data={field.checkboxAnalytics}
            fieldLabel={field.fieldLabel}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No checkbox analytics data available
          </div>
        );

      case 'date_field':
        return field.dateAnalytics ? (
          <DateFieldAnalytics
            data={field.dateAnalytics}
            fieldLabel={field.fieldLabel}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No date analytics data available
          </div>
        );

      case 'email_field':
        return field.emailAnalytics ? (
          <EmailFieldAnalytics
            data={field.emailAnalytics}
            fieldLabel={field.fieldLabel}
            totalResponses={totalFormResponses}
            loading={loading}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No email analytics data available
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>{t('detailView.notSupported')}</p>
            <p className="text-sm mt-2">{t('detailView.fieldType')}: {field.fieldType}</p>
          </div>
        );
    }
  };

  return (
    <div>
      {/* Field Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            {getFieldTypeIcon(field.fieldType)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {field.fieldLabel || `Field ${field.fieldId}`}
            </h2>
            <p className="text-sm text-gray-600">
              {getFieldTypeDisplayName(field.fieldType, t)} • {field.totalResponses} responses • {field.responseRate.toFixed(1)}% response rate
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      {renderAnalytics()}
    </div>
  );
};

// Main Component
export const FieldAnalyticsViewer: React.FC<FieldAnalyticsViewerProps> = ({ formId, initialSelectedFieldId }) => {
  const { t } = useTranslation('fieldAnalyticsViewer');
  const [searchParams, setSearchParams] = useSearchParams();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  // Get selected field from URL parameters
  const selectedFieldIdFromUrl = searchParams.get('field') || null;
  
  // Determine view based on whether a field is selected
  const view = selectedFieldIdFromUrl ? 'analytics' : 'grid';
  
  const {
    allFields,
    allFieldsLoading,
    allFieldsError,
    totalResponses,
    selectedFieldId,
    selectedField,
    selectedFieldLoading,
    selectedFieldError,
    selectField,
    clearSelection,
    refreshAll,
    loading
  } = useFieldAnalyticsManager(formId);
  
  // Field URL helpers - convert between fieldId and URL-friendly parameter
  const getFieldUrlParam = (fieldId: string) => {
    const fieldIndex = allFields.findIndex(field => field.fieldId === fieldId);
    return fieldIndex >= 0 ? `field-${fieldIndex + 1}` : fieldId;
  };

  const getFieldIdFromUrlParam = (urlParam: string) => {
    if (urlParam.startsWith('field-')) {
      const fieldNumber = parseInt(urlParam.replace('field-', ''));
      if (!isNaN(fieldNumber) && fieldNumber > 0 && fieldNumber <= allFields.length) {
        return allFields[fieldNumber - 1]?.fieldId || null;
      }
    }
    // Fallback: try to find exact match (for backward compatibility)
    return allFields.find(field => field.fieldId === urlParam)?.fieldId || null;
  };

  // Initialize URL parameter if initialSelectedFieldId is provided
  useEffect(() => {
    if (initialSelectedFieldId && !selectedFieldIdFromUrl) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('field', getFieldUrlParam(initialSelectedFieldId));
      setSearchParams(newSearchParams);
    }
  }, [initialSelectedFieldId, selectedFieldIdFromUrl, searchParams, setSearchParams, allFields]);

  // Sync URL field selection with the analytics manager
  useEffect(() => {
    const actualFieldId = getFieldIdFromUrlParam(selectedFieldIdFromUrl || '');
    if (actualFieldId && actualFieldId !== selectedFieldId) {
      selectField(actualFieldId);
    } else if (!selectedFieldIdFromUrl && selectedFieldId) {
      clearSelection();
    }
  }, [selectedFieldIdFromUrl, selectedFieldId, selectField, clearSelection, allFields]);
  
  const { invalidateFormCache } = useFieldAnalyticsCache();

  // Debug field labels
  console.log('🔍 FieldAnalyticsViewer - All Fields Data:', allFields.map(field => ({
    fieldId: field.fieldId,
    fieldType: field.fieldType,
    fieldLabel: field.fieldLabel,
    hasFieldLabel: !!field.fieldLabel,
    fallback: `Field ${field.fieldId}`
  })));
  
  // Performance monitoring (only in development and limited logging)
  const { markLoadComplete, getPerformanceSummary: _getPerformanceSummary } = usePerformanceMonitor({
    componentName: 'FieldAnalyticsViewer',
    enableLogging: false, // Disable verbose logging
  });
  
  const { getMemoryPressure: _getMemoryPressure } = useMemoryTracker('FieldAnalyticsViewer');
  
  // Mark load complete when data is ready
  useEffect(() => {
    if (!loading && allFields.length > 0) {
      markLoadComplete();
    }
  }, [loading, allFields.length, markLoadComplete]);
  
  // Performance logging disabled to prevent console spam
  // const [hasLoggedPerformance, setHasLoggedPerformance] = useState(false);
  
  // useEffect(() => {
  //   if (process.env.NODE_ENV === 'development' && !loading && allFields.length > 0 && !hasLoggedPerformance) {
  //     console.log(getPerformanceSummary());
  //     console.log('Memory pressure:', getMemoryPressure());
  //     setHasLoggedPerformance(true);
  //   }
  // }, [loading, allFields.length, hasLoggedPerformance, getPerformanceSummary, getMemoryPressure]);
  
  // Handle cache invalidation
  const handleInvalidateCache = async () => {
    try {
      await invalidateFormCache(formId);
      // Refresh data after cache invalidation
      refreshAll();
    } catch (err) {
      console.error('Failed to invalidate cache:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      refreshAll();
      // Give a minimum delay to show the spinning animation
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFieldSelect = (fieldId: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('field', getFieldUrlParam(fieldId));
    setSearchParams(newSearchParams);
    // The selectField will be triggered by the useEffect hook
  };

  const handleBackToGrid = () => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete('field');
    setSearchParams(newSearchParams);
    // The clearSelection will be triggered by the useEffect hook
  };

  // Field navigation helpers
  const getCurrentFieldIndex = () => {
    const actualFieldId = getFieldIdFromUrlParam(selectedFieldIdFromUrl || '');
    if (!actualFieldId || !allFields.length) return -1;
    return allFields.findIndex(field => field.fieldId === actualFieldId);
  };

  const handlePrevField = () => {
    const currentIndex = getCurrentFieldIndex();
    if (currentIndex > 0) {
      const prevField = allFields[currentIndex - 1];
      handleFieldSelect(prevField.fieldId);
    }
  };

  const handleNextField = () => {
    const currentIndex = getCurrentFieldIndex();
    if (currentIndex < allFields.length - 1) {
      const nextField = allFields[currentIndex + 1];
      handleFieldSelect(nextField.fieldId);
    }
  };

  const canNavigatePrev = () => getCurrentFieldIndex() > 0;
  const canNavigateNext = () => getCurrentFieldIndex() < allFields.length - 1;

  if (allFieldsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('header.title')}</h1>
            <p className="text-gray-600">{t('header.loading')}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="h-16 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (allFieldsError) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-600 mb-4">
            <BarChart3 className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('error.loadingTitle')}</h3>
          <p className="text-gray-600 mb-4">
            {allFieldsError.message || t('errors.loadingAnalytics')}
          </p>
          <Button onClick={refreshAll} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('error.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          {view === 'analytics' && (
            <Button
              onClick={handleBackToGrid}
              variant="ghost"
              size="sm"
              className="mb-4 text-gray-600 hover:text-gray-900 p-0 h-auto font-normal"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              All Fields
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 w-40">
            {view === 'grid' ? t('titles.fieldAnalytics') : t('titles.fieldInsights')}
          </h1>
          {view === 'grid' && (
            <p className="text-gray-600 mt-1">
              Analyze individual field performance across {totalResponses} form responses
            </p>
          )}
        </div>

        {/* Field Navigation - only show in analytics view */}
        {view === 'analytics' && allFields.length > 1 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrevField}
              variant="outline"
              size="sm"
              disabled={!canNavigatePrev()}
              title={t('navigation.previousField')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 px-2">
              {t('navigation.fieldOfTotal', { 
                values: { 
                  current: getCurrentFieldIndex() + 1, 
                  total: allFields.length 
                } 
              })}
            </span>
            <Button
              onClick={handleNextField}
              variant="outline"
              size="sm"
              disabled={!canNavigateNext()}
              title={t('navigation.nextField')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={allFieldsLoading || selectedFieldLoading || isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(allFieldsLoading || selectedFieldLoading || isRefreshing) ? 'animate-spin' : ''}`} />
            {t('buttons.refresh')}
          </Button>
          
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={handleInvalidateCache}
              variant="outline"
              size="sm"
              title={t('buttons.clearCacheTitle')}
            >
              {t('buttons.clearCache')}
            </Button>
          )}
          
          {totalResponses > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <Eye className="h-4 w-4" />
              {t('responseCount', { values: { count: totalResponses } })}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {view === 'grid' ? (
        <>
          {/* Overview Stats */}
          {allFields.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{allFields.length}</div>
                      <div className="text-sm text-gray-600">{t('overviewStats.analyzableFields')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {allFields.filter(f => f.responseRate >= 80).length}
                      </div>
                      <div className="text-sm text-gray-600">{t('overviewStats.highEngagement')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {Math.round(allFields.reduce((sum, f) => sum + f.responseRate, 0) / allFields.length) || 0}%
                      </div>
                      <div className="text-sm text-gray-600">{t('overviewStats.avgResponseRate')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                      <Eye className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{totalResponses}</div>
                      <div className="text-sm text-gray-600">{t('overviewStats.formResponses')}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Field Selection Grid */}
          <FieldSelectionGrid
            fields={allFields}
            selectedFieldId={selectedFieldIdFromUrl}
            onFieldSelect={handleFieldSelect}
            totalFormResponses={totalResponses}
            t={t}
          />
        </>
      ) : selectedField ? (
        <AnalyticsContent
          field={selectedField}
          totalFormResponses={totalResponses}
          loading={selectedFieldLoading}
          t={t}
        />
      ) : (
        <div className="text-center py-8 text-gray-500">
          Loading field analytics...
        </div>
      )}

      {/* Error handling for selected field */}
      {selectedFieldError && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-red-600 mb-4">
              <BarChart3 className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('error.loadingData')}</h3>
            <p className="text-gray-600 mb-4">
              {selectedFieldError.message || t('errors.loadingFieldAnalytics')}
            </p>
            <Button onClick={refreshAll} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('error.tryAgain')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};