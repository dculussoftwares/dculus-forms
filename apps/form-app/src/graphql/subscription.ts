import { gql } from '@apollo/client';
import type { TypedDocumentNode } from '@apollo/client';

/**
 * GraphQL Operations for Subscription Management
 */

// Get available subscription plans
export const GET_AVAILABLE_PLANS : TypedDocumentNode<any, any> = gql`
  query GetAvailablePlans {
    availablePlans {
      id
      name
      description
      prices {
        id
        currency
        amount
        period
      }
      features {
        views
        submissions
      }
    }
  }
`;

// Get current organization subscription
export const GET_SUBSCRIPTION : TypedDocumentNode<any, any> = gql`
  query GetSubscription {
    activeOrganization {
      id
      name
      subscription {
        id
        planId
        status
        viewsUsed
        submissionsUsed
        viewsLimit
        submissionsLimit
        currentPeriodStart
        currentPeriodEnd
        enterprisePendingActivation
        usage {
          views {
            used
            limit
            unlimited
            percentage
            exceeded
          }
          submissions {
            used
            limit
            unlimited
            percentage
            exceeded
          }
        }
      }
    }
  }
`;

// Get organization daily usage
export const GET_ORG_DAILY_USAGE: TypedDocumentNode<any, any> = gql`
  query GetOrgDailyUsage($organizationId: ID!, $periodStart: String!, $periodEnd: String!) {
    orgDailyUsage(organizationId: $organizationId, periodStart: $periodStart, periodEnd: $periodEnd) {
      date
      views
      submissions
    }
  }
`;

// Create checkout session for upgrade
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CREATE_CHECKOUT_SESSION: TypedDocumentNode<any, any> = gql`
  mutation CreateCheckoutSession($itemPriceId: String!) {
    createCheckoutSession(itemPriceId: $itemPriceId) {
      url
      hostedPageId
    }
  }
`;

// Create portal session for subscription management
export const CREATE_PORTAL_SESSION : TypedDocumentNode<any, any> = gql`
  mutation CreatePortalSession {
    createPortalSession {
      url
    }
  }
`;

// Regenerate a Chargebee checkout hosted page for a pending (unpaid)
// Enterprise deal — see Subscription.enterprisePendingActivation
export const COMPLETE_ENTERPRISE_PAYMENT: TypedDocumentNode<any, any> = gql`
  mutation CompleteEnterprisePayment {
    completeEnterprisePayment {
      url
      hostedPageId
    }
  }
`;

// Initialize organization subscription (called after signup)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const INITIALIZE_ORGANIZATION_SUBSCRIPTION: TypedDocumentNode<any, any> = gql`
  mutation InitializeOrganizationSubscription($organizationId: ID!) {
    initializeOrganizationSubscription(organizationId: $organizationId) {
      success
      message
      subscription {
        id
        planId
        status
        viewsLimit
        submissionsLimit
      }
    }
  }
`;

// Get AI token usage for organization
export const GET_AI_TOKEN_USAGE : TypedDocumentNode<any, any> = gql`
  query GetAITokenUsage($organizationId: ID!) {
    aiTokenUsage(organizationId: $organizationId) {
      used
      limit
      resetAt
      creditsUsed
      creditsLimit
    }
  }
`;
