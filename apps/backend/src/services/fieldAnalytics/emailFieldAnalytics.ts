/**
 * Email Field Analytics Processor
 *
 * Processes analytics for EMAIL_FIELD type.
 */

import { FieldType } from '@dculus/types';
import { FieldResponse, FieldAnalyticsBase, EmailFieldAnalytics } from './types.js';

/**
 * Process email field analytics
 */
export const processEmailFieldAnalytics = (
  fieldResponses: FieldResponse[],
  fieldId: string,
  fieldLabel: string,
  totalFormResponses: number
): FieldAnalyticsBase & EmailFieldAnalytics => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emails = fieldResponses.map(r => String(r.value || '').trim().toLowerCase()).filter(e => e.length > 0);
  const totalResponses = emails.length;

  // Validation
  const validEmails = emails.filter(email => emailPattern.test(email));
  const invalidEmails = totalResponses - validEmails.length;
  const validationRate = totalResponses > 0 ? (validEmails.length / totalResponses) * 100 : 0;

  // Domain analysis
  const domainCounts = new Map<string, number>();
  const tldCounts = new Map<string, number>();

  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);

      const tld = domain.split('.').pop();
      if (tld) {
        tldCounts.set(tld, (tldCounts.get(tld) || 0) + 1);
      }
    }
  });

  const domains = Array.from(domainCounts.entries())
    .map(([domain, count]) => ({
      domain,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topLevelDomains = Array.from(tldCounts.entries())
    .map(([tld, count]) => ({
      tld,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Popular email providers
  const popularProviderDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com'
  ];

  const providerCounts = new Map<string, number>();
  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain && popularProviderDomains.includes(domain)) {
      const provider = domain.replace('.com', '').replace('.', '');
      providerCounts.set(provider, (providerCounts.get(provider) || 0) + 1);
    }
  });

  const popularProviders = Array.from(providerCounts.entries())
    .map(([provider, count]) => ({
      provider,
      count,
      percentage: (count / validEmails.length) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Corporate vs Personal analysis
  const corporateDomains = new Set();
  const personalDomains = new Set(popularProviderDomains);

  let corporate = 0;
  let personal = 0;
  let unknown = 0;

  validEmails.forEach(email => {
    const domain = email.split('@')[1];
    if (domain) {
      if (personalDomains.has(domain)) {
        personal++;
      } else if (corporateDomains.has(domain)) {
        corporate++;
      } else {
        // Heuristic: if domain appears only once or twice, likely personal
        // If appears multiple times, likely corporate
        const domainCount = domainCounts.get(domain) || 0;
        if (domainCount >= 3) {
          corporate++;
          corporateDomains.add(domain);
        } else {
          unknown++;
        }
      }
    }
  });

  return {
    fieldId,
    fieldType: FieldType.EMAIL_FIELD,
    fieldLabel,
    totalResponses,
    responseRate: totalFormResponses > 0 ? (totalResponses / totalFormResponses) * 100 : 0,
    lastUpdated: new Date(),
    validEmails: validEmails.length,
    invalidEmails,
    validationRate: Math.round(validationRate * 100) / 100,
    domains,
    topLevelDomains,
    corporateVsPersonal: { corporate, personal, unknown },
    popularProviders,
  };
};
