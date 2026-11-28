import { gql } from '@apollo/client';

export const GET_ORGANIZATION_BRAND_KIT = gql`
  query GetOrganizationBrandKit($organizationId: ID!) {
    organizationBrandKit(organizationId: $organizationId) {
      id
      organizationId
      tokens
      updatedAt
    }
  }
`;

export const SAVE_ORGANIZATION_BRAND_KIT = gql`
  mutation SaveOrganizationBrandKit($organizationId: ID!, $tokens: JSON!) {
    saveOrganizationBrandKit(organizationId: $organizationId, tokens: $tokens) {
      id
      organizationId
      tokens
      updatedAt
    }
  }
`;

export const DELETE_ORGANIZATION_BRAND_KIT = gql`
  mutation DeleteOrganizationBrandKit($organizationId: ID!) {
    deleteOrganizationBrandKit(organizationId: $organizationId)
  }
`;
