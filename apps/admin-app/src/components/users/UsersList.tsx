import { AdminUserDetail } from '../../graphql/users';
import { UserCard } from './UserCard';
import { useNavigate } from 'react-router-dom';

interface UsersListProps {
  users: AdminUserDetail[];
}

export const UsersList = ({ users }: UsersListProps) => {
  const navigate = useNavigate();

  const handleViewDetails = (userId: string) => {
    navigate(`/users/${userId}`);
  };

  const handleViewOrganization = (orgId: string) => {
    navigate(`/organizations/${orgId}`);
  };

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
          No users found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Try adjusting your search criteria
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onViewDetails={() => handleViewDetails(user.id)}
          onViewOrganization={handleViewOrganization}
        />
      ))}
    </div>
  );
};
