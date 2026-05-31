import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@dculus/ui';
import {
  AlertCircle, Building2, Users, FileText, BarChart3,
  HardDrive, Database, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { ADMIN_STATS_QUERY, ADMIN_ORGANIZATIONS_QUERY } from '../graphql/organizations';
import { ADMIN_SYSTEM_HEALTH_QUERY, SystemHealthItem } from '../graphql/systemHealth';
import { useTranslation } from '../hooks/useTranslation';

interface OrgNearLimit {
  orgId: string;
  orgName: string;
  submissionsUsed: number;
  submissionsLimit: number;
  usagePercent: number;
}

interface RecentOrg {
  id: string;
  name: string;
  slug: string;
  planId: string | null;
  memberCount: number;
  formCount: number;
}

const STAT_COLORS = [
  { iconBg: 'var(--tf-icon-salmon)', iconColor: 'var(--tf-dark)' },
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },
  { iconBg: '#fbe19d', iconColor: '#8b6a18' },
  { iconBg: 'var(--tf-icon-lavender)', iconColor: '#5c2e6b' },
];

const STORAGE_COLORS = [
  { iconBg: 'var(--tf-icon-gray)', iconColor: 'var(--tf-text)' },
  { iconBg: 'var(--tf-icon-teal)', iconColor: 'var(--tf-green)' },
];

