import { gql } from '@apollo/client';

export const ADMIN_ORGANIZATION_BY_ID_QUERY = gql`
  query AdminOrganizationById($id: String!) {
    adminOrganizationById(id: $id) {
      id
      name
      slug
      logo
      createdAt
      members {
        userId
        userName
        userEmail
        userImage
        role
        createdAt
      }
      stats {
        totalForms
        totalResponses
      }
    }
  }
`;

export interface OrganizationMember {
  userId: string;
  userName: string;
  userEmail: string;
  userImage: string | null;
  role: string;
  createdAt: string;
}

export interface OrganizationStats {
  totalForms: number;
  totalResponses: number;
}

export interface AdminOrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: string;
  members: OrganizationMember[];
  stats: OrganizationStats;
}

export interface AdminOrganizationByIdQueryData {
  adminOrganizationById: AdminOrganizationDetail;
}
