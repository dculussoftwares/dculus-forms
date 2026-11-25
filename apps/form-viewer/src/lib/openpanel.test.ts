import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetOpenPanelForTests,
  analyticsEnvironment,
  clearAnalyticsUser,
  identifyUser,
  initOpenPanel,
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
        trackOutgoingLinks: true,
        trackAttributes: true,
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

  it('derives the environment from the hostname', () => {
    expect(analyticsEnvironment('forms-dev.dculus.com')).toBe('dev');
    expect(analyticsEnvironment('form-admin-app-dev.dculus.com')).toBe('dev');
    expect(analyticsEnvironment('forms.dculus.com')).toBe('prod');
    expect(analyticsEnvironment('localhost')).toBe('local');
  });
});
