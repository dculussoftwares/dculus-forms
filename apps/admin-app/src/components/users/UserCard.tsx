import { Card, CardContent, Button } from '@dculus/ui';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';
import { AdminUserDetail } from '../../graphql/users';

interface UserCardProps {
  user: AdminUserDetail;
  onViewDetails: () => void;
  onViewOrganization: (orgId: string) => void;
}

export const UserCard = ({ user, onViewDetails, onViewOrganization }: UserCardProps) => {
  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Get role badge color
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

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardContent className="p-6">
        {/* User Header */}
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {user.image ? (
              <img
                src={user.image}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                {getInitials(user.name)}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {user.emailVerified ? (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <XCircle className="w-3 h-3" />
                  <span>Not Verified</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-4" />

        {/* Organizations */}
        <div className="space-y-2 mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Organizations {user.organizations.length > 0 && `(${user.organizations.length})`}
          </h4>
          {user.organizations.length > 0 ? (
            <div className="space-y-2">
              {user.organizations.slice(0, 3).map((org) => (
                <div
                  key={org.organizationId}
                  className="flex items-center justify-between text-sm p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    <span className="text-gray-900 dark:text-gray-100 truncate font-medium">
                      {org.organizationName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                        org.role
                      )}`}
                    >
                      {org.role}
                    </span>
                  </div>
                  <button
                    onClick={() => onViewOrganization(org.organizationId)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0 ml-2"
                  >
                    View Org →
                  </button>
                </div>
              ))}
              {user.organizations.length > 3 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  +{user.organizations.length - 3} more
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No organizations
            </p>
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Joined: {formatDate(user.createdAt)}
        </div>

        {/* Actions */}
        <Button
          onClick={onViewDetails}
          className="w-full"
          variant="outline"
        >
          View Details →
        </Button>
      </CardContent>
    </Card>
  );
};
