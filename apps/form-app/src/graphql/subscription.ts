import { gql } from '@apollo/client';

/**
 * GraphQL Operations for Subscription Management
 */

// Get available subscription plans
export const GET_AVAILABLE_PLANS = gql`
  query GetAvailablePlans {
    availablePlans {
      id
      name
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
export const GET_SUBSCRIPTION = gql`
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

// Create checkout session for upgrade
export const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($itemPriceId: String!) {
    createCheckoutSession(itemPriceId: $itemPriceId) {
      url
      hostedPageId
    }
  }
`;

// Create portal session for subscription management
export const CREATE_PORTAL_SESSION = gql`
  mutation CreatePortalSession {
    createPortalSession {
      url
    }
  }
`;

// Initialize organization subscription (called after signup)
export const INITIALIZE_ORGANIZATION_SUBSCRIPTION = gql`
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
