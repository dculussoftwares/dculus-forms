import { useQuery } from '@apollo/client';
import { Card, LoadingSpinner } from '@dculus/ui';
import { Building2, Users, FileText, BarChart3, HardDrive, Database } from 'lucide-react';
import { ADMIN_STATS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

export default function DashboardPage() {
  const { data, loading, error } = useQuery(ADMIN_STATS_QUERY);
  const { t } = useTranslation('dashboard');

  const stats = [
    {
      name: t('stats.totalOrganizations'),
      value: data?.adminStats?.organizationCount?.toString() || '0',
      icon: Building2,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      name: t('stats.totalUsers'),
      value: data?.adminStats?.userCount?.toString() || '0',
      icon: Users,
      color: 'text-green-600 bg-green-100',
    },
    {
      name: t('stats.totalForms'),
      value: data?.adminStats?.formCount?.toString() || '0',
      icon: FileText,
      color: 'text-yellow-600 bg-yellow-100',
    },
    {
      name: t('stats.formResponses'),
      value: data?.adminStats?.responseCount?.toString() || '0',
      icon: BarChart3,
      color: 'text-purple-600 bg-purple-100',
    },
  ];

  const storageStats = [
    {
      name: t('storage.s3Storage'),
      value: data?.adminStats?.storageUsed || '0 B',
      subtitle: `${data?.adminStats?.fileCount || 0} ${t('storage.files')}`,
      icon: HardDrive,
      color: 'text-indigo-600 bg-indigo-100',
    },
    {
      name: t('storage.mongoDB'),
      value: data?.adminStats?.mongoDbSize || '0 B',
      subtitle: `${data?.adminStats?.mongoCollectionCount || 0} ${t('storage.collections')}`,
      icon: Database,
      color: 'text-emerald-600 bg-emerald-100',
    },
  ];

  if (error) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">{t('error.unableToLoad')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error.message || t('error.checkConnection')}
          </p>
          <p className="text-xs text-gray-400">
            {t('error.backendRunning')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('welcome')}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-center">
              <div className={`rounded-lg p-2 ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <div className="text-2xl font-semibold text-gray-900">
                  {loading ? <LoadingSpinner className="min-h-8" /> : stat.value}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Storage Overview */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-6">{t('storage.title')}</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {storageStats.map((stat) => (
            <Card key={stat.name} className="p-6">
              <div className="flex items-center">
                <div className={`rounded-lg p-3 ${stat.color}`}>
                  <stat.icon className="h-8 w-8" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <div className="text-3xl font-semibold text-gray-900">
                    {loading ? <LoadingSpinner className="min-h-8" /> : stat.value}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {loading ? '...' : stat.subtitle}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('recentActivity.recentOrganizations')}</h3>
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>{t('recentActivity.noOrganizations')}</p>
            <p className="text-sm">{t('recentActivity.connectBackend')}</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{t('systemHealth.title')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.database')}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {t('systemHealth.connected')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.graphqlApi')}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {t('systemHealth.online')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{t('systemHealth.authentication')}</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {t('systemHealth.working')}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}