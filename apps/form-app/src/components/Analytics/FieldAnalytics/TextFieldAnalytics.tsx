import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, Histogram, CHART_COLORS } from './BaseChartComponents';
import { TextFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { FileText, Hash, Type, MessageSquare } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../../../hooks/useTranslation';

interface TextFieldAnalyticsProps {
  data: TextFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Simple Word Cloud Component (using CSS for visual effect)
const SimpleWordCloud: React.FC<{ 
  words: Array<{ word: string; count: number; weight: number }>;
  loading?: boolean;
  t: (key: string) => string;
}> = ({ words, loading, t }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('wordCloud.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!words || words.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('wordCloud.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            {t('wordCloud.noData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxWeight = Math.max(...words.map(w => w.weight));
  const minWeight = Math.min(...words.map(w => w.weight));

  const getFontSize = (weight: number) => {
    const normalized = (weight - minWeight) / (maxWeight - minWeight);
    return Math.max(12, Math.min(48, 12 + normalized * 36));
  };

  const getOpacity = (weight: number) => {
    const normalized = (weight - minWeight) / (maxWeight - minWeight);
    return Math.max(0.4, 0.4 + normalized * 0.6);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('wordCloud.mostCommon')}</CardTitle>
          <MetricHelper {...METRIC_HELPERS.WORD_CLOUD} compact />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 flex flex-wrap items-center justify-center gap-2 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg overflow-hidden">
          {words.slice(0, 30).map((word, index) => (
            <span
              key={word.word}
              className="inline-block cursor-default transition-all duration-200 hover:scale-110"
              style={{
                fontSize: `${getFontSize(word.weight)}px`,
                color: CHART_COLORS.primary[index % CHART_COLORS.primary.length],
                opacity: getOpacity(word.weight),
                fontWeight: word.weight > 0.7 ? 'bold' : word.weight > 0.4 ? '600' : 'normal',
              }}
              title={`"${word.word}" appears ${word.count} times`}
            >
              {word.word}
            </span>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-600 text-center">
          Hover over words to see frequency • Showing top {Math.min(30, words.length)} words
        </div>
      </CardContent>
    </Card>
  );
};

// Recent Responses Component
const RecentResponses: React.FC<{
  responses: Array<{ value: string; submittedAt: string; responseId: string }>;
  fieldLabel: string;
  loading?: boolean;
}> = ({ responses, fieldLabel: _fieldLabel, loading }) => {
  const { t, locale } = useTranslation('textFieldAnalytics');
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('recentResponses.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!responses || responses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('recentResponses.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            {t('recentResponses.noData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Responses ({responses.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {responses.map((response, index) => (
            <div 
              key={response.responseId} 
              className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-500">
                  #{index + 1} • {formatDate(response.submittedAt)}
                </span>
                <div className="text-xs text-gray-400">
                  {response.value.length} chars
                </div>
              </div>
              <p className="text-sm text-gray-800 break-words">
                {response.value.length > 200 
                  ? `${response.value.substring(0, 200)}...` 
                  : response.value
                }
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Common Phrases Component
const CommonPhrases: React.FC<{ 
  phrases: Array<{ phrase: string; count: number }>;
  loading?: boolean;
}> = ({ phrases, loading }) => {
  const { t } = useTranslation('textFieldAnalytics');
  
  if (loading || !phrases || phrases.length === 0) {
    return null;
  }

  const chartData = phrases.slice(0, 10).map(phrase => ({
    name: phrase.phrase.length > 25 ? `${phrase.phrase.substring(0, 25)}...` : phrase.phrase,
    value: phrase.count,
    fullPhrase: phrase.phrase
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('commonPhrases.title')}</CardTitle>
          <MetricHelper {...METRIC_HELPERS.COMMON_PHRASES} compact />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div 
              key={item.fullPhrase}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              title={item.fullPhrase}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div 
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CHART_COLORS.primary[index % CHART_COLORS.primary.length] }}
                />
                <span className="text-sm text-gray-800 truncate">
                  "{item.fullPhrase}"
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-medium text-gray-900">
                  {item.value}
                </span>
                <span className="text-xs text-gray-500">uses</span>
              </div>
            </div>
          ))}
        </div>
        {phrases.length > 10 && (
          <div className="mt-4 text-center text-sm text-gray-500">
            Showing top 10 of {phrases.length} common phrases
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const TextFieldAnalytics: React.FC<TextFieldAnalyticsProps> = ({
  data,
  fieldLabel,
  totalResponses,
  loading
}) => {
  const { t } = useTranslation('textFieldAnalytics');
  
  const lengthChartData = useMemo(() => {
    if (!data?.lengthDistribution) return [];
    return data.lengthDistribution.map(item => ({
      range: item.range,
      count: item.count
    }));
  }, [data?.lengthDistribution]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCard 
              key={i}
              title="Loading..." 
              value="--" 
              loading={true} 
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SimpleWordCloud words={[]} loading={true} t={t} />
          <Histogram data={[]} title={t('responseLength.title')} loading={true} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">{t('emptyState.title')}</p>
          <p className="text-sm">{t('emptyState.subtitle')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.averageLength')}
          value={`${Math.round(data.averageLength)} ${t('stats.chars')}`}
          subtitle={t('stats.averageLengthSubtitle')}
          icon={<Type className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.shortestResponse')}
          value={`${data.minLength} ${t('stats.chars')}`}
          subtitle={t('stats.minLength')}
          icon={<Hash className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.longestResponse')}
          value={`${data.maxLength} ${t('stats.chars')}`}
          subtitle={t('stats.maxLength')}
          icon={<Hash className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.totalWords')}
          value={data.wordCloud.reduce((sum, word) => sum + word.count, 0)}
          subtitle={t('stats.uniqueWords')}
          icon={<MessageSquare className="h-5 w-5" />}
        />
      </div>

      {/* Main Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleWordCloud 
          words={data.wordCloud}
          t={t}
        />
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('responseLength.title')}</CardTitle>
              <MetricHelper {...METRIC_HELPERS.LENGTH_DISTRIBUTION} compact />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={lengthChartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLORS.primary[1]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CommonPhrases phrases={data.commonPhrases} />
        <RecentResponses responses={data.recentResponses} fieldLabel={fieldLabel} />
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('summary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Response Rate:</span>
              <span className="font-medium">
                {totalResponses > 0 ? 
                  `${((data.recentResponses.length / totalResponses) * 100).toFixed(1)}%` : 
                  '0%'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Unique Words:</span>
              <span className="font-medium">{data.wordCloud.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Common Phrases:</span>
              <span className="font-medium">{data.commonPhrases.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};