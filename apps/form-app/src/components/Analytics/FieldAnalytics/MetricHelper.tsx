import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { Button } from '@dculus/ui';
import { useTranslation } from '../../../hooks/useTranslation';

interface MetricHelperProps {
  title?: string;
  description?: string;
  compact?: boolean;
  translationKey?: string;
}

export const MetricHelper: React.FC<MetricHelperProps> = ({ 
  title = '', 
  description = '', 
  compact = false,
  translationKey
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation('metricHelper');
  
  // Use translation if key is provided, otherwise fall back to props
  const displayTitle = translationKey ? t(`${translationKey}.title`) : title;
  const displayDescription = translationKey ? t(`${translationKey}.description`) : description;

  if (compact) {
    return (
      <div className="relative inline-block">
        <Button
          variant="ghost"
          size="icon"
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-400 hover:text-gray-600 ml-1 h-auto w-auto p-0"
          aria-label={`Help: ${displayTitle}`}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>

        {isVisible && (
          <div className="absolute z-20 left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
            <div className="font-medium mb-1">{displayTitle}</div>
            <div className="text-gray-300">{displayDescription}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
      <div className="flex items-start">
        <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <h4 className="font-medium text-blue-900 mb-1">{displayTitle}</h4>
          <p className="text-sm text-blue-800 leading-relaxed">{displayDescription}</p>
        </div>
      </div>
    </div>
  );
};

// Predefined helper text for common metrics
// All strings are loaded from translations using translationKey
export const METRIC_HELPERS = {
  // Text Field Metrics
  WORD_CLOUD: {
    translationKey: "wordCloud"
  },
  AVERAGE_LENGTH: {
    translationKey: "averageLength"
  },
  LENGTH_DISTRIBUTION: {
    translationKey: "lengthDistribution"
  },
  COMMON_PHRASES: {
    translationKey: "commonPhrases"
  },

  // Number Field Metrics
  STATISTICAL_SUMMARY: {
    translationKey: "statisticalSummary"
  },
  VALUE_DISTRIBUTION: {
    translationKey: "valueDistribution"
  },
  PERCENTILES: {
    translationKey: "percentiles"
  },
  TREND_ANALYSIS: {
    translationKey: "trendAnalysis"
  },

  // Selection Field Metrics
  OPTION_POPULARITY: {
    translationKey: "optionPopularity"
  },
  RESPONSE_DISTRIBUTION: {
    translationKey: "responseDistribution"
  },
  SELECTION_TRENDS: {
    translationKey: "selectionTrends"
  },

  // Checkbox Field Metrics  
  INDIVIDUAL_OPTIONS: {
    translationKey: "individualOptions"
  },
  COMBINATION_ANALYSIS: {
    translationKey: "combinationAnalysis"
  },
  SELECTION_PATTERNS: {
    translationKey: "selectionPatterns"
  },
  CORRELATIONS: {
    translationKey: "correlations"
  },

  // Date Field Metrics
  DATE_DISTRIBUTION: {
    translationKey: "dateDistribution"
  },
  WEEKDAY_PATTERNS: {
    translationKey: "weekdayPatterns"
  },
  SEASONAL_ANALYSIS: {
    translationKey: "seasonalAnalysis"
  },
  MONTHLY_TRENDS: {
    translationKey: "monthlyTrends"
  },

  // Email Field Metrics
  VALIDATION_RATE: {
    translationKey: "validationRate"
  },
  DOMAIN_ANALYSIS: {
    translationKey: "domainAnalysis"
  },
  PROVIDER_BREAKDOWN: {
    translationKey: "providerBreakdown"
  },
  CORPORATE_VS_PERSONAL: {
    translationKey: "corporateVsPersonal"
  },

  // General Metrics
  RESPONSE_RATE: {
    translationKey: "responseRate"
  },
  TOTAL_RESPONSES: {
    translationKey: "totalResponses"
  }
};