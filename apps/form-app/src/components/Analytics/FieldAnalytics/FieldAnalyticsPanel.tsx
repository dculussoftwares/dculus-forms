/**
 * Field Analytics Panel Component
 *
 * Displays detailed analytics for a selected field.
 * Routes to appropriate field-specific analytics components based on field type.
 */

import React from 'react';
import {
  BarChart3,
  FileText,
  Hash,
  Mail,
  Calendar,
  ListOrdered,
  CheckSquare,
  CircleDot
} from 'lucide-react';
import { getFieldTypeDisplayName } from '@dculus/utils';
import { FieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { TextFieldAnalytics } from './TextFieldAnalytics';
import { NumberFieldAnalytics } from './NumberFieldAnalytics';
import { SelectionFieldAnalytics } from './SelectionFieldAnalytics';
import { CheckboxFieldAnalytics } from './CheckboxFieldAnalytics';
import { DateFieldAnalytics } from './DateFieldAnalytics';
import { EmailFieldAnalytics } from './EmailFieldAnalytics';

// Field Type Icons
const getFieldTypeIcon = (fieldType: string) => {
  switch (fieldType) {
    case 'text_input_field':
    case 'text_area_field':
      return <FileText className="h-6 w-6" />;
    case 'number_field':
      return <Hash className="h-6 w-6" />;
    case 'email_field':
      return <Mail className="h-6 w-6" />;
    case 'date_field':
      return <Calendar className="h-6 w-6" />;
    case 'select_field':
      return <ListOrdered className="h-6 w-6" />;
    case 'radio_field':
      return <CircleDot className="h-6 w-6" />;
    case 'checkbox_field':
      return <CheckSquare className="h-6 w-6" />;
    default:
      return <BarChart3 className="h-6 w-6" />;
  }
};

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
   * Render field-specific analytics component based on field type
   */
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
            {t('noDataMessages.textAnalytics')}
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
            {t('noDataMessages.numberAnalytics')}
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
            {t('noDataMessages.selectionAnalytics')}
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
            {t('noDataMessages.checkboxAnalytics')}
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
            {t('noDataMessages.dateAnalytics')}
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
            {t('noDataMessages.emailAnalytics')}
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
