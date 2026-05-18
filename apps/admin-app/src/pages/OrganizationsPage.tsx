import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingSpinner } from '@dculus/ui';
import { Building2 } from 'lucide-react';
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
}

/* Reusable Typeform-style action link */
const ActionLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <Button
    {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    variant="ghost"
    size="sm"
    className="text-xs h-7 px-2 text-[#655d67] hover:text-[#3c323e]"
  >
    {children}
  </Button>
);

import React from 'react';

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('organizations');
  const { data, loading, error, refetch } = useQuery(ADMIN_ORGANIZATIONS_QUERY, {
    variables: { limit: 50, offset: 0 },
  });

  const organizations: AdminOrganization[] = data?.adminOrganizations?.organizations || [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h2 className="text-sm font-semibold mb-1 text-[#3c323e]">{t('error.unableToLoad')}</h2>
        <p className="text-xs mb-3 text-[#655d67]">{error.message || t('error.checkConnection')}</p>
        <ActionLink onClick={() => refetch()}>{t('common.tryAgain', { defaultValue: 'Try again' })}</ActionLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[#3c323e]">{t('title')}</h1>
        <p className="text-xs mt-0.5 text-[#655d67]">{t('subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : (
        <div
          className="rounded-xl bg-white overflow-hidden"
          style={{ border: '1px solid rgba(81,76,84,0.10)', boxShadow: '0 1px 4px rgba(60,50,62,0.06)' }}
        >
          {organizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#f7f7f8' }}>
                <Building2 className="h-6 w-6 text-[#dedcde]" />
              </div>
              <p className="text-sm font-medium text-[#3c323e]">No Organizations</p>
              <p className="text-xs mt-0.5 text-[#655d67]">No organizations have been created yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(81,76,84,0.08)' }}>
                    {['Organization', 'Members', 'Forms', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#655d67', backgroundColor: '#f7f7f8' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {organizations.map((org, i) => (
                    <tr
                      key={org.id}
                      className="hover:bg-[rgba(87,84,91,0.025)] transition-colors"
                      style={{ borderTop: i > 0 ? '1px solid rgba(81,76,84,0.07)' : undefined }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#f8cdd8' }}>
                            {org.logo ? (
                              <img src={org.logo} alt={org.name} className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <Building2 className="h-4 w-4 text-[#3c323e]" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#3c323e]">{org.name}</p>
                            <p className="text-xs text-[#655d67]">/{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#4c414e]">{org.memberCount}</td>
                      <td className="px-5 py-3.5 text-sm text-[#4c414e]">{org.formCount}</td>
                      <td className="px-5 py-3.5 text-xs text-[#655d67]">{new Date(org.createdAt).toLocaleDateString()}</td>
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
