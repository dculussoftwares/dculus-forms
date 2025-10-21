# Chargebee Subscription System - Implementation Status

## ✅ COMPLETED PHASES (0-4)

### Phase 0: Chargebee Setup ✅
**Files Created:**
- `apps/backend/src/scripts/setup-chargebee.ts` - Automated Chargebee configuration script
- `apps/backend/src/scripts/verify-chargebee.ts` - Verification script
- `apps/backend/src/scripts/README-CHARGEBEE-SETUP.md` - Documentation

**What it does:**
- Creates item family: `dculus-forms`
- Creates features: `form_views`, `form_submissions`
- Creates 3 plan items: `free`, `starter`, `advanced`
- Creates 10 item prices (monthly + yearly for starter/advanced in USD/INR)
- Creates entitlements linking features to plans

**Chargebee Dashboard:**
- All plans configured and ready
- Multi-currency support (USD, INR)
- Metered features enabled

### Phase 1: Database & Events ✅
**Files Created:**
- `apps/backend/prisma/schema.prisma` - Added Subscription model
- `apps/backend/src/subscriptions/types.ts` - Event type definitions
- `apps/backend/src/subscriptions/events.ts` - Event emitter system
- `apps/backend/src/subscriptions/usageService.ts` - Usage tracking service
- `apps/backend/src/subscriptions/index.ts` - Module exports

**What it does:**
- Stores subscription data in MongoDB
- Tracks usage (viewsUsed, submissionsUsed)
- Emits events for form views and submissions
- Warns at 80% usage threshold
- Blocks actions when limits exceeded

**Database Schema:**
```prisma
model Subscription {
  id                      String   @id
  organizationId          String   @unique
  chargebeeCustomerId     String
  chargebeeSubscriptionId String?
  planId                  String   // 'free', 'starter', 'advanced'
  status                  String   // 'active', 'cancelled', etc.
  viewsUsed               Int
  submissionsUsed         Int
  viewsLimit              Int?     // null = unlimited
  submissionsLimit        Int?
  currentPeriodStart      DateTime
  currentPeriodEnd        DateTime
}
```

### Phase 2: GraphQL Schema & Resolvers ✅
**Files Modified:**
- `apps/backend/src/graphql/schema.ts` - Added Subscription types
- `apps/backend/src/graphql/resolvers/subscriptions.ts` - Created subscription resolvers
- `apps/backend/src/graphql/resolvers.ts` - Integrated subscription resolvers

**GraphQL API:**
```graphql
type Organization {
  subscription: Subscription
}

type Subscription {
  planId: String!
  status: SubscriptionStatus!
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
}

# Queries
query {
  availablePlans: [AvailablePlan!]!
  activeOrganization {
    subscription {
      usage {
        views { used limit percentage exceeded }
        submissions { used limit percentage exceeded }
      }
    }
  }
}

# Mutations
mutation {
  createCheckoutSession(itemPriceId: String!): CheckoutSessionResponse!
  createPortalSession: PortalSessionResponse!
}
```

### Phase 3: Usage Enforcement ✅
**Files Modified:**
- `apps/backend/src/graphql/resolvers/forms.ts` - Added view limit checks
- `apps/backend/src/graphql/resolvers/responses.ts` - Added submission limit checks

**What it does:**
- Blocks form viewing when `viewsExceeded === true`
- Blocks form submissions when `submissionsExceeded === true`
- Emits subscription events for usage tracking
- Usage automatically incremented via event listeners

**Enforcement Points:**
1. **Form Viewer** (`formByShortUrl` query):
   ```typescript
   // Check subscription usage limits
   const usageExceeded = await checkUsageExceeded(form.organizationId);
   if (usageExceeded.viewsExceeded) {
     throw new Error("Form view limit exceeded...");
   }
   ```

2. **Form Submission** (`submitResponse` mutation):
   ```typescript
   // Check subscription usage limits
   const usageExceeded = await checkUsageExceeded(form.organizationId);
   if (usageExceeded.submissionsExceeded) {
     throw new Error("Form submission limit exceeded...");
   }

   // After successful submission
   emitSubscriptionFormSubmitted(organizationId, formId, responseId);
   ```

