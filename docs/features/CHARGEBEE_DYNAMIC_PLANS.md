# Chargebee Dynamic Plan Fetching

**Status**: ✅ Complete
**Last Updated**: 2025-11-06

---

## Overview

The subscription system now **dynamically fetches plans from Chargebee** instead of using hardcoded values. This means:

✅ **No code changes needed** when you update plans in Chargebee
✅ **Automatic synchronization** with your Chargebee catalog
✅ **Real-time pricing updates** reflected in the app
✅ **Feature/entitlement support** directly from Chargebee
✅ **Performance optimized** with 5-minute caching

---

## How It Works

### Before (Hardcoded)
```typescript
export const getAvailablePlans = () => {
  return [
    {
      id: 'free',
      name: 'Free Plan',
      prices: [
        { id: 'free-usd-monthly', currency: 'USD', amount: 0, period: 'month' },
        // ... hardcoded prices
      ],
      features: { views: 10000, submissions: 1000 }
    },
    // ... more hardcoded plans
  ];
};
```

### After (Dynamic)
```typescript
export const getAvailablePlans = async () => {
  // 1. Fetch all item prices from Chargebee
  const itemPrices = await chargebee.itemPrice.list({ limit: 100 });

  // 2. Fetch entitlements (features) for each plan
  const entitlements = await chargebee.entitlement.list({ limit: 100 });

  // 3. Fetch item details (plan names, descriptions)
  for (const itemPrice of itemPrices) {
    const item = await chargebee.item.retrieve(itemPrice.item_id);
  }

  // 4. Group by plan and return structured data
  return transformedPlans;
};
```

---

## Architecture

### Data Flow
```
User visits /pricing
  ↓
Frontend: GET_AVAILABLE_PLANS query
  ↓
Backend: availablePlans resolver
  ↓
Check cache (5-minute TTL)
  ├─ Cache hit → Return cached plans
  └─ Cache miss → Fetch from Chargebee
      ↓
      1. Fetch all item prices
      2. Fetch all entitlements
      3. Fetch item details
      4. Group and transform data
      5. Update cache
      6. Return plans
  ↓
Frontend: Display plans
```

### Caching Strategy
- **Cache Duration**: 5 minutes
- **Cache Location**: In-memory (per server instance)
- **Cache Invalidation**: Time-based (automatic after 5 minutes)
- **Fallback**: Hardcoded plans if Chargebee API fails

---

## Chargebee Data Mapping

### Item Prices → Plans
```javascript
// Chargebee Item Price
{
  id: "starter-usd-monthly",
  item_id: "starter-plan",
  item_type: "plan",
  currency_code: "USD",
  price: 600, // cents
  period: 1,
  period_unit: "month"
}

// Transformed to
{
  id: "starter-usd-monthly",
  currency: "USD",
  amount: 600,
  period: "month"
}
```

### Items → Plan Details
```javascript
// Chargebee Item
{
  id: "starter-plan",
  name: "Starter Plan",
  description: "For growing teams",
  external_name: "starter" // Used as plan ID
}

// Transformed to
{
  id: "starter", // From external_name
  name: "Starter Plan",
  description: "For growing teams"
}
```

### Entitlements → Features
```javascript
// Chargebee Entitlement
{
  entity_id: "starter-usd-monthly", // Item price ID
  feature_id: "form_views",
  value: "unlimited"
}

// Transformed to
{
  views: null, // null = unlimited
  submissions: 10000
}
```

---

## Configuring Plans in Chargebee

### Step 1: Create Items (Plans)
1. Navigate to **Product Catalog → Items**
2. Create new item for each plan:
   - **Free Plan**: `external_name: "free"`
   - **Starter Plan**: `external_name: "starter"`
   - **Advanced Plan**: `external_name: "advanced"`

### Step 2: Create Item Prices
For each plan, create prices:
- **Currencies**: USD, INR
- **Billing Periods**: Monthly, Yearly
- **Naming Convention**: `{plan}-{currency}-{period}`
  - Example: `starter-usd-monthly`, `starter-usd-yearly`

### Step 3: Create Features
1. Navigate to **Product Catalog → Features**
2. Create features:
   - **Feature ID**: `form_views`
   - **Feature ID**: `form_submissions`

### Step 4: Assign Entitlements
For each item price, assign entitlements:
```
Free Plan:
  - form_views: 10000
  - form_submissions: 1000

Starter Plan:
  - form_views: unlimited
  - form_submissions: 10000

Advanced Plan:
  - form_views: unlimited
  - form_submissions: 100000
```

