/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const ADMIN_ORGANIZATION_BY_ID_QUERY : TypedDocumentNode<any, any> = gql`
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
        aiCreditsLimit
        currentPeriodStart
        currentPeriodEnd
        chargebeeCustomerId
        chargebeeSubscriptionId
      }
    }
  }
`;

export const ADMIN_SET_ENTERPRISE_PLAN_MUTATION : TypedDocumentNode<any, any> = gql`
  mutation AdminSetEnterprisePlan(
    $orgId: ID!
    $currency: String!
    $period: String!
    $priceInSmallestUnit: Int!
    $viewsLimit: Int
    $submissionsLimit: Int
    $aiCreditsLimit: Int
  ) {
    adminSetEnterprisePlan(
      orgId: $orgId
      currency: $currency
      period: $period
      priceInSmallestUnit: $priceInSmallestUnit
      viewsLimit: $viewsLimit
      submissionsLimit: $submissionsLimit
      aiCreditsLimit: $aiCreditsLimit
    ) {
      requiresPayment
      checkoutUrl
    }
  }
`;

export const ADMIN_RESET_USAGE_MUTATION : TypedDocumentNode<any, any> = gql`
  mutation AdminResetUsage($orgId: ID!) {
    adminResetUsage(orgId: $orgId)
  }
`;

export const ADMIN_CANCEL_SUBSCRIPTION_MUTATION : TypedDocumentNode<any, any> = gql`
  mutation AdminCancelSubscription($orgId: ID!) {
    adminCancelSubscription(orgId: $orgId)
  }
`;

export const ADMIN_REACTIVATE_SUBSCRIPTION_MUTATION : TypedDocumentNode<any, any> = gql`
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
  aiCreditsLimit: number | null;
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
