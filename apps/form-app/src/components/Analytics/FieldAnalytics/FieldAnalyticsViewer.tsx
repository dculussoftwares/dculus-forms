/**
 * Field Analytics Viewer Component
 *
 * Main orchestrator for field analytics functionality.
 * Manages view state, URL parameters, and coordinates between grid and detail views.
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, Button } from '@dculus/ui';
import { useFieldAnalyticsManager } from '@/hooks/useFieldAnalytics.ts';
import { usePerformanceMonitor, useMemoryTracker } from '@/hooks/usePerformanceMonitor.ts';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  RefreshCw,
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { FieldSelectionGrid } from './FieldSelectionGrid';
import { FieldAnalyticsPanel } from './FieldAnalyticsPanel';

interface FieldAnalyticsViewerProps {
  formId: string;
  initialSelectedFieldId?: string | null;
}

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

  // Performance monitoring (only in development and limited logging)
  const { markLoadComplete } = usePerformanceMonitor({
    componentName: 'FieldAnalyticsViewer',
    enableLogging: false, // Disable verbose logging
  });

  useMemoryTracker('FieldAnalyticsViewer');

  // Mark load complete when data is ready
  useEffect(() => {
    if (!loading && allFields.length > 0) {
      markLoadComplete();
    }
  }, [loading, allFields.length, markLoadComplete]);

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
    <div className="w-full space-y-6">
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
              {t('navigation.allFields')}
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 w-40">
            {view === 'grid' ? t('titles.fieldAnalytics') : t('titles.fieldInsights')}
          </h1>
          {view === 'grid' && (
            <p className="text-gray-600 mt-1">
              {t('description.analyzePerformance', { values: { count: totalResponses } })}
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
        <FieldAnalyticsPanel
          field={selectedField}
          totalFormResponses={totalResponses}
          loading={selectedFieldLoading}
          t={t}
        />
      ) : (
        <div className="text-center py-8 text-gray-500">
          {t('loading.fieldAnalytics')}
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
