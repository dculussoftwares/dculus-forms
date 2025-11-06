# Chargebee Integration - Complete Guide

**Last Updated**: 2025-11-06
**Status**: Backend 100% Complete | Frontend 50% Complete
**Version**: 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [Business Model](#business-model)
3. [Architecture](#architecture)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Implementation](#frontend-implementation)
6. [Data Flow](#data-flow)
7. [API Reference](#api-reference)
8. [Testing Guide](#testing-guide)
9. [Deployment Checklist](#deployment-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is This Integration?

The Chargebee integration transforms dculus-forms into a **subscription-based SaaS product** with usage-based billing. Organizations are assigned subscription plans that limit:
- **Form Views**: Number of times forms can be viewed per billing period
- **Form Submissions**: Number of form responses that can be submitted per billing period

### Key Features

✅ **Three Pricing Tiers**: Free, Starter, Advanced
✅ **Multi-Currency**: USD and INR (Indian Rupees)
✅ **Usage Tracking**: Real-time tracking of views and submissions
✅ **Hard Limits**: Automatic enforcement when limits exceeded
✅ **Auto-Renewal**: Usage counters reset on billing renewal
✅ **Self-Service**: Users can upgrade/downgrade via Chargebee portal
✅ **Webhook Sync**: Automatic synchronization with Chargebee events

### Technology Stack

- **Backend**: Node.js + Express + GraphQL + Prisma
- **Payment Gateway**: Chargebee (Subscription Management Platform)
- **Database**: MongoDB (Prisma ORM)
- **Frontend**: React + Apollo Client
- **Authentication**: better-auth (organization-based)

---

## Business Model

### Pricing Plans

| Plan | Monthly (USD) | Yearly (USD) | Monthly (INR) | Yearly (INR) | Views | Submissions |
|------|---------------|--------------|---------------|--------------|-------|-------------|
| **Free** | $0 | - | ₹0 | - | 10,000 | 1,000 |
| **Starter** | $6 | $66 ($5.50/mo) | ₹489 | ₹5,400 (₹450/mo) | Unlimited | 10,000 |
| **Advanced** | $15 | $168 ($14/mo) | ₹1,289 | ₹14,268 (₹1,189/mo) | Unlimited | 100,000 |

### Plan Features

**Free Plan** (Default for all new organizations):
- 10,000 form views per month
- 1,000 form submissions per month
- Basic features
- Community support

**Starter Plan** (Small teams):
- **Unlimited** form views
- 10,000 form submissions per month
- All Free features
- Email support
- No branding (optional)

**Advanced Plan** (Enterprises):
- **Unlimited** form views
- 100,000 form submissions per month
- All Starter features
- Priority support
- Advanced analytics
- Custom integrations

### Usage Policies

**Reset Policy**: Usage counters (viewsUsed, submissionsUsed) reset to 0 at the start of each billing period.

**Enforcement Policy**:
- When limit reached: Block action and show error message
- Warning threshold: Alert users at 80% usage
- Grace period: None (hard limits enforced immediately)

**Overage Policy**: No overages allowed. Users must upgrade to continue using the service.

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      DCULUS-FORMS APP                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Frontend  │◄────────┤   GraphQL   │                   │
│  │   (React)   │         │     API     │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                            │
│         │                       ▼                            │
│         │              ┌─────────────────┐                  │
│         │              │  Subscription   │                  │
│         │              │     Service     │                  │
│         │              └────────┬────────┘                  │
│         │                       │                            │
│         │                       ▼                            │
│         │              ┌─────────────────┐                  │
│         │              │    Usage        │                  │
│         │              │   Tracking      │                  │
│         │              └────────┬────────┘                  │
│         │                       │                            │
│         │                       ▼                            │
│         │              ┌─────────────────┐                  │
│         └──────────────┤    Database     │                  │
│                        │   (MongoDB)     │                  │
│                        └─────────────────┘                  │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Webhooks
                       │ API Calls
                       ▼
              ┌─────────────────┐
              │   CHARGEBEE     │
              │   (External)    │
              │                 │
              │ • Billing       │
              │ • Checkout      │
              │ • Portal        │
              │ • Webhooks      │
              └─────────────────┘
```

### Database Schema

```prisma
model Subscription {
  id                      String   @id @map("_id")
  organizationId          String   @unique

  // Chargebee references
  chargebeeCustomerId     String
  chargebeeSubscriptionId String?

  // Plan information
  planId                  String   // "free", "starter", "advanced"
  status                  String   // "active", "cancelled", "expired", "past_due"

  // Usage tracking
  viewsUsed               Int      @default(0)
  submissionsUsed         Int      @default(0)

  // Limits (null = unlimited)
  viewsLimit              Int?
  submissionsLimit        Int?

  // Billing period
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime

  // Timestamps
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  // Relations
  organization            Organization @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
  @@index([status])
  @@map("subscriptions")
}
```

### Event System

**Event Types**:
```typescript
enum SubscriptionEventType {
  FORM_VIEWED = 'form.viewed',
  FORM_SUBMITTED = 'form.submitted',
  USAGE_LIMIT_REACHED = 'usage.limit.reached',
  USAGE_LIMIT_EXCEEDED = 'usage.limit.exceeded',
}
```

**Event Payload**:
```typescript
interface SubscriptionEvent {
  type: SubscriptionEventType;
  organizationId: string;
  formId?: string;
  responseId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
```

**Event Emitters**:
```typescript
// Emit when form is viewed
emitSubscriptionFormViewed(organizationId: string, formId: string);

// Emit when form is submitted
emitSubscriptionFormSubmitted(organizationId: string, formId: string, responseId: string);
```

---

## Backend Implementation

### Phase 1: Database & Event System ✅

**Files Created**:
- `apps/backend/prisma/schema.prisma` - Added Subscription model
- `apps/backend/src/subscriptions/types.ts` - Type definitions
- `apps/backend/src/subscriptions/events.ts` - Event emitters
- `apps/backend/src/subscriptions/usageService.ts` - Usage tracking
- `apps/backend/src/subscriptions/index.ts` - Module exports

**Usage Service Functions**:
```typescript
// Track usage
async function trackFormView(organizationId: string, formId: string): Promise<void>
async function trackFormSubmission(organizationId: string, formId: string, responseId: string): Promise<void>

// Check limits
async function checkUsageExceeded(organizationId: string): Promise<{
  viewsExceeded: boolean;
  submissionsExceeded: boolean;
}>

// Get usage status
async function getUsageStatus(organizationId: string): Promise<SubscriptionUsage>
```

**Usage Service Logic**:
```typescript
// Increment counter
subscription.viewsUsed += 1;

// Check if approaching limit (80% threshold)
if (subscription.viewsLimit) {
  const percentage = (subscription.viewsUsed / subscription.viewsLimit) * 100;
  if (percentage >= 80) {
    emitEvent('usage.limit.reached', { organizationId, percentage });
  }
}

// Check if exceeded
if (subscription.viewsUsed >= subscription.viewsLimit) {
  emitEvent('usage.limit.exceeded', { organizationId });
}
```

### Phase 2: GraphQL API ✅

**Files Created**:
- `apps/backend/src/graphql/schema.ts` - Schema extensions
- `apps/backend/src/graphql/resolvers/subscriptions.ts` - Resolvers

**GraphQL Schema Extensions**:
```graphql
type Organization {
  id: ID!
  name: String!
  subscription: Subscription  # Added
}

type Subscription {
  id: ID!
  organizationId: ID!
  planId: String!
  status: SubscriptionStatus!

  # Usage
  viewsUsed: Int!
  submissionsUsed: Int!
  viewsLimit: Int
  submissionsLimit: Int

  # Billing period
  currentPeriodStart: String!
  currentPeriodEnd: String!

  # Computed fields
  usage: SubscriptionUsage!
}

type SubscriptionUsage {
  views: UsageInfo!
  submissions: UsageInfo!
}

type UsageInfo {
  used: Int!
  limit: Int
  unlimited: Boolean!
  percentage: Float
  exceeded: Boolean!
  warning: Boolean!  # true if >= 80%
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
  PAST_DUE
}

type Plan {
  id: ID!
  name: String!
  description: String
  prices: [PlanPrice!]!
  features: PlanFeatures!
}

type PlanPrice {
  id: ID!
  currency: String!
  amount: Float!
  period: String!  # "monthly" or "yearly"
}

type PlanFeatures {
  views: Int  # null = unlimited
  submissions: Int  # null = unlimited
}

type CheckoutSession {
  url: String!
  hostedPageId: String!
}

type PortalSession {
  url: String!
}

extend type Query {
  availablePlans: [Plan!]!
}

extend type Mutation {
  createCheckoutSession(itemPriceId: String!): CheckoutSession!
  createPortalSession: PortalSession!
}
```

**Resolver Implementations**:

```typescript
// Get subscription for organization
Organization: {
  subscription: async (parent, args, context) => {
    return await prisma.subscription.findUnique({
      where: { organizationId: parent.id }
    });
  }
}

// Compute usage statistics
Subscription: {
  usage: (parent) => {
    return {
      views: {
        used: parent.viewsUsed,
        limit: parent.viewsLimit,
        unlimited: parent.viewsLimit === null,
        percentage: parent.viewsLimit
          ? (parent.viewsUsed / parent.viewsLimit) * 100
          : null,
        exceeded: parent.viewsLimit
          ? parent.viewsUsed >= parent.viewsLimit
          : false,
        warning: parent.viewsLimit
          ? (parent.viewsUsed / parent.viewsLimit) >= 0.8
          : false,
      },
      submissions: {
        // Same logic for submissions
      }
    };
  }
}

// Query available plans
Query: {
  availablePlans: async () => {
    return await getAvailablePlans(); // From chargebeeService
  }
}

// Create checkout session for upgrade
Mutation: {
  createCheckoutSession: async (parent, { itemPriceId }, context) => {
    // Require authentication
    if (!context.user) throw new Error('Authentication required');

    const org = context.activeOrganization;
    const subscription = await getSubscription(org.id);

    // Create Chargebee checkout
    const result = await createCheckoutHostedPage(
      subscription.chargebeeCustomerId,
      itemPriceId
    );

    return {
      url: result.url,
      hostedPageId: result.id
    };
  },

  createPortalSession: async (parent, args, context) => {
    // Require authentication
    if (!context.user) throw new Error('Authentication required');

    const org = context.activeOrganization;
    const subscription = await getSubscription(org.id);

    // Create Chargebee portal session
    const portalUrl = await createPortalSession(
      subscription.chargebeeCustomerId
    );

    return { url: portalUrl };
  }
}
```

### Phase 3: Usage Enforcement ✅

**Enforcement Locations**:

**1. Form Viewing** (`apps/backend/src/graphql/resolvers/forms.ts`):
```typescript
// In formByShortUrl resolver
const form = await prisma.form.findUnique({ where: { shortUrl } });

// Check usage limits
const usageExceeded = await checkUsageExceeded(form.organizationId);

if (usageExceeded.viewsExceeded) {
  throw new GraphQLError(
    "Form view limit exceeded for this organization's subscription plan. Please upgrade to continue.",
    { extensions: { code: 'USAGE_LIMIT_EXCEEDED' } }
  );
}

// Track the view
await trackFormView(form.organizationId, form.id);

return form;
```

**2. Form Submission** (`apps/backend/src/graphql/resolvers/responses.ts`):
```typescript
// In submitResponse mutation
const form = await prisma.form.findUnique({ where: { id: formId } });

// Check usage limits
const usageExceeded = await checkUsageExceeded(form.organizationId);

if (usageExceeded.submissionsExceeded) {
  throw new GraphQLError(
    "Form submission limit exceeded for this organization's subscription plan. Please upgrade to continue.",
    { extensions: { code: 'USAGE_LIMIT_EXCEEDED' } }
  );
}

// Save response
const response = await prisma.response.create({ data: responseData });

// Track the submission
await trackFormSubmission(form.organizationId, form.id, response.id);

return response;
```

### Phase 4: Chargebee Service & Webhooks ✅

**Files Created**:
- `apps/backend/src/services/chargebeeService.ts` - Chargebee API wrapper
- `apps/backend/src/routes/chargebee-webhooks.ts` - Webhook handler

**Chargebee Service Functions**:

```typescript
// Customer Management
export async function createChargebeeCustomer(
  organizationId: string,
  organizationName: string,
  email: string
): Promise<string> {
  const customer = await chargebee.customer.create({
    id: organizationId,
    first_name: organizationName,
    email: email,
  }).request();

  return customer.customer.id;
}

export async function createFreeSubscription(
  organizationId: string,
  chargebeeCustomerId: string
): Promise<Subscription> {
  // Create subscription record in database
  return await prisma.subscription.create({
    data: {
      id: generateId(),
      organizationId,
      chargebeeCustomerId,
      planId: 'free',
      status: 'active',
      viewsLimit: 10000,
      submissionsLimit: 1000,
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1),
    }
  });
}

// Checkout & Portal
export async function createCheckoutHostedPage(
  customerId: string,
  itemPriceId: string
): Promise<{ url: string; id: string }> {
  const result = await chargebee.hosted_page.checkout_new_for_items({
    customer: { id: customerId },
    subscription_items: [{
      item_price_id: itemPriceId,
      quantity: 1
    }]
  }).request();

  return {
    url: result.hosted_page.url,
    id: result.hosted_page.id
  };
}

export async function createPortalSession(
  customerId: string
): Promise<string> {
  const result = await chargebee.portal_session.create({
    customer: { id: customerId }
  }).request();

  return result.portal_session.access_url;
}

// Webhook Sync
export async function syncSubscriptionFromWebhook(
  subscriptionData: any
): Promise<void> {
  const chargebeeSubscription = subscriptionData.subscription;

  await prisma.subscription.upsert({
    where: {
      chargebeeSubscriptionId: chargebeeSubscription.id
    },
    update: {
      status: chargebeeSubscription.status,
      planId: chargebeeSubscription.subscription_items[0].item_price_id,
      currentPeriodStart: new Date(chargebeeSubscription.current_term_start * 1000),
      currentPeriodEnd: new Date(chargebeeSubscription.current_term_end * 1000),
    },
    create: {
      // Create new subscription
    }
  });
}

export async function handleSubscriptionRenewal(
  subscriptionData: any
): Promise<void> {
  const chargebeeSubscription = subscriptionData.subscription;

  // Reset usage counters
  await prisma.subscription.update({
    where: {
      chargebeeSubscriptionId: chargebeeSubscription.id
    },
    data: {
      viewsUsed: 0,
      submissionsUsed: 0,
      currentPeriodStart: new Date(chargebeeSubscription.current_term_start * 1000),
      currentPeriodEnd: new Date(chargebeeSubscription.current_term_end * 1000),
    }
  });
}

// Get Plans
export async function getAvailablePlans(): Promise<Plan[]> {
  const plans = await chargebee.item_price.list({
    // Query item prices
  }).request();

  // Transform to Plan format
  return transformPlansData(plans);
}
```

**Webhook Handler** (`apps/backend/src/routes/chargebee-webhooks.ts`):

```typescript
router.post('/api/webhooks/chargebee', async (req, res) => {
  try {
    const event = req.body;

    console.log(`Received Chargebee webhook: ${event.event_type}`);

    switch (event.event_type) {
      case 'subscription_created':
        await syncSubscriptionFromWebhook(event.content);
        break;

      case 'subscription_changed':
        await syncSubscriptionFromWebhook(event.content);
        break;

      case 'subscription_renewed':
        await syncSubscriptionFromWebhook(event.content);
        await handleSubscriptionRenewal(event.content);
        break;

      case 'subscription_cancelled':
        await syncSubscriptionFromWebhook(event.content);
        break;

      case 'subscription_reactivated':
        await syncSubscriptionFromWebhook(event.content);
        break;

      case 'payment_succeeded':
        console.log('Payment succeeded');
        break;

      case 'payment_failed':
        console.log('Payment failed - consider sending email notification');
        break;

      default:
        console.log(`Unhandled event type: ${event.event_type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
```

---

## Frontend Implementation

### Phase 5: Frontend Subscription Components ✅ (Partial)

**Files Created**:
- `apps/form-app/src/graphql/subscription.ts` - GraphQL operations ✅
- `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx` - Dashboard component ✅

**GraphQL Operations** (`subscription.ts`):

```typescript
import { gql } from '@apollo/client';

// Query available plans
export const GET_AVAILABLE_PLANS = gql`
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

// Query current subscription
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
            warning
          }
          submissions {
            used
            limit
            unlimited
            percentage
            exceeded
            warning
          }
        }
      }
    }
  }
`;

// Create checkout session
export const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($itemPriceId: String!) {
    createCheckoutSession(itemPriceId: $itemPriceId) {
      url
      hostedPageId
    }
  }
`;

// Create portal session
export const CREATE_PORTAL_SESSION = gql`
  mutation CreatePortalSession {
    createPortalSession {
      url
    }
  }
`;
```

**Subscription Dashboard Component** (`SubscriptionDashboard.tsx`):

```typescript
import React from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Card, Button } from '@dculus/ui';
import { GET_SUBSCRIPTION, CREATE_PORTAL_SESSION } from '../../graphql/subscription';

export const SubscriptionDashboard: React.FC = () => {
  const { data, loading } = useQuery(GET_SUBSCRIPTION);
  const [createPortalSession] = useMutation(CREATE_PORTAL_SESSION);

  if (loading) return <div>Loading...</div>;

  const subscription = data?.activeOrganization?.subscription;

  const handleManageSubscription = async () => {
    const result = await createPortalSession();
    window.open(result.data.createPortalSession.url, '_blank');
  };

  return (
    <Card>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Your Subscription</h2>

        {/* Plan Badge */}
        <div className="mb-6">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            {subscription.planId.toUpperCase()}
          </span>
        </div>

        {/* Usage Meters */}
        <div className="space-y-4">
          {/* Views Usage */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Form Views</span>
              <span className="text-sm text-gray-600">
                {subscription.usage.views.unlimited
                  ? '✓ Unlimited'
                  : `${subscription.usage.views.used} / ${subscription.usage.views.limit}`
                }
              </span>
            </div>
            {!subscription.usage.views.unlimited && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subscription.usage.views.exceeded ? 'bg-red-500' :
                    subscription.usage.views.warning ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(subscription.usage.views.percentage, 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Submissions Usage */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Form Submissions</span>
              <span className="text-sm text-gray-600">
                {subscription.usage.submissions.unlimited
                  ? '✓ Unlimited'
                  : `${subscription.usage.submissions.used} / ${subscription.usage.submissions.limit}`
                }
              </span>
            </div>
            {!subscription.usage.submissions.unlimited && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subscription.usage.submissions.exceeded ? 'bg-red-500' :
                    subscription.usage.submissions.warning ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(subscription.usage.submissions.percentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Warning Banner */}
        {(subscription.usage.views.exceeded || subscription.usage.submissions.exceeded) && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">
              ⚠️ Usage limit exceeded. Please upgrade your plan to continue.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          {subscription.planId !== 'advanced' && (
            <Button variant="primary">
              Upgrade Plan
            </Button>
          )}
          <Button variant="secondary" onClick={handleManageSubscription}>
            Manage Subscription
          </Button>
        </div>

        {/* Billing Period */}
        <div className="mt-6 text-sm text-gray-600">
          <p>
            Billing Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()}
            {' '}-{' '}
            {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        </div>
      </div>
    </Card>
  );
};
```

### Phase 6: Chargebee Checkout Integration ⏳ (TODO)

**What Needs to Be Built**:

1. **Upgrade Modal Component** (`apps/form-app/src/components/subscription/UpgradeModal.tsx`)
2. **Public Pricing Page** (`apps/form-app/src/pages/pricing.tsx`)
3. **Checkout Success Page** (`apps/form-app/src/pages/subscription/success.tsx`)
4. **Checkout Cancel Page** (`apps/form-app/src/pages/subscription/cancel.tsx`)
5. **Usage Warning Banner Component** (`apps/form-app/src/components/subscription/UsageWarning.tsx`)
6. **Organization Creation Hook** (Modify existing organization creation)

See [Remaining Tasks](#remaining-tasks) section for detailed implementation specs.

---

## Data Flow

### 1. New Organization Creation

```
User Signs Up
  ↓
better-auth creates User
  ↓
User creates Organization
  ↓
[TODO] Hook: createChargebeeCustomer()
  ↓
[TODO] Hook: createFreeSubscription()
  ↓
Subscription record created in DB
  ↓
Organization ready with Free plan
```

**Current State**: Manual - Organizations don't auto-get subscriptions
**TODO**: Add hook to createOrganization mutation

### 2. Form View Flow

```
Public User visits form URL
  ↓
Frontend: GET_FORM query (formByShortUrl)
  ↓
Backend: formByShortUrl resolver
  ├─ Find form by shortUrl
  ├─ Check subscription limits
  │   ├─ Get subscription for form.organizationId
  │   ├─ Check: viewsUsed < viewsLimit?
  │   │   ├─ YES: Continue
  │   │   └─ NO: Throw "View limit exceeded" error
  │   └─ Return form data
  ├─ Track view: trackFormView()
  │   ├─ Increment viewsUsed
  │   ├─ Check if >= 80% (warning)
  │   └─ Emit event if needed
  └─ Return form to frontend
  ↓
Frontend renders form
```

### 3. Form Submission Flow

```
User fills form and clicks Submit
  ↓
Frontend: SUBMIT_RESPONSE mutation
  ↓
Backend: submitResponse resolver
  ├─ Find form by formId
  ├─ Check subscription limits
  │   ├─ Get subscription for form.organizationId
  │   ├─ Check: submissionsUsed < submissionsLimit?
  │   │   ├─ YES: Continue
  │   │   └─ NO: Throw "Submission limit exceeded" error
  │   └─ Proceed with submission
  ├─ Validate response data
  ├─ Save response to database
  ├─ Track submission: trackFormSubmission()
  │   ├─ Increment submissionsUsed
  │   ├─ Check if >= 80% (warning)
  │   └─ Emit event if needed
  └─ Return success response
  ↓
Frontend shows success message
```

### 4. Upgrade Flow

```
User opens Subscription Dashboard
  ↓
User clicks "Upgrade Plan"
  ↓
[TODO] Frontend: Show UpgradeModal
  ├─ Display plan comparison
  ├─ Currency selector (USD/INR)
  └─ Billing cycle selector (Monthly/Yearly)
  ↓
User selects plan (e.g., Starter - Monthly - USD)
  ↓
User clicks "Select Plan"
  ↓
Frontend: CREATE_CHECKOUT_SESSION mutation
  variables: { itemPriceId: "starter-USD-monthly" }
  ↓
Backend: createCheckoutSession resolver
  ├─ Get user's organization
  ├─ Get subscription.chargebeeCustomerId
  ├─ Call chargebeeService.createCheckoutHostedPage()
  │   ├─ Chargebee API: Create hosted page
  │   └─ Returns checkout URL
  └─ Return { url, hostedPageId }
  ↓
Frontend receives checkout URL
  ↓
Frontend redirects: window.location.href = checkoutUrl
  ↓
User lands on Chargebee checkout page
  ├─ Enters payment details
  ├─ Completes payment
  └─ Chargebee processes payment
  ↓
Chargebee Webhook: subscription_created
  ↓
Backend: POST /api/webhooks/chargebee
  ├─ Receives webhook event
  ├─ Calls syncSubscriptionFromWebhook()
  │   ├─ Update subscription in DB
  │   │   ├─ planId = "starter"
  │   │   ├─ status = "active"
  │   │   ├─ submissionsLimit = 10000
  │   │   ├─ viewsLimit = null (unlimited)
  │   │   └─ chargebeeSubscriptionId = "..."
  │   └─ Save to database
  └─ Return 200 OK to Chargebee
  ↓
Chargebee redirects user back to app
  ↓
[TODO] Frontend: /subscription/success page
  ├─ Show success message
  ├─ Display new plan details
  └─ Link back to dashboard
  ↓
User sees upgraded plan in dashboard
```

### 5. Billing Renewal Flow

```
Billing period end date arrives
  ↓
Chargebee automatically charges payment method
  ↓
Chargebee Webhook: subscription_renewed
  ↓
Backend: POST /api/webhooks/chargebee
  ├─ Receives webhook event
  ├─ Calls syncSubscriptionFromWebhook()
  │   └─ Update period dates in DB
  ├─ Calls handleSubscriptionRenewal()
  │   ├─ Reset viewsUsed = 0
  │   ├─ Reset submissionsUsed = 0
  │   ├─ Update currentPeriodStart = new period start
  │   └─ Update currentPeriodEnd = new period end
  └─ Return 200 OK to Chargebee
  ↓
New billing period begins with fresh usage counters
  ↓
User can view/submit forms again (if previously at limit)
```

### 6. Subscription Management Flow

```
User opens Subscription Dashboard
  ↓
User clicks "Manage Subscription"
  ↓
Frontend: CREATE_PORTAL_SESSION mutation
  ↓
Backend: createPortalSession resolver
  ├─ Get user's organization
  ├─ Get subscription.chargebeeCustomerId
  ├─ Call chargebeeService.createPortalSession()
  │   ├─ Chargebee API: Create portal session
  │   └─ Returns portal URL
  └─ Return { url }
  ↓
Frontend receives portal URL
  ↓
Frontend opens in new tab: window.open(portalUrl, '_blank')
  ↓
User lands on Chargebee portal
  ├─ View billing history
  ├─ Update payment method
  ├─ Upgrade/downgrade plan
  ├─ Cancel subscription
  └─ Download invoices
  ↓
User makes changes (e.g., cancels subscription)
  ↓
Chargebee Webhook: subscription_cancelled
  ↓
Backend: POST /api/webhooks/chargebee
  ├─ Calls syncSubscriptionFromWebhook()
  │   └─ Update status = "cancelled" in DB
  └─ Return 200 OK
  ↓
Next time user tries to view/submit:
  └─ Usage enforcement checks status
      └─ If cancelled: Block with error message
```

---

## API Reference

### GraphQL Queries

#### `availablePlans`
Get all subscription plans with pricing.

**Query**:
```graphql
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
```

**Response**:
```json
{
  "data": {
    "availablePlans": [
      {
        "id": "free",
        "name": "Free",
        "description": "Perfect for getting started",
        "prices": [
          {
            "id": "free-USD-monthly",
            "currency": "USD",
            "amount": 0,
            "period": "monthly"
          }
        ],
        "features": {
          "views": 10000,
          "submissions": 1000
        }
      },
      {
        "id": "starter",
        "name": "Starter",
        "description": "For growing teams",
        "prices": [
          {
            "id": "starter-USD-monthly",
            "currency": "USD",
            "amount": 6,
            "period": "monthly"
          },
          {
            "id": "starter-USD-yearly",
            "currency": "USD",
            "amount": 66,
            "period": "yearly"
          }
        ],
        "features": {
          "views": null,
          "submissions": 10000
        }
      }
    ]
  }
}
```

#### `activeOrganization.subscription`
Get current organization's subscription details.

**Query**:
```graphql
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
          warning
        }
        submissions {
          used
          limit
          unlimited
          percentage
          exceeded
          warning
        }
      }
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "activeOrganization": {
      "id": "org_123",
      "name": "Acme Corp",
      "subscription": {
        "id": "sub_456",
        "planId": "free",
        "status": "ACTIVE",
        "viewsUsed": 8500,
        "submissionsUsed": 950,
        "viewsLimit": 10000,
        "submissionsLimit": 1000,
        "currentPeriodStart": "2025-11-01T00:00:00.000Z",
        "currentPeriodEnd": "2025-12-01T00:00:00.000Z",
        "usage": {
          "views": {
            "used": 8500,
            "limit": 10000,
            "unlimited": false,
            "percentage": 85.0,
            "exceeded": false,
            "warning": true
          },
          "submissions": {
            "used": 950,
            "limit": 1000,
            "unlimited": false,
            "percentage": 95.0,
            "exceeded": false,
            "warning": true
          }
        }
      }
    }
  }
}
```

### GraphQL Mutations

#### `createCheckoutSession`
Create a Chargebee checkout session for upgrading.

**Mutation**:
```graphql
mutation CreateCheckoutSession($itemPriceId: String!) {
  createCheckoutSession(itemPriceId: $itemPriceId) {
    url
    hostedPageId
  }
}
```

**Variables**:
```json
{
  "itemPriceId": "starter-USD-monthly"
}
```

**Response**:
```json
{
  "data": {
    "createCheckoutSession": {
      "url": "https://dculus-global.chargebee.com/pages/v3/abc123/",
      "hostedPageId": "abc123"
    }
  }
}
```

**Usage**:
```typescript
const { data } = await createCheckoutSession({
  variables: { itemPriceId: 'starter-USD-monthly' }
});

// Redirect to checkout
window.location.href = data.createCheckoutSession.url;
```

#### `createPortalSession`
Create a Chargebee portal session for subscription management.

**Mutation**:
```graphql
mutation CreatePortalSession {
  createPortalSession {
    url
  }
}
```

**Response**:
```json
{
  "data": {
    "createPortalSession": {
      "url": "https://dculus-global.chargebee.com/portal/v2/access/xyz789"
    }
  }
}
```

**Usage**:
```typescript
const { data } = await createPortalSession();

// Open portal in new tab
window.open(data.createPortalSession.url, '_blank');
```

### REST Endpoints

#### `POST /api/webhooks/chargebee`
Webhook endpoint for Chargebee events.

**Headers**:
```
Content-Type: application/json
```

**Request Body** (Example - subscription_renewed):
```json
{
  "event_type": "subscription_renewed",
  "content": {
    "subscription": {
      "id": "cbsub_123",
      "customer_id": "org_456",
      "plan_id": "starter-USD-monthly",
      "status": "active",
      "current_term_start": 1730419200,
      "current_term_end": 1733097600,
      "subscription_items": [
        {
          "item_price_id": "starter-USD-monthly",
          "quantity": 1
        }
      ]
    }
  }
}
```

**Response**:
```json
{
  "received": true
}
```

**Supported Events**:
- `subscription_created` - New subscription created
- `subscription_changed` - Plan upgraded/downgraded
- `subscription_renewed` - Billing period renewed (resets usage)
- `subscription_cancelled` - Subscription cancelled
- `subscription_reactivated` - Cancelled subscription reactivated
- `payment_succeeded` - Payment successful
- `payment_failed` - Payment failed

---

## Testing Guide

### Manual Testing Checklist

#### 1. Free Plan Enforcement
- [ ] Create a new organization
- [ ] Verify free subscription created automatically
- [ ] View a form 10,001 times
- [ ] Verify 10,001st view is blocked with error message
- [ ] Submit 1,001 responses
- [ ] Verify 1,001st submission is blocked with error message

#### 2. Usage Tracking
- [ ] View a form
- [ ] Query `activeOrganization.subscription`
- [ ] Verify `viewsUsed` incremented by 1
- [ ] Submit a form response
- [ ] Query `activeOrganization.subscription`
- [ ] Verify `submissionsUsed` incremented by 1

#### 3. Usage Warnings
- [ ] Set usage to 8,000 views (80%)
- [ ] Check `usage.views.warning` is `true`
- [ ] Verify warning banner shows in dashboard
- [ ] Set usage to 9,500 views (95%)
- [ ] Verify orange color in progress bar

#### 4. Upgrade Flow (TODO - Requires Frontend)
- [ ] Open subscription dashboard
- [ ] Click "Upgrade Plan"
- [ ] Select Starter plan - Monthly - USD
- [ ] Click "Select Plan"
- [ ] Verify redirected to Chargebee checkout
- [ ] Complete payment with test card
- [ ] Verify redirected back to success page
- [ ] Check subscription updated to Starter
- [ ] Check limits updated (unlimited views, 10k submissions)

#### 5. Webhook Events
- [ ] Trigger subscription renewal in Chargebee test mode
- [ ] Check webhook received in backend logs
- [ ] Verify `viewsUsed` and `submissionsUsed` reset to 0
- [ ] Verify period dates updated

#### 6. Portal Access
- [ ] Open subscription dashboard
- [ ] Click "Manage Subscription"
- [ ] Verify portal opens in new tab
- [ ] Verify can view billing history
- [ ] Verify can update payment method
- [ ] Make a change (e.g., cancel subscription)
- [ ] Verify webhook received and status updated

### Automated Testing

**GraphQL API Tests** (TODO):
```typescript
describe('Subscription API', () => {
  test('availablePlans returns all plans', async () => {
    const result = await query({ query: GET_AVAILABLE_PLANS });
    expect(result.data.availablePlans).toHaveLength(3);
  });

  test('enforces view limits', async () => {
    // Set subscription to 10,000 views used
    await setUsage(orgId, { viewsUsed: 10000 });

    // Try to view form
    const result = await query({
      query: GET_FORM,
      variables: { shortUrl: 'test-form' }
    });

    expect(result.errors[0].extensions.code).toBe('USAGE_LIMIT_EXCEEDED');
  });

  test('enforces submission limits', async () => {
    // Set subscription to 1,000 submissions used
    await setUsage(orgId, { submissionsUsed: 1000 });

    // Try to submit response
    const result = await mutation({
      mutation: SUBMIT_RESPONSE,
      variables: { formId, data: {} }
    });

    expect(result.errors[0].extensions.code).toBe('USAGE_LIMIT_EXCEEDED');
  });
});
```

### Chargebee Test Mode

**Test Cards**:
```
Visa Success: 4111 1111 1111 1111
Mastercard Success: 5555 5555 5555 4444
Amex Success: 3782 822463 10005

Declined: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
```

**Test Mode Configuration**:
1. Use test API key in `.env`: `CHARGEBEE_API_KEY="test_..."`
2. Configure webhook URL in Chargebee test site
3. Use test cards for checkout
4. Trigger events manually in Chargebee dashboard

---

## Deployment Checklist

### Environment Variables

**Backend** (`.env`):
```bash
# Chargebee Configuration
CHARGEBEE_SITE="dculus-global"
CHARGEBEE_API_KEY="live_Fh0vwXSHY45VO1XTEQCqmtiGFdOl62NC"

# Note: For testing, use test API key:
# CHARGEBEE_API_KEY="test_..."
```

### Chargebee Dashboard Configuration

1. **Plans & Pricing** ✅
   - [x] Create Item Family: `dculus-forms`
   - [x] Create Features: `form_views`, `form_submissions`
   - [x] Create Plans: Free, Starter, Advanced
   - [x] Create Item Prices (10 total)
   - [x] Configure entitlements

2. **Webhook Configuration** ⏳
   - [ ] Add webhook URL: `https://your-domain.com/api/webhooks/chargebee`
   - [ ] Enable events:
     - subscription_created
     - subscription_changed
     - subscription_renewed
     - subscription_cancelled
     - subscription_reactivated
     - payment_succeeded
     - payment_failed

3. **Hosted Pages** ⏳
   - [ ] Configure success URL: `https://your-domain.com/subscription/success`
   - [ ] Configure cancel URL: `https://your-domain.com/subscription/cancel`

### Database

1. **Schema Migration**
   ```bash
   pnpm db:generate  # Generate Prisma client
   pnpm db:push      # Push schema to MongoDB
   ```

2. **Verify Schema**
   ```bash
   pnpm db:studio    # Open Prisma Studio
   # Check that Subscription model exists
   ```

### Backend Deployment

1. **Build & Type-Check**
   ```bash
   pnpm --filter backend type-check
   pnpm --filter backend build
   ```

2. **Verify Chargebee Connection**
   ```bash
   npx tsx apps/backend/src/scripts/verify-chargebee.ts
   ```
   Expected output:
   ```
   ✅ Plans verified
   ✅ Features verified
   ✅ Item prices verified
   ```

3. **Start Server**
   ```bash
   pnpm backend:dev  # Development
   pnpm backend:start  # Production
   ```

4. **Verify Endpoints**
   - GraphQL Playground: `http://localhost:4000/graphql`
   - Webhook endpoint: `http://localhost:4000/api/webhooks/chargebee`

### Frontend Deployment

1. **Build & Type-Check**
   ```bash
   pnpm --filter form-app type-check
   pnpm --filter form-app build
   ```

2. **Verify GraphQL Operations**
   - Check that queries and mutations are properly typed
   - Verify Apollo Client can connect to backend

3. **Deploy Frontend**
   ```bash
   pnpm form-app:dev  # Development
   # Or deploy dist/ folder to hosting provider
   ```

### Post-Deployment Verification

1. **Smoke Tests**
   - [ ] Visit GraphQL playground
   - [ ] Run `availablePlans` query
   - [ ] Create test organization
   - [ ] Verify free subscription created
   - [ ] View a form, check usage incremented
   - [ ] Submit a response, check usage incremented

2. **Webhook Test**
   - [ ] Send test webhook from Chargebee dashboard
   - [ ] Check backend logs for received event
   - [ ] Verify event processed correctly

3. **End-to-End Test** (TODO - Requires Frontend)
   - [ ] Sign up for new account
   - [ ] Create organization
   - [ ] Open subscription dashboard
   - [ ] Click "Upgrade Plan"
   - [ ] Complete checkout
   - [ ] Verify subscription upgraded

---

## Troubleshooting

### Common Issues

#### Issue: "Chargebee API authentication failed"
**Symptoms**: Error when calling Chargebee API
**Causes**:
- Invalid API key
- API key for wrong site
- API key expired

**Solutions**:
1. Verify `CHARGEBEE_API_KEY` in `.env`
2. Check API key matches site: `CHARGEBEE_SITE="dculus-global"`
3. Regenerate API key in Chargebee dashboard if needed
4. Ensure using correct environment (test vs live)

#### Issue: "View limit exceeded" but usage is below limit
**Symptoms**: Forms blocked even though usage < limit
**Causes**:
- Usage counter out of sync
- Subscription record not found
- Limit set to 0 instead of null for unlimited

**Solutions**:
1. Check subscription record in database
2. Verify `viewsLimit` is set correctly
3. Reset usage counters if needed:
   ```typescript
   await prisma.subscription.update({
     where: { organizationId },
     data: { viewsUsed: 0 }
   });
   ```

#### Issue: Webhook not received
**Symptoms**: Subscription changes not syncing
**Causes**:
- Webhook URL not configured
- Webhook URL unreachable
- Chargebee sending to wrong URL

**Solutions**:
1. Verify webhook URL in Chargebee dashboard
2. Ensure backend server is publicly accessible
3. Check firewall/security rules allow Chargebee IPs
4. Test webhook manually:
   ```bash
   curl -X POST http://your-domain.com/api/webhooks/chargebee \
     -H "Content-Type: application/json" \
     -d '{"event_type":"subscription_created", ...}'
   ```

#### Issue: Usage not resetting on renewal
**Symptoms**: Counters stay at old values after billing period
**Causes**:
- `subscription_renewed` webhook not handled
- `handleSubscriptionRenewal()` not called
- Database update failed

**Solutions**:
1. Check backend logs for webhook receipt
2. Verify `handleSubscriptionRenewal()` is called
3. Check for errors in webhook handler
4. Manually reset if needed:
   ```typescript
   await prisma.subscription.update({
     where: { chargebeeSubscriptionId },
     data: {
       viewsUsed: 0,
       submissionsUsed: 0,
       currentPeriodStart: new Date(),
       currentPeriodEnd: addMonths(new Date(), 1)
     }
   });
   ```

#### Issue: Checkout redirect not working
**Symptoms**: User clicks "Upgrade" but nothing happens
**Causes**:
- `createCheckoutSession` mutation failing
- Invalid `itemPriceId`
- Chargebee customer not found

**Solutions**:
1. Check browser console for GraphQL errors
2. Verify `itemPriceId` matches Chargebee dashboard
3. Ensure organization has `chargebeeCustomerId`
4. Create customer if missing:
   ```typescript
   await createChargebeeCustomer(orgId, orgName, email);
   ```

#### Issue: Portal link not opening
**Symptoms**: "Manage Subscription" button doesn't work
**Causes**:
- `createPortalSession` mutation failing
- Invalid `chargebeeCustomerId`
- Popup blocked by browser

**Solutions**:
1. Check browser console for errors
2. Verify customer exists in Chargebee
3. Allow popups for your domain
4. Use `window.location.href` instead of `window.open()` as fallback

### Debugging Tips

**Enable Detailed Logging**:
```typescript
// In chargebeeService.ts
console.log('Chargebee API call:', {
  method: 'createCheckoutHostedPage',
  customerId,
  itemPriceId
});
```

**Check Usage in Real-Time**:
```graphql
query DebugSubscription($orgId: ID!) {
  organization(id: $orgId) {
    subscription {
      viewsUsed
      viewsLimit
      submissionsUsed
      submissionsLimit
      status
      currentPeriodEnd
    }
  }
}
```

**Manually Trigger Webhook**:
```bash
# In Chargebee dashboard: Settings > Webhooks > Test Webhook
# Or use curl:
curl -X POST http://localhost:4000/api/webhooks/chargebee \
  -H "Content-Type: application/json" \
  -d @test-webhook.json
```

**Reset Subscription for Testing**:
```typescript
// In Prisma Studio or via script
await prisma.subscription.update({
  where: { organizationId: 'org_test' },
  data: {
    viewsUsed: 0,
    submissionsUsed: 0,
    currentPeriodStart: new Date(),
    currentPeriodEnd: addMonths(new Date(), 1)
  }
});
```

---

## Remaining Tasks

### High Priority

1. **Organization Creation Hook** 🔴
   - **File**: Modify existing organization creation mutation
   - **Logic**: When organization created, auto-create Chargebee customer and free subscription
   - **Code**:
   ```typescript
   // In createOrganization mutation
   const org = await prisma.organization.create({ data: orgData });

   // Create Chargebee customer
   const customerId = await createChargebeeCustomer(
     org.id,
     org.name,
     user.email
   );

   // Create free subscription
   await createFreeSubscription(org.id, customerId);
   ```

2. **Upgrade Modal Component** 🔴
   - **File**: `apps/form-app/src/components/subscription/UpgradeModal.tsx`
   - **Features**:
     - Plan comparison table
     - Currency selector (USD/INR toggle)
     - Billing cycle toggle (Monthly/Yearly)
     - Pricing display with savings for yearly
     - "Select Plan" buttons that trigger checkout
   - **Wireframe**: See "Example UI Components" section above

3. **Checkout Success/Cancel Pages** 🟠
   - **Files**:
     - `apps/form-app/src/pages/subscription/success.tsx`
     - `apps/form-app/src/pages/subscription/cancel.tsx`
   - **Success Page**: Show confirmation, new plan details, link to dashboard
   - **Cancel Page**: Show cancellation message, link to try again

### Medium Priority

4. **Usage Warning Banner** 🟡
   - **File**: `apps/form-app/src/components/subscription/UsageWarning.tsx`
   - **Features**:
     - Show when usage >= 80%
     - Color-coded (orange 80-99%, red 100%+)
     - "Upgrade Now" button
     - Dismissible
   - **Placement**: Top of form builder, dashboard

5. **Public Pricing Page** 🟡
   - **File**: `apps/form-app/src/pages/pricing.tsx`
   - **Features**:
     - Marketing-style layout
     - Plan comparison cards
     - Feature checklist
     - Currency selector
     - "Get Started" buttons
     - FAQ section

6. **Settings Integration** 🟡
   - **Files**: Modify existing settings page
   - **Changes**:
     - Add "Subscription" tab
     - Embed `SubscriptionDashboard` component
     - Add to navigation menu

### Low Priority

7. **Email Notifications** 🟢
   - **Service**: Create email notification service
   - **Triggers**:
     - Usage approaching limit (80%)
     - Usage exceeded (100%)
     - Payment failed
     - Subscription cancelled
     - Subscription renewed

8. **Usage Guard Component** 🟢
   - **File**: `apps/form-app/src/components/subscription/UsageGuard.tsx`
   - **Purpose**: Reusable wrapper for features with usage limits
   - **Example**:
   ```typescript
   <UsageGuard resource="views">
     {({ exceeded, warning }) => (
       exceeded ? <UpgradePrompt /> :
       warning ? <WarningBanner /> :
       <FormViewer />
     )}
   </UsageGuard>
   ```

9. **Admin Analytics** 🟢
   - **Location**: Admin dashboard
   - **Metrics**:
     - Total revenue (MRR/ARR)
     - Plan distribution
     - Churn rate
     - Usage statistics
     - Conversion funnel

---

## Related Documentation

- **Architecture**: `CHARGEBEE_SUBSCRIPTION_ARCHITECTURE.md` - Original design document
- **Implementation Status**: `CHARGEBEE_IMPLEMENTATION_STATUS.md` - Phase-by-phase status
- **Final Summary**: `CHARGEBEE_FINAL_SUMMARY.md` - Quick reference guide
- **Integration Guide**: This document - Comprehensive developer guide

---

## Support & Resources

### Chargebee Resources
- **Dashboard**: https://dculus-global.chargebee.com/
- **API Documentation**: https://apidocs.chargebee.com/
- **Product Catalog 2.0**: https://www.chargebee.com/docs/2.0/
- **Webhooks**: https://www.chargebee.com/docs/2.0/webhooks.html
- **Support**: support@chargebee.com

### Internal Resources
- **GraphQL Playground**: http://localhost:4000/graphql (when running locally)
- **Prisma Studio**: Run `pnpm db:studio`
- **Setup Scripts**: `apps/backend/src/scripts/setup-chargebee.ts`
- **Verification**: `apps/backend/src/scripts/verify-chargebee.ts`

### Key Contacts
- **Chargebee Site**: dculus-global
- **API Environment**: Production
- **Webhook Secret**: (Configure in Chargebee dashboard)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Maintained By**: Development Team
**Next Review**: After Phase 5 & 6 completion
