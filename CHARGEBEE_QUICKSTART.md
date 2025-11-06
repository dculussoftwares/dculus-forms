# Chargebee Integration - Quick Start Guide

**Status**: ✅ Production Ready
**Last Updated**: 2025-11-06

---

## 🚀 Quick Start (5 Minutes)

### 1. Set Environment Variables

**Backend** (`apps/backend/.env`):
```bash
CHARGEBEE_SITE="dculus-global"
CHARGEBEE_API_KEY="live_Fh0vwXSHY45VO1XTEQCqmtiGFdOl62NC"
FRONTEND_URL="http://localhost:3000"  # Use production URL for deployment
```

### 2. Database Migration

```bash
# From project root
pnpm db:generate
pnpm db:push
```

### 3. Start Services

```bash
# Terminal 1: Backend
pnpm backend:dev

# Terminal 2: Frontend
pnpm form-app:dev
```

### 4. Configure Chargebee Webhook (Production Only)

In Chargebee Dashboard → Settings → Webhooks:
- **URL**: `https://your-backend-domain.com/webhooks/chargebee`
- **Events**: Enable all subscription events

---

## ✅ Test The Integration

### Test 1: Free Plan Auto-Creation
1. Visit http://localhost:3000/signup
2. Create new account
3. Create new organization
4. Navigate to `/settings/subscription`
5. ✅ **Verify**: Free plan showing (10K views, 1K submissions)

### Test 2: Pricing Page
1. Visit http://localhost:3000/pricing
2. Toggle billing cycle (Monthly/Yearly)
3. Toggle currency (USD/INR)
4. ✅ **Verify**: Prices update correctly

### Test 3: Upgrade Flow (Test Mode)
1. In subscription dashboard, click "Upgrade Plan"
2. Select Starter → Monthly → USD
3. Click "Upgrade to Starter Plan"
4. Use test card: `4111 1111 1111 1111`
5. Complete checkout
6. ✅ **Verify**: Redirects to `/subscription/success`
7. ✅ **Verify**: Success page shows Starter plan details

### Test 4: Usage Warnings
1. Manually update database:
   ```typescript
   // In Prisma Studio or script
   await prisma.subscription.update({
     where: { organizationId: 'your-org-id' },
     data: { viewsUsed: 8500 } // 85% of 10K
   });
   ```
2. Navigate to dashboard
3. ✅ **Verify**: Orange warning banner appears

---

## 📁 Key Files Reference

### Frontend
- **Pricing Page**: `apps/form-app/src/pages/Pricing.tsx`
- **Success Page**: `apps/form-app/src/pages/subscription/success.tsx`
- **Cancel Page**: `apps/form-app/src/pages/subscription/cancel.tsx`
- **Usage Warning**: `apps/form-app/src/components/subscription/UsageWarning.tsx`
- **Subscription Dashboard**: `apps/form-app/src/components/subscription/SubscriptionDashboard.tsx`
- **Upgrade Modal**: `apps/form-app/src/components/subscription/UpgradeModal.tsx`

### Backend
- **Chargebee Service**: `apps/backend/src/services/chargebeeService.ts`
- **Webhook Handler**: `apps/backend/src/routes/chargebee-webhooks.ts`
- **GraphQL Resolvers**: `apps/backend/src/graphql/resolvers/subscriptions.ts`
- **Usage Service**: `apps/backend/src/subscriptions/usageService.ts`

### Translations
- `apps/form-app/src/locales/en/pricing.json`
- `apps/form-app/src/locales/en/usageWarning.json`
- `apps/form-app/src/locales/en/checkoutSuccess.json`
- `apps/form-app/src/locales/en/checkoutCancel.json`

---

## 🎯 Available Routes

### Public Routes
- `/pricing` - Public pricing page with plan comparison
- `/subscription/success` - Checkout success confirmation
- `/subscription/cancel` - Checkout cancellation page

### Protected Routes
- `/settings/subscription` - Subscription dashboard and management

---

## 🔧 GraphQL Operations

### Queries
```graphql
# Get available plans
query GetAvailablePlans {
  availablePlans {
    id
    name
    prices { id currency amount period }
    features { views submissions }
  }
}

# Get current subscription
query GetSubscription {
  activeOrganization {
    subscription {
      planId
      status
      viewsUsed
      submissionsUsed
      usage {
        views { exceeded warning percentage }
        submissions { exceeded warning percentage }
      }
    }
  }
}
```

### Mutations
```graphql
# Create checkout session
mutation CreateCheckoutSession($itemPriceId: String!) {
  createCheckoutSession(itemPriceId: $itemPriceId) {
    url
    hostedPageId
  }
}

# Create portal session
mutation CreatePortalSession {
  createPortalSession {
    url
  }
}
```

---

## 📊 Data Flow Summary

### Organization Creation
```
User Creates Org
  ↓
Auto-creates Chargebee customer
  ↓
Auto-creates free subscription
  ↓
10K views, 1K submissions limits
```

### Upgrade Flow
```
User clicks "Upgrade"
  ↓
Select plan & checkout
  ↓
Chargebee processes payment
  ↓
Webhook syncs subscription
  ↓
Redirect to success page
  ↓
Updated limits in dashboard
```

### Usage Enforcement
```
User views form
  ↓
Check usage < limit
  ↓
If exceeded: Block with error
If OK: Increment counter & show form
  ↓
If >= 80%: Show warning banner
```

---

## 🐛 Common Issues

### "Chargebee customer not found"
**Solution**: Organization hook may have failed. Manually create:
```typescript
const customerId = await createChargebeeCustomer(orgId, orgName, email);
await createFreeSubscription(orgId, customerId);
```

### "Checkout redirect not working"
**Solution**: Check `FRONTEND_URL` environment variable in backend.

### "Webhook not received"
**Solution**:
1. Verify webhook URL in Chargebee dashboard
2. Check backend is publicly accessible
3. Test manually: `curl -X POST https://your-backend.com/webhooks/chargebee`

---

## 📚 Documentation

- **Complete Guide**: `CHARGEBEE_INTEGRATION_GUIDE.md`
- **Implementation Summary**: `CHARGEBEE_IMPLEMENTATION_COMPLETE.md`
- **Architecture Details**: `CHARGEBEE_SUBSCRIPTION_ARCHITECTURE.md`

---

## ✨ Features Included

✅ **Subscription Management**
- Auto-create free subscriptions for new organizations
- Upgrade/downgrade flows with Chargebee checkout
- Self-service subscription portal

✅ **Usage Tracking**
- Real-time view and submission tracking
- Hard limits enforcement
- Warning banners at 80% usage

✅ **Multi-Currency & Billing**
- USD and INR currency support
- Monthly and yearly billing cycles
- 8% discount on yearly plans

✅ **UI Components**
- Public pricing page
- Subscription dashboard
- Upgrade modal with plan comparison
- Usage warning banners
- Success/cancel checkout pages

✅ **Internationalization**
- Full translation support
- All user-facing strings translated

✅ **Webhook Integration**
- Auto-sync subscription changes
- Auto-reset usage on renewal
- Handle cancellations and reactivations

---

**Ready to Deploy!** 🎉

All code is type-checked, tested, and production-ready.
Follow the deployment steps above to go live.

**Questions?** See detailed documentation in `CHARGEBEE_INTEGRATION_GUIDE.md`
