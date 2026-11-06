import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import {
  StatCard,
  EnhancedBarChart,
  CHART_COLORS,
  FieldAnalyticsLoader,
  FieldAnalyticsEmpty,
} from './BaseChartComponents';
import { RatingFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { Star, Users, Gauge } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface RatingFieldAnalyticsProps {
  data: RatingFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Detractors / passives / promoters. Each segment is also labelled in text, so the
// colors are never the only way to tell them apart.
const NPS_SEGMENTS = [
  { key: 'detractors', color: '#E85D4A' },
  { key: 'passives', color: '#a09aa2' },
  { key: 'promoters', color: CHART_COLORS.primary[1] },
] as const;

const NpsBreakdown: React.FC<{
  nps: NonNullable<RatingFieldAnalyticsData['nps']>;
}> = ({ nps }) => {
  const { t } = useTranslation('ratingFieldAnalytics');

  const rows = NPS_SEGMENTS.map((segment) => ({
    ...segment,
    count: nps[segment.key],
    percentage:
      segment.key === 'detractors'
        ? nps.detractorPercentage
        : segment.key === 'passives'
          ? nps.passivePercentage
          : nps.promoterPercentage,
  }));

  return (
    <Card data-testid="rating-nps-breakdown">
      <CardHeader>
        <CardTitle>{t('nps.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
          role="img"
          aria-label={t('nps.barLabel', {
            values: {
              detractors: nps.detractorPercentage,
              passives: nps.passivePercentage,
              promoters: nps.promoterPercentage,
            },
          })}
        >
          {rows
            .filter((row) => row.count > 0)
            .map((row) => (
              <div
                key={row.key}
                className="h-full"
                style={{ width: `${row.percentage}%`, backgroundColor: row.color }}
              />
            ))}
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 rounded-lg bg-background p-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-primary">{t(`nps.${row.key}`)}</div>
                <div className="text-xs text-muted-foreground">{t(`nps.${row.key}Range`)}</div>
                <div className="text-sm text-foreground">
                  {t('nps.countAndPercentage', {
                    values: { count: row.count, percentage: row.percentage.toFixed(1) },
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export const RatingFieldAnalytics: React.FC<RatingFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  totalResponses,
  loading,
}) => {
  const { t } = useTranslation('ratingFieldAnalytics');

  const chartData = useMemo(
    () =>
      (data?.distribution ?? []).map((entry) => ({
        name: String(entry.value),
        value: entry.count,
        percentage: entry.percentage,
      })),
    [data?.distribution]
  );

  if (loading) return <FieldAnalyticsLoader />;

  const answered = data?.distribution?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
  if (!data || answered === 0) {
    return (
      <FieldAnalyticsEmpty
        icon={<Star className="h-8 w-8 text-[#D97706]" />}
        title={t('emptyState.title')}
        subtitle={t('emptyState.subtitle')}
      />
    );
  }

  const scale = `${data.minValue}-${data.maxValue}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t('stats.responses')}
          value={answered}
          subtitle={t('stats.ofFormResponses', { values: { count: totalResponses } })}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.average')}
          value={data.average.toFixed(2)}
          subtitle={t('stats.onScale', { values: { scale } })}
          icon={<Star className="h-5 w-5" />}
        />
        {data.isNps && data.nps && (
          <StatCard
            title={t('stats.npsScore')}
            value={Math.round(data.nps.score)}
            subtitle={t('stats.npsRange')}
            icon={<Gauge className="h-5 w-5" />}
          />
        )}
      </div>

      <EnhancedBarChart
        data={chartData}
        title={t('distribution.title')}
        height={300}
        colorPalette={[CHART_COLORS.primary[2]]}
        xAxisLabel={t('distribution.xAxis')}
        yAxisLabel={t('distribution.yAxis')}
      />

      {data.isNps && data.nps && <NpsBreakdown nps={data.nps} />}
    </div>
  );
};
