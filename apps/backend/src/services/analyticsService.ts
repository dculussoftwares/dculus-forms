import { UAParser } from 'ua-parser-js';
import countries from 'i18n-iso-countries';
import * as ct from 'countries-and-timezones';
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { Reader } from '@maxmind/geoip2-node';
import { logger } from '../lib/logger.js';
import {
  formViewAnalyticsRepository,
  formSubmissionAnalyticsRepository,
} from '../repositories/index.js';
import { EdgeVisitorLocation } from '../middleware/edge-geolocation.js';
import { sanitizeEmbedAttribution } from '../lib/embedAttribution.js';

/**
 * Shapes of the two embed group-by results.
 *
 * The repository's `groupBy` is deliberately loosely typed (Prisma's overloads
 * need a non-optional `orderBy` that `GroupByArgs` does not carry), so the
 * result is narrowed here at the point of use rather than left as `any`.
 */
interface EmbedContextGroup {
  embedContext: string | null;
  _count: { _all: number };
}

interface EmbedHostGroup {
  embedHost: string | null;
  _count: { embedHost: number };
}

// Create require for CommonJS modules in ES module context
const require = createRequire(import.meta.url);

// Initialize locale registration using closure for state management
const initializeLocale = (() => {
  let isInitialized = false;
  return () => {
    if (!isInitialized) {
      countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
      isInitialized = true;
    }
  };
})();

// Types
interface AnalyticsData {
  formId: string;
  sessionId: string;
  userAgent: string;
  timezone?: string;
  language?: string;
  visitorGeo?: EdgeVisitorLocation;
  // Form Embed v1 — client-supplied, so both go through
  // sanitizeEmbedAttribution() before they reach the database.
  embedContext?: string;
  embedHost?: string;
}

interface SubmissionAnalyticsData extends AnalyticsData {
  responseId: string;
  completionTimeSeconds?: number;
}

interface UpdateFormStartTimeData {
  formId: string;
  sessionId: string;
  startedAt: string; // ISO 8601 timestamp
}

interface GeolocationResult {
  countryCode?: string;
  regionCode?: string;
  city?: string;
}

interface LocationDetails {
  countryAlpha2: string | null;
  region: string | null;
  regionCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  countryCode: string | null;
}

interface UserAgentInfo {
  operatingSystem: string | null;
  browser: string | null;
  browserVersion: string | null;
}

// Pure utility functions
const parseUserAgent = (userAgent: string): UserAgentInfo => {
  try {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    return {
      operatingSystem: result.os.name || null,
      browser: result.browser.name || null,
      browserVersion: result.browser.version || null
    };
  } catch (error) {
    logger.error('Error parsing user agent:', error);
    return {
      operatingSystem: null,
      browser: null,
      browserVersion: null
    };
  }
};

// MaxMind GeoIP2 reader — lazily initialised on first call
let geoReader: Awaited<ReturnType<typeof Reader.open>> | null = null;
let geoReaderInitAttempted = false;

const initGeoReader = async (): Promise<void> => {
  if (geoReaderInitAttempted) return;
  geoReaderInitAttempted = true;

  const dbPath = process.env.MAXMIND_DB_PATH;
  if (!dbPath || !existsSync(dbPath)) return;

  try {
    geoReader = await Reader.open(dbPath);
    logger.info('MaxMind GeoIP2 database loaded:', dbPath);
  } catch (err) {
    logger.warn('MaxMind GeoIP2 init failed (geolocation will be empty):', err);
  }
};

export const analyticsInternals = {
  getGeolocationFromIP: async (ip: string): Promise<GeolocationResult> => {
    if (!geoReaderInitAttempted) await initGeoReader();

    if (!geoReader || !ip || ip === '::1' || ip === '127.0.0.1') return {};

    try {
      const city = await geoReader.city(ip);
      return {
        countryCode: city.country?.isoCode ?? undefined,
        regionCode: city.subdivisions?.[0]?.isoCode ?? undefined,
        city: city.city?.names?.en ?? undefined,
      };
    } catch {
      return {};
    }
  }
};

