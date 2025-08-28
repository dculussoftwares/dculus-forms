import { useQuery } from '@apollo/client';
import { Card, LoadingSpinner } from '@dculus/ui';
import { Building2, Users, FileText, BarChart3 } from 'lucide-react';
import { ADMIN_STATS_QUERY } from '../graphql/organizations';

export default function DashboardPage() {
  const { data, loading, error } = useQuery(ADMIN_STATS_QUERY);

  const stats = [
    {
      name: 'Total Organizations',
      value: data?.adminStats?.organizationCount?.toString() || '0',
      icon: Building2,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      name: 'Total Users',
      value: data?.adminStats?.userCount?.toString() || '0',
      icon: Users,
      color: 'text-green-600 bg-green-100',
    },
    {
      name: 'Total Forms',
      value: data?.adminStats?.formCount?.toString() || '0',
      icon: FileText,
      color: 'text-yellow-600 bg-yellow-100',
    },
    {
      name: 'Form Responses',
      value: data?.adminStats?.responseCount?.toString() || '0',
      icon: BarChart3,
      color: 'text-purple-600 bg-purple-100',
    },
  ];

  if (error) {
    return (
      <div className="min-h-64 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Unable to load dashboard</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error.message || 'Please check your connection and try again.'}
          </p>
          <p className="text-xs text-gray-400">
            Make sure the backend server is running and GraphQL endpoint is accessible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome to the Dculus Forms admin dashboard
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Organizations</h3>
          <div className="text-center py-8 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No organizations data available yet</p>
            <p className="text-sm">Connect your GraphQL backend to see real data</p>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">GraphQL API</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Authentication</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Working
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}