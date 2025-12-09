import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@dculus/ui';
import { StatCard, EnhancedPieChart, CHART_COLORS } from './BaseChartComponents';
import { EmailFieldAnalyticsData } from '../../../hooks/useFieldAnalytics';
import { Mail, Shield, Building, User, Globe, AlertTriangle, CheckCircle } from 'lucide-react';
import { MetricHelper, METRIC_HELPERS } from './MetricHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
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
                stroke={isHighValidation ? "#10b981" : isMediumValidation ? "#f59e0b" : "#ef4444"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${validationRate * 2.83} 283`}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  isHighValidation ? "text-green-600" : 
                  isMediumValidation ? "text-yellow-600" : "text-red-600"
                }`}>
                  {validationRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">{t('validationStatus.valid')}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-lg font-bold text-gray-900">{validEmails}</div>
              <div className="text-sm text-gray-600">{t('validationStatus.validEmails')}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <div className="text-lg font-bold text-gray-900">{invalidEmails}</div>
              <div className="text-sm text-gray-600">{t('validationStatus.invalidEmails')}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">{t('validationStatus.qualityScore')}</span>
            <span className={`font-bold ${
              isHighValidation ? "text-green-600" : 
              isMediumValidation ? "text-yellow-600" : "text-red-600"
            }`}>
              {isHighValidation ? t('validationStatus.excellent') : isMediumValidation ? t('validationStatus.good') : t('validationStatus.needsAttention')}
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
    { name: t('corporatePersonal.corporate'), value: corporateVsPersonal.corporate, color: CHART_COLORS.primary[0] },
    { name: t('corporatePersonal.personal'), value: corporateVsPersonal.personal, color: CHART_COLORS.primary[1] },
    { name: t('corporatePersonal.unknown'), value: corporateVsPersonal.unknown, color: CHART_COLORS.primary[2] }
  ].filter(item => item.value > 0);

  const corporatePercentage = totalEmails > 0 ? (corporateVsPersonal.corporate / totalEmails) * 100 : 0;
  const personalPercentage = totalEmails > 0 ? (corporateVsPersonal.personal / totalEmails) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('corporatePersonal.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Building className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {corporateVsPersonal.corporate}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('corporatePersonal.corporate')} ({corporatePercentage.toFixed(1)}%)
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${corporatePercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <User className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-lg font-bold text-gray-900">
                    {corporateVsPersonal.personal}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('corporatePersonal.personal')} ({personalPercentage.toFixed(1)}%)
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${personalPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {corporateVsPersonal.unknown > 0 && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Globe className="h-8 w-8 text-gray-500" />
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {corporateVsPersonal.unknown}
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('corporatePersonal.unknown')} ({((corporateVsPersonal.unknown / totalEmails) * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
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

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-gray-900">{t('emailTypeComparison.insights')}</span>
          </div>
          <div className="text-sm text-gray-700 space-y-1">
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
    return topLevelDomains.slice(0, 10).map(tld => ({
      name: `.${tld.tld}`,
      value: tld.count,
      percentage: tld.percentage,
      fullName: `.${tld.tld}`
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
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <YAxis 
              label={{ value: t('charts.yAxisLabel'), angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              content={({ active, payload, label: _label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                      <p className="font-medium text-gray-900 mb-2">
                        {data.fullName}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full bg-orange-600" />
                        <span className="text-gray-700">
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
                <Cell 
                  key={`cell-${index}`} 
                  fill={CHART_COLORS.primary[3]} 
                />
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
      case 'gmail': return '📧';
      case 'yahoo': return '💌';
      case 'hotmail': case 'outlook': return '📮';
      case 'icloud': return '☁️';
      case 'aol': return '📨';
      default: return '✉️';
    }
  };

  const getProviderColor = (index: number) => {
    const colors = ['bg-red-100 border-red-300', 'bg-blue-100 border-blue-300', 'bg-green-100 border-green-300', 'bg-yellow-100 border-yellow-300', 'bg-purple-100 border-purple-300'];
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
                <span className="text-2xl">{getProviderIcon(provider.provider)}</span>
                <div>
                  <div className="font-medium text-gray-900 capitalize">
                    {provider.provider}
                  </div>
                  <div className="text-sm text-gray-600">
                    {provider.count} {provider.count !== 1 ? t('providers.emails') : 'email'}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {provider.percentage.toFixed(1)}%
                </div>
                <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, provider.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {providers.length > 5 && (
          <div className="mt-4 text-center text-sm text-gray-500">
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
  loading
}) => {
  const { t } = useTranslation('emailFieldAnalytics');
  const { t: tCommon } = useTranslation('common');
  
  const domainChartData = useMemo(() => {
    if (!data?.domains) return [];
    return data.domains.slice(0, 15).map(domain => ({
      name: domain.domain.length > 20 ? `${domain.domain.substring(0, 20)}...` : domain.domain,
      value: domain.count,
      fullName: domain.domain,
      percentage: domain.percentage
    }));
  }, [data?.domains]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <StatCard 
              key={i}
              title={tCommon('loading')} 
              value="--" 
              loading={true} 
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
          <div className="animate-pulse h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data || (data.validEmails === 0 && data.invalidEmails === 0)) {
    return (
      <Card className="w-full">
        <CardContent className="p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('emptyState.title')}</h3>
            <p className="text-gray-600 max-w-md mx-auto">{t('emptyState.subtitle')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalEmails = data.validEmails + data.invalidEmails;
  const topDomain = data.domains.length > 0 ? data.domains[0] : null;
  const topProvider = data.popularProviders.length > 0 ? data.popularProviders[0] : null;
  const responseRate = totalResponses > 0 ? (totalEmails / totalResponses) * 100 : 0;

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
          subtitle={topDomain ? 
            (topDomain.domain.length > 20 ? `${topDomain.domain.substring(0, 20)}...` : topDomain.domain) : 
            t('stats.noDomains')
          }
          icon={<Globe className="h-5 w-5" />}
        />
        <StatCard
          title={t('stats.topProvider')}
          value={topProvider ? topProvider.provider : 'N/A'}
          subtitle={topProvider ? `${topProvider.count} emails` : t('stats.noProviders')}
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
                    label={{ value: t('charts.yAxisLabel'), angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    content={({ active, payload, label: _label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg border-gray-200">
                            <p className="font-medium text-gray-900 mb-2">
                              {data.fullName}
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                              <div className="w-3 h-3 rounded-full bg-orange-600" />
                              <span className="text-gray-700">
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
                    {domainChartData.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} 
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
              <h4 className="font-medium text-gray-900">{t('summary.validationTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.validRate')}</span>
                  <span className="font-medium">{data.validationRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.invalidCount')}</span>
                  <span className="font-medium">{data.invalidEmails}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.domainDiversityTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.uniqueDomains')}</span>
                  <span className="font-medium">{data.domains.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.tldTypes')}</span>
                  <span className="font-medium">{data.topLevelDomains.length}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.emailTypesTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.corporate')}</span>
                  <span className="font-medium">{data.corporateVsPersonal.corporate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.personal')}</span>
                  <span className="font-medium">{data.corporateVsPersonal.personal}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{t('summary.dataQualityTitle')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.totalEmails')}</span>
                  <span className="font-medium">{data.popularProviders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('summary.completeness')}</span>
                  <span className="font-medium">{topProvider?.provider || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};