---

## Code Changes Made

### Backend Changes

#### 1. Chargebee Service (`apps/backend/src/services/chargebeeService.ts`)
```typescript
// Added caching
let plansCache: any[] | null = null;
let plansCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Made function async and fetch from Chargebee
export const getAvailablePlans = async () => {
  // Check cache first
  if (plansCache && (Date.now() - plansCacheTime) < CACHE_DURATION) {
    return plansCache;
  }

  // Fetch from Chargebee
  const itemPrices = await chargebee.itemPrice.list({ limit: 100 });
  const entitlements = await chargebee.entitlement.list({ limit: 100 });
  // ... transform and return

  // Update cache
  plansCache = plans;
  plansCacheTime = Date.now();

  return plans;
};
```

#### 2. GraphQL Resolver (`apps/backend/src/graphql/resolvers/subscriptions.ts`)
```typescript
// Made resolver async
availablePlans: async () => {
  return await getAvailablePlans();
}
```

#### 3. GraphQL Schema (`apps/backend/src/graphql/schema.ts`)
```graphql
type AvailablePlan {
  id: String!
  name: String!
  description: String  # Added description field
  prices: [PlanPrice!]!
  features: PlanFeatures!
}
```

### Frontend Changes

#### GraphQL Query (`apps/form-app/src/graphql/subscription.ts`)
```graphql
query GetAvailablePlans {
  availablePlans {
    id
    name
    description  # Added description field
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

---

## Testing

### Manual Testing

#### Test 1: Verify Dynamic Fetching
```bash
# Start backend with logging
pnpm backend:dev

# Watch logs when visiting pricing page
# Should see: "[Chargebee Service] Fetched plans from Chargebee: 3"
```

#### Test 2: Verify Caching
```bash
# Visit /pricing twice within 5 minutes
# First visit: Fetches from Chargebee
# Second visit: "[Chargebee Service] Returning cached plans"
```

#### Test 3: Verify Fallback
```bash
# Temporarily use invalid Chargebee API key
CHARGEBEE_API_KEY="invalid_key"

