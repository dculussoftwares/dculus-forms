import { useQuery } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { Card, LoadingSpinner } from '@dculus/ui';
import { Building2, Users, FileText, Calendar } from 'lucide-react';
import { ADMIN_ORGANIZATIONS_QUERY } from '../graphql/organizations';
import { useTranslation } from '../hooks/useTranslation';

export default function OrganizationsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('organizations');
  const { data, loading, error, refetch } = useQuery(ADMIN_ORGANIZATIONS_QUERY, {
    variables: {
      limit: 50,
      offset: 0,
    },
  });

  const organizations = data?.adminOrganizations?.organizations || [];

  if (error) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">{t('error.unableToLoad')}</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error.message || t('error.checkConnection')}
          </p>
          <button
            onClick={() => refetch()}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            {t('common.tryAgain', { defaultValue: 'Try again' })}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {t('subtitle')}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="min-h-64 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {/* Organizations Grid */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org: any) => (
          <Card key={org.id} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <Building2 className="h-6 w-6 text-gray-500" />
                  )}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">/{org.slug}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-4 w-4 mr-2" />
                <span>{org.memberCount} {t('members')}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <FileText className="h-4 w-4 mr-2" />
                <span>{org.formCount} {t('forms')}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>{t('created')} {new Date(org.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between">
                <button 
                  onClick={() => navigate(`/organizations/${org.id}`)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {t('viewDetails')}
                </button>
                <button className="text-sm text-gray-600 hover:text-gray-800">
                  Manage
                </button>
              </div>
            </div>
          </Card>
        ))}

          {/* Empty state */}
          {organizations.length === 0 && (
            <Card className="p-6 border-dashed border-2 border-gray-300">
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Organizations</h3>
                <p className="text-sm text-gray-600">
                  No organizations have been created yet.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Organizations Table View (Alternative layout) */}
      <div className="mt-12">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">All Organizations</h3>
            <p className="text-sm text-gray-600">Detailed view of all organizations</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Forms
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org: any) => (
                  <tr key={org.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-md bg-gray-200 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{org.name}</div>
                          <div className="text-sm text-gray-500">/{org.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {org.memberCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {org.formCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => navigate(`/organizations/${org.id}`)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}