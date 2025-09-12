import { gql } from '@apollo/client';

export const GET_INVITATION = gql`
  query GetInvitation($id: ID!) {
    invitation(id: $id) {
      id
      email
      role
      status
      expiresAt
      organizationName
      inviterName
    }
  }
`;