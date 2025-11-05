import { useState, useEffect, useCallback } from 'react';
import { useQuery, gql } from '@apollo/client';
import { usePerformanceMonitor } from './usePerformanceMonitor';

// GraphQL queries for field analytics
const GET_FIELD_ANALYTICS = gql`
  query GetFieldAnalytics($formId: ID!, $fieldId: ID!) {
    fieldAnalytics(formId: $formId, fieldId: $fieldId) {
      fieldId
      fieldType
      fieldLabel
      totalResponses
      responseRate
      lastUpdated
      
      textAnalytics {
        averageLength
        minLength
        maxLength
        wordCloud {
          word
          count
          weight
        }
        lengthDistribution {
          range
          count
        }
        commonPhrases {
          phrase
          count
        }
        recentResponses {
          value
          submittedAt
          responseId
        }
      }
      
      numberAnalytics {
        min
        max
        average
        median
        standardDeviation
        distribution {
          range
          count
          percentage
        }
        trend {
          date
          average
          count
        }
        percentiles {
          p25
          p50
          p75
          p90
          p95
        }
      }
      
      selectionAnalytics {
        options {
          option
          count
          percentage
        }
        trend {
          date
          options {
            option
            count
          }
        }
        topOption
        responseDistribution
      }
      
      checkboxAnalytics {
        individualOptions {
          option
          count
          percentage
        }
        combinations {
          combination
          count
          percentage
        }
        averageSelections
        selectionDistribution {
          selectionCount
          responseCount
          percentage
        }
        correlations {
          option1
          option2
          correlation
        }
      }
      
      dateAnalytics {
        earliestDate
        latestDate
        mostCommonDate
        dateDistribution {
          date
          count
        }
        weekdayDistribution {
          weekday
          count
          percentage
        }
        monthlyDistribution {
          month
          count
          percentage
        }
        seasonalPatterns {
          season
          count
          percentage
        }
      }
      
      emailAnalytics {
        validEmails
        invalidEmails
        validationRate
        domains {
          domain
          count
          percentage
        }
        topLevelDomains {
          tld
          count
          percentage
        }
        corporateVsPersonal {
          corporate
          personal
          unknown
        }
        popularProviders {
          provider
          count
          percentage
        }
      }
    }
  }
`;

const GET_ALL_FIELDS_ANALYTICS = gql`
  query GetAllFieldsAnalytics($formId: ID!) {
    allFieldsAnalytics(formId: $formId) {
      formId
      totalResponses
      fields {
        fieldId
        fieldType
        fieldLabel
        totalResponses
        responseRate
        lastUpdated
        
        textAnalytics {
          averageLength
          minLength
          maxLength
          wordCloud {
            word
            count
            weight
          }
          lengthDistribution {
            range
            count
          }
          commonPhrases {
            phrase
            count
          }
          recentResponses {
            value
            submittedAt
            responseId
          }
        }
        
        numberAnalytics {
          min
          max
          average
          median
          standardDeviation
          distribution {
            range
            count
            percentage
          }
          trend {
            date
            average
            count
          }
          percentiles {
            p25
            p50
            p75
            p90
            p95
          }
        }
        
        selectionAnalytics {
          options {
            option
            count
            percentage
          }
          trend {
            date
            options {
              option
              count
            }
          }
          topOption
          responseDistribution
        }
        
        checkboxAnalytics {
          individualOptions {
            option
            count
            percentage
          }
          combinations {
            combination
            count
            percentage
          }
          averageSelections
          selectionDistribution {
            selectionCount
            responseCount
            percentage
          }
          correlations {
            option1
            option2
            correlation
          }
        }
        
        dateAnalytics {
          earliestDate
          latestDate
          mostCommonDate
          dateDistribution {
            date
            count
          }
          weekdayDistribution {
            weekday
            count
            percentage
          }
          monthlyDistribution {
            month
            count
            percentage
          }
          seasonalPatterns {
            season
            count
            percentage
          }
        }
        
        emailAnalytics {
          validEmails
          invalidEmails
          validationRate
          domains {
            domain
            count
            percentage
          }
          topLevelDomains {
            tld
            count
            percentage
          }
          corporateVsPersonal {
            corporate
            personal
            unknown
          }
          popularProviders {
            provider
            count
            percentage
          }
        }
      }
    }
  }
`;

// TypeScript types
export interface FieldAnalyticsData {
  fieldId: string;
  fieldType: string;
  fieldLabel: string;
  totalResponses: number;
  responseRate: number;
  lastUpdated: string;
  textAnalytics?: TextFieldAnalyticsData;
  numberAnalytics?: NumberFieldAnalyticsData;
  selectionAnalytics?: SelectionFieldAnalyticsData;
  checkboxAnalytics?: CheckboxFieldAnalyticsData;
  dateAnalytics?: DateFieldAnalyticsData;
  emailAnalytics?: EmailFieldAnalyticsData;
}

export interface TextFieldAnalyticsData {
  averageLength: number;
  minLength: number;
  maxLength: number;
  wordCloud: Array<{ word: string; count: number; weight: number }>;
  lengthDistribution: Array<{ range: string; count: number }>;
  commonPhrases: Array<{ phrase: string; count: number }>;
  recentResponses: Array<{ value: string; submittedAt: string; responseId: string }>;
}

