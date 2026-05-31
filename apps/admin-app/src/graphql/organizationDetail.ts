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
      subscription {
        planId
        status
        viewsUsed
        submissionsUsed
        viewsLimit
        submissionsLimit
        currentPeriodStart
        currentPeriodEnd
        chargebeeCustomerId
        chargebeeSubscriptionId
      }
    }
  }
`;

export const ADMIN_CHANGE_PLAN_MUTATION = gql`
  mutation AdminChangePlan($orgId: ID!, $planId: String!) {
    adminChangePlan(orgId: $orgId, planId: $planId)
  }
`;

export const ADMIN_RESET_USAGE_MUTATION = gql`
  mutation AdminResetUsage($orgId: ID!) {
    adminResetUsage(orgId: $orgId)
  }
`;

export const ADMIN_CANCEL_SUBSCRIPTION_MUTATION = gql`
  mutation AdminCancelSubscription($orgId: ID!) {
    adminCancelSubscription(orgId: $orgId)
  }
`;

export const ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION = gql`
  mutation AdminReactivateSubscription($orgId: ID!) {
    adminReactivateSubscription(orgId: $orgId)
  }
`;

export interface OrgSubscription {
  planId: string;
  status: string;
  viewsUsed: number;
  submissionsUsed: number;
  viewsLimit: number | null;
  submissionsLimit: number | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  chargebeeCustomerId: string;
  chargebeeSubscriptionId: string | null;
}

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
  subscription: OrgSubscription | null;
}

export interface AdminOrganizationByIdQueryData {
  adminOrganizationById: AdminOrganizationDetail;
}
