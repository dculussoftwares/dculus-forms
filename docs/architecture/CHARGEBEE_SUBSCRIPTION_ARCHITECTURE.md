# Chargebee Subscription Architecture

## Overview

The Dculus Forms subscription system integrates Chargebee using an **event-driven architecture** to manage tiered pricing plans with usage-based limits. The system tracks form views and submissions in real-time, enforces hard limits, and provides a comprehensive subscription management UI—all while maintaining high performance through asynchronous processing and intelligent caching.

## Core Principles

1. **Event-Driven** - Usage tracking happens asynchronously via events (similar to plugin system)
2. **Extend Existing Queries** - Subscription data is part of Organization type (no new GraphQL queries)
3. **Non-Blocking** - Chargebee API calls happen in background, don't block user actions
4. **Local Caching** - Usage counters cached locally for performance, synced to Chargebee periodically
5. **Hard Limits** - Enforce limits at application level before allowing views/submissions
6. **Auto-Upgrade UI** - Upgrade modals trigger automatically based on usage data already loaded
7. **Multi-Currency** - Support INR and USD pricing via Chargebee price points

---

## Subscription Plans

### Free Plan
- **Price**: $0/month (0 INR / 0 USD)
- **Form Views**: 10,000 views per month
- **Form Submissions**: 1,000 submissions per month
- **Features**: Basic form building, analytics, collaboration

### Starter Plan
- **Price**: $6/month (489 INR / 6 USD)
- **Form Views**: Unlimited
- **Form Submissions**: 10,000 submissions per month
- **Features**: All Free features + priority support

### Advanced Plan
- **Price**: $15/month (1,289 INR / 15 USD)
- **Form Views**: Unlimited
- **Form Submissions**: 100,000 submissions per month
- **Features**: All Starter features + advanced analytics, API access, white-labeling

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     User Actions                                │
│         (View Form, Submit Response)                            │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   │ Check Limits (Synchronous)
                   ▼
┌────────────────────────────────────────────────────────────────┐
│               Subscription Limit Guard                          │
│   1. Query local subscription cache                            │
│   2. Check if limit exceeded                                   │
│   3. Allow or block action                                     │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   │ If allowed, emit event (Asynchronous)
                   ▼
┌────────────────────────────────────────────────────────────────┐
│              Subscription Event Emitter                         │
│         (Node.js EventEmitter pattern)                          │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   │ Event listeners
                   ▼
┌────────────────────────────────────────────────────────────────┐
│            Subscription Usage Service                           │
│   1. Increment local usage counter (Prisma)                    │
│   2. Queue usage for Chargebee sync                            │
│   3. Check if approaching limits                               │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   │ Background worker (every 5 min)
                   ▼
┌────────────────────────────────────────────────────────────────┐
│                Chargebee Service                                │
│   - Batch usage reports to Chargebee API                       │
│   - Create/update subscriptions                                │
│   - Process webhooks                                            │
│   - Sync subscription status                                   │
└────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Subscription Model

```prisma
model Subscription {
  id                      String    @id @map("_id")
  organizationId          String    @unique
  chargebeeCustomerId     String    // Chargebee customer ID
  chargebeeSubscriptionId String?   // Chargebee subscription ID (null for free plan)

  // Plan information
  planId                  String    // 'free', 'starter', 'advanced'
  status                  String    // 'active', 'cancelled', 'expired', 'past_due'

  // Usage tracking (local cache for performance)
  viewsUsed               Int       @default(0)
  submissionsUsed         Int       @default(0)
  viewsLimit              Int?      // null = unlimited
  submissionsLimit        Int?      // null = unlimited

  // Billing period (resets usage counters)
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime

  // Metadata
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // Relations
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([organizationId])
  @@index([status])
  @@index([planId])
  @@map("subscription")
}
```

**Key Fields:**
- `chargebeeCustomerId` - Links to Chargebee customer record
- `chargebeeSubscriptionId` - Links to Chargebee subscription (null for free plan)
- `planId` - Internal plan identifier ('free', 'starter', 'advanced')
- `status` - Subscription status synced from Chargebee
- `viewsUsed` / `submissionsUsed` - Local usage counters (reset monthly)
- `viewsLimit` / `submissionsLimit` - Plan limits (null = unlimited)

---

## Event System

### Event Types

| Event Type | When Triggered | Payload Data | Usage Impact |
|------------|---------------|--------------|--------------|
| `subscription.view` | User views form | `{ formId, organizationId }` | Increment views counter |
| `subscription.submit` | User submits response | `{ formId, organizationId, responseId }` | Increment submissions counter |
| `subscription.created` | New subscription created | `{ organizationId, planId }` | Initialize usage counters |
| `subscription.upgraded` | Plan upgraded | `{ organizationId, oldPlanId, newPlanId }` | Update limits |
| `subscription.cancelled` | Subscription cancelled | `{ organizationId }` | Move to free plan |
| `subscription.period_end` | Billing period ends | `{ organizationId }` | Reset usage counters |