### Phase 4: Chargebee Service & Webhooks ✅
**Files Created:**
- `apps/backend/src/services/chargebeeService.ts` - Chargebee API wrapper
- `apps/backend/src/routes/chargebee-webhooks.ts` - Webhook handlers
- `apps/backend/src/index.ts` - Added webhook route

**Chargebee Service Functions:**
- `createChargebeeCustomer()` - Create customer for organization
- `createFreeSubscription()` - Create free plan subscription
- `createCheckoutHostedPage()` - Generate checkout URL
- `createPortalSession()` - Generate portal URL
- `getChargebeeSubscription()` - Retrieve subscription details
- `cancelChargebeeSubscription()` - Cancel subscription
- `reactivateChargebeeSubscription()` - Reactivate subscription
- `syncSubscriptionFromWebhook()` - Sync from Chargebee events
- `handleSubscriptionRenewal()` - Reset usage counters
- `getAvailablePlans()` - Get plan/pricing data

**Webhook Handler:**
- Endpoint: `POST /api/webhooks/chargebee`
- Handles events:
  - `subscription_created`
  - `subscription_changed`
  - `subscription_renewed` (resets usage)
  - `subscription_cancelled`
  - `subscription_reactivated`
  - `payment_succeeded`
  - `payment_failed`

**Plan Configuration:**
```javascript
const PLAN_LIMITS = {
  free: {
    views: 10000,
    submissions: 1000,
  },
  starter: {
    views: null, // unlimited
    submissions: 10000,
  },
  advanced: {
    views: null, // unlimited
    submissions: 100000,
  },
}
```

---

## 🚧 REMAINING PHASES (5-6)

### Phase 5: Frontend Subscription Components
**Location:** `apps/form-app/src/`

**Components to Build:**

1. **Subscription Usage Guard** (`components/subscription/UsageGuard.tsx`)
   - Shows usage warnings at 80%, 90%, 100%
   - Displays upgrade prompts
   - Blocks actions when exceeded

2. **Subscription Dashboard** (`components/subscription/SubscriptionDashboard.tsx`)
   - Current plan display
   - Usage meters (views/submissions)
   - Billing period info
   - "Upgrade" and "Manage" buttons

3. **Upgrade Modal** (`components/subscription/UpgradeModal.tsx`)
   - Plan comparison table
   - Currency toggle (USD/INR)
   - Billing cycle toggle (monthly/yearly)
   - "Upgrade" button triggers checkout

4. **Pricing Page** (`pages/Pricing.tsx`)
   - Public pricing page
   - Currency selector
   - Billing cycle toggle
   - Plan cards with features
   - "Get Started" buttons

**GraphQL Queries Needed:**
```typescript
// Get current subscription
const GET_SUBSCRIPTION = gql`
  query GetSubscription {
    activeOrganization {
      id
      name
      subscription {
        planId
        status
        usage {
          views { used limit percentage exceeded }
          submissions { used limit percentage exceeded }
        }
      }
    }
  }
`;

// Get available plans
const GET_AVAILABLE_PLANS = gql`
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
```

**GraphQL Mutations Needed:**
```typescript
// Create checkout session
const CREATE_CHECKOUT_SESSION = gql`
  mutation CreateCheckoutSession($itemPriceId: String!) {
    createCheckoutSession(itemPriceId: $itemPriceId) {
      url
      hostedPageId
    }
  }
`;

