/**
 * Field Selection Grid Component
 *
 * Displays a grid of field cards for analytics selection.
 * Shows field preview charts, response rates, and metadata.
 */

import React from 'react';
import { Card, CardContent, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@dculus/ui';
import {
  BarChart3,
  Users,
  Eye,
} from 'lucide-react';
import { FieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { MiniPreviewChart } from './MiniChartComponents';
import { getFieldTypeDisplayName } from '@dculus/utils';
import { getAnalyticsIcon } from './registry';

interface FieldSelectionGridProps {
  fields: FieldAnalyticsData[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  totalFormResponses: number;
  t: (key: string, options?: { values?: Record<string, string | number>; defaultValue?: string }) => string;
}

export const FieldSelectionGrid: React.FC<FieldSelectionGridProps> = ({
  fields,
  selectedFieldId,
  onFieldSelect,
  totalFormResponses: _totalFormResponses,
  t
}) => {
  // Empty state
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

  // Helper to get response rate color
  const getResponseRateColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 bg-green-100';
    if (rate >= 60) return 'text-yellow-600 bg-yellow-100';
    if (rate >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {fields.map((field) => {
        const isSelected = selectedFieldId === field.fieldId;

        return (
          <Card
            key={field.fieldId}
            className={`cursor-pointer transition-all hover:shadow-lg overflow-hidden ${
              isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:ring-1 hover:ring-gray-300'
            }`}
            onClick={() => onFieldSelect(field.fieldId)}
          >
            <CardContent className="p-0">
              {/* Field Header */}
              <div className="p-5 border-b bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`p-2.5 rounded-lg flex-shrink-0 ${
                      isSelected ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {React.createElement(getAnalyticsIcon(field.fieldType as any), { className: 'h-5 w-5' })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="font-semibold text-gray-900 text-base truncate cursor-help">
                              {field.fieldLabel || `${t('fieldHeader.fieldPrefix')} ${field.fieldId}`}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-sm">{field.fieldLabel || `${t('fieldHeader.fieldPrefix')} ${field.fieldId}`}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {getFieldTypeDisplayName(field.fieldType, (key: string) => t(key))}
                      </div>
                    </div>
                  </div>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 cursor-help ${
                          getResponseRateColor(field.responseRate)
                        }`}>
                          {field.responseRate.toFixed(0)}%
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm font-semibold mb-1">{t('tooltips.responseRate.title')}</p>
                        <p className="text-xs opacity-90">
                          {t('tooltips.responseRate.description')}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              {/* Chart Preview */}
              <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 p-4">
                <div className="h-48 flex items-center justify-center bg-white rounded-xl shadow-sm">
                  <MiniPreviewChart field={field} />
                </div>
              </div>

              {/* Stats Footer */}
              <div className="p-4 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Users className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600">{t('fieldList.responses')}</div>
                      <div className="font-bold text-sm text-gray-900">{field.totalResponses}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg">
                    <Eye className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-600">{t('fieldList.lastUpdated')}</div>
                      <div className="font-medium text-xs text-gray-900 truncate">
                        {new Date(field.lastUpdated).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>
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