### Event Flow

```typescript
// apps/backend/src/events/subscription-events.ts

import { EventEmitter } from 'events';

// Create singleton event emitter
const subscriptionEventEmitter = new EventEmitter();
subscriptionEventEmitter.setMaxListeners(100);

/**
 * Emit form.viewed event
 * Triggered when a user views a form
 */
export const emitFormViewed = (
  formId: string,
  organizationId: string
): void => {
  const event = {
    type: 'subscription.view',
    formId,
    organizationId,
    timestamp: new Date(),
  };

  subscriptionEventEmitter.emit('subscription:event', event);
};

/**
 * Emit form.submitted event
 * Triggered when a user submits a form response
 */
export const emitFormSubmitted = (
  formId: string,
  organizationId: string,
  responseId: string
): void => {
  const event = {
    type: 'subscription.submit',
    formId,
    organizationId,
    data: { responseId },
    timestamp: new Date(),
  };

  subscriptionEventEmitter.emit('subscription:event', event);
};

/**
 * Initialize subscription event system
 * Sets up event listeners that process subscription events
 */
export const initializeSubscriptionEvents = (): void => {
  console.log('[Subscription Events] Initializing...');

  // Listen for all subscription events
  subscriptionEventEmitter.on('subscription:event', async (event) => {
    console.log(`[Subscription Events] Event: ${event.type}`, {
      organizationId: event.organizationId,
    });

    try {
      await processSubscriptionEvent(event);
    } catch (error: any) {
      console.error('[Subscription Events] Error:', error);
    }
  });

  console.log('[Subscription Events] Initialized successfully');
};
```

---

## Usage Tracking Service

### Subscription Usage Service

```typescript
// apps/backend/src/services/subscriptionUsageService.ts

import { prisma } from '../lib/prisma.js';
import { reportUsageToChargebee } from './chargebeeService.js';

/**
 * Process subscription events
 * Handles view and submission events
 */
export const processSubscriptionEvent = async (event: SubscriptionEvent) => {
  if (event.type === 'subscription.view') {
    await incrementViewCount(event.organizationId, event.formId);
  }

  if (event.type === 'subscription.submit') {
    await incrementSubmissionCount(event.organizationId, event.formId);
  }
};

/**
 * Increment view count for organization
 * Checks limit before incrementing
 */
export const incrementViewCount = async (
  organizationId: string,
  formId: string
): Promise<void> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId }
  });

  if (!subscription) {
    console.error(`No subscription found for organization: ${organizationId}`);
    return;
  }

  // Check if limit already exceeded (defensive check)
  if (subscription.viewsLimit && subscription.viewsUsed >= subscription.viewsLimit) {
    console.warn(`[Usage] Organization ${organizationId} exceeded view limit`);
    return;
  }

  // Increment local counter
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      viewsUsed: { increment: 1 },
      updatedAt: new Date()
    }
  });

  // Queue for Chargebee sync (non-blocking)
  await reportUsageToChargebee(
    subscription.chargebeeSubscriptionId,
    'form_views',
    1
  );

  console.log(`[Usage] View count incremented for org ${organizationId}: ${subscription.viewsUsed + 1}`);
};

/**
 * Increment submission count for organization
 * Checks limit before incrementing
 */
export const incrementSubmissionCount = async (
  organizationId: string,
  formId: string
): Promise<void> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId }
  });

  if (!subscription) {
    console.error(`No subscription found for organization: ${organizationId}`);
    return;
  }

  // Check if limit already exceeded (defensive check)
  if (subscription.submissionsLimit &&
      subscription.submissionsUsed >= subscription.submissionsLimit) {
    console.warn(`[Usage] Organization ${organizationId} exceeded submission limit`);
    return;
  }

  // Increment local counter
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      submissionsUsed: { increment: 1 },
      updatedAt: new Date()
    }
  });

  // Queue for Chargebee sync (non-blocking)
  await reportUsageToChargebee(
    subscription.chargebeeSubscriptionId,
    'form_submissions',
    1
  );

  console.log(`[Usage] Submission count incremented for org ${organizationId}: ${subscription.submissionsUsed + 1}`);
};

/**
 * Check if organization can view forms
 * Returns false if view limit exceeded
 */
export const canViewForm = async (organizationId: string): Promise<boolean> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId }
  });

  if (!subscription) {
    return false;
  }

  // Unlimited views
  if (!subscription.viewsLimit) {
    return true;
  }

  // Check limit
  return subscription.viewsUsed < subscription.viewsLimit;
};

/**
 * Check if organization can submit forms
 * Returns false if submission limit exceeded
 */
export const canSubmitForm = async (organizationId: string): Promise<boolean> => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId }
  });

  if (!subscription) {
    return false;
  }

  // Unlimited submissions
  if (!subscription.submissionsLimit) {
    return true;
  }

  // Check limit
  return subscription.submissionsUsed < subscription.submissionsLimit;
};

/**
 * Reset usage counters for new billing period
 * Called when subscription period ends
 */
export const resetUsageCounters = async (organizationId: string): Promise<void> => {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      viewsUsed: 0,
      submissionsUsed: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
      updatedAt: new Date()
    }
  });

  console.log(`[Usage] Usage counters reset for organization ${organizationId}`);
};
```

