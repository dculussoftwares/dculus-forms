import { gql } from '@apollo/client';

export const ACTIVE_ORGANIZATION = gql`
  query ActiveOrganization {
    activeOrganization {
      id
      name
      slug
      logo
      members {
        id
        role
        user {
          id
          name
          email
        }
      }
    }
  }
`;
