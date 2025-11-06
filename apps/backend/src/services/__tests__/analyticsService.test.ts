import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyticsService } from '../analyticsService.js';
import {
  formViewAnalyticsRepository,
  formSubmissionAnalyticsRepository,
} from '../../repositories/index.js';

// Mock repositories
vi.mock('../../repositories/index.js');

// Mock external dependencies
vi.mock('ua-parser-js', () => ({
  UAParser: vi.fn().mockImplementation(() => ({
    getResult: () => ({
      os: { name: 'Windows' },
      browser: { name: 'Chrome', version: '120.0.0' },
    }),
  })),
}));

vi.mock('i18n-iso-countries', () => ({
  default: {
    registerLocale: vi.fn(),
    alpha2ToAlpha3: vi.fn((code) => {
      const map: Record<string, string> = {
        US: 'USA',
        CA: 'CAN',
        GB: 'GBR',
        FR: 'FRA',
      };
      return map[code] || null;
    }),
    getName: vi.fn((code) => {
      const map: Record<string, string> = {
        USA: 'United States',
        CAN: 'Canada',
        GBR: 'United Kingdom',
      };
      return map[code] || code;
    }),
  },
}));

vi.mock('countries-and-timezones', () => ({
  getTimezone: vi.fn((tz) => {
    const timezones: Record<string, { countries: string[] }> = {
      'America/New_York': { countries: ['US'] },
      'America/Toronto': { countries: ['CA'] },
      'Europe/London': { countries: ['GB'] },
    };
    return timezones[tz] || null;
  }),
}));

