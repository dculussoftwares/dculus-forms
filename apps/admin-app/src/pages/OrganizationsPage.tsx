import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@apollo/client/react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner } from '@dculus/ui';
import { Building2, Search, AlertTriangle } from 'lucide-react';
import { ADMIN_ORGANIZATIONS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  formCount: number;
  planId?: string | null;
  subscriptionStatus?: string | null;
  submissionsUsed?: number | null;
  submissionsLimit?: number | null;
}

const planBadgeStyle = (planId: string, status?: string | null): React.CSSProperties => {
  if (status === 'past_due') return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' };
  switch (planId) {
    case 'starter':  return { backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    case 'advanced': return { backgroundColor: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' };
    default:         return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)', border: '1px solid var(--tf-border)' };
  }
};

const UsageMiniBar: React.FC<{ used: number; limit: number }> = ({ used, limit }) => {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 100 ? '#dc2626' : pct >= 80 ? '#d97706' : '#16a34a';
  return (
    <div className="mt-1">
      <div className="h-1 rounded-full w-20" style={{ backgroundColor: 'var(--tf-faint)' }}>
        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-[9px] mt-0.5" style={{ color: 'var(--tf-muted)' }}>
        {used.toLocaleString()} / {limit.toLocaleString()}
      </p>
    </div>
  );
};

const ActionLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <Button
    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    variant="ghost"
    size="sm"
    className="text-xs h-7 px-2 text-muted-foreground hover:text-primary"
  >
    {children}
  </Button>
);

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('organizations');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const { data, loading, error, refetch } = useQuery<any, any>(ADMIN_ORGANIZATIONS_QUERY, {
    variables: { limit: 50, offset: 0, search: debouncedSearch || undefined },
  });

  const organizations: AdminOrganization[] = data?.adminOrganizations?.organizations || [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1 text-primary">{t('error.unableToLoad')}</h2>
        <p className="text-xs mb-3 text-muted-foreground">{error.message || t('error.checkConnection')}</p>
        <ActionLink onClick={() => refetch()}>Try again</ActionLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-primary">{t('title')}</h1>
        <p className="text-xs mt-0.5 text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          style={{ border: '1px solid var(--tf-border-medium)' }}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' }}
        >
          {organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-faint)' }}>
                <Building2 className="h-6 w-6 text-[var(--tf-icon-gray)]" />
              </div>
              <p className="text-sm font-medium text-primary">No Organizations</p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                {debouncedSearch ? 'No organizations match your search.' : 'No organizations have been created yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--tf-border-light)' }}>
                    {['Organization', 'Members', 'Forms', t('plan.columnHeader'), 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--tf-muted)', backgroundColor: 'var(--tf-faint)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {organizations.map((org, i) => (
                    <tr
                      key={org.id}
                      className="hover:bg-[var(--tf-tab-bg-faint)] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
                            {org.logo
                              ? <img src={org.logo} alt={org.name} className="w-8 h-8 rounded-lg object-cover" />
                              : <Building2 className="h-4 w-4 text-primary" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-primary">{org.name}</p>
                            <p className="text-xs text-muted-foreground">/{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{org.memberCount}</td>
                      <td className="px-5 py-3.5 text-sm text-foreground">{org.formCount}</td>
                      <td className="px-5 py-3.5">
                        {org.planId ? (
                          <div>
                            <div className="flex items-center gap-1">
                              {org.subscriptionStatus === 'past_due' && (
                                <AlertTriangle className="h-3 w-3" style={{ color: '#991b1b' }} />
                              )}
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
                                style={planBadgeStyle(org.planId, org.subscriptionStatus)}
                              >
                                {org.planId}
                              </span>
                            </div>
                            {org.submissionsUsed != null && org.submissionsLimit != null && (
                              <UsageMiniBar used={org.submissionsUsed} limit={org.submissionsLimit} />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <ActionLink onClick={() => navigate(`/organizations/${org.id}`)}>View</ActionLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
