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

export const FIELD_ICON_THEME: Record<string, { bg: string; color: string }> = {
  text_input_field:  { bg: '#e6f7f4', color: '#0E8C70' },
  text_area_field:   { bg: '#e6f7f4', color: '#0E8C70' },
  number_field:      { bg: '#fef3e2', color: '#D97706' },
  select_field:      { bg: '#f0ebff', color: '#7C3AAE' },
  radio_field:       { bg: '#f0ebff', color: '#7C3AAE' },
  checkbox_field:    { bg: '#e8f0fe', color: '#2563EB' },
  date_field:        { bg: '#fdecea', color: '#E85D4A' },
  email_field:       { bg: '#e8f0fe', color: '#2563EB' },
  file_upload_field: { bg: '#e6f7f4', color: '#0E8C70' },
};

export const DEFAULT_ICON_THEME = { bg: '#e8f0fe', color: '#2563EB' };

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
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
        <div className="text-center py-8 text-muted-foreground">
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
      <div className="mb-6 pb-4 border-b border-[var(--tf-border-medium)]">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="p-2 rounded-xl flex-shrink-0"
            style={{ backgroundColor: (FIELD_ICON_THEME[field.fieldType] ?? DEFAULT_ICON_THEME).bg }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: (FIELD_ICON_THEME[field.fieldType] ?? DEFAULT_ICON_THEME).color }}
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">
              {field.fieldLabel || `${t('fieldHeader.fieldPrefix')} ${field.fieldId}`}
            </h2>
            <p className="text-sm text-foreground">
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
