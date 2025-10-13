import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { Button } from '@dculus/ui';
import { Users as UsersIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { ADMIN_USERS_QUERY, AdminUsersQueryData } from '../../graphql/users';
import { UsersList } from '../../components/users/UsersList';
import { UserSearchBar } from '../../components/users/UserSearchBar';

export const UsersPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, loading, error } = useQuery<AdminUsersQueryData>(ADMIN_USERS_QUERY, {
    variables: {
      page: currentPage,
      limit,
      search: search || undefined,
    },
  });

  const handleSearch = (searchTerm: string) => {
    setSearch(searchTerm);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (data && currentPage < data.adminUsers.totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <UsersIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Users Management
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage all users across organizations
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <UserSearchBar onSearch={handleSearch} />
        </div>

        {/* Stats */}
        {data && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.adminUsers.totalCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page {data.adminUsers.currentPage} of {data.adminUsers.totalPages}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
                Error loading users
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {error.message}
              </p>
            </div>
          </div>
        )}

        {/* Users List */}
        {data && !loading && <UsersList users={data.adminUsers.users} />}

        {/* Pagination */}
        {data && data.adminUsers.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {data.adminUsers.totalPages}
            </span>
            <Button
              onClick={handleNextPage}
              disabled={currentPage === data.adminUsers.totalPages}
              variant="outline"
              className="flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