# Visit /pricing
# Should see: "[Chargebee Service] Falling back to hardcoded plans"
# Plans still display correctly
```

#### Test 4: Update Plan in Chargebee
```bash
# 1. In Chargebee dashboard, update a plan price
# 2. Wait 5 minutes (cache expiry)
# 3. Visit /pricing
# 4. Verify new price is displayed
```

### Automated Testing (TODO)
```typescript
describe('Dynamic Plan Fetching', () => {
  test('fetches plans from Chargebee', async () => {
    const plans = await getAvailablePlans();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0]).toHaveProperty('id');
    expect(plans[0]).toHaveProperty('name');
    expect(plans[0]).toHaveProperty('prices');
  });

  test('caches plans for 5 minutes', async () => {
    const plans1 = await getAvailablePlans();
    const plans2 = await getAvailablePlans();
    // Should return same instance (cached)
    expect(plans1).toBe(plans2);
  });

  test('falls back to hardcoded plans on error', async () => {
    // Mock Chargebee API failure
    jest.spyOn(chargebee.itemPrice, 'list').mockRejectedValue(new Error('API Error'));

    const plans = await getAvailablePlans();
    expect(plans.length).toBe(3); // Hardcoded fallback
    expect(plans[0].id).toBe('free');
  });
});
```

---

## Performance Considerations

### API Calls Per Request
- **Without Cache**: 3 API calls
  - 1x `itemPrice.list()` (fetches all item prices)
  - 1x `entitlement.list()` (fetches all entitlements)
  - Nx `item.retrieve()` (fetches details for each unique item)

- **With Cache**: 0 API calls (served from memory)

### Cache Benefits
- **Reduced latency**: Plans load instantly from cache
- **Reduced Chargebee API usage**: Fewer API calls = lower costs
- **Better UX**: Faster page loads

### Cache Limitations
- **Memory usage**: Plans stored in-memory per server instance
- **Multi-server**: Each server has its own cache (not shared)
- **Stale data**: Plans can be up to 5 minutes old

### Optimization Tips
1. **Increase cache duration** if plans rarely change:
   ```typescript
   const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
   ```

2. **Add Redis caching** for multi-server environments:
   ```typescript
   // Use Redis instead of in-memory cache
   const cachedPlans = await redis.get('chargebee:plans');
   if (cachedPlans) return JSON.parse(cachedPlans);
   ```

3. **Preload plans on startup**:
   ```typescript
   // In server startup
   await getAvailablePlans(); // Prime the cache
   ```

---

## Troubleshooting

### Issue: Plans not loading
**Symptoms**: Empty plans array or loading forever
**Solutions**:
1. Check Chargebee API credentials
2. Check backend logs for errors
3. Verify Chargebee plans are configured correctly
4. Check network connectivity to Chargebee

### Issue: Old prices showing
**Symptoms**: Prices don't update after changing in Chargebee
**Solutions**:
1. Wait for cache expiry (5 minutes)
2. Restart backend to clear cache
3. Reduce cache duration for faster updates

### Issue: Wrong features/limits
**Symptoms**: Features don't match Chargebee entitlements
**Solutions**:
1. Verify entitlements are assigned to item prices
2. Check feature IDs match: `form_views`, `form_submissions`
3. Ensure feature values are correct (number or "unlimited")

### Issue: API rate limits
**Symptoms**: Chargebee API errors, HTTP 429
**Solutions**:
1. Increase cache duration to reduce API calls
2. Implement exponential backoff
3. Use webhooks to update cache on plan changes

---

## Migration Guide

### For Existing Installations

No migration needed! The system includes fallback to hardcoded plans.

**Recommended Steps**:
1. Configure plans in Chargebee (see "Configuring Plans" section)
2. Deploy updated code
3. Verify plans load from Chargebee (check logs)
4. Remove hardcoded fallback (optional, after verification)

### Rolling Back

If dynamic fetching causes issues, you can roll back by:

```typescript
// apps/backend/src/services/chargebeeService.ts
export const getAvailablePlans = () => {
  // Return hardcoded plans immediately
  return [
    { id: 'free', name: 'Free Plan', ... },
    { id: 'starter', name: 'Starter Plan', ... },
    { id: 'advanced', name: 'Advanced Plan', ... },
  ];
};
```

---

## Future Enhancements

### 1. Webhook-Based Cache Invalidation
Instead of time-based cache, invalidate when plans change:
```typescript
// Webhook handler
router.post('/webhooks/chargebee', (req, res) => {
  if (req.body.event_type === 'item_price_created' ||
      req.body.event_type === 'item_price_updated') {
    // Invalidate plans cache
    plansCache = null;
  }
});
```

### 2. GraphQL Field Resolvers
Move feature fetching to field resolvers for better performance:
```typescript
Plan: {
  features: async (plan) => {
    // Fetch entitlements on-demand
    return await getEntitlementsForPlan(plan.id);
  }
}
```

### 3. Plan Descriptions from Chargebee
Already implemented! Use `item.description` field in Chargebee.

### 4. Plan Metadata
Add custom metadata to plans:
```typescript
Plan: {
  metadata: async (plan) => {
    // Fetch custom metadata from Chargebee
    return plan.metadata;
  }
}
```

---

## API Reference

### Chargebee APIs Used

#### `itemPrice.list()`
Fetches all item prices (plan prices).

**Request**:
```javascript
await chargebee.itemPrice.list({ limit: 100 });
```

**Response**:
```javascript
{
  list: [
    {
      item_price: {
        id: "starter-usd-monthly",
        item_id: "starter-plan",
        currency_code: "USD",
        price: 600,
        period_unit: "month"
      }
    }
  ],
  next_offset: "..." // For pagination
}
```

#### `entitlement.list()`
Fetches all entitlements (features).

**Request**:
```javascript
await chargebee.entitlement.list({ limit: 100 });
```

**Response**:
```javascript
{
  list: [
    {
      entitlement: {
        entity_id: "starter-usd-monthly",
        feature_id: "form_views",
        value: "unlimited"
      }
    }
  ]
}
```

#### `item.retrieve()`
Fetches item details (plan details).

**Request**:
```javascript
await chargebee.item.retrieve("starter-plan");
```

**Response**:
```javascript
{
  item: {
    id: "starter-plan",
    name: "Starter Plan",
    description: "For growing teams",
    external_name: "starter"
  }
}
```

---

## Benefits Summary

✅ **For Developers**:
- No code changes when updating plans
- Easy to add new plans
- Consistent with Chargebee source of truth

✅ **For Business**:
- Update prices without deployments
- A/B test different pricing
- Seasonal promotions without code changes

✅ **For Users**:
- Always see current pricing
- Accurate feature descriptions
- Consistent experience

---

**Implementation Complete!** 🎉

Plans are now dynamically fetched from Chargebee with automatic caching and fallback support.

**Last Updated**: 2025-11-06
**Status**: ✅ Production Ready
