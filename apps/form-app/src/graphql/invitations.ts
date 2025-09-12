import { gql } from '@apollo/client';

// Fragment for invitation data
export const INVITATION_FRAGMENT = gql`
  fragment InvitationFragment on Invitation {
    id
    email
    role
    status
    expiresAt
    createdAt
    updatedAt
    organization {
      id
      name
      slug
      logo
    }
    inviter {
      id
      name
      email
    }
  }
`;

// Queries
export const GET_ORGANIZATION_INVITATIONS = gql`
  ${INVITATION_FRAGMENT}
  query GetOrganizationInvitations($organizationId: ID!) {
    organizationInvitations(organizationId: $organizationId) {
      ...InvitationFragment
    }
  }
`;

export const GET_INVITATION = gql`
  ${INVITATION_FRAGMENT}
  query GetInvitation($id: ID!) {
    invitation(id: $id) {
      ...InvitationFragment
    }
  }
`;

// Mutations
export const INVITE_USER = gql`
  ${INVITATION_FRAGMENT}
  mutation InviteUser($input: InviteUserInput!) {
    inviteUser(input: $input) {
      ...InvitationFragment
    }
  }
`;

export const ACCEPT_INVITATION = gql`
  ${INVITATION_FRAGMENT}
  mutation AcceptInvitation($invitationId: ID!) {
    acceptInvitation(invitationId: $invitationId) {
      ...InvitationFragment
    }
  }
`;

export const REJECT_INVITATION = gql`
  ${INVITATION_FRAGMENT}
  mutation RejectInvitation($invitationId: ID!) {
    rejectInvitation(invitationId: $invitationId) {
      ...InvitationFragment
    }
  }
`;

export const CANCEL_INVITATION = gql`
  ${INVITATION_FRAGMENT}
  mutation CancelInvitation($invitationId: ID!) {
    cancelInvitation(invitationId: $invitationId) {
      ...InvitationFragment
    }
  }
`;

// Types
export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo?: string;
  };
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export interface InviteUserInput {
  organizationId: string;
  email: string;
  role?: string;
}

export interface InviteUserVariables {
  input: InviteUserInput;
}

export interface GetOrganizationInvitationsVariables {
  organizationId: string;
}

export interface GetInvitationVariables {
  id: string;
}

export interface AcceptInvitationVariables {
  invitationId: string;
}

export interface RejectInvitationVariables {
  invitationId: string;
}

export interface CancelInvitationVariables {
  invitationId: string;
}