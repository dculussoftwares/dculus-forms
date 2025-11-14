# Cloudflare Geolocation Integration

## Overview

Cloudflare's IP Geolocation feature automatically adds geographic information headers to every request proxied through Cloudflare's network. This integration extracts and exposes that data throughout the backend application.

## Prerequisites

### 1. Cloudflare Configuration

**Step 1: Enable IP Geolocation (Free)**
1. Log in to Cloudflare Dashboard
2. Select your domain
3. Go to **Network** settings
4. Enable **IP Geolocation**
5. This provides `CF-IPCountry` header automatically

**Step 2: Enable Visitor Location Headers (Recommended)**
1. Go to **Rules** > **Transform Rules** > **Managed Transforms**
2. Enable **"Add visitor location headers"**
3. This adds all location headers listed below

**Step 3: Verify DNS Proxy Status**
1. Go to **DNS** settings
2. Ensure your backend subdomain has **orange cloud** icon (proxied)
3. Gray cloud = DNS only (no Cloudflare features)

**Verify Setup:**
```bash
# Check if your domain is proxied through Cloudflare
curl -I https://form-services-dev.dculus.com/health
# Look for: CF-Ray header (indicates Cloudflare proxy)
```

### 2. Available Geolocation Headers

| Header | Description | Availability |
|--------|-------------|--------------|
| `CF-IPCountry` | ISO 3166-1 Alpha 2 country code (e.g., "US", "GB", "IN") | ✅ All plans (IP Geolocation enabled) |
| `CF-IPContinent` | Continent code (e.g., "NA", "EU", "AS") | ✅ With Managed Transform |
| `CF-IPCity` | City name (UTF-8 encoded) | ✅ With Managed Transform |
| `CF-Region` | Region/state name | ✅ With Managed Transform |
| `CF-Region-Code` | Region/state code (e.g., "CA", "TX") | ✅ With Managed Transform |
| `CF-Postal-Code` | Postal/ZIP code | ✅ With Managed Transform |
| `CF-Metro-Code` | Metro code (DMA for US) | ✅ With Managed Transform |
| `CF-IPLatitude` | Latitude coordinate | ✅ With Managed Transform |
| `CF-IPLongitude` | Longitude coordinate | ✅ With Managed Transform |
| `CF-Timezone` | IANA timezone name | ✅ With Managed Transform |
| `CF-Connecting-IP` | Original visitor IP address | ✅ All plans (confirmed working) |
| `CF-Ray` | Cloudflare Ray ID (includes data center code) | ✅ All plans (confirmed working) |

**Notes:**
- `CF-IPCountry` requires only **IP Geolocation** enabled (Network settings)
- All other location headers require **"Add visitor location headers"** Managed Transform (Rules > Transform Rules > Managed Transforms)
- City names with non-ASCII characters are UTF-8 encoded (e.g., `São Paulo` → `S\u00c3\u00a3o Paulo`)
- Accuracy varies by location; some fields may be empty for certain IPs

## Architecture

### Middleware Flow

```
Client Request
    ↓
Cloudflare Proxy (adds geolocation headers)
    ↓
Azure Container Apps Backend
    ↓
cloudflareGeolocationMiddleware (extracts headers)
    ↓
req.cloudflare = { country, continent, city, ... }
    ↓
Available in GraphQL context & route handlers
```

### Implementation Components

1. **Middleware**: `src/middleware/cloudflare-geolocation.ts`
   - Extracts Cloudflare headers from incoming requests
   - Attaches geolocation data to `req.cloudflare`
   - Provides helper functions for resolvers

2. **Debug Routes**: `src/routes/debug.ts`
   - `/debug/cloudflare` - Inspect geolocation data
   - `/debug/headers` - View all request headers

3. **GraphQL Context**: `src/index.ts`
   - Geolocation data automatically available in all resolvers via `context.cloudflare`

## Usage Examples

### 1. In GraphQL Resolvers

```typescript
import { getGeolocationFromContext, getUserCountry } from '../../middleware/cloudflare-geolocation.js';

export const myResolvers = {
  Query: {
    myQuery: async (_: any, args: any, context: any) => {
      // Get full geolocation object
      const geo = getGeolocationFromContext(context);
      
      if (geo?.isProxied) {
        console.log('User location:', {
          country: geo.country,          // "US"
          continent: geo.continent,      // "NA"
          city: geo.city,                // "San Francisco"
          region: geo.region,            // "California"
          postalCode: geo.postalCode,    // "94107"
          timezone: geo.timezone,        // "America/Los_Angeles"
          coordinates: `${geo.latitude},${geo.longitude}`, // "37.7749,-122.4194"
          ip: geo.connectingIp,          // "203.0.113.1"
        });
      }

      // Get just the country code
      const country = getUserCountry(context);
      
      // Conditional logic based on location
      if (country === 'US') {
        // US-specific logic
      }

      // Check if user is from EU
      const isEU = isUserFromCountry(context, ['DE', 'FR', 'IT', 'ES', 'NL']);
      
      return { data: 'result' };
    },
  },
};
```

