import { gql } from '@apollo/client';

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers($page: Int, $limit: Int, $search: String) {
    adminUsers(page: $page, limit: $limit, search: $search) {
      users {
        id
        name
        email
        emailVerified
        image
        createdAt
        updatedAt
        organizations {
          organizationId
          organizationName
          organizationSlug
          role
          createdAt
        }
      }
      totalCount
      currentPage
      totalPages
    }
  }
`;

export const ADMIN_USER_BY_ID_QUERY = gql`
  query AdminUserById($id: String!) {
    adminUserById(id: $id) {
      id
      name
      email
      emailVerified
      image
      createdAt
      updatedAt
      organizations {
        organizationId
        organizationName
        organizationSlug
        role
        createdAt
      }
    }
  }
`;

export interface UserOrganizationMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  role: string;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  organizations: UserOrganizationMembership[];
}

export interface AdminUsersResponse {
  users: AdminUserDetail[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface AdminUsersQueryData {
  adminUsers: AdminUsersResponse;
}

export interface AdminUserByIdQueryData {
  adminUserById: AdminUserDetail;
}
