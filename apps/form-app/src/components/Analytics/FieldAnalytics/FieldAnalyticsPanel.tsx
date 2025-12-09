/**
 * Field Analytics Panel Component
 *
 * Displays detailed analytics for a selected field.
 * Uses the analytics registry to dynamically render the appropriate component.
 */

import React from 'react';
import { BarChart3 } from 'lucide-react';
import { getFieldTypeDisplayName } from '@dculus/utils';
import { FieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { getAnalyticsComponent, getAnalyticsDataKey, getAnalyticsIcon } from './registry';

interface FieldAnalyticsPanelProps {
  field: FieldAnalyticsData;
  totalFormResponses: number;
  loading: boolean;
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}

export const FieldAnalyticsPanel: React.FC<FieldAnalyticsPanelProps> = ({
  field,
  totalFormResponses,
  loading,
  t
}) => {
  /**
   * Render field-specific analytics component using registry
   */
  const renderAnalytics = () => {
    // Get component and data key from registry
    const Component = getAnalyticsComponent(field.fieldType as any);
    const dataKey = getAnalyticsDataKey(field.fieldType as any);

    // Check if field type is supported
    if (!Component || !dataKey) {
      return (
        <div className="text-center py-8 text-gray-500">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{t('detailView.notSupported')}</p>
          <p className="text-sm mt-2">{t('detailView.fieldType')}: {field.fieldType}</p>
        </div>
      );
    }

    // Get analytics data for this field type
    const data = field[dataKey];

    // Check if data is available
    if (!data) {
      return (
        <div className="text-center py-8 text-gray-500">
          {t(`noDataMessages.${dataKey}`)}
        </div>
      );
    }

    // Render the analytics component with appropriate props
    // Handle special case for selection field type
    const props: any = {
      data,
      fieldLabel: field.fieldLabel,
      totalResponses: totalFormResponses,
      loading,
    };

    // Add fieldType for selection analytics (select vs radio)
    if (field.fieldType === 'select_field' || field.fieldType === 'radio_field') {
      props.fieldType = field.fieldType === 'select_field' ? 'select' : 'radio';
    }

    return <Component {...props} />;
  };

  // Get icon for field type from registry
  const Icon = getAnalyticsIcon(field.fieldType as any);

  return (
    <div className="w-full">
      {/* Field Header */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {field.fieldLabel || `${t('fieldHeader.fieldPrefix')} ${field.fieldId}`}
            </h2>
            <p className="text-sm text-gray-600">
              {getFieldTypeDisplayName(field.fieldType, (key: string) => t(key))} • {t('fieldHeader.responsesCount', { values: { count: field.totalResponses } })} • {t('fieldHeader.responseRateText', { values: { rate: field.responseRate.toFixed(1) } })}
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Content */}
      {renderAnalytics()}
    </div>
  );
};