---

## GraphQL Schema Extensions

### Extend Organization Type

```graphql
type Organization {
  id: ID!
  name: String!
  slug: String!
  logo: String
  createdAt: String!
  updatedAt: String!
  members: [Member!]!

  # NEW: Subscription information
  subscription: Subscription
}

type Subscription {
  id: ID!
  planId: String!
  planName: String!          # "Free", "Starter", "Advanced"
  status: String!            # "active", "cancelled", "expired", "past_due"

  # Usage tracking
  viewsUsed: Int!
  submissionsUsed: Int!
  viewsLimit: Int            # null = unlimited
  submissionsLimit: Int      # null = unlimited

  # Computed fields
  viewsRemaining: Int        # viewsLimit - viewsUsed (null if unlimited)
  submissionsRemaining: Int  # submissionsLimit - submissionsUsed (null if unlimited)
  viewsPercentage: Float!    # (viewsUsed / viewsLimit) * 100
  submissionsPercentage: Float! # (submissionsUsed / submissionsLimit) * 100
  isViewLimitExceeded: Boolean!
  isSubmissionLimitExceeded: Boolean!
  isLimitExceeded: Boolean!  # Either limit exceeded

  # Billing period
  currentPeriodStart: DateTime!
  currentPeriodEnd: DateTime!

  # Metadata
  createdAt: DateTime!
  updatedAt: DateTime!
}

# Subscription management mutations
type Mutation {
  # Create checkout session for plan upgrade
  createCheckoutSession(planId: String!): CheckoutSession!

  # Upgrade/downgrade subscription
  updateSubscription(planId: String!): Subscription!

  # Cancel subscription (moves to free plan)
  cancelSubscription: Subscription!

  # Update payment method
  updatePaymentMethod: PaymentMethod!
}

type CheckoutSession {
  url: String!           # Chargebee hosted checkout URL
  sessionId: String!     # Session identifier
}

type PaymentMethod {
  id: String!
  type: String!          # "card", "paypal", etc.
  last4: String          # Last 4 digits of card
  expiryMonth: Int
  expiryYear: Int
  brand: String          # "Visa", "Mastercard", etc.
}
```

### GraphQL Resolvers

```typescript
// apps/backend/src/graphql/resolvers/subscription.ts

import { GraphQLError } from 'graphql';
import { prisma } from '../../lib/prisma.js';
import { createCheckoutSession, updateSubscription, cancelSubscription } from '../../services/subscriptionService.js';

export const subscriptionResolvers = {
  Organization: {
    subscription: async (parent: any) => {
      return await prisma.subscription.findUnique({
        where: { organizationId: parent.id }
      });
    }
  },

  Subscription: {
    planName: (parent: any) => {
      const planNames: Record<string, string> = {
        free: 'Free',
        starter: 'Starter',
        advanced: 'Advanced'
      };
      return planNames[parent.planId] || parent.planId;
    },

    viewsRemaining: (parent: any) => {
      if (!parent.viewsLimit) return null; // Unlimited
      return Math.max(0, parent.viewsLimit - parent.viewsUsed);
    },

    submissionsRemaining: (parent: any) => {
      if (!parent.submissionsLimit) return null; // Unlimited
      return Math.max(0, parent.submissionsLimit - parent.submissionsUsed);
    },

    viewsPercentage: (parent: any) => {
      if (!parent.viewsLimit) return 0;
      return (parent.viewsUsed / parent.viewsLimit) * 100;
    },

    submissionsPercentage: (parent: any) => {
      if (!parent.submissionsLimit) return 0;
      return (parent.submissionsUsed / parent.submissionsLimit) * 100;
    },

    isViewLimitExceeded: (parent: any) => {
      if (!parent.viewsLimit) return false;
      return parent.viewsUsed >= parent.viewsLimit;
    },

    isSubmissionLimitExceeded: (parent: any) => {
      if (!parent.submissionsLimit) return false;
      return parent.submissionsUsed >= parent.submissionsLimit;
    },

    isLimitExceeded: (parent: any) => {
      const viewExceeded = parent.viewsLimit && parent.viewsUsed >= parent.viewsLimit;
      const submissionExceeded = parent.submissionsLimit && parent.submissionsUsed >= parent.submissionsLimit;
      return viewExceeded || submissionExceeded;
    }
  },

  Mutation: {
    createCheckoutSession: async (_: any, { planId }: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      const session = await createCheckoutSession(
        context.user.id,
        context.activeOrganizationId,
        planId
      );

      return session;
    },

    updateSubscription: async (_: any, { planId }: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      const subscription = await updateSubscription(
        context.activeOrganizationId,
        planId
      );

      return subscription;
    },

    cancelSubscription: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required');
      }

      const subscription = await cancelSubscription(
        context.activeOrganizationId
      );

      return subscription;
    }
  }
};
```

