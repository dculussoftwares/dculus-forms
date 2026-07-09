/* eslint-disable @typescript-eslint/no-explicit-any */
import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

export const ADMIN_PLANS_QUERY: TypedDocumentNode<any, any> = gql`
  query AdminPlans {
    adminPlans {
      id
      name
      description
      status
      visibleOnPricingPage
      prices {
        id
        currency
        period
        priceInSmallestUnit
        status
      }
      limits {
        views
        submissions
        aiCredits
      }
      subscriberCount
    }
  }
`;

export const ADMIN_CREATE_PLAN_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminCreatePlan($input: AdminCreatePlanInput!) {
    adminCreatePlan(input: $input) {
      id
    }
  }
`;

export const ADMIN_UPDATE_PLAN_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminUpdatePlan($input: AdminUpdatePlanInput!) {
    adminUpdatePlan(input: $input) {
      id
    }
  }
`;

export const ADMIN_ARCHIVE_PLAN_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminArchivePlan($planId: String!) {
    adminArchivePlan(planId: $planId)
  }
`;

export const ADMIN_UNARCHIVE_PLAN_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminUnarchivePlan($planId: String!) {
    adminUnarchivePlan(planId: $planId)
  }
`;

export const ADMIN_ASSIGN_PLAN_MUTATION: TypedDocumentNode<any, any> = gql`
  mutation AdminAssignPlan($orgId: ID!, $planId: String!) {
    adminAssignPlan(orgId: $orgId, planId: $planId)
  }
`;

export interface AdminPlanPrice {
  id: string;
  currency: string;
  period: 'monthly' | 'yearly';
  priceInSmallestUnit: number;
  status: 'active' | 'archived';
}

export interface AdminPlanLimits {
  views: number | null;
  submissions: number | null;
  aiCredits: number | null;
}

export interface AdminPlan {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  visibleOnPricingPage: boolean;
  prices: AdminPlanPrice[];
  limits: AdminPlanLimits;
  subscriberCount: number;
}

export interface AdminPlansQueryData {
  adminPlans: AdminPlan[];
}
