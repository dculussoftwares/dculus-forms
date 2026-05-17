import { useQuery } from '@apollo/client';
import { LoadingSpinner } from '@dculus/ui';
import { Building2, Users, FileText, BarChart3, HardDrive, Database } from 'lucide-react';
import { ADMIN_STATS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

/* Typeform field-icon palette for admin stats */
const STAT_COLORS = [
  { iconBg: '#f8cdd8', iconColor: '#3c323e' },  // Organizations — salmon
  { iconBg: '#f4faf8', iconColor: '#177767' },  // Users — teal
  { iconBg: '#fbe19d', iconColor: '#8b6a18' },  // Forms — yellow
  { iconBg: '#ddd6fa', iconColor: '#5c2e6b' },  // Responses — lavender
];

const STORAGE_COLORS = [
  { iconBg: '#dedcde', iconColor: '#4c414e' },  // S3 — gray
  { iconBg: '#c4e3ba', iconColor: '#2d6236' },  // MongoDB — green
];

/* Reusable stat card */
const StatCard: React.FC<{ name: string; value: string; subtitle?: string; icon: React.ElementType; iconBg: string; iconColor: string; large?: boolean }> = ({
  name, value, subtitle, icon: Icon, iconBg, iconColor, large = false,
}) => (
  <div className="rounded-xl bg-white p-5 flex items-center gap-4" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
    <div className={`${large ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0`} style={{ backgroundColor: iconBg }}>
      <Icon className={large ? 'h-6 w-6' : 'h-5 w-5'} style={{ color: iconColor }} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium truncate" style={{ color: '#655d67' }}>{name}</p>
      <p className={`font-light truncate ${large ? 'text-3xl' : 'text-2xl'}`} style={{ color: '#262627' }}>{value}</p>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: '#655d67' }}>{subtitle}</p>}
    </div>
  </div>
);

import React from 'react';

export default function DashboardPage() {
  const { data, loading, error } = useQuery(ADMIN_STATS_QUERY);
  const { t } = useTranslation('dashboard');

  const stats = [
    { name: t('stats.totalOrganizations'), value: data?.adminStats?.organizationCount?.toString() || '0', icon: Building2, ...STAT_COLORS[0] },
    { name: t('stats.totalUsers'),         value: data?.adminStats?.userCount?.toString() || '0',         icon: Users,      ...STAT_COLORS[1] },
    { name: t('stats.totalForms'),         value: data?.adminStats?.formCount?.toString() || '0',         icon: FileText,   ...STAT_COLORS[2] },
    { name: t('stats.formResponses'),      value: data?.adminStats?.responseCount?.toString() || '0',     icon: BarChart3,  ...STAT_COLORS[3] },
  ];

  const storageStats = [
    { name: t('storage.s3Storage'), value: data?.adminStats?.storageUsed || '0 B', subtitle: `${data?.adminStats?.fileCount || 0} ${t('storage.files')}`, icon: HardDrive, ...STORAGE_COLORS[0] },
    { name: t('storage.mongoDB'),   value: data?.adminStats?.mongoDbSize || '0 B', subtitle: `${data?.adminStats?.mongoCollectionCount || 0} ${t('storage.collections')}`, icon: Database, ...STORAGE_COLORS[1] },
  ];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1" style={{ color: '#3c323e' }}>{t('error.unableToLoad')}</h2>
        <p className="text-xs mb-1" style={{ color: '#655d67' }}>{error.message || t('error.checkConnection')}</p>
        <p className="text-xs" style={{ color: '#655d67', opacity: 0.7 }}>{t('error.backendRunning')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: '#3c323e' }}>{t('title')}</h1>
        <p className="text-xs mt-0.5" style={{ color: '#655d67' }}>{t('welcome')}</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          loading
            ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-20" style={{ border: '1px solid rgba(81,76,84,0.10)' }} />
            : <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Storage */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#3c323e' }}>{t('storage.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {storageStats.map((stat) => (
            loading
              ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-24" style={{ border: '1px solid rgba(81,76,84,0.10)' }} />
              : <StatCard key={stat.name} {...stat} large />
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orgs placeholder */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#3c323e' }}>{t('recentActivity.recentOrganizations')}</h3>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#f7f7f8' }}>
              <Building2 className="h-5 w-5" style={{ color: '#dedcde' }} />
            </div>
            <p className="text-xs font-medium" style={{ color: '#655d67' }}>{t('recentActivity.noOrganizations')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: '#655d67', opacity: 0.7 }}>{t('recentActivity.connectBackend')}</p>
          </div>
        </div>

        {/* System health */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#3c323e' }}>{t('systemHealth.title')}</h3>
          <div className="space-y-3">
            {[
              { label: t('systemHealth.database'),       status: t('systemHealth.connected') },
              { label: t('systemHealth.graphqlApi'),     status: t('systemHealth.online') },
              { label: t('systemHealth.authentication'), status: t('systemHealth.working') },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#655d67' }}>{label}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: 'rgba(23,119,103,0.08)', color: '#177767', border: '1px solid rgba(23,119,103,0.16)' }}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