---

## Usage Enforcement

### Form Viewer - Pre-Check

```typescript
// apps/form-viewer/src/pages/FormViewer.tsx

import { useQuery } from '@apollo/client';
import { GET_FORM_BY_SHORT_URL } from '../graphql/queries';
import { emitFormViewed } from '../utils/analytics';

export const FormViewer = () => {
  const { shortUrl } = useParams();
  const { data, loading, error } = useQuery(GET_FORM_BY_SHORT_URL, {
    variables: { shortUrl }
  });

  const form = data?.formByShortUrl;
  const subscription = form?.organization?.subscription;

  // Check if view limit exceeded
  const isViewLimitExceeded = subscription?.isViewLimitExceeded;

  useEffect(() => {
    if (form && !isViewLimitExceeded) {
      // Emit view event (non-blocking)
      emitFormViewed(form.id, form.organizationId);
    }
  }, [form, isViewLimitExceeded]);

  if (loading) return <Spinner />;
  if (error) return <ErrorPage error={error} />;

  // Show limit exceeded page
  if (isViewLimitExceeded) {
    return (
      <LimitExceededPage
        type="views"
        subscription={subscription}
        formTitle={form.title}
      />
    );
  }

  return <FormViewerContent form={form} />;
};
```

### Form Submission - Pre-Check

```typescript
// apps/backend/src/graphql/resolvers/responses.ts

import { GraphQLError } from 'graphql';
import { canSubmitForm } from '../../services/subscriptionUsageService.js';
import { emitFormSubmitted } from '../../events/subscription-events.js';

export const responseResolvers = {
  Mutation: {
    submitResponse: async (_: any, { input }: any) => {
      const form = await prisma.form.findUnique({
        where: { id: input.formId }
      });

      if (!form) {
        throw new GraphQLError('Form not found');
      }

      // CHECK SUBMISSION LIMIT BEFORE CREATING RESPONSE
      const canSubmit = await canSubmitForm(form.organizationId);

      if (!canSubmit) {
        // Get subscription details for error message
        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: form.organizationId }
        });

        throw new GraphQLError('Submission limit exceeded', {
          extensions: {
            code: 'SUBMISSION_LIMIT_EXCEEDED',
            subscription: {
              planId: subscription?.planId,
              submissionsUsed: subscription?.submissionsUsed,
              submissionsLimit: subscription?.submissionsLimit,
              submissionsRemaining: 0
            }
          }
        });
      }

      // Create response
      const response = await prisma.response.create({
        data: {
          formId: input.formId,
          data: input.data,
          // ... other fields
        }
      });

      // Emit event to increment counter (non-blocking)
      emitFormSubmitted(form.id, form.organizationId, response.id);

      return response;
    }
  }
};
```

---

## Chargebee Integration

### Chargebee Service