describe('Analytics Service', () => {
  const mockAnalyticsData = {
    formId: 'form-123',
    sessionId: 'session-123',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    timezone: 'America/New_York',
    language: 'en-US',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trackFormView', () => {
    it('should track form view with complete analytics data', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView(mockAnalyticsData);

      const call = vi.mocked(formViewAnalyticsRepository.createViewEvent).mock.calls[0][0];
      expect(call).toMatchObject({
        formId: 'form-123',
        sessionId: 'session-123',
        countryCode: 'USA',
        timezone: 'America/New_York',
        language: 'en-US',
      });
      expect(call.id).toBeDefined();
      expect(call.viewedAt).toBeInstanceOf(Date);
    });

    it('should track form view with IP geolocation', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView(mockAnalyticsData, '192.168.1.1');

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalled();
    });

    it('should detect country from language when available', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);
      const dataWithLanguage = {
        ...mockAnalyticsData,
        language: 'en-US',
        timezone: undefined,
      };

      await analyticsService.trackFormView(dataWithLanguage);

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: 'USA',
          language: 'en-US',
        })
      );
    });

    it('should detect country from timezone when language unavailable', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);
      const dataWithTimezone = {
        ...mockAnalyticsData,
        language: undefined,
        timezone: 'America/Toronto',
      };

      await analyticsService.trackFormView(dataWithTimezone);

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: 'CAN',
          timezone: 'America/Toronto',
        })
      );
    });

    it('should handle missing country detection gracefully', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);
      const dataWithoutLocation = {
        ...mockAnalyticsData,
        language: undefined,
        timezone: undefined,
      };

      await analyticsService.trackFormView(dataWithoutLocation);

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: null,
        })
      );
    });

    it('should parse user agent and call repository', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView(mockAnalyticsData);

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalled();
      const call = vi.mocked(formViewAnalyticsRepository.createViewEvent).mock.calls[0][0];
      expect(call.userAgent).toBe(mockAnalyticsData.userAgent);
    });

    it('should not throw error if tracking fails', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockRejectedValue(
        new Error('Database error')
      );

      await expect(analyticsService.trackFormView(mockAnalyticsData)).resolves.not.toThrow();
      expect(console.error).toHaveBeenCalledWith(
        'Error tracking form view analytics:',
        expect.any(Error)
      );
    });

    it('should generate unique analytics IDs', async () => {
      const calls: any[] = [];
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockImplementation(
        async (data: any) => {
          calls.push(data.id);
          return {} as any;
        }
      );

      await analyticsService.trackFormView(mockAnalyticsData);
      await analyticsService.trackFormView(mockAnalyticsData);

      expect(calls).toHaveLength(2);
      expect(calls[0]).not.toBe(calls[1]);
    });
  });

  describe('updateFormStartTime', () => {
    it('should update form start time', async () => {
      vi.mocked(formViewAnalyticsRepository.updateSessionMetrics).mockResolvedValue({} as any);
      const startTime = new Date('2024-01-01T10:00:00Z');

      await analyticsService.updateFormStartTime({
        formId: 'form-123',
        sessionId: 'session-123',
        startedAt: startTime.toISOString(),
      });

      expect(formViewAnalyticsRepository.updateSessionMetrics).toHaveBeenCalledWith(
        {
          formId: 'form-123',
          sessionId: 'session-123',
          startedAt: null,
        },
        {
          startedAt: startTime,
        }
      );
    });

    it('should not throw error if update fails', async () => {
      vi.mocked(formViewAnalyticsRepository.updateSessionMetrics).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        analyticsService.updateFormStartTime({
          formId: 'form-123',
          sessionId: 'session-123',
          startedAt: new Date().toISOString(),
        })
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Error updating form start time:',
        expect.any(Error)
      );
    });
  });

  describe('trackFormSubmission', () => {
    it('should track form submission with completion time', async () => {
      vi.mocked(formSubmissionAnalyticsRepository.createSubmissionEvent).mockResolvedValue(
        {} as any
      );
      vi.mocked(formViewAnalyticsRepository.updateSessionMetrics).mockResolvedValue({} as any);

      await analyticsService.trackFormSubmission({
        ...mockAnalyticsData,
        responseId: 'response-123',
        completionTimeSeconds: 120,
      });

      const call = vi.mocked(formSubmissionAnalyticsRepository.createSubmissionEvent).mock.calls[0][0];
      expect(call).toMatchObject({
        formId: 'form-123',
        responseId: 'response-123',
        completionTimeSeconds: 120,
      });
    });


    it('should track submission without completion time', async () => {
      vi.mocked(formSubmissionAnalyticsRepository.createSubmissionEvent).mockResolvedValue(
        {} as any
      );

      await analyticsService.trackFormSubmission({
        ...mockAnalyticsData,
        responseId: 'response-123',
      });

      const call = vi.mocked(formSubmissionAnalyticsRepository.createSubmissionEvent).mock.calls[0][0];
      expect(call.responseId).toBe('response-123');
      expect(call.completionTimeSeconds).toBeNull();
    });

    it('should not throw error if tracking fails', async () => {
      vi.mocked(formSubmissionAnalyticsRepository.createSubmissionEvent).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        analyticsService.trackFormSubmission({
          ...mockAnalyticsData,
          responseId: 'response-123',
        })
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        'Error tracking form submission analytics:',
        expect.any(Error)
      );
    });
  });



  describe('Country detection fallback logic', () => {
    it('should use language when IP and timezone unavailable', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView({
        ...mockAnalyticsData,
        timezone: undefined,
        language: 'fr-FR',
      });

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: 'FRA',
        })
      );
    });

    it('should use timezone when language is invalid', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView({
        ...mockAnalyticsData,
        timezone: 'Europe/London',
        language: 'invalid',
      });

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: 'GBR',
        })
      );
    });

    it('should return null when all detection methods fail', async () => {
      vi.mocked(formViewAnalyticsRepository.createViewEvent).mockResolvedValue({} as any);

      await analyticsService.trackFormView({
        ...mockAnalyticsData,
        timezone: 'Invalid/Timezone',
        language: 'invalid',
      });

      expect(formViewAnalyticsRepository.createViewEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          countryCode: null,
        })
      );
    });
  });

});