### 2. In Express Route Handlers

```typescript
import { Router } from 'express';

const router = Router();

router.get('/my-route', (req, res) => {
  const geo = req.cloudflare;
  
  if (geo?.isProxied) {
    console.log('Request from:', geo.country);
    
    // Conditional response based on location
    if (geo.country === 'US') {
      res.json({ message: 'Hello from the USA!' });
    } else {
      res.json({ message: `Hello from ${geo.country}!` });
    }
  } else {
    // Not proxied through Cloudflare
    res.json({ message: 'Hello!' });
  }
});

export default router;
```

### 3. Analytics Integration

The analytics resolver already uses geolocation data:

```typescript
// src/graphql/resolvers/analytics.ts
trackFormView: async (_: any, { input }, context) => {
  // Automatically gets client IP from Cloudflare
  const clientIP = context.cloudflare?.connectingIp || fallbackIP;
  
  // Log location data
  if (context.cloudflare?.isProxied) {
    logger.info('Form view from:', {
      country: context.cloudflare.country,
      continent: context.cloudflare.continent,
    });
  }
  
  // Track analytics...
}
```

## Testing & Debugging

### Local Development

When testing locally (not proxied through Cloudflare):
- `context.cloudflare.isProxied` will be `false`
- Geolocation headers will be `undefined`
- Use debug endpoints to verify

### Debug Endpoints (Development Only)

#### 1. Check Cloudflare Geolocation
```bash
curl http://localhost:4000/debug/cloudflare
```

**Response:**
```json
{
  "success": true,
  "isProxiedThroughCloudflare": false,
  "cloudflareHeaders": {
    "cf-ipcountry": null,
    "cf-ipcontinent": null,
    "cf-connecting-ip": null,
    "cf-ray": null
  },
  "geolocationData": {
    "isProxied": false
  }
}
```

#### 2. Check All Headers
```bash
curl http://localhost:4000/debug/headers
```

### Production Testing

Test on deployed backend:

```bash
# Check if proxied through Cloudflare
curl -I https://api-dev.dculus.com/health

# Expected headers:
# CF-Ray: 1234567890abc-IAD
# CF-Cache-Status: DYNAMIC

# Test geolocation endpoint (only in dev/staging)
curl https://api-dev.dculus.com/debug/cloudflare
```

**Expected Production Response:**
```json
{
  "success": true,
  "isProxiedThroughCloudflare": true,
  "cloudflareHeaders": {
    "cf-ipcountry": "IN",
    "cf-ipcontinent": "AS",
    "cf-ipcity": "Chennai",
    "cf-region": "Tamil Nadu",
    "cf-region-code": "TN",
    "cf-postal-code": "600001",
    "cf-iplatitude": "13.0827",
    "cf-iplongitude": "80.2707",
    "cf-timezone": "Asia/Kolkata",
    "cf-connecting-ip": "2406:7400:1c3:6ed4:c549:edec:c16a:2953",
    "cf-ray": "99e467c6ca5e7f4b-MAA"
  },
  "geolocationData": {
    "country": "IN",
    "continent": "AS",
    "city": "Chennai",
    "region": "Tamil Nadu",
    "regionCode": "TN",
    "postalCode": "600001",
    "latitude": "13.0827",
    "longitude": "80.2707",
    "timezone": "Asia/Kolkata",
    "connectingIp": "2406:7400:1c3:6ed4:c549:edec:c16a:2953",
    "colo": "MAA",
    "ray": "99e467c6ca5e7f4b-MAA",
    "isProxied": true
  }
}
```

**Note:** All location fields shown above require the **"Add visitor location headers"** Managed Transform to be enabled. Without it, only `country`, `connectingIp`, and `ray` will be available.

## Helper Functions

### `getGeolocationFromContext(context)`
Returns full geolocation object or null.

```typescript
const geo = getGeolocationFromContext(context);
if (geo?.isProxied) {
  console.log(geo.country, geo.continent, geo.city);
}
```

### `getUserCountry(context)`
Returns ISO country code or null.

```typescript
const country = getUserCountry(context); // "US" or null
```