```typescript
// apps/backend/src/services/chargebeeService.ts

import chargebee from 'chargebee';

// Initialize Chargebee
chargebee.configure({
  site: process.env.CHARGEBEE_SITE,
  api_key: process.env.CHARGEBEE_API_KEY
});

// Usage queue for batch reporting
const usageQueue: UsageQueueItem[] = [];

interface UsageQueueItem {
  subscriptionId: string;
  featureId: 'form_views' | 'form_submissions';
  quantity: number;
  timestamp: number;
}

/**
 * Queue usage for Chargebee sync
 * Non-blocking, batched reporting
 */
export const reportUsageToChargebee = async (
  subscriptionId: string | null,
  featureId: 'form_views' | 'form_submissions',
  quantity: number
): Promise<void> => {
  // Don't report for free plan (no Chargebee subscription)
  if (!subscriptionId) {
    return;
  }

  // Add to queue
  usageQueue.push({
    subscriptionId,
    featureId,
    quantity,
    timestamp: Date.now()
  });

  console.log(`[Chargebee] Queued usage: ${featureId} +${quantity}`);
};

/**
 * Background worker - Process usage queue
 * Runs every 5 minutes
 */
setInterval(async () => {
  if (usageQueue.length === 0) {
    return;
  }

  console.log(`[Chargebee] Processing ${usageQueue.length} usage records...`);

  // Take first 100 items
  const batch = usageQueue.splice(0, 100);

  // Group by subscription and feature
  const grouped = batch.reduce((acc, item) => {
    const key = `${item.subscriptionId}:${item.featureId}`;
    if (!acc[key]) {
      acc[key] = {
        subscriptionId: item.subscriptionId,
        featureId: item.featureId,
        totalQuantity: 0
      };
    }
    acc[key].totalQuantity += item.quantity;
    return acc;
  }, {} as Record<string, any>);

  // Report to Chargebee
  for (const key in grouped) {
    const { subscriptionId, featureId, totalQuantity } = grouped[key];

    try {
      await chargebee.subscription.add_charge_item_at_term_end(subscriptionId, {
        item_price_id: featureId,
        quantity: totalQuantity
      }).request();

      console.log(`[Chargebee] Reported ${totalQuantity} ${featureId} for ${subscriptionId}`);
    } catch (error: any) {
      console.error(`[Chargebee] Failed to report usage:`, error);
      // Re-queue failed items
      usageQueue.push(...batch.filter(item =>
        item.subscriptionId === subscriptionId && item.featureId === featureId
      ));
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Create Chargebee checkout session
 */
export const createCheckoutSession = async (
  customerId: string,
  planId: string,
  organizationId: string
): Promise<{ url: string; sessionId: string }> => {
  const result = await chargebee.hosted_page.checkout_new({
    customer: {
      id: customerId
    },
    subscription: {
      plan_id: planId,
      cf_organization_id: organizationId // Custom field
    },
    redirect_url: `${process.env.APP_URL}/subscription/success`,
    cancel_url: `${process.env.APP_URL}/pricing`
  }).request();

  return {
    url: result.hosted_page.url,
    sessionId: result.hosted_page.id
  };
};

/**
 * Update subscription plan
 */
export const updateSubscriptionPlan = async (
  subscriptionId: string,
  newPlanId: string
): Promise<void> => {
  await chargebee.subscription.update(subscriptionId, {
    plan_id: newPlanId,
    prorate: true // Prorate charges
  }).request();
};

/**
 * Cancel subscription
 */
export const cancelChargebeeSubscription = async (
  subscriptionId: string
): Promise<void> => {
  await chargebee.subscription.cancel(subscriptionId, {
    end_of_term: true // Cancel at end of billing period
  }).request();
};
```

### Webhook Handler

```typescript
// apps/backend/src/webhooks/chargebee-webhooks.ts

import express from 'express';
import { syncSubscriptionFromChargebee } from '../services/subscriptionService.js';
import { resetUsageCounters } from '../services/subscriptionUsageService.js';

const router = express.Router();

router.post('/webhooks/chargebee', express.json(), async (req, res) => {
  const event = req.body;

  console.log(`[Chargebee Webhook] Event: ${event.event_type}`);

  try {
    switch (event.event_type) {
      case 'subscription_created':
        await handleSubscriptionCreated(event.content.subscription);
        break;

      case 'subscription_changed':
        await handleSubscriptionChanged(event.content.subscription);
        break;

      case 'subscription_cancelled':
        await handleSubscriptionCancelled(event.content.subscription);
        break;

      case 'subscription_renewed':
        await handleSubscriptionRenewed(event.content.subscription);
        break;

      case 'payment_succeeded':
        await handlePaymentSucceeded(event.content);
        break;

      case 'payment_failed':
        await handlePaymentFailed(event.content);
        break;
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('[Chargebee Webhook] Error:', error);
    res.status(500).send('Error processing webhook');
  }
});

async function handleSubscriptionCreated(subscription: any) {
  await syncSubscriptionFromChargebee(subscription);
}

async function handleSubscriptionChanged(subscription: any) {
  await syncSubscriptionFromChargebee(subscription);
}

async function handleSubscriptionCancelled(subscription: any) {
  const organizationId = subscription.cf_organization_id;

  // Move to free plan
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      planId: 'free',
      status: 'cancelled',
      chargebeeSubscriptionId: null,
      viewsLimit: 10000,
      submissionsLimit: 1000
    }
  });
}

async function handleSubscriptionRenewed(subscription: any) {
  const organizationId = subscription.cf_organization_id;

  // Reset usage counters for new billing period
  await resetUsageCounters(organizationId);

  // Sync subscription data
  await syncSubscriptionFromChargebee(subscription);
}

async function handlePaymentSucceeded(content: any) {
  console.log('[Chargebee] Payment succeeded:', content.invoice.id);
}

async function handlePaymentFailed(content: any) {
  console.log('[Chargebee] Payment failed:', content.invoice.id);
  // TODO: Send notification to organization owner
}

export default router;
```

