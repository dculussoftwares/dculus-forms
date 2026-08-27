import { describe, it, expect } from 'vitest';
import {
  generateAutomationFailureEmailHtml,
  generateAutomationFailureEmailText,
} from '../automationFailureEmail.js';

const base = {
  ownerName: 'Ada',
  automationName: 'Welcome flow',
  runUrl: 'https://app.example.com/dashboard/form/f1/builder/automations/a1/runs?runId=r1',
  consecutiveFailures: 1,
} as const;

describe('automationFailureEmail', () => {
  it('links straight to the failed run — "an automation failed" is useless without the error', () => {
    const html = generateAutomationFailureEmailHtml({ ...base, reason: 'first-failure' });
    expect(html).toContain(base.runUrl);
    expect(generateAutomationFailureEmailText({ ...base, reason: 'first-failure' })).toContain(base.runUrl);
  });

  it('tells a paused automation apart from a one-off failure', () => {
    const paused = generateAutomationFailureEmailHtml({
      ...base,
      reason: 'auto-paused',
      consecutiveFailures: 5,
    });
    expect(paused).toContain('paused');
    // The recipient has to know nothing will run until they act.
    expect(paused).toMatch(/activate the automation again/i);

    const failure = generateAutomationFailureEmailHtml({ ...base, reason: 'first-failure' });
    expect(failure).not.toMatch(/has been paused/i);
  });

  // automationName is set by any EDITOR on the form, so it is arbitrary user input by the time it
  // reaches an inbox.
  it('escapes the automation name rather than injecting it as markup', () => {
    const html = generateAutomationFailureEmailHtml({
      ...base,
      automationName: '<img src=x onerror="alert(1)">',
      reason: 'first-failure',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('onerror="alert(1)"');
  });

  it('leaves the plain-text variant unescaped, where entities would be shown literally', () => {
    const text = generateAutomationFailureEmailText({
      ...base,
      automationName: 'Sales & Marketing',
      reason: 'first-failure',
    });

    expect(text).toContain('Sales & Marketing');
    expect(text).not.toContain('&amp;');
  });
});
