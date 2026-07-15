import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import {
  StatCard,
  EnhancedPieChart,
  MetricItem,
  CHART_COLORS,
  FieldAnalyticsLoader,
  FieldAnalyticsEmpty,
} from './BaseChartComponents';
import { EmailFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import {
  Mail,
  Shield,
  Building,
  User,
  Globe,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslation } from '../../../hooks/useTranslation';

interface EmailFieldAnalyticsProps {
  data: EmailFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

// Email Validation Indicator
const ValidationIndicator: React.FC<{
  validEmails: number;
  invalidEmails: number;
  validationRate: number;
}> = ({ validEmails, invalidEmails, validationRate }) => {
  const { t } = useTranslation('emailFieldAnalytics');

  const isHighValidation = validationRate >= 90;
  const isMediumValidation = validationRate >= 70;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('validationStatus.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-32 h-32">
            <svg
              className="w-32 h-32 transform -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={
                  isHighValidation
                    ? '#0E8C70'
                    : isMediumValidation
                      ? '#f59e0b'
                      : '#E85D4A'
                }
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${validationRate * 2.83} 283`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${
                    isHighValidation
                      ? 'text-primary'
                      : isMediumValidation
                        ? 'text-yellow-600'
                        : 'text-destructive'
                  }`}
                >
                  {validationRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('validationStatus.valid')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricItem
            icon={<CheckCircle className="h-8 w-8 text-primary" />}
            value={validEmails}
            label={t('validationStatus.validEmails')}
            className="bg-primary/5"
          />

          <MetricItem
            icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
            value={invalidEmails}
            label={t('validationStatus.invalidEmails')}
            className="bg-[var(--tf-error-bg)]"
          />
        </div>

        <div className="mt-4 p-3 bg-background rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {t('validationStatus.qualityScore')}
            </span>
            <span
              className={`font-bold ${
                isHighValidation
                  ? 'text-primary'
                  : isMediumValidation
                    ? 'text-yellow-600'
                    : 'text-destructive'
              }`}
            >
              {isHighValidation
                ? t('validationStatus.excellent')
                : isMediumValidation
                  ? t('validationStatus.good')
                  : t('validationStatus.needsAttention')}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Corporate vs Personal Analysis
const CorporatePersonalBreakdown: React.FC<{
  corporateVsPersonal: { corporate: number; personal: number; unknown: number };
  totalEmails: number;
}> = ({ corporateVsPersonal, totalEmails }) => {
  const { t } = useTranslation('emailFieldAnalytics');

  const chartData = [
    {
      name: t('corporatePersonal.corporate'),
      value: corporateVsPersonal.corporate,
      color: CHART_COLORS.primary[0],
    },
    {
      name: t('corporatePersonal.personal'),
      value: corporateVsPersonal.personal,
      color: CHART_COLORS.primary[1],
    },
    {
      name: t('corporatePersonal.unknown'),
      value: corporateVsPersonal.unknown,
      color: CHART_COLORS.primary[2],
    },
  ].filter((item) => item.value > 0);

  const corporatePercentage =
    totalEmails > 0 ? (corporateVsPersonal.corporate / totalEmails) * 100 : 0;
  const personalPercentage =
    totalEmails > 0 ? (corporateVsPersonal.personal / totalEmails) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('corporatePersonal.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <MetricItem
                icon={<Building className="h-8 w-8 text-blue-500" />}
                value={corporateVsPersonal.corporate}
                label={`${t('corporatePersonal.corporate')} (${corporatePercentage.toFixed(1)}%)`}
                className="bg-[#dbeafe]"
                progress={corporatePercentage}
                progressColor="bg-[#2563EB]"
              />

              <MetricItem
                icon={<User className="h-8 w-8 text-primary" />}
                value={corporateVsPersonal.personal}
                label={`${t('corporatePersonal.personal')} (${personalPercentage.toFixed(1)}%)`}
                className="bg-primary/5"
                progress={personalPercentage}
                progressColor="bg-primary/50"
              />

              {corporateVsPersonal.unknown > 0 && (
                <MetricItem
                  icon={<Globe className="h-8 w-8 text-muted-foreground" />}
                  value={corporateVsPersonal.unknown}
                  label={`${t('corporatePersonal.unknown')} (${((corporateVsPersonal.unknown / totalEmails) * 100).toFixed(1)}%)`}
                  className="bg-background"
                />
              )}
            </div>
          </div>

          {chartData.length > 1 && (
            <div className="flex items-center justify-center">
              <EnhancedPieChart
                data={chartData}
                title=""
                height={200}
                showPercentage={true}
              />
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-background rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-[#2563EB]" />
            <span className="font-medium text-primary">
              {t('emailTypeComparison.insights')}
            </span>
          </div>
          <div className="text-sm text-foreground space-y-1">
            <p>• {t('emailTypeComparison.corporateInfo')}</p>
            <p>• {t('emailTypeComparison.personalInfo')}</p>
            <p>• {t('emailTypeComparison.audienceInfo')}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Top Level Domains Analysis
const TopLevelDomainsChart: React.FC<{
  topLevelDomains: Array<{ tld: string; count: number; percentage: number }>;
  loading?: boolean;
}> = ({ topLevelDomains, loading: _loading }) => {
  const { t } = useTranslation('emailFieldAnalytics');

  const chartData = useMemo(() => {
    if (!topLevelDomains) return [];
    return topLevelDomains.slice(0, 10).map((tld) => ({
      name: `.${tld.tld}`,
      value: tld.count,
      percentage: tld.percentage,
      fullName: `.${tld.tld}`,
    }));
  }, [topLevelDomains]);

  if (!topLevelDomains || topLevelDomains.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('topDomains.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis
              label={{
                value: t('charts.yAxisLabel'),
                angle: -90,
                position: 'insideLeft',
              }}
            />
            <Tooltip
              content={({ active, payload, label: _label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg border-[var(--tf-border-medium)]">
                      <p className="font-medium text-primary mb-2">
                        {data.fullName}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-orange-600" />
                        <span className="text-foreground">
                          Emails: {data.value} ({data.percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[3]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Popular Email Providers
const PopularProviders: React.FC<{
  providers: Array<{ provider: string; count: number; percentage: number }>;
  loading?: boolean;
}> = ({ providers, loading }) => {
  const { t } = useTranslation('emailFieldAnalytics');

  if (loading || !providers || providers.length === 0) {
    return null;
  }

  const getProviderIcon = (provider: string) => {
    const providerLower = provider.toLowerCase();
    switch (providerLower) {
      case 'gmail':
        return '📧';
      case 'yahoo':
        return '💌';
      case 'hotmail':
      case 'outlook':
        return '📮';
      case 'icloud':
        return '☁️';
      case 'aol':
        return '📨';
      default:
        return '✉️';
    }
  };

  const getProviderColor = (index: number) => {
    const colors = [
      'bg-[var(--tf-error-bg)] border-red-300',
      'bg-[#dbeafe] border-[#93c5fd]',
      'bg-primary/10 border-primary/30',
      'bg-yellow-100 border-yellow-300',
      'bg-[#e6f7f4] border-[#99e2cf]',
    ];
    return colors[index % colors.length];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('providers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {providers.map((provider, index) => (
            <div
              key={provider.provider}
              className={`flex items-center justify-between p-3 border-2 rounded-lg ${getProviderColor(index)}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {getProviderIcon(provider.provider)}
                </span>
                <div>
                  <div className="font-medium text-primary capitalize">
                    {provider.provider}
                  </div>
                  <div className="text-sm text-foreground">
                    {provider.count}{' '}
                    {provider.count !== 1 ? t('providers.emails') : 'email'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-primary">
                  {provider.percentage.toFixed(1)}%
                </div>
                <div className="w-20 bg-[#ebe9ec] rounded-full h-2 mt-1">
                  <div
                    className="bg-[#2563EB] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, provider.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {providers.length > 5 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Showing top {providers.length} email providers
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const EmailFieldAnalytics: React.FC<EmailFieldAnalyticsProps> = ({
  data,
  fieldLabel: _fieldLabel,
  totalResponses,
  loading,
}) => {
  const { t } = useTranslation('emailFieldAnalytics');

  const domainChartData = useMemo(() => {
    if (!data?.domains) return [];
    return data.domains.slice(0, 15).map((domain) => ({
      name:
        domain.domain.length > 20
          ? `${domain.domain.substring(0, 20)}...`
          : domain.domain,
      value: domain.count,
      fullName: domain.domain,
      percentage: domain.percentage,
    }));
  }, [data?.domains]);

  if (loading) return <FieldAnalyticsLoader />;

  if (!data || (data.validEmails === 0 && data.invalidEmails === 0)) {
    return (
      <FieldAnalyticsEmpty
        icon={<Mail className="h-8 w-8 text-[#2563EB]" />}
        title={t('emptyState.title')}
        subtitle={t('emptyState.subtitle')}
      />
    );
  }

  const totalEmails = data.validEmails + data.invalidEmails;
  const topDomain = data.domains.length > 0 ? data.domains[0] : null;
  const topProvider =
    data.popularProviders.length > 0 ? data.popularProviders[0] : null;
  const responseRate =
    totalResponses > 0 ? (totalEmails / totalResponses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('stats.totalEmails')}
          value={totalEmails}
          subtitle={`${responseRate.toFixed(1)}% response rate`}
          icon={<Mail className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.validEmails')}
          value={`${data.validationRate.toFixed(1)}%`}
          subtitle={`${data.validEmails} of ${totalEmails} emails`}
          icon={<CheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.topDomain')}
          value={topDomain ? `${topDomain.percentage.toFixed(1)}%` : 'N/A'}
          subtitle={
            topDomain
              ? topDomain.domain.length > 20
                ? `${topDomain.domain.substring(0, 20)}...`
                : topDomain.domain
              : t('stats.noDomains')
          }
          icon={<Globe className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.topProvider')}
          value={topProvider ? topProvider.provider : 'N/A'}
          subtitle={
            topProvider ? `${topProvider.count} emails` : t('stats.noProviders')
          }
          icon={<Building className="h-5 w-5" />}
        />
      </div>

      {/* Email Validation Status */}
      <div className="space-y-4">
        <MetricHelper {...METRIC_HELPERS.VALIDATION_RATE} compact />
        <ValidationIndicator
          validEmails={data.validEmails}
          invalidEmails={data.invalidEmails}
          validationRate={data.validationRate}
        />
      </div>

      {/* Domain Analysis */}
      {domainChartData.length > 0 && (
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.DOMAIN_ANALYSIS} compact />
          <Card>
            <CardHeader>
              <CardTitle>{t('commonDomains.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={domainChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    label={{
                      value: t('charts.yAxisLabel'),
                      angle: -90,
                      position: 'insideLeft',
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label: _label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg border-[var(--tf-border-medium)]">
                            <p className="font-medium text-primary mb-2">
                              {data.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full bg-orange-600" />
                              <span className="text-foreground">
                                Emails: {data.value} (
                                {data.percentage.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {domainChartData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          CHART_COLORS.primary[
                            index % CHART_COLORS.primary.length
                          ]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Corporate vs Personal & TLD Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.CORPORATE_VS_PERSONAL} compact />
          <CorporatePersonalBreakdown
            corporateVsPersonal={data.corporateVsPersonal}
            totalEmails={totalEmails}
          />
        </div>
        <div className="space-y-6">
          <TopLevelDomainsChart topLevelDomains={data.topLevelDomains} />
        </div>
      </div>

      {/* Popular Providers */}
      {data.popularProviders.length > 0 && (
        <div className="space-y-4">
          <MetricHelper {...METRIC_HELPERS.PROVIDER_BREAKDOWN} compact />
          <PopularProviders providers={data.popularProviders} />
        </div>
      )}

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>{t('summary.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-primary">
                {t('summary.validationTitle')}
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.validRate')}
                  </span>
                  <span className="font-medium">
                    {data.validationRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.invalidCount')}
                  </span>
                  <span className="font-medium">{data.invalidEmails}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-primary">
                {t('summary.domainDiversityTitle')}
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.uniqueDomains')}
                  </span>
                  <span className="font-medium">{data.domains.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.tldTypes')}</span>
                  <span className="font-medium">
                    {data.topLevelDomains.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-primary">
                {t('summary.emailTypesTitle')}
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.corporate')}
                  </span>
                  <span className="font-medium">
                    {data.corporateVsPersonal.corporate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">{t('summary.personal')}</span>
                  <span className="font-medium">
                    {data.corporateVsPersonal.personal}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-primary">
                {t('summary.dataQualityTitle')}
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.totalEmails')}
                  </span>
                  <span className="font-medium">
                    {data.popularProviders.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground">
                    {t('summary.completeness')}
                  </span>
                  <span className="font-medium">
                    {topProvider?.provider || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FileUploadFieldAnalytics
// ─────────────────────────────────────────────────────────────────────────────
import { FileUploadFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { Upload, Files, FileCheck, FileX } from 'lucide-react';

interface FileUploadFieldAnalyticsProps {
  data: FileUploadFieldAnalyticsData;
  fieldLabel: string;
  totalResponses: number;
  loading?: boolean;
}

export const FileUploadFieldAnalytics: React.FC<
  FileUploadFieldAnalyticsProps
> = ({ data, fieldLabel: _fieldLabel, totalResponses, loading }) => {
  const { t: tCommon } = useTranslation('common');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCard
              key={i}
              title={tCommon('loading')}
              value="--"
              loading={true}
            />
          ))}
        </div>
        <div className="animate-pulse h-64 bg-[#ebe9ec] rounded" />
      </div>
    );
  }

  if (!data || data.totalFilesUploaded === 0) {
    return (
      <Card className="w-full">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-[#e6f7f4] mb-4">
              <Upload className="h-8 w-8 text-[#0E8C70]" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">
              No files uploaded yet
            </h3>
            <p className="text-foreground">
              File upload analytics will appear here once respondents start
              uploading files.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const responseRate =
    totalResponses > 0 ? (data.responsesWithFiles / totalResponses) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Files"
          value={data.totalFilesUploaded}
          icon={<Files className="h-5 w-5" />}
        />
        <StatCard
          title="Avg Files / Response"
          value={data.averageFilesPerResponse.toFixed(2)}
          icon={<Upload className="h-5 w-5" />}
        />
        <StatCard
          title="Responses with Files"
          value={data.responsesWithFiles}
          icon={<FileCheck className="h-5 w-5 text-primary" />}
        />
        <StatCard
          title="Responses without Files"
          value={data.responsesWithoutFiles}
          icon={<FileX className="h-5 w-5 text-destructive" />}
        />
      </div>

      {/* Response Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-[#ebe9ec] rounded-full h-4">
              <div
                className="bg-[#0E8C70] h-4 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, responseRate)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-foreground min-w-[3rem]">
              {responseRate.toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {data.responsesWithFiles} of {totalResponses} responses include
            uploaded files
          </p>
        </CardContent>
      </Card>

      {/* File Type Distribution */}
      {data.extensionDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>File Type Distribution</CardTitle>
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
                  <span className="text-sm text-foreground min-w-[3rem] text-right">
                    {ext.count} ({ext.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
