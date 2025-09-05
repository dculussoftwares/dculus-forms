/*
  Debug utilities for form-app
  Enable via:
  - localStorage.setItem('DF_DEBUG', '1')
  - or (temporarily) window.DFDebug.enable()
  - or set VITE_DCULUS_DEBUG=1 in env
*/

export type LogLevel = 'log' | 'warn' | 'error';

const isEnabled = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      // runtime flags
      // @ts-ignore
      if (window.DF_DEBUG === true) return true;
      if (localStorage.getItem('DF_DEBUG') === '1') return true;
    }
    // Vite env flag
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DCULUS_DEBUG === '1') return true;
  } catch (_) {
    // ignore
  }
  return false;
};

const timeStr = () => new Date().toISOString();

export const debugLog = (namespace: string, message: string, data?: unknown, level: LogLevel = 'log') => {
  if (!isEnabled()) return;
  const prefix = `[DF][${timeStr()}][${namespace}]`;
  if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(prefix, message, data ?? '');
  } else if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(prefix, message, data ?? '');
  } else {
    // eslint-disable-next-line no-console
    console.log(prefix, message, data ?? '');
  }
};

export const logger = (namespace: string) => ({
  log: (message: string, data?: unknown) => debugLog(namespace, message, data, 'log'),
  warn: (message: string, data?: unknown) => debugLog(namespace, message, data, 'warn'),
  error: (message: string, data?: unknown) => debugLog(namespace, message, data, 'error'),
  group: (label: string) => {
    if (!isEnabled()) return; // eslint-disable-next-line no-console
    console.group(`[DF][${timeStr()}][${namespace}] ${label}`);
  },
  groupEnd: () => {
    if (!isEnabled()) return; // eslint-disable-next-line no-console
    console.groupEnd();
  }
});

// Expose toggles on window for convenience during manual debugging
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.DFDebug = {
    enable: () => {
      try { localStorage.setItem('DF_DEBUG', '1'); } catch (_) {}
      // @ts-ignore
      window.DF_DEBUG = true;
      debugLog('DFDebug', 'Enabled');
    },
    disable: () => {
      try { localStorage.removeItem('DF_DEBUG'); } catch (_) {}
      // @ts-ignore
      window.DF_DEBUG = false;
      debugLog('DFDebug', 'Disabled');
    },
    status: () => isEnabled(),
  };
}
