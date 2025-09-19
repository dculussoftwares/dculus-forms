import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Avatar,
  AvatarFallback,
  AvatarImage,
  toastError
} from '@dculus/ui';
import { ChevronDown, Building2, Check, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { GET_USER_ORGANIZATIONS } from '../graphql/queries';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  members?: Array<{
    id: string;
    role: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export const OrganizationSwitcher: React.FC = () => {
  const { activeOrganization, setActiveOrganization, user, organizationError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const { data: userOrgsData, loading: orgsLoading } = useQuery(GET_USER_ORGANIZATIONS, {
    skip: !user,
    errorPolicy: 'all',
  });

  const organizations: Organization[] = userOrgsData?.me?.organizations || [];

  const handleOrganizationSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganization?.id) return;

    setIsLoading(true);
    try {
      const success = await setActiveOrganization(organizationId);
      if (!success) {
        toastError('Failed to switch organization', 'Please try again');
      }
    } catch (error) {
      console.error('Error switching organization:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show error state if there's an organization error
  if (organizationError && !orgsLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-destructive/10 text-destructive">
        <Building2 className="h-4 w-4" />
        <span className="text-sm font-medium">Organization Error</span>
      </div>
    );
  }

  // Show loading state
  if (orgsLoading || isLoading) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  // Show no organizations state
  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">No Organizations</span>
      </div>
    );
  }

  const getOrganizationInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserRole = (org: Organization): string => {
    if (!user || !org.members) return 'Member';

    const membership = org.members.find(member => member.user.id === user.id);
    if (!membership) return 'Member';

    switch (membership.role) {
      case 'companyOwner':
        return 'Owner';
      case 'companyMember':
        return 'Member';
      default:
        return membership.role;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-2 h-auto"
          disabled={isLoading}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6">
              <AvatarImage src={activeOrganization?.logo || undefined} alt={activeOrganization?.name} />
              <AvatarFallback className="text-xs">
                {activeOrganization ? getOrganizationInitials(activeOrganization.name) : 'ORG'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">
                {activeOrganization?.name || 'Select Organization'}
              </div>
              {activeOrganization && (
                <div className="text-xs text-muted-foreground truncate">
                  {getUserRole(activeOrganization)}
                </div>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => handleOrganizationSwitch(org.id)}
            className="flex items-center gap-2 p-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={org.logo || undefined} alt={org.name} />
              <AvatarFallback className="text-xs">
                {getOrganizationInitials(org.name)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{org.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {getUserRole(org)}
              </div>
            </div>

            {activeOrganization?.id === org.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            // Navigate to create organization or show create dialog
            window.location.href = '/settings?tab=organizations';
          }}
          className="flex items-center gap-2 p-2"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">Create Organization</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};