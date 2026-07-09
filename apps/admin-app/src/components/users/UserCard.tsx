import { Button } from '@dculus/ui';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';
import { AdminUserDetail } from '../../graphql/users';

interface UserCardProps {
  user: AdminUserDetail;
  onViewDetails: () => void;
  onViewOrganization: (orgId: string) => void;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid var(--tf-border-medium)', boxShadow: '0 1px 4px var(--tf-overlay)' };

const roleBadgeStyle = (role: string): React.CSSProperties => {
  switch (role.toLowerCase()) {
    case 'owner': return { backgroundColor: 'var(--tf-icon-lavender)', color: '#5c2e6b' };
    case 'admin': return { backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' };
    default:      return { backgroundColor: 'var(--tf-faint)', color: 'var(--tf-muted)' };
  }
};

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

  return (
    <div className="rounded-xl bg-white p-5 flex flex-col" style={CARD_STYLE}>
      {/* User Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        {user.image ? (
          <img
            src={user.image}
            alt={user.name}
            className="w-11 h-11 rounded-full object-cover shrink-0"
          />
        ) : (
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ backgroundColor: 'var(--tf-icon-salmon)', color: 'var(--tf-dark)' }}
          >
            {getInitials(user.name)}
          </div>
        )}

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-primary truncate">
            {user.name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {user.emailVerified ? (
              <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--tf-green)' }}>
                <CheckCircle2 className="w-3 h-3" />
                <span>Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <XCircle className="w-3 h-3" />
                <span>Not Verified</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--tf-border-medium)' }} className="my-3" />

      {/* Organizations */}
      <div className="space-y-2 mb-3 flex-1">
        <h4 className="text-xs font-medium text-muted-foreground">
          Organizations {user.organizations.length > 0 && `(${user.organizations.length})`}
        </h4>
        {user.organizations.length > 0 ? (
          <div className="space-y-1.5">
            {user.organizations.slice(0, 3).map((org) => (
              <div
                key={org.organizationId}
                className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--tf-faint)' }}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-primary truncate font-medium">
                    {org.organizationName}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                    style={roleBadgeStyle(org.role)}
                  >
                    {org.role}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewOrganization(org.organizationId)}
                  className="text-[11px] shrink-0 h-auto p-0"
                  style={{ color: 'var(--tf-green)' }}
                >
                  View Org →
                </Button>
              </div>
            ))}
            {user.organizations.length > 3 && (
              <p className="text-[11px] text-muted-foreground text-center">
                +{user.organizations.length - 3} more
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No organizations
          </p>
        )}
      </div>

      {/* Metadata */}
      <div className="text-[11px] text-muted-foreground mb-3">
        Joined: {formatDate(user.createdAt)}
      </div>

      {/* Actions */}
      <Button
        onClick={onViewDetails}
        className="w-full text-xs"
        variant="outline"
        size="sm"
      >
        View Details →
      </Button>
    </div>
  );
};
