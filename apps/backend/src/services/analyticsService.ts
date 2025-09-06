import { UAParser } from 'ua-parser-js';
import { getCode, getName } from 'country-list';
import { prisma } from '../lib/prisma.js';

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

class AnalyticsService {
  private geoReader: any = null;
  
  constructor() {
    this.initializeGeoReader();
  }

  private async initializeGeoReader() {
    try {
      // For now, we'll use a fallback approach without MaxMind DB
      // In production, you would download and use MaxMind GeoLite2-Country.mmdb
      console.log('GeoIP service initialized (fallback mode)');
    } catch (error) {
      console.warn('GeoIP database not available, using fallback methods');
    }
  }

  private parseUserAgent(userAgent: string) {
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
  }

  private async getGeolocationFromIP(ip: string): Promise<GeolocationResult> {
    try {
      // TODO: Implement MaxMind GeoIP2 when database is available
      // For now, return null to use fallback methods
      return {};
    } catch (error) {
      console.error('Error getting geolocation from IP:', error);
      return {};
    }
  }

  private getCountryFromLanguage(language: string): string | null {
    try {
      const parts = language.split('-');
      if (parts.length >= 2) {
        const alpha2Code = parts[1].toUpperCase(); // e.g., "US", "CA", "GB"
        
        // Convert 2-letter to 3-letter ISO code
        const countryName = getName(alpha2Code);
        if (countryName) {
          // Get 3-letter code by looking up the name
          const countries3Letter: { [key: string]: string } = {
            'United States': 'USA',
            'Canada': 'CAN',
            'United Kingdom': 'GBR',
            'Germany': 'DEU',
            'France': 'FRA',
            'Japan': 'JPN',
            'Australia': 'AUS',
            'Brazil': 'BRA',
            'India': 'IND',
            'China': 'CHN',
            'Mexico': 'MEX',
            'Spain': 'ESP',
            'Italy': 'ITA',
            'Netherlands': 'NLD',
            'Sweden': 'SWE',
            'Norway': 'NOR',
            'Denmark': 'DNK',
            'Finland': 'FIN',
            'Russia': 'RUS',
            'South Korea': 'KOR'
          };
          
          return countries3Letter[countryName] || null;
        }
      }
      return null;
    } catch (error) {
      console.error('Error parsing country from language:', error);
      return null;
    }
  }

  private getCountryFromTimezone(timezone: string): string | null {
    const timezoneToCountry: { [key: string]: string } = {
      // North America
      'America/New_York': 'USA',
      'America/Chicago': 'USA',
      'America/Denver': 'USA',
      'America/Los_Angeles': 'USA',
      'America/Phoenix': 'USA',
      'America/Anchorage': 'USA',
      'America/Hawaii': 'USA',
      'America/Toronto': 'CAN',
      'America/Vancouver': 'CAN',
      'America/Halifax': 'CAN',
      'America/Mexico_City': 'MEX',
      
      // Europe
      'Europe/London': 'GBR',
      'Europe/Dublin': 'IRL',
      'Europe/Paris': 'FRA',
      'Europe/Berlin': 'DEU',
      'Europe/Madrid': 'ESP',
      'Europe/Rome': 'ITA',
      'Europe/Amsterdam': 'NLD',
      'Europe/Stockholm': 'SWE',
      'Europe/Oslo': 'NOR',
      'Europe/Copenhagen': 'DNK',
      'Europe/Helsinki': 'FIN',
      'Europe/Moscow': 'RUS',
      
      // Asia Pacific
      'Asia/Tokyo': 'JPN',
      'Asia/Seoul': 'KOR',
      'Asia/Shanghai': 'CHN',
      'Asia/Hong_Kong': 'HKG',
      'Asia/Singapore': 'SGP',
      'Asia/Kolkata': 'IND',
      'Australia/Sydney': 'AUS',
      'Australia/Melbourne': 'AUS',
      'Australia/Perth': 'AUS',
      
      // South America
      'America/Sao_Paulo': 'BRA',
      'America/Argentina/Buenos_Aires': 'ARG',
      'America/Santiago': 'CHL'
    };
    
    return timezoneToCountry[timezone] || null;
  }

