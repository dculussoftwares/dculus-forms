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
const getFieldTypeDisplayName = (fieldType: string) => {
  switch (fieldType) {
    case 'text_input_field': return 'Text Input';
    case 'text_area_field': return 'Text Area';
    case 'number_field': return 'Number';
    case 'email_field': return 'Email';
    case 'date_field': return 'Date';
    case 'select_field': return 'Select Dropdown';
    case 'radio_field': return 'Radio Buttons';
    case 'checkbox_field': return 'Checkboxes';
    default: return 'Unknown Field';
  }
};

// Field Selection Grid
const FieldSelectionGrid: React.FC<{
  fields: FieldAnalyticsData[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  totalFormResponses: number;
}> = ({ fields, selectedFieldId, onFieldSelect, totalFormResponses: _totalFormResponses }) => {
  if (fields.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Fields Available</h3>
          <p className="text-gray-600">
            This form doesn't have any fields that support analytics, or no responses have been submitted yet.
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getFieldTypeIcon(field.fieldType)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {field.fieldLabel || `Field ${field.fieldId}`}
                    </div>
                    <div className="text-xs text-gray-500">
                      {getFieldTypeDisplayName(field.fieldType)}
                    </div>
                  </div>
                </div>
                
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  getResponseRateColor(field.responseRate)
                }`}>
                  {field.responseRate.toFixed(0)}%
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <Users className="h-3 w-3" />
                    <span>Responses</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    {field.totalResponses}
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>Rate</span>
                  </div>
                  <div className="font-semibold text-gray-900">
                    {field.responseRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Last updated: {new Date(field.lastUpdated).toLocaleDateString()}
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
}> = ({ field, totalFormResponses, loading }) => {
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
            <p>Analytics not supported for this field type</p>
            <p className="text-sm mt-2">Field type: {field.fieldType}</p>
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
              {getFieldTypeDisplayName(field.fieldType)} • {field.totalResponses} responses • {field.responseRate.toFixed(1)}% response rate
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
            <h1 className="text-2xl font-bold text-gray-900">Field Analytics</h1>
            <p className="text-gray-600">Loading field data...</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Field Analytics</h3>
          <p className="text-gray-600 mb-4">
            {allFieldsError.message || 'There was an error loading the field analytics data.'}
          </p>
          <Button onClick={refreshAll} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
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
            {view === 'grid' ? 'Field Analytics' : 'Field Insights'}
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
              title="Previous field"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 px-2">
              {getCurrentFieldIndex() + 1} of {allFields.length}
            </span>
            <Button
              onClick={handleNextField}
              variant="outline"
              size="sm"
              disabled={!canNavigateNext()}
              title="Next field"
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
            Refresh
          </Button>
          
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={handleInvalidateCache}
              variant="outline"
              size="sm"
              title="Clear cache and refresh data"
            >
              Clear Cache
            </Button>
          )}
          
          {totalResponses > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <Eye className="h-4 w-4" />
              {totalResponses} responses
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
                      <div className="text-sm text-gray-600">Analyzable Fields</div>
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
                      <div className="text-sm text-gray-600">High Engagement</div>
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
                      <div className="text-sm text-gray-600">Avg Response Rate</div>
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
                      <div className="text-sm text-gray-600">Form Responses</div>
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
          />
        </>
      ) : selectedField ? (
        <AnalyticsContent
          field={selectedField}
          totalFormResponses={totalResponses}
          loading={selectedFieldLoading}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Field Data</h3>
            <p className="text-gray-600 mb-4">
              {selectedFieldError.message || 'There was an error loading this field\'s analytics.'}
            </p>
            <Button onClick={refreshAll} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};