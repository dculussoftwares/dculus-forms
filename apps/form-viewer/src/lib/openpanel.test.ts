import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetOpenPanelForTests,
  analyticsEnvironment,
  clearAnalyticsUser,
  identifyUser,
  initOpenPanel,
  sanitizeAnalyticsUrl,
  trackEvent,
} from '@dculus/utils';

type QueuedOp = ((...args: unknown[]) => void) & { q?: unknown[][] };
const win = window as unknown as { op?: QueuedOp };

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll('script')).filter((s) => s.src.includes('op1.js'));
}

describe('OpenPanel browser analytics', () => {
  beforeEach(() => {
    __resetOpenPanelForTests();
    delete win.op;
    scripts().forEach((s) => s.remove());
  });

  it('is a silent no-op without a client id', () => {
    expect(initOpenPanel({ clientId: '', app: 'form-viewer' })).toBe(false);
    trackEvent('form_viewed', { form_id: 'f1' });
    identifyUser('u1');
    clearAnalyticsUser();
    expect(win.op).toBeUndefined();
    expect(scripts()).toHaveLength(0);
  });

  it('queues init first and loads the SDK from the first-party path', () => {
    expect(initOpenPanel({ clientId: 'cid', app: 'form-viewer' })).toBe(true);

    const queue = win.op?.q ?? [];
    expect(queue[0]).toEqual([
      'init',
      {
        apiUrl: '/_e',
        clientId: 'cid',
        trackScreenViews: true,
        trackOutgoingLinks: false,
        trackAttributes: false,
        filter: expect.any(Function),
      },
    ]);
    expect(queue[1]).toEqual(['setGlobalProperties', { app: 'form-viewer', environment: 'local' }]);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute('src')).toBe('/_e/op1.js');
  });

  it('respects a custom api url and initialises only once', () => {
    initOpenPanel({ clientId: 'cid', apiUrl: 'https://example.com/_x/', app: 'form-app' });
    initOpenPanel({ clientId: 'cid', app: 'form-app' });
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute('src')).toBe('https://example.com/_x/op1.js');
  });

  it('forwards events, identifies by id only, and clears', () => {
    initOpenPanel({ clientId: 'cid', app: 'form-app' });
    trackEvent('form_created', { source: 'blank' });
    identifyUser('user-1');
    identifyUser(undefined);
    clearAnalyticsUser();

    expect(win.op?.q?.slice(2)).toEqual([
      ['track', 'form_created', { source: 'blank' }],
      ['identify', { profileId: 'user-1' }],
      ['clear'],
    ]);
  });

  it.each([
    ['https://x.dculus.com/magic-link/verify?token=secret', 'https://x.dculus.com/magic-link/verify'],
    ['https://x.dculus.com/forgot-password?email=a%40b.com&token=t', 'https://x.dculus.com/forgot-password'],
    ['https://x.dculus.com/oauth/google/sheets#access_token=t', 'https://x.dculus.com/oauth/google/sheets'],
    ['https://x.dculus.com/invite/abc123', 'https://x.dculus.com/invite/redacted'],
    ['https://x.dculus.com/signup?utm_source=ad&email=a%40b.com&utm_medium=cpc#x', 'https://x.dculus.com/signup?utm_source=ad&utm_medium=cpc'],
    ['https://x.dculus.com/dashboard', 'https://x.dculus.com/dashboard'],
    ['', ''],
  ])('sanitizes %s', (input, expected) => {
    expect(sanitizeAnalyticsUrl(input)).toBe(expected);
  });

  it('strips secrets from URL properties of every outgoing event without dropping it', () => {
    initOpenPanel({ clientId: 'cid', app: 'form-app' });
    const options = win.op?.q?.[0]?.[1] as { filter: (event: unknown) => boolean };
    const event = {
      type: 'track',
      payload: {
        name: 'screen_view',
        properties: {
          __path: 'https://x.dculus.com/auth/callback?ott=secret',
          __referrer: 'https://x.dculus.com/forgot-password?token=secret',
          app: 'form-app',
        },
      },
    };

    expect(options.filter(event)).toBe(true);
    expect(event.payload.properties).toEqual({
      __path: 'https://x.dculus.com/auth/callback',
      __referrer: 'https://x.dculus.com/forgot-password',
      app: 'form-app',
    });
    expect(options.filter({ type: 'identify', payload: {} })).toBe(true);
  });

  it('derives the environment from the hostname', () => {
    expect(analyticsEnvironment('forms-dev.dculus.com')).toBe('dev');
    expect(analyticsEnvironment('form-admin-app-dev.dculus.com')).toBe('dev');
    expect(analyticsEnvironment('forms.dculus.com')).toBe('prod');
    expect(analyticsEnvironment('localhost')).toBe('local');
  });
});
