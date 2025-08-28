import { gql } from '@apollo/client';

export const ADMIN_ORGANIZATIONS_QUERY = gql`
  query AdminOrganizations($limit: Int, $offset: Int) {
    adminOrganizations(limit: $limit, offset: $offset) {
      organizations {
        id
        name
        slug
        logo
        createdAt
        updatedAt
        memberCount
        formCount
      }
      total
      hasMore
    }
  }
`;

export const ADMIN_ORGANIZATION_QUERY = gql`
  query AdminOrganization($id: ID!) {
    adminOrganization(id: $id) {
      id
      name
      slug
      logo
      createdAt
      updatedAt
      memberCount
      formCount
      members {
        id
        role
        user {
          id
          name
          email
        }
        createdAt
      }
      forms {
        id
        title
        isPublished
        createdAt
      }
    }
  }
`;

export const ADMIN_STATS_QUERY = gql`
  query AdminStats {
    adminStats {
      organizationCount
      userCount
      formCount
      responseCount
    }
  }
`;