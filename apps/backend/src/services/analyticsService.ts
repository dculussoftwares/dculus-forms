import { UAParser } from 'ua-parser-js';
import countries from 'i18n-iso-countries';
import * as ct from 'countries-and-timezones';
import { createRequire } from 'module';
import { prisma } from '../lib/prisma.js';

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
}

interface GeolocationResult {
  countryCode?: string;
  regionCode?: string;
  city?: string;
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
    console.error('Error parsing user agent:', error);
    return {
      operatingSystem: null,
      browser: null,
      browserVersion: null
    };
  }
};

const getGeolocationFromIP = async (_ip: string): Promise<GeolocationResult> => {
  try {
    // TODO: Implement MaxMind GeoIP2 when database is available
    return {};
  } catch (error) {
    console.error('Error getting geolocation from IP:', error);
    return {};
  }
};

const getCountryFromLanguage = (language: string): string | null => {
  try {
    initializeLocale();
    
    const parts = language.split('-');
    if (parts.length >= 2) {
      const alpha2Code = parts[1].toUpperCase();
      const alpha3Code = countries.alpha2ToAlpha3(alpha2Code);
      
      if (alpha3Code) {
        console.log(`Language ${language} -> Alpha2: ${alpha2Code} -> Alpha3: ${alpha3Code}`);
        return alpha3Code;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing country from language:', error);
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
          console.log(`Timezone ${timezone} -> Alpha2: ${countryCode} -> Alpha3: ${alpha3Code}`);
          return alpha3Code;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing country from timezone:', error);
    return null;
  }
};

const getCountryNameFromCode = (code: string): string => {
  try {
    initializeLocale();
    const countryName = countries.getName(code, 'en');
    return countryName || code || 'Unknown';
  } catch (error) {
    console.error('Error getting country name from code:', error);
    return code || 'Unknown';
  }
};

// Higher-order functions for country detection
const detectCountryCode = async (data: AnalyticsData, clientIP?: string): Promise<string | null> => {
  // Method 1: IP geolocation (most accurate when available)
  if (clientIP) {
    const geoData = await getGeolocationFromIP(clientIP);
    if (geoData.countryCode) {
      return geoData.countryCode;
    }
  }

  // Method 2: Fallback to browser language
  if (data.language) {
    const countryCode = getCountryFromLanguage(data.language);
    if (countryCode) {
      console.log(`Country from language ${data.language}: ${countryCode}`);
      return countryCode;
    }
  }

  // Method 3: Fallback to timezone
  if (data.timezone) {
    const countryCode = getCountryFromTimezone(data.timezone);
    if (countryCode) {
      console.log(`Country from timezone ${data.timezone}: ${countryCode}`);
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
const trackFormView = async (data: AnalyticsData, clientIP?: string): Promise<void> => {
  try {
    const userAgentData = parseUserAgent(data.userAgent);
    const countryCode = await detectCountryCode(data, clientIP);
    const analyticsId = generateAnalyticsId();

    await prisma.formViewAnalytics.create({
      data: {
        id: analyticsId,
        formId: data.formId,
        sessionId: data.sessionId,
        userAgent: data.userAgent,
        operatingSystem: userAgentData.operatingSystem,
        browser: userAgentData.browser,
        browserVersion: userAgentData.browserVersion,
        countryCode,
        regionCode: null, // TODO: Add region detection
        city: null,       // TODO: Add city detection
        timezone: data.timezone,
        language: data.language,
        viewedAt: new Date()
      }
    });
    
    console.log(`Analytics tracked for form ${data.formId}, session ${data.sessionId}, country: ${countryCode || 'unknown'}`);
  } catch (error) {
    console.error('Error tracking form view analytics:', error);
    // Don't throw error to avoid disrupting form viewing
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
    const [totalViews, uniqueSessionsData, countryStats, osStats, browserStats, dailyViews] = await Promise.all([
      prisma.formViewAnalytics.count({ where: whereClause }),
      
      prisma.formViewAnalytics.groupBy({
        by: ['sessionId'],
        where: whereClause
      }),
      
      prisma.formViewAnalytics.groupBy({
        by: ['countryCode'],
        where: { ...whereClause, countryCode: { not: null } },
        _count: { countryCode: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 10
      }),
      
      prisma.formViewAnalytics.groupBy({
        by: ['operatingSystem'],
        where: { ...whereClause, operatingSystem: { not: null } },
        _count: { operatingSystem: true },
        orderBy: { _count: { operatingSystem: 'desc' } },
        take: 10
      }),
      
      prisma.formViewAnalytics.groupBy({
        by: ['browser'],
        where: { ...whereClause, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 10
      }),
      
      // Time-series data: Get all records for daily aggregation
      prisma.formViewAnalytics.findMany({
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
      topOperatingSystems,
      topBrowsers,
      viewsOverTime: filledViewsOverTime
    };
  } catch (error) {
    console.error('Error getting form analytics:', error);
    throw new Error('Failed to fetch analytics data');
  }
};

// Initialize service (log startup)
const initializeService = () => {
  console.log('GeoIP service initialized (fallback mode)');
};

// Service object using functional composition
const analyticsService = {
  trackFormView,
  getFormAnalytics,
  initialize: initializeService
};

// Initialize on module load
analyticsService.initialize();

export { analyticsService };