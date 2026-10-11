import React, { useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
  FileCheck,
  Files,
  HardDrive,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  CHART_COLORS,
  EnhancedLineChart,
  EnhancedPieChart,
  FieldAnalyticsEmpty,
  FieldAnalyticsLoader,
  Histogram,
  StatCard,
} from './BaseChartComponents';
import type { FileUploadFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { useResponseFileUrl } from '../../../hooks/useResponseFileUrl';
import { useTranslation } from '../../../hooks/useTranslation';
import { formatBytes, isPreviewable, responseLabel } from '../../../utils/responseFiles';
import type { ResponseFile } from '../../../graphql/responseFiles';
import { FileKindIcon } from '../../Responses/files/FileKindIcon';
import { ResponseFilePreviewDialog } from '../../Responses/files/ResponseFilePreviewDialog';

const MB = 1024 * 1024;
const TREND_METRICS = ['files', 'storage'] as const;
type TrendMetric = (typeof TREND_METRICS)[number];

interface FileUploadFieldAnalyticsProps {
  data: FileUploadFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

const RecentUploads: React.FC<{
  files: FileUploadFieldAnalyticsData['recentFiles'];
  fieldLabel: string;
}> = ({ files, fieldLabel }) => {
  const { t, locale } = useTranslation('fileUploadFieldAnalytics');
  const { t: tFiles } = useTranslation('responseFiles');
  const { download, pendingKey } = useResponseFileUrl();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const previewableFiles: ResponseFile[] = useMemo(
    () =>
      files
        .filter((file) => isPreviewable(file.mimeType))
        .map((file) => ({ ...file, respondentEmail: null, fieldId: '', fieldLabel })),
    [files, fieldLabel]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recent.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('recent.description')}</p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-[var(--tf-border-medium)]">
          {files.map((file) => {
            const previewPosition = previewableFiles.findIndex((candidate) => candidate.key === file.key);
            return (
              <li key={file.key} className="flex items-center gap-3 py-3">
                <FileKindIcon name={file.originalName} mimeType={file.mimeType} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary truncate" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[
                      formatBytes(file.size, locale),
                      new Date(file.submittedAt).toLocaleDateString(locale),
                      responseLabel(file.responseId, file.submittedAt),
                    ].join(' · ')}
                  </p>
                </div>
                {previewPosition >= 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewIndex(previewPosition)}
                    aria-label={`${tFiles('actions.preview')}: ${file.originalName}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingKey === file.key}
                  onClick={() => void download(file.key)}
                  aria-label={`${tFiles('actions.download')}: ${file.originalName}`}
                >
                  {pendingKey === file.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <ResponseFilePreviewDialog files={previewableFiles} index={previewIndex} onIndexChange={setPreviewIndex} />
    </Card>
  );
};

const UploadLimits: React.FC<{ limits: FileUploadFieldAnalyticsData['limits'] }> = ({ limits }) => {
  const { t } = useTranslation('fileUploadFieldAnalytics');

  const hasLimits = !!limits.maxFileSizeMb || !!limits.maxFiles || limits.allowedMimeTypes.length > 0;
  if (!hasLimits) return null;

  const insights: string[] = [];
  if (limits.filesNearSizeLimit > 0) {
    insights.push(
      t('limits.insights.nearSize', { values: { count: limits.filesNearSizeLimit, max: limits.maxFileSizeMb ?? 0 } })
    );
  }
  if (limits.responsesAtFileLimit > 0) {
    insights.push(
      t('limits.insights.atFileLimit', { values: { count: limits.responsesAtFileLimit, max: limits.maxFiles ?? 0 } })
    );
  }
  if (limits.filesOutsideAllowedTypes > 0) {
    insights.push(t('limits.insights.outsideTypes', { values: { count: limits.filesOutsideAllowedTypes } }));
  }

  const rows: Array<[string, string]> = [
    [
      t('limits.maxFileSize'),
      limits.maxFileSizeMb ? t('limits.megabytes', { values: { count: limits.maxFileSizeMb } }) : t('limits.notSet'),
    ],
    [t('limits.maxFiles'), limits.maxFiles ? String(limits.maxFiles) : t('limits.notSet')],
    [t('limits.mostInOneResponse'), String(limits.maxFilesInSingleResponse)],
    [
      t('limits.allowedTypes'),
      limits.allowedMimeTypes.length > 0 ? limits.allowedMimeTypes.join(', ') : t('limits.anyType'),
    ],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('limits.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-primary text-right break-words min-w-0">{value}</dd>
            </div>
          ))}
        </dl>

        {insights.length > 0 ? (
          <ul className="space-y-2">
            {insights.map((insight) => (
              <li key={insight} className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-[#e6f7f4] p-3 text-sm text-[#0E8C70]">
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t('limits.insights.healthy')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const FileUploadFieldAnalytics: React.FC<FileUploadFieldAnalyticsProps> = ({
  data,
  fieldLabel,
  totalResponses,
  loading,
}) => {
  const { t, locale } = useTranslation('fileUploadFieldAnalytics');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('files');

  const categoryData = useMemo(
    () =>
      (data?.categoryDistribution ?? []).map((item) => ({
        name: t(`fileTypes.categories.${item.category}`),
        value: item.count,
        percentage: item.percentage,
      })),
    [data?.categoryDistribution, t]
  );

  const sizeData = useMemo(
    () =>
      (data?.sizeDistribution ?? []).map((item) => ({
        range: t(`sizes.buckets.${item.bucket}`),
        count: item.count,
        percentage: item.percentage,
      })),
    [data?.sizeDistribution, t]
  );

  const perResponseData = useMemo(
    () =>
      (data?.filesPerResponseDistribution ?? []).map((item) => ({
        range:
          item.fileCount === 0 ? t('perResponse.none') : t('perResponse.count', { values: { count: item.fileCount } }),
        count: item.responseCount,
        percentage: item.percentage,
      })),
    [data?.filesPerResponseDistribution, t]
  );

  const trendData = useMemo(
    () =>
      (data?.uploadTrend ?? []).map((point) => ({
        name: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        value: trendMetric === 'files' ? point.files : Number((point.bytes / MB).toFixed(2)),
      })),
    [data?.uploadTrend, trendMetric, locale]
  );

  if (loading) return <FieldAnalyticsLoader />;

  if (!data || data.totalFilesUploaded === 0) {
    return (
      <FieldAnalyticsEmpty
        icon={<Upload className="h-8 w-8 text-[#0E8C70]" />}
        title={t('emptyState.title')}
        subtitle={t('emptyState.subtitle')}
      />
    );
  }

  const coverage = totalResponses > 0 ? (data.responsesWithFiles / totalResponses) * 100 : 0;
  const filesWithUnknownSize = data.totalFilesUploaded - data.filesWithKnownSize;
  const hasSizeData = data.filesWithKnownSize > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.totalFiles')}
          value={data.totalFilesUploaded}
          subtitle={t('stats.perResponse', { values: { average: data.averageFilesPerResponse.toFixed(2) } })}
          icon={<Files className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.totalStorage')}
          value={hasSizeData ? formatBytes(data.totalBytes, locale) : '—'}
          subtitle={
            hasSizeData
              ? t('stats.averageSize', { values: { size: formatBytes(data.averageFileSize, locale) } })
              : t('stats.noSizeData')
          }
          icon={<HardDrive className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.largestFile')}
          value={data.largestFile ? formatBytes(data.largestFile.size, locale) : '—'}
          subtitle={data.largestFile?.originalName ?? t('stats.noSizeData')}
          icon={<Upload className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.responsesWithFiles')}
          value={data.responsesWithFiles}
          subtitle={t('stats.ofResponses', { values: { total: totalResponses } })}
          icon={<FileCheck className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('coverage.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className="flex-1 bg-[#ebe9ec] rounded-full h-4"
              role="progressbar"
              aria-label={t('coverage.title')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(coverage)}
            >
              <div
                className="bg-[#0E8C70] h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, coverage)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground min-w-[3rem]">{coverage.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {t('coverage.summary', { values: { withFiles: data.responsesWithFiles, total: totalResponses } })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedPieChart
          data={categoryData}
          title={t('fileTypes.categoryTitle')}
          height={280}
          showPercentage={true}
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('fileTypes.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.extensionDistribution.slice(0, 10).map((ext) => (
                <div key={ext.extension} className="flex items-center gap-3">
                  <span className="text-sm font-mono bg-background px-2 py-0.5 rounded min-w-[4rem] text-center">
                    .{ext.extension}
                  </span>
                  <div className="flex-1 bg-background rounded-full h-3">
                    <div
                      className="bg-[#0E8C70] h-3 rounded-full"
                      style={{ width: `${Math.max(2, ext.percentage)}%` }}
                    />
                  </div>
                  <span className="text-sm text-foreground min-w-[5rem] text-right">
                    {ext.count} ({ext.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasSizeData && (
          <div className="space-y-2">
            <Histogram
              data={sizeData}
              title={t('sizes.title')}
              height={260}
              color={CHART_COLORS.primary[2]}
              showPercentage={true}
            />
            {filesWithUnknownSize > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('sizes.unknownNote', { values: { count: filesWithUnknownSize } })}
              </p>
            )}
          </div>
        )}
        <Histogram
          data={perResponseData}
          title={t('perResponse.title')}
          height={260}
          color={CHART_COLORS.primary[1]}
          showPercentage={true}
        />
      </div>

      {trendData.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-end gap-1" role="group" aria-label={t('trend.title')}>
            {TREND_METRICS.map((metric) => (
              <Button
                key={metric}
                size="sm"
                variant={trendMetric === metric ? 'default' : 'outline'}
                aria-pressed={trendMetric === metric}
                disabled={metric === 'storage' && !hasSizeData}
                onClick={() => setTrendMetric(metric)}
              >
                {t(`trend.show.${metric}`)}
              </Button>
            ))}
          </div>
          <EnhancedLineChart
            data={trendData}
            title={t('trend.title')}
            height={280}
            yAxisLabel={trendMetric === 'files' ? t('trend.files') : t('trend.storage')}
            showDots={trendData.length <= 31}
          />
        </div>
      )}

      <UploadLimits limits={data.limits} />

      {data.recentFiles.length > 0 && <RecentUploads files={data.recentFiles} fieldLabel={fieldLabel} />}
    </div>
  );
};
