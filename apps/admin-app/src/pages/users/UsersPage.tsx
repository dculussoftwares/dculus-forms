import React from 'react';
import { useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Users as UsersIcon, AlertCircle } from 'lucide-react';
import { Button } from '@dculus/ui';
import { ADMIN_USERS_QUERY, AdminUsersQueryData } from '../../graphql/users';
import { UsersList } from '../../components/users/UsersList';
import { UserSearchBar } from '../../components/users/UserSearchBar';

export const UsersPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data, loading, error } = useQuery<AdminUsersQueryData>(ADMIN_USERS_QUERY, {
    variables: { page: currentPage, limit, search: search || undefined },
  });

  const handleSearch = (searchTerm: string) => {
    setSearch(searchTerm);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tf-icon-teal)' }}>
          <UsersIcon className="w-5 h-5 text-[var(--tf-green)]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-primary">Users Management</h1>
          <p className="text-xs text-muted-foreground">View and manage all users across organizations</p>
        </div>
      </div>

      <UserSearchBar onSearch={handleSearch} />

      {data && (
        <div className="flex items-center justify-between rounded-xl bg-white px-5 py-3.5" style={{ border: '1px solid var(--tf-border-medium)' }}>
          <div>
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="text-2xl font-light text-primary">{data.adminUsers.totalCount}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Page {data.adminUsers.currentPage} of {data.adminUsers.totalPages}
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin mb-3" style={{ borderColor: 'var(--tf-border-strong)', borderTopColor: 'var(--tf-dark)' }} />
          <p className="text-xs text-muted-foreground">Loading users…</p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--tf-error-bg)' }}>
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm font-semibold mb-1 text-primary">Error loading users</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}

      {data && !loading && <UsersList users={data.adminUsers.users} />}

      {data && data.adminUsers.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="gap-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {currentPage} of {data.adminUsers.totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === data.adminUsers.totalPages} className="gap-1.5">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};
