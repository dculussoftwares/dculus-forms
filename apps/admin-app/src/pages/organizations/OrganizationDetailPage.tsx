import { useQuery } from '@apollo/client';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, CardContent } from '@dculus/ui';
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  BarChart3,
  Calendar,
  Mail,
} from 'lucide-react';
import {
  ADMIN_ORGANIZATION_BY_ID_QUERY,
  AdminOrganizationByIdQueryData,
} from '../../graphql/organizationDetail';

export const OrganizationDetailPage = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<AdminOrganizationByIdQueryData>(
    ADMIN_ORGANIZATION_BY_ID_QUERY,
    {
      variables: { id: orgId },
      skip: !orgId,
    }
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading organization details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
            Error loading organization
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {error?.message || 'Organization not found'}
          </p>
          <Button onClick={() => navigate('/organizations')}>
            Back to Organizations
          </Button>
        </div>
      </div>
    );
  }

  const org = data.adminOrganizationById;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back Button */}
        <Button
          onClick={() => navigate('/organizations')}
          variant="outline"
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Organizations
        </Button>

        {/* Organization Header Card */}
        <Card className="mb-6">
          <CardContent className="p-8">
            <div className="flex items-start gap-6">
              {/* Logo */}
              <div className="flex-shrink-0">
                {org.logo ? (
                  <img
                    src={org.logo}
                    alt={org.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-10 h-10 text-white" />
                  </div>
                )}
              </div>

              {/* Org Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {org.name}
                </h1>
                {org.slug && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">@{org.slug}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Created {formatDate(org.createdAt)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Members Count */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Members</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {org.members.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forms Count */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Forms</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {org.stats.totalForms}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responses Count */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                  <BarChart3 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Responses</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {org.stats.totalResponses}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organization ID Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Organization Information
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Organization ID
                </p>
                <p className="font-mono text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 p-2 rounded">
                  {org.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Created Date
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(org.createdAt)}
                </p>
              </div>
              {org.slug && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Slug</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{org.slug}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Members Card */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Members ({org.members.length})
            </h2>
            {org.members.length > 0 ? (
              <div className="space-y-3">
                {org.members.map((member) => (
                  <Card
                    key={member.userId}
                    className="border border-gray-200 dark:border-gray-700"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Avatar */}
                          {member.userImage ? (
                            <img
                              src={member.userImage}
                              alt={member.userName}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {getInitials(member.userName)}
                            </div>
                          )}

                          {/* Member Info */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                              {member.userName}
                            </h3>
                            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                              <Mail className="w-3 h-3" />
                              <span>{member.userEmail}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                                  member.role
                                )}`}
                              >
                                {member.role}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Joined {formatDate(member.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* View User Button */}
                        <Button
                          onClick={() => navigate(`/users/${member.userId}`)}
                          variant="outline"
                          size="sm"
                        >
                          View User →
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">No members in this organization</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