const parseCoordinate = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const convertAlpha2ToAlpha3 = (alpha2?: string | null): string | null => {
  if (!alpha2) {
    return null;
  }

  try {
    initializeLocale();
    const code = countries.alpha2ToAlpha3(alpha2.toUpperCase());
    return code || null;
  } catch (error) {
    logger.error('Error converting alpha2 to alpha3:', error);
    return null;
  }
};

const extractVisitorLocation = (geo?: EdgeVisitorLocation): LocationDetails => {
  return {
    countryAlpha2: geo?.country?.toUpperCase() || null,
    region: geo?.region || null,
    regionCode: geo?.regionCode || null,
    city: geo?.city || null,
    latitude: parseCoordinate(geo?.latitude),
    longitude: parseCoordinate(geo?.longitude),
    countryCode: convertAlpha2ToAlpha3(geo?.country),
  };
};

const getCountryFromLanguage = (language: string): string | null => {
  try {
    initializeLocale();
    
    const parts = language.split('-');
    if (parts.length >= 2) {
      const alpha2Code = parts[1].toUpperCase();
      const alpha3Code = countries.alpha2ToAlpha3(alpha2Code);
      
      if (alpha3Code) {
        logger.info(`Language ${language} -> Alpha2: ${alpha2Code} -> Alpha3: ${alpha3Code}`);
        return alpha3Code;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error parsing country from language:', error);
    return null;
  }
};

const getCountryFromTimezone = (timezone: string): string | null => {
  try {
    initializeLocale();
    
    const timezoneInfo = ct.getTimezone(timezone);
    
    if (timezoneInfo && timezoneInfo.countries) {
      const countryCode = timezoneInfo.countries[0];
      if (countryCode) {
        const alpha3Code = countries.alpha2ToAlpha3(countryCode);
        
        if (alpha3Code) {
          logger.info(`Timezone ${timezone} -> Alpha2: ${countryCode} -> Alpha3: ${alpha3Code}`);
          return alpha3Code;
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error parsing country from timezone:', error);
    return null;
  }
};

const getCountryNameFromCode = (code: string): string => {
  try {
    initializeLocale();
    const countryName = countries.getName(code, 'en');
    return countryName || code || 'Unknown';
  } catch (error) {
    logger.error('Error getting country name from code:', error);
    return code || 'Unknown';
  }
};

// Higher-order functions for country detection
const detectCountryCode = async (data: AnalyticsData, clientIP?: string): Promise<string | null> => {
  // Method 1: IP geolocation (most accurate when available)
  if (clientIP) {
    try {
      const geoData = await analyticsInternals.getGeolocationFromIP(clientIP);
      if (geoData.countryCode) {
        return geoData.countryCode;
      }
    } catch (error) {
      logger.error('Error getting geolocation from IP:', error);
    }
  }

  // Method 2: Fallback to browser language
  if (data.language) {
    const countryCode = getCountryFromLanguage(data.language);
    if (countryCode) {
      logger.info(`Country from language ${data.language}: ${countryCode}`);
      return countryCode;
    }
  }

  // Method 3: Fallback to timezone
  if (data.timezone) {
    const countryCode = getCountryFromTimezone(data.timezone);
    if (countryCode) {
      logger.info(`Country from timezone ${data.timezone}: ${countryCode}`);
      return countryCode;
    }
  }

  return null;
};

const generateAnalyticsId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Main business logic functions
const trackFormView = async (
  data: AnalyticsData,
  clientIP?: string
): Promise<void> => {
  try {
    const userAgentData = parseUserAgent(data.userAgent);
    const locationDetails = extractVisitorLocation(data.visitorGeo);
    const countryCode =
      locationDetails.countryCode || (await detectCountryCode(data, clientIP));
    const analyticsId = generateAnalyticsId();

    await formViewAnalyticsRepository.createViewEvent({
      id: analyticsId,
      formId: data.formId,
      sessionId: data.sessionId,
      userAgent: data.userAgent,
      operatingSystem: userAgentData.operatingSystem,
      browser: userAgentData.browser,
      browserVersion: userAgentData.browserVersion,
      countryCode,
      countryAlpha2: locationDetails.countryAlpha2,
      regionCode: locationDetails.regionCode,
      region: locationDetails.region,
      city: locationDetails.city,
      longitude: locationDetails.longitude,
      latitude: locationDetails.latitude,
      timezone: data.timezone,
      language: data.language,
      viewedAt: new Date(),
      ...sanitizeEmbedAttribution(data),
    });
    
    logger.info(`Analytics tracked for form ${data.formId}, session ${data.sessionId}, country: ${countryCode || 'unknown'}`);
  } catch (error) {
    logger.error('Error tracking form view analytics:', error);
    // Don't throw error to avoid disrupting form viewing
  }
};

// Update form start time when user first interacts with form
const updateFormStartTime = async (data: UpdateFormStartTimeData): Promise<void> => {
  try {
    await formViewAnalyticsRepository.updateSessionMetrics(
      {
        formId: data.formId,
        sessionId: data.sessionId,
        startedAt: null, // Only update if not already set
      },
      {
        startedAt: new Date(data.startedAt),
      }
    );
    
    logger.info(`Form start time updated for form ${data.formId}, session ${data.sessionId}`);
  } catch (error) {
    logger.error('Error updating form start time:', error);
    // Don't throw error to avoid disrupting form interaction
  }
};

const trackFormSubmission = async (
  data: SubmissionAnalyticsData,
  clientIP?: string
): Promise<void> => {
  try {
    const userAgentData = parseUserAgent(data.userAgent);
    const locationDetails = extractVisitorLocation(data.visitorGeo);
    const countryCode =
      locationDetails.countryCode || (await detectCountryCode(data, clientIP));
    const analyticsId = generateAnalyticsId();

    await formSubmissionAnalyticsRepository.createSubmissionEvent({
      id: analyticsId,
      formId: data.formId,
      responseId: data.responseId,
      sessionId: data.sessionId,
      userAgent: data.userAgent,
      operatingSystem: userAgentData.operatingSystem,
      browser: userAgentData.browser,
      browserVersion: userAgentData.browserVersion,
      countryCode,
      countryAlpha2: locationDetails.countryAlpha2,
      regionCode: locationDetails.regionCode,
      region: locationDetails.region,
      city: locationDetails.city,
      longitude: locationDetails.longitude,
      latitude: locationDetails.latitude,
      timezone: data.timezone,
      language: data.language,
      submittedAt: new Date(),
      completionTimeSeconds: data.completionTimeSeconds ?? null,
      ...sanitizeEmbedAttribution(data),
    });
    
    logger.info(`Submission analytics tracked for form ${data.formId}, response ${data.responseId}, session ${data.sessionId}, country: ${countryCode || 'unknown'}`);
  } catch (error) {
    logger.error('Error tracking form submission analytics:', error);
    // Don't throw error to avoid disrupting form submission
  }
};

// Helper function to generate date range for time series
const generateDateRange = (start: Date, end: Date): string[] => {
  const dates: string[] = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]); // YYYY-MM-DD format
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

// Helper function to create completion time distribution ranges
const createCompletionTimeDistribution = (completionTimes: number[]) => {
  const ranges = [
    { label: '0-30 seconds', minSeconds: 0, maxSeconds: 30 },
    { label: '31-60 seconds', minSeconds: 31, maxSeconds: 60 },
    { label: '1-2 minutes', minSeconds: 61, maxSeconds: 120 },
    { label: '2-5 minutes', minSeconds: 121, maxSeconds: 300 },
    { label: '5-10 minutes', minSeconds: 301, maxSeconds: 600 },
    { label: '10+ minutes', minSeconds: 601, maxSeconds: null }
  ];
  
  const total = completionTimes.length;
  
  return ranges.map(range => {
    const count = completionTimes.filter(time => {
      if (range.maxSeconds === null) {
        return time >= range.minSeconds;
      }
      return time >= range.minSeconds && time <= range.maxSeconds;
    }).length;
    
    return {
      ...range,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0
    };
  }).filter(range => range.count > 0); // Only return ranges with data
};

/**
 * Bucketed view counts for the `Form.dashboardStats` field resolver. All
 * three counts are independent and safe to run concurrently.
 */
const getDashboardViewCounts = async (
  formId: string,
  ranges: { weekAgo: Date; twoWeeksAgo: Date }
): Promise<{ total: number; thisWeek: number; lastWeek: number }> => {
  const [total, thisWeek, lastWeek] = await Promise.all([
    formViewAnalyticsRepository.count({ where: { formId } }),
    formViewAnalyticsRepository.count({ where: { formId, viewedAt: { gte: ranges.weekAgo } } }),
    formViewAnalyticsRepository.count({ where: { formId, viewedAt: { gte: ranges.twoWeeksAgo, lt: ranges.weekAgo } } }),
  ]);
  return { total, thisWeek, lastWeek };
};

/**
 * Average completion time across a form's submission analytics, ignoring
 * null and non-positive values. Computed in SQL (not loaded into JS memory)
 * so this stays cheap on the frequently-hit `Form.dashboardStats` field
 * resolver even for forms with large submission volumes.
 */
const getAverageCompletionTime = async (formId: string): Promise<number | null> => {
  const avg = await formSubmissionAnalyticsRepository.getAverageCompletionTime(formId);
  return avg != null ? Number(avg) : null;
};

// Database query functions
const getFormAnalytics = async (formId: string, timeRange?: { start: Date; end: Date }) => {
  try {
    const whereClause: any = { formId };
    
    if (timeRange) {
      whereClause.viewedAt = {
        gte: timeRange.start,
        lte: timeRange.end
      };
    }
    
    // Parallel execution of database queries for better performance
    const [
      totalViews,
      uniqueSessions,
      countryStats,
      regionStats,
      cityStats,
      osStats,
      browserStats,
      embedContextStats,
      embedHostStats,
      rawDailyViews,
    ] = await Promise.all([
      formViewAnalyticsRepository.count({ where: whereClause }),

      formViewAnalyticsRepository.countDistinctSessions(formId, timeRange),

      formViewAnalyticsRepository.groupBy({
        by: ['countryCode'],
        where: { ...whereClause, countryCode: { not: null } },
        _count: { countryCode: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 10
      }),

      formViewAnalyticsRepository.groupBy({
        by: ['region', 'regionCode', 'countryAlpha2'],
        where: { ...whereClause, region: { not: null } },
        _count: { region: true },
        orderBy: { _count: { region: 'desc' } },
        take: 10
      }),

      formViewAnalyticsRepository.groupBy({
        by: ['city', 'region', 'regionCode', 'countryAlpha2'],
        where: { ...whereClause, city: { not: null } },
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: 10
      }),
      
      formViewAnalyticsRepository.groupBy({
        by: ['operatingSystem'],
        where: { ...whereClause, operatingSystem: { not: null } },
        _count: { operatingSystem: true },
        orderBy: { _count: { operatingSystem: 'desc' } },
        take: 10
      }),
      
      formViewAnalyticsRepository.groupBy({
        by: ['browser'],
        where: { ...whereClause, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 10
      }),
      
      // Form Embed v1 traffic sources. NULL embedContext is every row that
      // predates the feature plus every non-embedded view, and both mean the
      // same thing — so the null bucket is folded into 'direct' below rather
      // than being backfilled or shown as its own category.
      formViewAnalyticsRepository.groupBy({
        by: ['embedContext'],
        where: whereClause,
        _count: { _all: true },
      }),

      formViewAnalyticsRepository.groupBy({
        by: ['embedHost'],
        where: { ...whereClause, embedHost: { not: null } },
        _count: { embedHost: true },
        orderBy: { _count: { embedHost: 'desc' } },
        take: 10,
      }),

      formViewAnalyticsRepository.getDailyViewStats(formId, timeRange),
    ]);

    // Transform data using functional programming principles
    const topCountries = countryStats.map((stat: any) => ({
      code: stat.countryCode,
      name: getCountryNameFromCode(stat.countryCode || ''),
      count: stat._count.countryCode,
      percentage: totalViews > 0 ? (stat._count.countryCode / totalViews) * 100 : 0
    }));

    const topRegions = regionStats
      .filter((stat: any) => stat.region)
      .map((stat: any) => ({
        name: stat.region,
        code: stat.regionCode,
        countryCode: stat.countryAlpha2,
        count: stat._count.region,
        percentage: totalViews > 0 ? (stat._count.region / totalViews) * 100 : 0
      }));

    const topCities = cityStats
      .filter((stat: any) => stat.city)
      .map((stat: any) => ({
        name: stat.city,
        region: stat.region,
        countryCode: stat.countryAlpha2,
        count: stat._count.city,
        percentage: totalViews > 0 ? (stat._count.city / totalViews) * 100 : 0
      }));
    
    const topOperatingSystems = osStats.map((stat: any) => ({
      name: stat.operatingSystem,
      count: stat._count.operatingSystem,
      percentage: totalViews > 0 ? (stat._count.operatingSystem / totalViews) * 100 : 0
    }));
    
    const topBrowsers = browserStats.map((stat: any) => ({
      name: stat.browser,
      count: stat._count.browser,
      percentage: totalViews > 0 ? (stat._count.browser / totalViews) * 100 : 0
    }));
    
    // Fold the null bucket into 'direct': a view with no embed context is a
    // view of the hosted page, whether it was recorded before this feature
    // existed or simply wasn't embedded.
    const contextCounts = new Map<string, number>();
    for (const stat of embedContextStats as EmbedContextGroup[]) {
      const key = stat.embedContext ?? 'direct';
      contextCounts.set(key, (contextCounts.get(key) ?? 0) + stat._count._all);
    }
    const trafficSources = Array.from(contextCounts.entries())
      .map(([context, count]) => ({
        context,
        count,
        percentage: totalViews > 0 ? (count / totalViews) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const topEmbedHosts = (embedHostStats as EmbedHostGroup[]).map((stat) => ({
      host: stat.embedHost,
      count: stat._count.embedHost,
      percentage: totalViews > 0 ? (stat._count.embedHost / totalViews) * 100 : 0,
    }));

    // Fill in missing dates with zero values if timeRange is specified
    let viewsOverTime = rawDailyViews;
    if (timeRange && rawDailyViews.length > 0) {
      const dateRange = generateDateRange(timeRange.start, timeRange.end);
      viewsOverTime = dateRange.map(date => {
        const existingData = rawDailyViews.find(v => v.date === date);
        return existingData || { date, views: 0, sessions: 0 };
      });
    }

    return {
      totalViews,
      uniqueSessions,
      topCountries,
      topRegions,
      topCities,
      topOperatingSystems,
      topBrowsers,
      trafficSources,
      topEmbedHosts,
      viewsOverTime
    };
  } catch (error) {
    logger.error('Error getting form analytics:', error);
    throw new Error('Failed to fetch analytics data');
  }
};

/**
 * Get organization's daily views and submissions for a given time period.
 * Returns merged data sorted by date in ascending order.
 */
const getOrgDailyUsage = async (
  organizationId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Array<{ date: string; views: number; submissions: number }>> => {
  try {
    const [viewRows, submissionRows] = await Promise.all([
      formViewAnalyticsRepository.getOrgDailyViewCounts(organizationId, periodStart, periodEnd),
      formSubmissionAnalyticsRepository.getOrgDailySubmissionCounts(organizationId, periodStart, periodEnd),
    ]);

    const merged = new Map<string, { views: number; submissions: number }>();

    for (const row of viewRows) {
      const date = new Date(row.date).toISOString().split('T')[0];
      merged.set(date, { views: Number(row.views), submissions: 0 });
    }
    for (const row of submissionRows) {
      const date = new Date(row.date).toISOString().split('T')[0];
      const existing = merged.get(date);
      if (existing) {
        existing.submissions = Number(row.submissions);
      } else {
        merged.set(date, { views: 0, submissions: Number(row.submissions) });
      }
    }

    return Array.from(merged.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));
  } catch (error) {
    logger.error('Error getting org daily usage:', error);
    throw new Error('Failed to fetch org daily usage data');
  }
};

// Initialize service (log startup)
const initializeService = () => {
  const dbPath = process.env.MAXMIND_DB_PATH;
  if (dbPath && existsSync(dbPath)) {
    logger.info('GeoIP service: MaxMind database path configured, will load on first request');
  } else {
    logger.info('GeoIP service initialized (fallback mode — set MAXMIND_DB_PATH to enable IP geolocation)');
  }
};

/**
 * Delete FormViewAnalytics and FormSubmissionAnalytics records older than
 * `daysToRetain` days. Intended to be called on a daily schedule.
 *
 * P2-08: Analytics cleanup job — default retention is 365 days.
 */
export const cleanupOldAnalytics = async (daysToRetain = 365): Promise<void> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToRetain);

  const [viewsDeleted, submissionsDeleted] = await Promise.all([
    formViewAnalyticsRepository.deleteMany({ where: { viewedAt: { lt: cutoff } } }),
    formSubmissionAnalyticsRepository.deleteMany({ where: { submittedAt: { lt: cutoff } } }),
  ]);

  logger.info(
    `Analytics cleanup: deleted ${viewsDeleted.count} views, ${submissionsDeleted.count} submissions older than ${daysToRetain} days`
  );
};

// Database query functions for submission analytics
const getFormSubmissionAnalytics = async (formId: string, timeRange?: { start: Date; end: Date }) => {
  try {
    const whereClause: any = { formId };
    
    if (timeRange) {
      whereClause.submittedAt = {
        gte: timeRange.start,
        lte: timeRange.end
      };
    }
    
    // Parallel execution of database queries for better performance
    const [
      totalSubmissions,
      uniqueSessions,
      countryStats,
      regionStats,
      cityStats,
      osStats,
      browserStats,
      rawDailySubmissions,
      completionTimePercentilesRaw,
      completionTimeDistributionData,
    ] = await Promise.all([
      formSubmissionAnalyticsRepository.count({ where: whereClause }),

      formSubmissionAnalyticsRepository.countDistinctSessions(formId, timeRange),

      formSubmissionAnalyticsRepository.groupBy({
        by: ['countryCode'],
        where: { ...whereClause, countryCode: { not: null } },
        _count: { countryCode: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 10
      }),

      formSubmissionAnalyticsRepository.groupBy({
        by: ['region', 'regionCode', 'countryAlpha2'],
        where: { ...whereClause, region: { not: null } },
        _count: { region: true },
        orderBy: { _count: { region: 'desc' } },
        take: 10
      }),
      
      formSubmissionAnalyticsRepository.groupBy({
        by: ['city', 'region', 'regionCode', 'countryAlpha2'],
        where: { ...whereClause, city: { not: null } },
        _count: { city: true },
        orderBy: { _count: { city: 'desc' } },
        take: 10
      }),
      
      formSubmissionAnalyticsRepository.groupBy({
        by: ['operatingSystem'],
        where: { ...whereClause, operatingSystem: { not: null } },
        _count: { operatingSystem: true },
        orderBy: { _count: { operatingSystem: 'desc' } },
        take: 10
      }),
      
      formSubmissionAnalyticsRepository.groupBy({
        by: ['browser'],
        where: { ...whereClause, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 10
      }),
      
      formSubmissionAnalyticsRepository.getDailySubmissionStats(formId, timeRange),

      // P2-05: Completion time percentiles computed in SQL to avoid loading all rows
      // into JS memory. PERCENTILE_CONT is a PostgreSQL ordered-set aggregate.
      formSubmissionAnalyticsRepository.getCompletionTimePercentiles(formId),

      // Distribution still needs individual values — cap at 10,000 rows to avoid
      // loading unbounded data into memory for large forms.
      formSubmissionAnalyticsRepository.findMany({
        where: {
          ...whereClause,
          completionTimeSeconds: { not: null }
        },
        select: {
          completionTimeSeconds: true
        },
        take: 10_000,
      })
    ]);

    // Transform data using functional programming principles
    const topCountries = countryStats.map((stat: any) => ({
      code: stat.countryCode,
      name: getCountryNameFromCode(stat.countryCode || ''),
      count: stat._count.countryCode,
      percentage: totalSubmissions > 0 ? (stat._count.countryCode / totalSubmissions) * 100 : 0
    }));

    const topRegions = regionStats
      .filter((stat: any) => stat.region)
      .map((stat: any) => ({
        name: stat.region,
        code: stat.regionCode,
        countryCode: stat.countryAlpha2,
        count: stat._count.region,
        percentage: totalSubmissions > 0 ? (stat._count.region / totalSubmissions) * 100 : 0
      }));

    const topCities = cityStats
      .filter((stat: any) => stat.city)
      .map((stat: any) => ({
        name: stat.city,
        region: stat.region,
        countryCode: stat.countryAlpha2,
        count: stat._count.city,
        percentage: totalSubmissions > 0 ? (stat._count.city / totalSubmissions) * 100 : 0
      }));
    
    const topOperatingSystems = osStats.map((stat: any) => ({
      name: stat.operatingSystem,
      count: stat._count.operatingSystem,
      percentage: totalSubmissions > 0 ? (stat._count.operatingSystem / totalSubmissions) * 100 : 0
    }));
    
    const topBrowsers = browserStats.map((stat: any) => ({
      name: stat.browser,
      count: stat._count.browser,
      percentage: totalSubmissions > 0 ? (stat._count.browser / totalSubmissions) * 100 : 0
    }));
    
    // Fill in missing dates with zero values if timeRange is specified
    let submissionsOverTime = rawDailySubmissions;
    if (timeRange && rawDailySubmissions.length > 0) {
      const dateRange = generateDateRange(timeRange.start, timeRange.end);
      submissionsOverTime = dateRange.map(date => {
        const existingData = rawDailySubmissions.find(s => s.date === date);
        return existingData || { date, submissions: 0, sessions: 0 };
      });
    }
    
    // P2-05: Use SQL-computed percentiles — no JS-side sort over all rows needed
    const sqlPercentiles = completionTimePercentilesRaw ?? null;
    const averageCompletionTime = sqlPercentiles?.avg != null ? Number(sqlPercentiles.avg) : null;
    const completionTimePercentiles = sqlPercentiles
      ? {
          p50: sqlPercentiles.p50 != null ? Number(sqlPercentiles.p50) : null,
          p75: sqlPercentiles.p75 != null ? Number(sqlPercentiles.p75) : null,
          p90: sqlPercentiles.p90 != null ? Number(sqlPercentiles.p90) : null,
          p95: sqlPercentiles.p95 != null ? Number(sqlPercentiles.p95) : null,
        }
      : { p50: null, p75: null, p90: null, p95: null };

    // Distribution still computed in JS (capped at 10,000 rows above)
    const completionTimes = completionTimeDistributionData
      .map((record: any) => record.completionTimeSeconds)
      .filter((time: number) => time != null && time > 0);
    const completionTimeDistribution = createCompletionTimeDistribution(completionTimes);
    
    return {
      totalSubmissions,
      uniqueSessions,
      averageCompletionTime,
      completionTimePercentiles,
      topCountries,
      topRegions,
      topCities,
      topOperatingSystems,
      topBrowsers,
      submissionsOverTime,
      completionTimeDistribution
    };
  } catch (error) {
    logger.error('Error getting form submission analytics:', error);
    throw new Error('Failed to fetch submission analytics data');
  }
};

// Service object using functional composition
const analyticsService = {
  trackFormView,
  updateFormStartTime,
  trackFormSubmission,
  getFormAnalytics,
  getFormSubmissionAnalytics,
  getOrgDailyUsage,
  getDashboardViewCounts,
  getAverageCompletionTime,
  initialize: initializeService
};

// Initialize on module load
analyticsService.initialize();

export { analyticsService };