---

## Frontend Integration

### Automatic Upgrade Modal

```typescript
// apps/form-app/src/components/subscription/SubscriptionGuard.tsx

import React, { useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_MY_ORGANIZATIONS } from '../../graphql/queries';
import { UpgradeModal } from './UpgradeModal';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const { data } = useQuery(GET_MY_ORGANIZATIONS);
  const [modalDismissed, setModalDismissed] = useState(false);

  const activeOrg = data?.me?.organizations?.find((o: any) => o.isActive);
  const subscription = activeOrg?.subscription;

  // Auto-show upgrade modal at 90% usage
  const showUpgradeModal = useMemo(() => {
    if (!subscription || modalDismissed) return false;

    const viewsPercent = subscription.viewsPercentage || 0;
    const submissionsPercent = subscription.submissionsPercentage || 0;

    // Show at 90% usage
    return viewsPercent >= 90 || submissionsPercent >= 90;
  }, [subscription, modalDismissed]);

  const handleDismiss = () => {
    setModalDismissed(true);
    // Re-enable after 24 hours
    setTimeout(() => setModalDismissed(false), 24 * 60 * 60 * 1000);
  };

  return (
    <>
      {children}
      {showUpgradeModal && (
        <UpgradeModal
          subscription={subscription}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
};
```

### Usage Dashboard Widget

```typescript
// apps/form-app/src/components/subscription/UsageDashboard.tsx

import React from 'react';
import { useQuery } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, Button, Alert, AlertTitle } from '@dculus/ui';
import { GET_MY_ORGANIZATIONS } from '../../graphql/queries';
import { UsageProgressBar } from './UsageProgressBar';
import { useNavigate } from 'react-router-dom';

export const UsageDashboard: React.FC = () => {
  const { data, loading } = useQuery(GET_MY_ORGANIZATIONS);
  const navigate = useNavigate();

  const activeOrg = data?.me?.organizations?.find((o: any) => o.isActive);
  const subscription = activeOrg?.subscription;

  if (loading || !subscription) {
    return null;
  }

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Current Plan: {subscription.planName}</span>
          {subscription.planId !== 'advanced' && (
            <Button size="sm" onClick={handleUpgrade}>
              Upgrade
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Views Usage */}
        <UsageProgressBar
          label="Form Views"
          used={subscription.viewsUsed}
          limit={subscription.viewsLimit}
          isUnlimited={!subscription.viewsLimit}
        />

        {/* Submissions Usage */}
        <UsageProgressBar
          label="Form Submissions"
          used={subscription.submissionsUsed}
          limit={subscription.submissionsLimit}
          isUnlimited={!subscription.submissionsLimit}
        />

        {/* Limit Exceeded Alert */}
        {subscription.isLimitExceeded && (
          <Alert variant="destructive">
            <AlertTitle>Limit Exceeded</AlertTitle>
            <p className="text-sm mb-2">
              You've reached your plan limit. Upgrade to continue using forms.
            </p>
            <Button onClick={handleUpgrade} size="sm">
              Upgrade Now
            </Button>
          </Alert>
        )}

        {/* Billing Period */}
        <div className="text-sm text-muted-foreground">
          Resets on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};
```

### Pricing Page

```typescript
// apps/form-app/src/pages/Pricing.tsx

import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@dculus/ui';
import { CREATE_CHECKOUT_SESSION } from '../graphql/mutations';
import { toastSuccess, toastError } from '@dculus/ui';

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: { usd: 0, inr: 0 },
    features: [
      '10,000 form views/month',
      '1,000 submissions/month',
      'Basic analytics',
      'Collaboration tools'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: { usd: 6, inr: 489 },
    features: [
      'Unlimited form views',
      '10,000 submissions/month',
      'Advanced analytics',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'advanced',
    name: 'Advanced',
    price: { usd: 15, inr: 1289 },
    features: [
      'Unlimited form views',
      '100,000 submissions/month',
      'Advanced analytics',
      'API access',
      'White-labeling'
    ]
  }
];

export const Pricing: React.FC = () => {
  const [currency, setCurrency] = useState<'usd' | 'inr'>('usd');
  const [createCheckoutSession, { loading }] = useMutation(CREATE_CHECKOUT_SESSION);

  const handleSubscribe = async (planId: string) => {
    if (planId === 'free') {
      toastError('You are already on the free plan');
      return;
    }

    try {
      const { data } = await createCheckoutSession({
        variables: { planId }
      });

      // Redirect to Chargebee checkout
      window.location.href = data.createCheckoutSession.url;
    } catch (error: any) {
      toastError('Failed to create checkout session', error.message);
    }
  };

  return (
    <div className="container mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground mb-6">
          Select the plan that best fits your needs
        </p>

        {/* Currency Toggle */}
        <div className="inline-flex gap-2">
          <Button
            variant={currency === 'usd' ? 'default' : 'outline'}
            onClick={() => setCurrency('usd')}
          >
            USD
          </Button>
          <Button
            variant={currency === 'inr' ? 'default' : 'outline'}
            onClick={() => setCurrency('inr')}
          >
            INR
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.popular ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.popular && <Badge>Popular</Badge>}
              </div>
              <div className="text-3xl font-bold">
                {currency === 'usd' ? '$' : '₹'}
                {currency === 'usd' ? plan.price.usd : plan.price.inr}
                <span className="text-sm font-normal text-muted-foreground">
                  /month
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading}
              >
                {plan.id === 'free' ? 'Current Plan' : 'Subscribe'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

---

## Integration Points

### Form Viewer Integration

```typescript
// apps/form-viewer/src/pages/FormViewer.tsx