export interface NumberFieldAnalyticsData {
  min: number;
  max: number;
  average: number;
  median: number;
  standardDeviation: number;
  distribution: Array<{ range: string; count: number; percentage: number }>;
  trend: Array<{ date: string; average: number; count: number }>;
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
}

export interface SelectionFieldAnalyticsData {
  options: Array<{ option: string; count: number; percentage: number }>;
  trend: Array<{ date: string; options: Array<{ option: string; count: number }> }>;
  topOption: string;
  responseDistribution: string;
}

export interface CheckboxFieldAnalyticsData {
  individualOptions: Array<{ option: string; count: number; percentage: number }>;
  combinations: Array<{ combination: string[]; count: number; percentage: number }>;
  averageSelections: number;
  selectionDistribution: Array<{ selectionCount: number; responseCount: number; percentage: number }>;
  correlations: Array<{ option1: string; option2: string; correlation: number }>;
}

export interface DateFieldAnalyticsData {
  earliestDate: string;
  latestDate: string;
  mostCommonDate: string;
  dateDistribution: Array<{ date: string; count: number }>;
  weekdayDistribution: Array<{ weekday: string; count: number; percentage: number }>;
  monthlyDistribution: Array<{ month: string; count: number; percentage: number }>;
  seasonalPatterns: Array<{ season: string; count: number; percentage: number }>;
}

export interface EmailFieldAnalyticsData {
  validEmails: number;
  invalidEmails: number;
  validationRate: number;
  domains: Array<{ domain: string; count: number; percentage: number }>;
  topLevelDomains: Array<{ tld: string; count: number; percentage: number }>;
  corporateVsPersonal: { corporate: number; personal: number; unknown: number };
  popularProviders: Array<{ provider: string; count: number; percentage: number }>;
}

export interface AllFieldsAnalyticsData {
  formId: string;
  totalResponses: number;
  fields: FieldAnalyticsData[];
}

// Hook for single field analytics
export const useFieldAnalytics = (formId: string, fieldId: string) => {
  const { data, loading, error, refetch } = useQuery(GET_FIELD_ANALYTICS, {
    variables: { formId, fieldId },
    skip: !formId || !fieldId,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first', // Enable Apollo Client caching
  });

  // Performance monitoring
  const { startDataFetch, endDataFetch, markLoadComplete } = usePerformanceMonitor({
    componentName: `FieldAnalytics-${fieldId}`,
    enableLogging: false, // Disable to reduce console spam
    trackDataFetching: true,
  });

  // Track data fetch performance
  useEffect(() => {
    if (loading) {
      startDataFetch();
    } else {
      endDataFetch();
      if (data) {
        markLoadComplete();
      }
    }
  }, [loading, data, startDataFetch, endDataFetch, markLoadComplete]);

  const refreshData = useCallback(() => {
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  return {
    data: data?.fieldAnalytics as FieldAnalyticsData | null,
    loading,
    error,
    refreshData,
  };
};

// Hook for all fields analytics
export const useAllFieldsAnalytics = (formId: string) => {
  const { data, loading, error, refetch } = useQuery(GET_ALL_FIELDS_ANALYTICS, {
    variables: { formId },
    skip: !formId,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first', // Enable Apollo Client caching
  });

  // Performance monitoring
  const { startDataFetch, endDataFetch, markLoadComplete } = usePerformanceMonitor({
    componentName: 'AllFieldsAnalytics',
    enableLogging: false, // Disable to reduce console spam
    trackDataFetching: true,
  });

  // Track data fetch performance
  useEffect(() => {
    if (loading) {
      startDataFetch();
    } else {
      endDataFetch();
      if (data) {
        markLoadComplete();
      }
    }
  }, [loading, data, startDataFetch, endDataFetch, markLoadComplete]);

  const refreshData = useCallback(() => {
    if (refetch) {
      refetch();
    }
  }, [refetch]);

  return {
    data: data?.allFieldsAnalytics as AllFieldsAnalyticsData | null,
    loading,
    error,
    refreshData,
  };
};

// Hook for managing field selection and analytics display
export const useFieldAnalyticsManager = (formId: string) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
  const allFieldsQuery = useAllFieldsAnalytics(formId);
  const fieldQuery = useFieldAnalytics(formId, selectedFieldId || '');

  const selectField = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFieldId(null);
  }, []);

  const availableFields = allFieldsQuery.data?.fields || [];
  const selectedField = fieldQuery.data;

  const refreshAll = useCallback(() => {
    allFieldsQuery.refreshData();
    if (selectedFieldId) {
      fieldQuery.refreshData();
    }
  }, [allFieldsQuery.refreshData, fieldQuery.refreshData, selectedFieldId]);

  return {
    // All fields data
    allFields: availableFields,
    allFieldsLoading: allFieldsQuery.loading,
    allFieldsError: allFieldsQuery.error,
    totalResponses: allFieldsQuery.data?.totalResponses || 0,
    
    // Selected field data
    selectedFieldId,
    selectedField,
    selectedFieldLoading: fieldQuery.loading,
    selectedFieldError: fieldQuery.error,
    
    // Actions
    selectField,
    clearSelection,
    refreshAll,
    
    // Loading states
    loading: allFieldsQuery.loading || (selectedFieldId ? fieldQuery.loading : false),
    error: allFieldsQuery.error || fieldQuery.error,
  };
};

