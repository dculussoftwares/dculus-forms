import { AdminUserDetail } from '../../graphql/users';
import { UserCard } from './UserCard';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@dculus/ui';
import { Users } from 'lucide-react';

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
      <EmptyState
        icon={<Users className="h-6 w-6 text-[#655d67]" />}
        title="No users found"
        description="Try adjusting your search criteria"
      />
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
