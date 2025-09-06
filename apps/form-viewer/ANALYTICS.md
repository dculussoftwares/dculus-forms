# Form Viewer Analytics

This document describes the analytics system implemented in the Form Viewer application.

## Overview

The Form Viewer includes a comprehensive analytics system that automatically tracks form views with privacy-first anonymous data collection. The system captures visitor metrics including operating system, browser, country, and session data without storing any personally identifiable information.

## Features

### 📊 Data Collected
- **View Metrics**: Total views and unique sessions
- **Geographic Data**: Country detection using 3-letter ISO codes (USA, CAN, GBR)
- **Technical Info**: Operating system, browser type and version
- **Context**: Timezone, language, and session information

### 🔒 Privacy-First Design
- **Anonymous Sessions**: UUID-based session tracking
- **No Personal Data**: IP addresses are not stored
- **GDPR Compliant**: Only aggregated metrics collected
- **Graceful Degradation**: Analytics failures don't affect form viewing

## Implementation

### Client-Side Hook

The `useFormAnalytics` hook automatically tracks form views:

```typescript
import { useFormAnalytics } from '../hooks/useFormAnalytics';

// In FormViewer component
useFormAnalytics({ 
  formId: form.id, 
  enabled: true 
});
```

### Session Management

```javascript
// Generates persistent session ID
let sessionId = localStorage.getItem('dculus_form_session_id');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem('dculus_form_session_id', sessionId);
}
```

### Data Collection

The hook automatically collects:
- `formId`: Form identifier
- `sessionId`: Anonymous UUID
- `userAgent`: Browser information
- `timezone`: User's timezone (e.g., "America/New_York")
- `language`: Browser language (e.g., "en-US")

## Backend Processing

### Analytics Service

The backend processes analytics data through several steps:

1. **User Agent Parsing**: Uses `ua-parser-js` to extract OS and browser info
2. **Country Detection**: Multiple fallback methods for geographic location
3. **Data Storage**: Stores in MongoDB via Prisma ORM

### Country Detection Methods

1. **IP Geolocation** (Primary): Uses MaxMind GeoIP2 when available
2. **Browser Language** (Fallback 1): Extracts from `navigator.language`
3. **Timezone Mapping** (Fallback 2): Maps timezone to country

### Database Schema

```prisma
model FormViewAnalytics {
  id              String   @id
  formId          String
  sessionId       String   // Anonymous UUID
  userAgent       String
  operatingSystem String?  // Windows, macOS, Linux
  browser         String?  // Chrome, Firefox, Safari
  browserVersion  String?
  countryCode     String?  // USA, CAN, GBR (ISO 3166-1 alpha-3)
  regionCode      String?
  city            String?
  timezone        String?  // America/New_York
  language        String?  // en-US
  viewedAt        DateTime @default(now())
  
  form Form @relation(fields: [formId], references: [id])
}
```

## GraphQL API

### Tracking Mutation

```graphql
mutation TrackFormView($input: TrackFormViewInput!) {
  trackFormView(input: $input) {
    success
  }
}
```

### Analytics Query

```graphql
query GetFormAnalytics($formId: ID!, $timeRange: TimeRangeInput) {
  formAnalytics(formId: $formId, timeRange: $timeRange) {
    totalViews
    uniqueSessions
    topCountries {
      code        # USA, CAN, GBR
      name        # United States, Canada, United Kingdom
      count
      percentage
    }
    topOperatingSystems {
      name        # Windows, macOS, Linux
      count
      percentage
    }
    topBrowsers {
      name        # Chrome, Firefox, Safari
      count
      percentage
    }
  }
}
```

## Dependencies

The analytics system uses these libraries:

```json
{
  "@maxmind/geoip2-node": "^6.1.0",
  "ua-parser-js": "^1.0.41", 
  "country-list": "^2.4.1",
  "@types/ua-parser-js": "*",
  "@types/country-list": "*"
}
```

## Usage Examples

### View Analytics Data

```bash
# Check recent analytics for a form
cd apps/backend
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.formViewAnalytics.findMany({
  where: { formId: 'your-form-id' },
  orderBy: { viewedAt: 'desc' },
  take: 10
}).then(console.log);
"
```

### Test Analytics Tracking

1. Start the development servers:
   ```bash
   pnpm backend:dev  # Backend on :4000
   pnpm form-viewer:dev  # Form viewer on :5173
   ```

2. Visit a form: `http://localhost:5173/f/YOUR_FORM_SHORT_URL`

3. Check backend logs for analytics tracking confirmation

## Files Modified/Added

### New Files
- `apps/form-viewer/src/hooks/useFormAnalytics.ts` - Client-side analytics hook
- `apps/backend/src/services/analyticsService.ts` - Analytics processing service
- `apps/backend/src/graphql/resolvers/analytics.ts` - GraphQL resolvers

### Modified Files
- `apps/form-viewer/src/pages/FormViewer.tsx` - Integrated analytics hook
- `apps/form-viewer/src/graphql/queries.ts` - Added analytics queries
- `apps/backend/src/graphql/schema.ts` - Added analytics types
- `apps/backend/src/graphql/resolvers.ts` - Registered analytics resolvers
- `apps/backend/prisma/schema.prisma` - Added FormViewAnalytics model

## Testing

The analytics system has been tested and verified to:
- ✅ Generate unique session IDs for each visitor
- ✅ Parse user agents correctly (OS, browser, version)
- ✅ Detect geographic location via timezone/language fallbacks
- ✅ Store data in MongoDB with proper indexing
- ✅ Handle errors gracefully without disrupting form viewing
- ✅ Maintain user privacy (no personal data stored)

## Dashboard Integration

The `formAnalytics` GraphQL query provides all necessary data for building analytics dashboards with:
- Real-time view counters
- Geographic distribution maps
- Browser/OS usage charts
- Session trend analysis
- Time-range filtering

This analytics system enables comprehensive form performance tracking while maintaining the highest standards of user privacy and data protection.