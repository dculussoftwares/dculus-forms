import { useQuery } from '@apollo/client';
import { EmptyState } from '@dculus/ui';
import { AlertCircle, Building2, Users, FileText, BarChart3, HardDrive, Database } from 'lucide-react';
import { ADMIN_STATS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

/* Typeform field-icon palette for admin stats */
const STAT_COLORS = [
  { iconBg: 'var(--tf-icon-salmon)', iconColor: 'var(--tf-dark)' },  // Organizations — salmon
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },  // Users — teal
  { iconBg: '#fbe19d', iconColor: '#8b6a18' },  // Forms — yellow
  { iconBg: 'var(--tf-icon-lavender)', iconColor: '#5c2e6b' },  // Responses — lavender
];

const STORAGE_COLORS = [
  { iconBg: 'var(--tf-icon-gray)', iconColor: 'var(--tf-text)' },   // S3 — gray
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },  // Postgres — teal
];

/* Reusable stat card */
const StatCard: React.FC<{ name: string; value: string; subtitle?: string; icon: React.ElementType; iconBg: string; iconColor: string; large?: boolean }> = ({
  name, value, subtitle, icon: Icon, iconBg, iconColor, large = false,
}) => (
  <div className="rounded-xl bg-white p-5 flex items-center gap-4" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
    <div className={`${large ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0`} style={{ backgroundColor: iconBg }}>
      <Icon className={large ? 'h-6 w-6' : 'h-5 w-5'} style={{ color: iconColor }} />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium truncate text-muted-foreground">{name}</p>
      <p className={`font-light truncate text-primary ${large ? 'text-3xl' : 'text-2xl'}`}>{value}</p>
      {subtitle && <p className="text-xs mt-0.5 text-muted-foreground">{subtitle}</p>}
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
    { name: t('storage.s3Storage'),   value: data?.adminStats?.storageUsed || '0 B',    subtitle: `${data?.adminStats?.fileCount || 0} ${t('storage.files')}`,           icon: HardDrive, ...STORAGE_COLORS[0] },
    { name: t('storage.postgresDB'),  value: data?.adminStats?.postgresDbSize || '0 B', subtitle: `${data?.adminStats?.postgresTableCount || 0} ${t('storage.tables')}`, icon: Database,  ...STORAGE_COLORS[1] },
  ];

  if (error) {
    return (
      <EmptyState
        variant="error"
        className="min-h-64"
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title={t('error.unableToLoad')}
        description={error.message || t('error.checkConnection')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{t('welcome')}</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          loading
            ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-20" style={{ border: '1px solid var(--tf-border-medium)' }} />
            : <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Storage */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-primary">{t('storage.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {storageStats.map((stat) => (
            loading
              ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-24" style={{ border: '1px solid var(--tf-border-medium)' }} />
              : <StatCard key={stat.name} {...stat} large />
          ))}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent orgs placeholder */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('recentActivity.recentOrganizations')}</h3>
          <div className="flex flex-col items-center justify-center py-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <Building2 className="h-5 w-5 text-[var(--tf-icon-gray)]" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">{t('recentActivity.noOrganizations')}</p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--tf-muted)', opacity: 0.7 }}>{t('recentActivity.connectBackend')}</p>
          </div>
        </div>

        {/* System health */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('systemHealth.title')}</h3>
          <div className="space-y-3">
            {[
              { label: t('systemHealth.database'),       status: t('systemHealth.connected') },
              { label: t('systemHealth.graphqlApi'),     status: t('systemHealth.online') },
              { label: t('systemHealth.authentication'), status: t('systemHealth.working') },
            ].map(({ label, status }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' }}
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