import { emitFormViewed } from '../utils/analytics';

export const FormViewer = () => {
  // ... existing code

  useEffect(() => {
    if (form && !subscription?.isViewLimitExceeded) {
      // Emit view event (existing analytics + new subscription tracking)
      emitFormViewed(form.id, form.organizationId);
    }
  }, [form]);

  // ... rest of component
};
```

### Form Submission Integration

```typescript
// apps/backend/src/graphql/resolvers/responses.ts

import { emitFormSubmitted } from '../../events/subscription-events.js';

export const submitResponse = async (_: any, { input }: any) => {
  // ... existing validation

  // Check submission limit
  const canSubmit = await canSubmitForm(form.organizationId);
  if (!canSubmit) {
    throw new GraphQLError('Submission limit exceeded', {
      extensions: { code: 'SUBMISSION_LIMIT_EXCEEDED' }
    });
  }

  // Create response
  const response = await createResponse(input);

  // Emit event (non-blocking)
  emitFormSubmitted(form.id, form.organizationId, response.id);

  return response;
};
```

### Organization Creation Integration

```typescript
// apps/backend/src/lib/better-auth.ts

import { createFreeSubscription } from '../services/subscriptionService.js';

// Better-auth hook
auth.afterOrganizationCreate(async (org) => {
  // Auto-create free plan subscription
  await createFreeSubscription(org.id);

  console.log(`[Subscription] Free plan created for organization ${org.id}`);
});
```

---

## Chargebee Configuration

### Plans Setup in Chargebee

**Free Plan** (`free`)
- Price: $0/month
- Metered Features:
  - `form_views`: 10,000 included
  - `form_submissions`: 1,000 included

**Starter Plan** (`starter`)
- Price Points:
  - USD: $6/month
  - INR: ₹489/month
- Metered Features:
  - `form_views`: Unlimited
  - `form_submissions`: 10,000 included

**Advanced Plan** (`advanced`)
- Price Points:
  - USD: $15/month
  - INR: ₹1,289/month
- Metered Features:
  - `form_views`: Unlimited
  - `form_submissions`: 100,000 included

### Metered Features

1. **Form Views** (`form_views`)
   - Type: Metered
   - Unit: Views
   - Reporting: Real-time via API

2. **Form Submissions** (`form_submissions`)
   - Type: Metered
   - Unit: Submissions
   - Reporting: Real-time via API

---

## Best Practices

### Usage Tracking

✅ **DO:**
- Track usage asynchronously via events
- Cache usage locally for performance
- Batch Chargebee API calls
- Check limits before allowing actions
- Reset counters at period end
- Log all usage tracking operations

❌ **DON'T:**
- Block user actions while tracking usage
- Make Chargebee API calls synchronously
- Trust client-side limit checks
- Allow negative usage counts
- Skip validation of organization ownership

### Performance Optimization

✅ **DO:**
- Use local Prisma counters for limit checks
- Queue Chargebee usage reports (batch every 5 minutes)
- Cache subscription data in GraphQL queries
- Index database fields (organizationId, status, planId)
- Use computed fields in GraphQL resolvers

❌ **DON'T:**
- Query Chargebee for every view/submission
- Make synchronous API calls to Chargebee
- Recalculate usage on every request
- Skip database indexes

### Security

✅ **DO:**
- Validate organization ownership before allowing upgrades
- Verify Chargebee webhook signatures
- Encrypt Chargebee API keys
- Enforce limits server-side (not client-side)
- Log all subscription changes

❌ **DON'T:**
- Trust client-provided usage data
- Skip webhook signature verification
- Expose Chargebee API keys to frontend
- Allow unlimited trials

---

## File Structure

```
apps/backend/
├── src/
│   ├── events/
│   │   └── subscription-events.ts       # Event emitters
│   ├── services/
│   │   ├── subscriptionService.ts       # Subscription management
│   │   ├── subscriptionUsageService.ts  # Usage tracking & limits
│   │   └── chargebeeService.ts          # Chargebee API wrapper
│   ├── graphql/
│   │   ├── schema.ts                    # Extended with Subscription type
│   │   └── resolvers/
│   │       └── subscription.ts          # Subscription resolvers
│   ├── webhooks/
│   │   └── chargebee-webhooks.ts        # Webhook handlers
│   └── lib/
│       └── better-auth.ts               # Hook for org creation
├── prisma/
│   └── schema.prisma                    # Subscription model

