import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldType } from '@dculus/types';
import { processEmailFieldAnalytics } from '../emailFieldAnalytics.js';
import type { FieldResponse } from '../types.js';

describe('fieldAnalytics/emailFieldAnalytics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const toDate = (value: string) => new Date(value);

  describe('processEmailFieldAnalytics', () => {
    it('should calculate basic email statistics', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@example.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@example.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'invalid-email', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.fieldId).toBe('field-1');
      expect(result.fieldLabel).toBe('Email');
      expect(result.fieldType).toBe(FieldType.EMAIL_FIELD);
      expect(result.totalResponses).toBe(3);
      expect(result.responseRate).toBe(30);
      expect(result.validEmails).toBe(2);
      expect(result.invalidEmails).toBe(1);
      expect(result.validationRate).toBeCloseTo(66.67, 2);
    });

    it('should normalize emails to lowercase', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'USER@EXAMPLE.COM', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'User@Example.Com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.domains[0].domain).toBe('example.com');
      expect(result.domains[0].count).toBe(2);
    });

    it('should trim whitespace from emails', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '  user@example.com  ', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '\tuser2@example.com\n', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.validEmails).toBe(2);
      expect(result.domains[0].domain).toBe('example.com');
    });

    it('should validate email format', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'valid@example.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid@', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: '@example.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'no-at-sign.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'valid2@test.org', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.validEmails).toBe(2);
      expect(result.invalidEmails).toBe(3);
    });

    it('should extract and count domains', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@gmail.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@gmail.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@yahoo.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@company.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.domains).toBeDefined();
      expect(result.domains[0].domain).toBe('gmail.com');
      expect(result.domains[0].count).toBe(2);
      expect(result.domains[0].percentage).toBe(50);
    });

    it('should extract and count top-level domains', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@example.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@test.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@example.org', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@company.net', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.topLevelDomains).toBeDefined();
      const comTld = result.topLevelDomains.find(t => t.tld === 'com');
      expect(comTld?.count).toBe(2);
      expect(comTld?.percentage).toBe(50);
    });

    it('should identify popular email providers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@gmail.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@gmail.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@yahoo.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@outlook.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'user5@hotmail.com', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.popularProviders).toBeDefined();
      const gmailProvider = result.popularProviders.find(p => p.provider === 'gmail');
      expect(gmailProvider?.count).toBe(2);
      expect(gmailProvider?.percentage).toBe(40);
    });

    it('should classify corporate vs personal emails', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@gmail.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@yahoo.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'emp1@company.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'emp2@company.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'emp3@company.com', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.corporateVsPersonal).toBeDefined();
      expect(result.corporateVsPersonal.personal).toBe(2);
      expect(result.corporateVsPersonal.corporate).toBe(3);
    });

    it('should mark domain as corporate when it appears 3+ times', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'emp1@acmecorp.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'emp2@acmecorp.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'emp3@acmecorp.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.corporateVsPersonal.corporate).toBe(3);
      expect(result.corporateVsPersonal.personal).toBe(0);
    });

    it('should mark infrequent non-popular domains as unknown', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@unique1.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@unique2.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@unique3.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.corporateVsPersonal.unknown).toBe(3);
    });

    it('should limit domains list to 20 items', () => {
      const fieldResponses: FieldResponse[] = Array.from({ length: 50 }, (_, i) => ({
        value: `user${i}@domain${i}.com`,
        submittedAt: toDate('2024-01-01T10:00:00Z'),
        responseId: `r${i}`,
      }));

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 100);

      expect(result.domains.length).toBeLessThanOrEqual(20);
    });

    it('should sort domains by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@alpha.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@beta.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@beta.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@gamma.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'user5@gamma.com', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'user6@gamma.com', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.domains[0].domain).toBe('gamma.com');
      expect(result.domains[0].count).toBe(3);
      expect(result.domains[1].domain).toBe('beta.com');
      expect(result.domains[1].count).toBe(2);
      expect(result.domains[2].domain).toBe('alpha.com');
      expect(result.domains[2].count).toBe(1);
    });

    it('should sort top-level domains by count descending', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@test.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@test.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@test.org', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@test.net', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'user5@test.net', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'user6@test.net', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.topLevelDomains[0].tld).toBe('net');
      expect(result.topLevelDomains[0].count).toBe(3);
      expect(result.topLevelDomains[1].tld).toBe('com');
      expect(result.topLevelDomains[1].count).toBe(2);
    });

    it('should handle empty responses', () => {
      const result = processEmailFieldAnalytics([], 'field-1', 'Email', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
      expect(result.validEmails).toBe(0);
      expect(result.invalidEmails).toBe(0);
      expect(result.validationRate).toBe(0);
      expect(result.domains).toEqual([]);
      expect(result.topLevelDomains).toEqual([]);
      expect(result.popularProviders).toEqual([]);
    });

    it('should handle responses with empty strings', () => {
      const fieldResponses: FieldResponse[] = [
        { value: '', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '   ', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.totalResponses).toBe(0);
      expect(result.responseRate).toBe(0);
    });

    it('should handle all invalid emails', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'invalid1', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: '@test.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user@', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.validEmails).toBe(0);
      expect(result.invalidEmails).toBe(3);
      expect(result.validationRate).toBe(0);
      expect(result.domains).toEqual([]);
    });

    it('should calculate validation rate as 100 for all valid emails', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@test.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@test.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.validationRate).toBe(100);
    });

    it('should recognize all popular email providers', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user@gmail.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user@yahoo.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user@hotmail.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user@outlook.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
        { value: 'user@aol.com', submittedAt: toDate('2024-01-05T10:00:00Z'), responseId: 'r5' },
        { value: 'user@icloud.com', submittedAt: toDate('2024-01-06T10:00:00Z'), responseId: 'r6' },
        { value: 'user@protonmail.com', submittedAt: toDate('2024-01-07T10:00:00Z'), responseId: 'r7' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.popularProviders.length).toBeGreaterThan(0);
      expect(result.corporateVsPersonal.personal).toBe(7);
    });

    it('should handle domains with multiple subdomains', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user@mail.company.co.uk', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.validEmails).toBe(1);
      expect(result.domains[0].domain).toBe('mail.company.co.uk');
      expect(result.topLevelDomains[0].tld).toBe('uk');
    });

    it('should set lastUpdated to current time', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user@test.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 5);

      expect(result.lastUpdated).toEqual(new Date('2024-05-01T12:00:00Z'));
    });

    it('should handle mixed valid and invalid emails correctly', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'valid@test.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'invalid', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'another-valid@test.org', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'also@invalid', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.totalResponses).toBe(4);
      expect(result.validEmails).toBe(2);
      expect(result.invalidEmails).toBe(2);
      expect(result.validationRate).toBe(50);
    });

    it('should calculate percentages correctly for domains', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user1@gmail.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user2@gmail.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user3@gmail.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
        { value: 'user4@yahoo.com', submittedAt: toDate('2024-01-04T10:00:00Z'), responseId: 'r4' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      const gmailDomain = result.domains.find(d => d.domain === 'gmail.com');
      expect(gmailDomain?.percentage).toBe(75);

      const yahooDomain = result.domains.find(d => d.domain === 'yahoo.com');
      expect(yahooDomain?.percentage).toBe(25);
    });

    it('should handle domain extraction from complex email formats', () => {
      const fieldResponses: FieldResponse[] = [
        { value: 'user+tag@example.com', submittedAt: toDate('2024-01-01T10:00:00Z'), responseId: 'r1' },
        { value: 'user.name@example.com', submittedAt: toDate('2024-01-02T10:00:00Z'), responseId: 'r2' },
        { value: 'user_name@example.com', submittedAt: toDate('2024-01-03T10:00:00Z'), responseId: 'r3' },
      ];

      const result = processEmailFieldAnalytics(fieldResponses, 'field-1', 'Email', 10);

      expect(result.domains[0].domain).toBe('example.com');
      expect(result.domains[0].count).toBe(3);
    });
  });
});