### `isUserFromCountry(context, countryCodes)`
Check if user is from specific countries.

```typescript
// Check if user is from EU countries
const isEU = isUserFromCountry(context, ['DE', 'FR', 'IT', 'ES']);

// Check if user is from US
const isUS = isUserFromCountry(context, ['US']);
```

## Common Use Cases

### 1. Regional Content/Pricing
```typescript
Query: {
  getFormPricing: async (_: any, { formId }, context) => {
    const country = getUserCountry(context);
    
    // Adjust pricing based on country
    if (country === 'US') {
      return { price: 10, currency: 'USD' };
    } else if (isUserFromCountry(context, ['GB', 'IE'])) {
      return { price: 8, currency: 'GBP' };
    } else {
      return { price: 9, currency: 'EUR' };
    }
  }
}
```

### 2. GDPR Compliance
```typescript
const isEU = isUserFromCountry(context, [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]);

if (isEU) {
  // Show GDPR consent banner
  // Apply EU-specific privacy rules
}
```

### 3. Form Response Analytics
```typescript
Mutation: {
  submitFormResponse: async (_: any, { input }, context) => {
    const geo = getGeolocationFromContext(context);
    
    const response = await prisma.formResponse.create({
      data: {
        ...input,
        metadata: {
          country: geo?.country,
          continent: geo?.continent,
          submittedAt: new Date(),
        }
      }
    });
    
    return response;
  }
}
```

### 4. Rate Limiting by Country
```typescript
if (context.cloudflare?.country === 'CN') {
  // Apply stricter rate limits for specific regions
  const recentRequests = await checkRateLimit(context.cloudflare.connectingIp);
  if (recentRequests > 10) {
    throw new Error('Rate limit exceeded');
  }
}
```

## Troubleshooting

### Issue: Geolocation headers are undefined

**Possible Causes:**
1. DNS record not proxied (gray cloud in Cloudflare)
2. IP Geolocation not enabled in Cloudflare
3. Testing locally (not going through Cloudflare)

**Solution:**
```bash
# 1. Check DNS proxy status in Cloudflare Dashboard
# 2. Enable IP Geolocation in Network settings
# 3. Test on deployed environment, not localhost

# Verify CF-Ray header is present:
curl -I https://api-dev.dculus.com/health | grep CF-Ray
```

### Issue: CF-IPCity is undefined

**Cause:** `CF-IPCity` header requires Cloudflare Enterprise plan.

**Solution:** Use country/continent data, or upgrade to Enterprise.

### Issue: Debug endpoints not available

**Cause:** Debug routes are disabled in production.

**Solution:**
- Test on `dev` or `staging` environment
- Or temporarily enable in production (not recommended)

## Security Considerations

### IP Spoofing Protection

Cloudflare headers can be trusted because:
1. Cloudflare strips these headers from incoming requests
2. Only Cloudflare can set them (when proxied)
3. `CF-Ray` header verifies the request passed through Cloudflare

**Always check `isProxied` flag:**
```typescript
if (context.cloudflare?.isProxied) {
  // Safe to trust geolocation data
  const country = context.cloudflare.country;
} else {
  // Don't trust client-provided location
}
```

### Privacy Considerations

- IP addresses are logged (via `CF-Connecting-IP`)
- Consider anonymizing IPs for GDPR compliance
- City data (Enterprise) is more sensitive than country data

## TypeScript Types

```typescript
interface CloudflareGeolocation {
  country?: string;        // "US", "GB", "IN"
  continent?: string;      // "NA", "EU", "AS"
  city?: string;           // "New York" (Enterprise only)
  connectingIp?: string;   // "203.0.113.1"
  colo?: string;           // "IAD", "LHR", "SIN"
  ray?: string;            // "1234567890abc-IAD"
  isProxied: boolean;      // true if via Cloudflare
}

// Express Request extends to include:
interface Request {
  cloudflare?: CloudflareGeolocation;
}

// GraphQL Context includes:
interface GraphQLContext {
  cloudflare?: CloudflareGeolocation;
  // ... other context
}
```

## References

- [Cloudflare IP Geolocation Docs](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-ipcountry)
- [Cloudflare Request Headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/)
- [Cloudflare Ray ID](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-ray)

## Related Files

- `apps/backend/src/middleware/cloudflare-geolocation.ts` - Middleware implementation
- `apps/backend/src/routes/debug.ts` - Debug endpoints
- `apps/backend/src/index.ts` - Integration point
- `apps/backend/src/graphql/resolvers/analytics.ts` - Usage example