const StatCard: React.FC<{
  name: string; value: string; subtitle?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; large?: boolean;
}> = ({ name, value, subtitle, icon: Icon, iconBg, iconColor, large = false }) => (
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

const planBadgeStyle = (planId: string) => {
  switch (planId) {
    case 'starter': return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default: return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const healthBadgeStyle = (status: string) => {
  switch (status) {
    case 'ok': return { backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)', border: '1px solid var(--tf-green-bg-md)' };
    case 'degraded': return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
    default: return { backgroundColor: 'var(--tf-error-bg)', color: 'var(--tf-error)', border: '1px solid var(--tf-error-bg-lg)' };
  }
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const [alertsExpanded, setAlertsExpanded] = useState(false);

  const { data: statsData, loading: statsLoading, error: statsError } = useQuery(ADMIN_STATS_QUERY);
  const { data: orgsData, loading: orgsLoading } = useQuery(ADMIN_ORGANIZATIONS_QUERY, {
    variables: { limit: 5, offset: 0 },
  });
  const { data: healthData, loading: healthLoading } = useQuery(ADMIN_SYSTEM_HEALTH_QUERY);

  const stats = [
    { name: t('stats.totalOrganizations'), value: statsData?.adminStats?.organizationCount?.toString() || '0', icon: Building2, ...STAT_COLORS[0] },
    { name: t('stats.totalUsers'),         value: statsData?.adminStats?.userCount?.toString() || '0',         icon: Users,      ...STAT_COLORS[1] },
    { name: t('stats.totalForms'),         value: statsData?.adminStats?.formCount?.toString() || '0',         icon: FileText,   ...STAT_COLORS[2] },
    { name: t('stats.formResponses'),      value: statsData?.adminStats?.responseCount?.toString() || '0',     icon: BarChart3,  ...STAT_COLORS[3] },
  ];

  const storageStats = [
    { name: t('storage.s3Storage'),  value: statsData?.adminStats?.storageUsed || '0 B',    subtitle: `${statsData?.adminStats?.fileCount || 0} ${t('storage.files')}`,           icon: HardDrive, ...STORAGE_COLORS[0] },
    { name: t('storage.postgresDB'), value: statsData?.adminStats?.postgresDbSize || '0 B', subtitle: `${statsData?.adminStats?.postgresTableCount || 0} ${t('storage.tables')}`, icon: Database,  ...STORAGE_COLORS[1] },
  ];

  const planChips = [
    { key: 'free',     count: statsData?.adminStats?.freePlanCount     ?? 0 },
    { key: 'starter',  count: statsData?.adminStats?.starterPlanCount  ?? 0 },
    { key: 'advanced', count: statsData?.adminStats?.advancedPlanCount ?? 0 },
  ];

  const orgsNearLimit: OrgNearLimit[] = statsData?.adminStats?.orgsNearLimit ?? [];
  const recentOrgs: RecentOrg[] = orgsData?.adminOrganizations?.organizations ?? [];
  const healthItems: SystemHealthItem[] = healthData?.adminSystemHealth ?? [];

  if (statsError) {
    return (
      <EmptyState
        variant="error"
        className="min-h-64"
        icon={<AlertCircle className="h-6 w-6 text-destructive" />}
        title={t('error.unableToLoad')}
        description={statsError.message || t('error.checkConnection')}
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
          statsLoading
            ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-20" style={{ border: '1px solid var(--tf-border-medium)' }} />
            : <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Storage */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-primary">{t('storage.title')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {storageStats.map((stat) => (
            statsLoading
              ? <div key={stat.name} className="rounded-xl bg-white p-5 animate-pulse h-24" style={{ border: '1px solid var(--tf-border-medium)' }} />
              : <StatCard key={stat.name} {...stat} large />
          ))}
        </div>
      </div>

      {/* Plan distribution */}
      <div>
        <h2 className="text-sm font-semibold mb-3 text-primary">{t('plans.title')}</h2>
        <div className="flex gap-3 flex-wrap">
          {statsLoading
            ? [0, 1, 2].map(i => (
                <div key={i} className="animate-pulse rounded-full h-6 w-24" style={{ backgroundColor: 'var(--tf-faint)' }} />
              ))
            : planChips.map(({ key, count }) => (
                <span key={key} className="px-3 py-1 rounded-full text-xs font-medium" style={planBadgeStyle(key)}>
                  {t(`plans.${key as 'free' | 'starter' | 'advanced'}`)} · {count} {t('plans.orgs')}
                </span>
              ))
          }
        </div>
      </div>

      {/* Usage alerts */}
      {statsLoading && (
        <div className="animate-pulse rounded-xl h-12" style={{ backgroundColor: 'var(--tf-faint)' }} />
      )}
      {!statsLoading && orgsNearLimit.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setAlertsExpanded(v => !v)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: '#92400e' }} />
              <span className="text-xs font-medium" style={{ color: '#92400e' }}>
                {orgsNearLimit.length} organization(s) are at ≥80% of their submission limit
              </span>
            </div>
            {alertsExpanded
              ? <ChevronUp className="h-4 w-4" style={{ color: '#92400e' }} />
              : <ChevronDown className="h-4 w-4" style={{ color: '#92400e' }} />
            }
          </div>
          {alertsExpanded && (
            <div className="mt-3 space-y-1.5">
              {orgsNearLimit.map((org) => (
                <div
                  key={org.orgId}
                  className="flex items-center justify-between cursor-pointer hover:opacity-80"
                  onClick={() => navigate(`/organizations/${org.orgId}`)}
                >
                  <span className="text-xs font-medium" style={{ color: '#92400e' }}>{org.orgName}</span>
                  <span className="text-xs" style={{ color: '#92400e' }}>
                    {org.submissionsUsed.toLocaleString()} / {org.submissionsLimit.toLocaleString()} ({org.usagePercent}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent organizations — real data */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('recentActivity.recentOrganizations')}</h3>
          {orgsLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="animate-pulse rounded-xl h-10" style={{ backgroundColor: 'var(--tf-faint)' }} />
              ))}
            </div>
          ) : recentOrgs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--tf-faint)' }}>
                <Building2 className="h-5 w-5 text-[var(--tf-icon-gray)]" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">{t('recentActivity.noOrganizations')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[var(--tf-tab-bg-faint)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/organizations/${org.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
                      <Building2 className="h-3 w-3 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{org.name}</p>
                      <p className="text-[10px] text-muted-foreground">/{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {org.planId && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium capitalize" style={planBadgeStyle(org.planId)}>
                        {org.planId}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{org.memberCount}m · {org.formCount}f</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System health — real data */}
        <div className="rounded-xl bg-white p-5" style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}>
          <h3 className="text-sm font-semibold mb-4 text-primary">{t('systemHealth.title')}</h3>
          <div className="space-y-3">
            {healthLoading
              ? [0, 1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="animate-pulse rounded h-3 w-24" style={{ backgroundColor: 'var(--tf-faint)' }} />
                    <div className="animate-pulse rounded-full h-5 w-16" style={{ backgroundColor: 'var(--tf-faint)' }} />
                  </div>
                ))
              : healthItems.map((item: SystemHealthItem) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      {item.latencyMs != null && (
                        <span className="text-[10px] text-muted-foreground ml-1">({item.latencyMs}ms)</span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={healthBadgeStyle(item.status)}>
                      {t(`systemHealth.${item.status}`)}
                    </span>
                  </div>
                ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