  async trackFormView(data: AnalyticsData, clientIP?: string): Promise<void> {
    try {
      // Parse user agent
      const userAgentData = this.parseUserAgent(data.userAgent);
      
      // Attempt to get country from multiple sources
      let countryCode: string | null = null;
      let regionCode: string | null = null;
      let city: string | null = null;
      
      // Method 1: IP geolocation (most accurate when available)
      if (clientIP) {
        const geoData = await this.getGeolocationFromIP(clientIP);
        countryCode = geoData.countryCode || null;
        regionCode = geoData.regionCode || null;
        city = geoData.city || null;
      }
      
      // Method 2: Fallback to browser language
      if (!countryCode && data.language) {
        countryCode = this.getCountryFromLanguage(data.language);
      }
      
      // Method 3: Fallback to timezone
      if (!countryCode && data.timezone) {
        countryCode = this.getCountryFromTimezone(data.timezone);
      }
      
      // Generate a unique ID for the analytics record
      const analyticsId = Math.random().toString(36).substring(2, 15) + 
                         Math.random().toString(36).substring(2, 15);
      
      // Store analytics data
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
          regionCode,
          city,
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
  }

  async getFormAnalytics(formId: string, timeRange?: { start: Date; end: Date }) {
    try {
      const whereClause: any = { formId };
      
      if (timeRange) {
        whereClause.viewedAt = {
          gte: timeRange.start,
          lte: timeRange.end
        };
      }
      
      // Get total views and unique sessions
      const totalViews = await prisma.formViewAnalytics.count({
        where: whereClause
      });
      
      const uniqueSessions = await prisma.formViewAnalytics.groupBy({
        by: ['sessionId'],
        where: whereClause
      });
      
      // Get top countries
      const countryStats = await prisma.formViewAnalytics.groupBy({
        by: ['countryCode'],
        where: { ...whereClause, countryCode: { not: null } },
        _count: { countryCode: true },
        orderBy: { _count: { countryCode: 'desc' } },
        take: 10
      });
      
      // Get top operating systems
      const osStats = await prisma.formViewAnalytics.groupBy({
        by: ['operatingSystem'],
        where: { ...whereClause, operatingSystem: { not: null } },
        _count: { operatingSystem: true },
        orderBy: { _count: { operatingSystem: 'desc' } },
        take: 10
      });
      
      // Get top browsers
      const browserStats = await prisma.formViewAnalytics.groupBy({
        by: ['browser'],
        where: { ...whereClause, browser: { not: null } },
        _count: { browser: true },
        orderBy: { _count: { browser: 'desc' } },
        take: 10
      });
      
      // Convert country codes to names
      const topCountries = countryStats.map((stat: any) => {
        const countryName = this.getCountryNameFromCode(stat.countryCode || '');
        return {
          code: stat.countryCode,
          name: countryName,
          count: stat._count.countryCode,
          percentage: totalViews > 0 ? (stat._count.countryCode / totalViews) * 100 : 0
        };
      });
      
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
      
      return {
        totalViews,
        uniqueSessions: uniqueSessions.length,
        topCountries,
        topOperatingSystems,
        topBrowsers
      };
    } catch (error) {
      console.error('Error getting form analytics:', error);
      throw new Error('Failed to fetch analytics data');
    }
  }
  
  private getCountryNameFromCode(code: string): string {
    const countryNames: { [key: string]: string } = {
      'USA': 'United States',
      'CAN': 'Canada',
      'GBR': 'United Kingdom',
      'DEU': 'Germany',
      'FRA': 'France',
      'JPN': 'Japan',
      'AUS': 'Australia',
      'BRA': 'Brazil',
      'IND': 'India',
      'CHN': 'China',
      'MEX': 'Mexico',
      'ESP': 'Spain',
      'ITA': 'Italy',
      'NLD': 'Netherlands',
      'SWE': 'Sweden',
      'NOR': 'Norway',
      'DNK': 'Denmark',
      'FIN': 'Finland',
      'RUS': 'Russia',
      'KOR': 'South Korea',
      'IRL': 'Ireland',
      'HKG': 'Hong Kong',
      'SGP': 'Singapore',
      'ARG': 'Argentina',
      'CHL': 'Chile'
    };
    
    return countryNames[code] || code || 'Unknown';
  }
}

export const analyticsService = new AnalyticsService();