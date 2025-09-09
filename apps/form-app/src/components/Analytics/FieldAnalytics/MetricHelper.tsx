import React, { useState } from 'react';
import { HelpCircle, Info } from 'lucide-react';

interface MetricHelperProps {
  title: string;
  description: string;
  compact?: boolean;
}

export const MetricHelper: React.FC<MetricHelperProps> = ({ 
  title, 
  description, 
  compact = false 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
          onClick={() => setIsVisible(!isVisible)}
          className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
          aria-label={`Help: ${title}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
        
        {isVisible && (
          <div className="absolute z-20 left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-72 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
            <div className="font-medium mb-1">{title}</div>
            <div className="text-gray-300">{description}</div>
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
          <h4 className="font-medium text-blue-900 mb-1">{title}</h4>
          <p className="text-sm text-blue-800 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
};

// Predefined helper text for common metrics
export const METRIC_HELPERS = {
  // Text Field Metrics
  WORD_CLOUD: {
    title: "Word Cloud",
    description: "Visual representation showing the most frequently used words in responses. Larger words appear more often in user submissions."
  },
  AVERAGE_LENGTH: {
    title: "Average Length",
    description: "The typical number of characters users enter for this field. Helps understand how detailed responses usually are."
  },
  LENGTH_DISTRIBUTION: {
    title: "Length Distribution", 
    description: "Shows how response lengths are distributed across different character count ranges. Useful for spotting patterns in user behavior."
  },
  COMMON_PHRASES: {
    title: "Common Phrases",
    description: "Most frequently occurring 2-3 word combinations in responses. Helps identify recurring themes or popular expressions."
  },

  // Number Field Metrics
  STATISTICAL_SUMMARY: {
    title: "Statistical Summary",
    description: "Key statistics including minimum, maximum, average, and median values. Provides a quick overview of number distribution."
  },
  VALUE_DISTRIBUTION: {
    title: "Value Distribution",
    description: "Shows how numeric responses are spread across different value ranges. Helps identify clustering, outliers, and data patterns."
  },
  PERCENTILES: {
    title: "Percentiles",
    description: "Shows values at key percentage points (25th, 50th, 75th, etc.). The 50th percentile is the median - half of responses are above/below this value."
  },
  TREND_ANALYSIS: {
    title: "Trend Analysis",
    description: "How average values change over time. Useful for spotting trends, seasonal patterns, or changes in user behavior."
  },

  // Selection Field Metrics
  OPTION_POPULARITY: {
    title: "Option Popularity",
    description: "Shows how often each option was selected. Helps identify most and least popular choices to optimize form options."
  },
  RESPONSE_DISTRIBUTION: {
    title: "Response Distribution Type",
    description: "Categorizes selection patterns: 'Even' (balanced choices), 'Concentrated' (one dominant option), or 'Polarized' (few clear favorites)."
  },
  SELECTION_TRENDS: {
    title: "Selection Trends",
    description: "How option popularity changes over time. Useful for understanding evolving preferences or seasonal variations."
  },

  // Checkbox Field Metrics  
  INDIVIDUAL_OPTIONS: {
    title: "Individual Option Analysis",
    description: "Shows selection frequency for each checkbox option. Helps identify which features or choices are most/least popular."
  },
  COMBINATION_ANALYSIS: {
    title: "Combination Analysis", 
    description: "Shows which combinations of options users select together most frequently. Reveals common usage patterns."
  },
  SELECTION_PATTERNS: {
    title: "Selection Patterns",
    description: "Distribution of how many options users typically select (1 option, 2 options, etc.). Shows user engagement levels."
  },
  CORRELATIONS: {
    title: "Option Correlations",
    description: "Shows which options are frequently selected together. Values above 1.2 indicate strong relationships between choices."
  },

  // Date Field Metrics
  DATE_DISTRIBUTION: {
    title: "Date Distribution",
    description: "Shows when users submitted responses across different dates. Helps identify peak submission times and patterns."
  },
  WEEKDAY_PATTERNS: {
    title: "Weekday Patterns", 
    description: "Distribution of responses by day of the week. Useful for understanding user behavior and optimal timing."
  },
  SEASONAL_ANALYSIS: {
    title: "Seasonal Analysis",
    description: "Response patterns across seasons (Spring, Summer, Fall, Winter). Helps identify seasonal trends in user engagement."
  },
  MONTHLY_TRENDS: {
    title: "Monthly Trends",
    description: "Shows response distribution across different months. Useful for identifying seasonal patterns and peak periods."
  },

  // Email Field Metrics
  VALIDATION_RATE: {
    title: "Email Validation Rate",
    description: "Percentage of entries that follow proper email format (user@domain.com). High rates indicate good data quality."
  },
  DOMAIN_ANALYSIS: {
    title: "Domain Analysis",
    description: "Shows which email domains (gmail.com, company.com, etc.) are most common. Helps understand your audience composition."
  },
  PROVIDER_BREAKDOWN: {
    title: "Email Provider Breakdown",
    description: "Distribution across popular email providers (Gmail, Yahoo, Outlook). Provides insights into user preferences and demographics."
  },
  CORPORATE_VS_PERSONAL: {
    title: "Corporate vs Personal",
    description: "Ratio of business emails vs personal email providers. Helps understand whether responses come from work or personal contexts."
  },

  // General Metrics
  RESPONSE_RATE: {
    title: "Response Rate",
    description: "Percentage of form submissions that included a response for this field. Shows how often users complete this specific field."
  },
  TOTAL_RESPONSES: {
    title: "Total Responses",
    description: "Number of users who provided a response for this field. Does not include empty or skipped responses."
  }
};