apps/form-app/
├── src/
│   ├── components/
│   │   └── subscription/
│   │       ├── SubscriptionGuard.tsx    # Auto upgrade modal
│   │       ├── UsageDashboard.tsx       # Usage widget
│   │       ├── UpgradeModal.tsx         # Upgrade flow
│   │       └── UsageProgressBar.tsx     # Progress indicator
│   ├── pages/
│   │   ├── Pricing.tsx                  # Public pricing page
│   │   └── PaymentSettings.tsx          # Payment management
│   └── graphql/
│       ├── queries.ts                   # Extended org queries
│       └── mutations.ts                 # Subscription mutations

apps/form-viewer/
└── src/
    ├── pages/
    │   └── FormViewer.tsx               # View limit check
    └── utils/
        └── analytics.ts                 # Event emission
```

---

## Testing

### Integration Tests

```typescript
// Test usage tracking
describe('Subscription Usage Tracking', () => {
  it('should increment view count on form view', async () => {
    const orgId = 'test-org-123';

    // Emit view event
    emitFormViewed('form-123', orgId);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check counter incremented
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId }
    });

    expect(subscription.viewsUsed).toBe(1);
  });

  it('should block submission when limit exceeded', async () => {
    const orgId = 'test-org-123';

    // Set limit to 0
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { submissionsUsed: 1000, submissionsLimit: 1000 }
    });

    // Try to submit
    const canSubmit = await canSubmitForm(orgId);

    expect(canSubmit).toBe(false);
  });
});
```

---

## Monitoring & Logging

### Key Metrics to Track

- **Usage Tracking**
  - View events processed per minute
  - Submission events processed per minute
  - Event queue size
  - Failed event processing

- **Chargebee Sync**
  - Usage queue length
  - Batch sync success rate
  - API error rate
  - Sync latency

- **Subscription Status**
  - Active subscriptions by plan
  - Cancellation rate
  - Upgrade/downgrade rate
  - Payment failure rate

### Logging

```typescript
// Log usage tracking
console.log(`[Usage] View count incremented: org=${orgId}, count=${newCount}`);

// Log Chargebee sync
console.log(`[Chargebee] Synced ${batchSize} usage records`);

// Log subscription changes
console.log(`[Subscription] Plan changed: org=${orgId}, old=${oldPlan}, new=${newPlan}`);

// Log errors
console.error(`[Subscription] Error processing event:`, error);
```

---

## Future Enhancements

### Advanced Features
- **Usage Alerts** - Email notifications at 80%, 90%, 100% usage
- **Overage Billing** - Optional pay-as-you-go beyond limits
- **Custom Plans** - Enterprise pricing with custom limits
- **Team Limits** - Per-user limits within organization
- **API Access Tiers** - Different API rate limits per plan

### Optimizations
- **Redis Caching** - Cache subscription data in Redis
- **Usage Aggregation** - Pre-aggregate usage stats for dashboards
- **Predictive Alerts** - ML-based usage prediction
- **A/B Testing** - Test different pricing tiers

---

## Support & Resources

### Documentation
- [Chargebee API Documentation](https://apidocs.chargebee.com/docs/api)
- [Chargebee Webhooks Guide](https://www.chargebee.com/docs/2.0/events_and_webhooks.html)
- [Chargebee Multi-Currency Pricing](https://www.chargebee.com/docs/2.0/multi-currency.html)

### Code References
- Plugin System: `PLUGIN_SYSTEM.md`
- GraphQL Schema: `apps/backend/src/graphql/schema.ts`
- Analytics: `CLAUDE.md` (Form Viewer Analytics section)

---

## Changelog

### v1.0 (Planned)
- Event-driven usage tracking
- Extend Organization GraphQL type with subscription
- Local usage caching with Prisma
- Chargebee integration (create, update, cancel)
- Webhook handlers for subscription events
- Automatic upgrade modals at 90% usage
- Pricing page with currency toggle
- Usage dashboard widget
- Hard limits on views and submissions
- Background worker for batch Chargebee sync

---

**Status**: Architecture Planning Phase
**Next Steps**: Begin Phase 1 implementation (Database & Events)
