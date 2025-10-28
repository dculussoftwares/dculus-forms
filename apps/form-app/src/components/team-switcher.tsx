import { useState, useMemo } from 'react';
import { ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client';
import { gql } from '@apollo/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  toastSuccess,
  toastError,
} from '@dculus/ui';
import { useAuth } from '../contexts/AuthContext';

const GET_USER_ORGANIZATIONS = gql`
  query GetUserOrganizations {
    me {
      id
      organizations {
        id
        name
        slug
        logo
      }
    }
  }
`;

const SET_ACTIVE_ORGANIZATION = gql`
  mutation SetActiveOrganization($organizationId: ID!) {
    setActiveOrganization(organizationId: $organizationId) {
      id
      name
      slug
      logo
    }
  }
`;

export function TeamSwitcher() {
  const { isMobile } = useSidebar();
  const { activeOrganization } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Query user's organizations
  const { data: orgsData } = useQuery(GET_USER_ORGANIZATIONS, {
    fetchPolicy: 'cache-and-network',
  });

  // Mutation to set active organization
  const [setActiveOrganization] = useMutation(SET_ACTIVE_ORGANIZATION, {
    refetchQueries: ['ActiveOrganization'],
    onCompleted: () => {
      setIsLoading(false);
      toastSuccess('Organization switched', 'You are now working in the new organization');
    },
    onError: (error) => {
      setIsLoading(false);
      toastError('Failed to switch organization', error.message);
    },
  });

  const organizations = useMemo(() => {
    return orgsData?.me?.organizations || [];
  }, [orgsData]);

  const handleOrganizationSwitch = async (orgId: string) => {
    if (orgId === activeOrganization?.id) return;

    setIsLoading(true);
    await setActiveOrganization({
      variables: { organizationId: orgId },
    });
  };

  if (!activeOrganization) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isLoading}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeOrganization.logo ? (
                  <img
                    src={activeOrganization.logo}
                    alt={activeOrganization.name}
                    className="size-4 rounded"
                  />
                ) : (
                  <Building2 className="size-4" />
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeOrganization.name}
                </span>
                <span className="truncate text-xs">Active Organization</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org: any, index: number) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleOrganizationSwitch(org.id)}
                className="gap-2 p-2"
                disabled={isLoading || org.id === activeOrganization.id}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="size-4 rounded shrink-0"
                    />
                  ) : (
                    <Building2 className="size-4 shrink-0" />
                  )}
                </div>
                <span className={org.id === activeOrganization.id ? 'font-semibold' : ''}>
                  {org.name}
                </span>
                {index < 9 && <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 p-2"
              onClick={() => {
                // TODO: Navigate to create organization page
                toastError('Coming soon', 'Organization creation will be available soon');
              }}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">
                Add Organization
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
