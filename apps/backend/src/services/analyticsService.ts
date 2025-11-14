import { UAParser } from 'ua-parser-js';
import countries from 'i18n-iso-countries';
import * as ct from 'countries-and-timezones';
import { createRequire } from 'module';
import { logger } from '../lib/logger.js';
import {
  formViewAnalyticsRepository,
  formSubmissionAnalyticsRepository,
} from '../repositories/index.js';
import { EdgeVisitorLocation } from '../middleware/edge-geolocation.js';

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

export const analyticsInternals = {
  getGeolocationFromIP: async (_ip: string): Promise<GeolocationResult> => {
    try {
      // TODO: Implement MaxMind GeoIP2 when database is available
      return {};
    } catch (error) {
      logger.error('Error getting geolocation from IP:', error);
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

// Helper function to calculate completion time percentiles
const calculatePercentiles = (values: number[]) => {
  if (values.length === 0) return { p50: null, p75: null, p90: null, p95: null };
  
  const sorted = values.sort((a, b) => a - b);
  const len = sorted.length;
  
  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * len) - 1;
    return sorted[Math.max(0, Math.min(index, len - 1))];
  };
  
  return {
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95)
  };
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
      uniqueSessionsData,
      countryStats,
      regionStats,
      cityStats,
      osStats,
      browserStats,
      dailyViews,
    ] = await Promise.all([
      formViewAnalyticsRepository.count({ where: whereClause }),
      
      formViewAnalyticsRepository.groupBy({
        by: ['sessionId'],
        where: whereClause
      }),
      
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
      
      // Time-series data: Get all records for daily aggregation
      formViewAnalyticsRepository.findMany({
        where: whereClause,
        select: {
          viewedAt: true,
          sessionId: true
        },
        orderBy: {
          viewedAt: 'asc'
        }
      })
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
    
    // Process time-series data: Group by date
    const timeSeriesMap = new Map<string, { views: number; sessions: Set<string> }>();
    
    dailyViews.forEach((record: any) => {
      const dateKey = record.viewedAt.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!timeSeriesMap.has(dateKey)) {
        timeSeriesMap.set(dateKey, { views: 0, sessions: new Set() });
      }
      
      const dayData = timeSeriesMap.get(dateKey)!;
      dayData.views += 1;
      dayData.sessions.add(record.sessionId);
    });
    
    // Convert to array format expected by frontend
    const viewsOverTime = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        views: data.views,
        sessions: data.sessions.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Fill in missing dates with zero values if timeRange is specified
    let filledViewsOverTime = viewsOverTime;
    if (timeRange && viewsOverTime.length > 0) {
      const dateRange = generateDateRange(timeRange.start, timeRange.end);
      const existingDates = new Set(viewsOverTime.map(v => v.date));
      
      filledViewsOverTime = dateRange.map(date => {
        const existingData = viewsOverTime.find(v => v.date === date);
        return existingData || { date, views: 0, sessions: 0 };
      });
    }
    
    return {
      totalViews,
      uniqueSessions: uniqueSessionsData.length,
      topCountries,
      topRegions,
      topCities,
      topOperatingSystems,
      topBrowsers,
      viewsOverTime: filledViewsOverTime
    };
  } catch (error) {
    logger.error('Error getting form analytics:', error);
    throw new Error('Failed to fetch analytics data');
  }
};

// Initialize service (log startup)
const initializeService = () => {
  logger.info('GeoIP service initialized (fallback mode)');
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
      uniqueSessionsData,
      countryStats,
      regionStats,
      cityStats,
      osStats,
      browserStats,
      dailySubmissions,
      completionTimeData
    ] = await Promise.all([
      formSubmissionAnalyticsRepository.count({ where: whereClause }),
      
      formSubmissionAnalyticsRepository.groupBy({
        by: ['sessionId'],
        where: whereClause
      }),
      
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
      
      // Time-series data: Get all records for daily aggregation
      formSubmissionAnalyticsRepository.findMany({
        where: whereClause,
        select: {
          submittedAt: true,
          sessionId: true
        },
        orderBy: {
          submittedAt: 'asc'
        }
      }),
      
      // Completion time data: Get all completion times for statistical analysis
      formSubmissionAnalyticsRepository.findMany({
        where: { 
          ...whereClause, 
          completionTimeSeconds: { not: null } 
        },
        select: {
          completionTimeSeconds: true
        }
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
    
    // Process time-series data: Group by date
    const timeSeriesMap = new Map<string, { submissions: number; sessions: Set<string> }>();
    
    dailySubmissions.forEach((record: any) => {
      const dateKey = record.submittedAt.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!timeSeriesMap.has(dateKey)) {
        timeSeriesMap.set(dateKey, { submissions: 0, sessions: new Set() });
      }
      
      const dayData = timeSeriesMap.get(dateKey)!;
      dayData.submissions += 1;
      dayData.sessions.add(record.sessionId);
    });
    
    // Convert to array format expected by frontend
    const submissionsOverTime = Array.from(timeSeriesMap.entries())
      .map(([date, data]) => ({
        date,
        submissions: data.submissions,
        sessions: data.sessions.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // Fill in missing dates with zero values if timeRange is specified
    let filledSubmissionsOverTime = submissionsOverTime;
    if (timeRange && submissionsOverTime.length > 0) {
      const dateRange = generateDateRange(timeRange.start, timeRange.end);
      const existingDates = new Set(submissionsOverTime.map(v => v.date));
      
      filledSubmissionsOverTime = dateRange.map(date => {
        const existingData = submissionsOverTime.find(v => v.date === date);
        return existingData || { date, submissions: 0, sessions: 0 };
      });
    }
    
    // Process completion time data
    const completionTimes = completionTimeData
      .map((record: any) => record.completionTimeSeconds)
      .filter((time: number) => time != null && time > 0);
    
    const averageCompletionTime = completionTimes.length > 0 
      ? completionTimes.reduce((sum: number, time: number) => sum + time, 0) / completionTimes.length 
      : null;
    
    const completionTimePercentiles = calculatePercentiles(completionTimes);
    const completionTimeDistribution = createCompletionTimeDistribution(completionTimes);
    
    return {
      totalSubmissions,
      uniqueSessions: uniqueSessionsData.length,
      averageCompletionTime,
      completionTimePercentiles,
      topCountries,
      topRegions,
      topCities,
      topOperatingSystems,
      topBrowsers,
      submissionsOverTime: filledSubmissionsOverTime,
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
  initialize: initializeService
};

// Initialize on module load
analyticsService.initialize();

export { analyticsService };
