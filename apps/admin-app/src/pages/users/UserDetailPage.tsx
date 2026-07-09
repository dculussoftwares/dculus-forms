import { useQuery } from '@apollo/client/react';
import { useParams, useNavigate } from 'react-router';
import { Button, LoadingSpinner } from '@dculus/ui';
import { ArrowLeft, Mail, CheckCircle2, XCircle, Building2, Calendar, Fingerprint } from 'lucide-react';
import { ADMIN_USER_BY_ID_QUERY, AdminUserByIdQueryData } from '../../graphql/users';
import { CARD_STYLE, roleBadgeStyle } from '../../lib/cardTokens';

export const UserDetailPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useQuery<AdminUserByIdQueryData>(
    ADMIN_USER_BY_ID_QUERY,
    {
      variables: { id: userId },
      skip: !userId,
    }
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-64"><LoadingSpinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 text-center">
        <h3 className="text-sm font-semibold text-primary mb-1">Error loading user</h3>
        <p className="text-xs text-muted-foreground mb-4">{error?.message || 'User not found'}</p>
        <Button onClick={() => navigate('/users')} variant="outline" size="sm">Back to Users</Button>
      </div>
    );
  }

  const user = data.adminUserById;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Back */}
      <Button
        onClick={() => navigate('/users')}
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1.5 text-xs h-7 px-2 text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Users
      </Button>

      {/* User Profile card */}
      <div className="rounded-xl bg-white p-6" style={CARD_STYLE}>
        <div className="flex items-start gap-4">
          {user.image ? (
            <img src={user.image} alt={user.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-base font-semibold shrink-0"
              style={{ backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' }}
            >
              {getInitials(user.name)}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-primary truncate">{user.name}</h1>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5">
              {user.emailVerified ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'var(--tf-green-bg)', color: 'var(--tf-green)' }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Email Verified
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)' }}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Email Not Verified
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Information card */}
      <div className="rounded-xl bg-white p-5" style={CARD_STYLE}>
        <h2 className="text-sm font-semibold text-primary mb-3">Account Information</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-lavender)' }}>
              <Fingerprint className="w-[18px] h-[18px]" style={{ color: 'var(--tf-icon-lavender-text)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="font-mono text-xs text-primary truncate">{user.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-teal)' }}>
              <Calendar className="w-[18px] h-[18px]" style={{ color: 'var(--tf-green)' }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-sm text-primary">{formatDate(user.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-salmon)' }}>
              <Calendar className="w-[18px] h-[18px]" style={{ color: 'var(--tf-dark)' }} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm text-primary">{formatDate(user.updatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Organizations card */}
      <div className="rounded-xl bg-white p-5" style={CARD_STYLE}>
        <h2 className="text-sm font-semibold text-primary mb-3">Organizations ({user.organizations.length})</h2>
        {user.organizations.length > 0 ? (
          <div className="space-y-2">
            {user.organizations.map((org) => (
              <div
                key={org.organizationId}
                className="flex items-center justify-between gap-3 rounded-lg p-3"
                style={{ border: '1px solid var(--tf-border-medium)' }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--tf-icon-gray)' }}>
                    <Building2 className="w-[18px] h-[18px] text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-primary truncate">{org.organizationName}</h3>
                    {org.organizationSlug && (
                      <p className="text-xs text-muted-foreground truncate">@{org.organizationSlug}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={roleBadgeStyle(org.role)}>
                        {org.role}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Joined {formatDate(org.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => navigate(`/organizations/${org.organizationId}`)}
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 shrink-0 text-muted-foreground hover:text-primary"
                >
                  View Details →
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--tf-faint)' }}>
              <Building2 className="w-6 h-6 text-[var(--tf-icon-gray)]" />
            </div>
            <p className="text-sm text-muted-foreground">This user is not a member of any organizations</p>
          </div>
        )}
      </div>
    </div>
  );
};