// Create portal session
const CREATE_PORTAL_SESSION = gql`
  mutation CreatePortalSession {
    createPortalSession {
      url
    }
  }
`;
```

### Phase 6: Chargebee Checkout Integration
**Location:** `apps/form-app/src/`

**Implementation Steps:**

1. **Checkout Flow:**
   ```typescript
   const handleUpgrade = async (itemPriceId: string) => {
     // 1. Create checkout session
     const { data } = await createCheckoutSession({
       variables: { itemPriceId }
     });

     // 2. Redirect to Chargebee hosted page
     window.location.href = data.createCheckoutSession.url;
   };
   ```

2. **Return Handling:**
   - Success URL: `/subscription/success`
   - Cancel URL: `/subscription/cancel`
   - Chargebee redirects back with `hostedpage_id` param
   - Poll backend to check if subscription was created

3. **Portal Integration:**
   ```typescript
   const handleManageSubscription = async () => {
     // Open Chargebee portal in new window
     const { data } = await createPortalSession();
     window.open(data.createPortalSession.url, '_blank');
   };
   ```

4. **Organization Creation Hook:**
   - When new organization is created via better-auth
   - Automatically create Chargebee customer
   - Automatically create free subscription
   - Add to `createOrganization` mutation

---

## 📊 Current System State

### ✅ Backend: Fully Implemented
- Database schema ready
- Event-driven usage tracking active
- GraphQL API complete
- Webhook handlers ready
- Usage enforcement active

### ⏳ Frontend: Ready for Implementation
- All backend APIs available
- GraphQL schema available
- Ready to build UI components

### 🔧 Configuration Needed

**Environment Variables** (`.env`):
```bash
CHARGEBEE_SITE="dculus-global"
CHARGEBEE_API_KEY="live_Fh0vwXSHY45VO1XTEQCqmtiGFdOl62NC"
```

**Webhook URL** (Configure in Chargebee Dashboard):
```
https://your-domain.com/api/webhooks/chargebee
```

---

## 🎯 Next Steps

1. **Implement Frontend Components (Phase 5)**
   - Create `UsageGuard` component
   - Create `SubscriptionDashboard` component
   - Create `UpgradeModal` component
   - Create `Pricing` page

2. **Integrate Checkout Flow (Phase 6)**
   - Add checkout redirect logic
   - Handle return URLs
   - Add portal integration
   - Hook into organization creation

3. **Testing**
   - Test free plan limits
   - Test upgrade flow
   - Test usage tracking
   - Test webhook events

4. **Production Deployment**
   - Configure Chargebee webhooks
   - Update environment variables
   - Test in production

---

## 📝 Plan Pricing Summary

| Plan | Monthly (USD) | Yearly (USD) | Monthly (INR) | Yearly (INR) | Views | Submissions |
|------|---------------|--------------|---------------|--------------|-------|-------------|
| Free | $0 | - | ₹0 | - | 10,000 | 1,000 |
| Starter | $6 | $66 ($5.50/mo) | ₹489 | ₹5,400 (₹450/mo) | Unlimited | 10,000 |
| Advanced | $15 | $168 ($14/mo) | ₹1,289 | ₹14,268 (₹1,189/mo) | Unlimited | 100,000 |

---

## 🔍 Testing Commands

```bash
# Type check backend
pnpm --filter backend type-check

# Build backend
pnpm --filter backend build

# Run backend
pnpm backend:dev

# Test Chargebee setup
npx tsx apps/backend/src/scripts/verify-chargebee.ts

# Check subscription in database
# (Use Prisma Studio or MongoDB Compass)
```

---

## 📚 Key Files Reference

### Backend
- **Schema**: `apps/backend/prisma/schema.prisma`
- **Events**: `apps/backend/src/subscriptions/events.ts`
- **Usage Service**: `apps/backend/src/subscriptions/usageService.ts`
- **Chargebee Service**: `apps/backend/src/services/chargebeeService.ts`
- **GraphQL Schema**: `apps/backend/src/graphql/schema.ts`
- **Resolvers**: `apps/backend/src/graphql/resolvers/subscriptions.ts`
- **Webhooks**: `apps/backend/src/routes/chargebee-webhooks.ts`

### Frontend (To Be Created)
- **Usage Guard**: `apps/form-app/src/components/subscription/UsageGuard.tsx`
- **Dashboard**: `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx`
- **Upgrade Modal**: `apps/form-app/src/components/subscription/UpgradeModal.tsx`
- **Pricing Page**: `apps/form-app/src/pages/Pricing.tsx`
