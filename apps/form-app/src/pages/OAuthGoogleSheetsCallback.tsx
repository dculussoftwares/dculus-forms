import { useEffect } from 'react';

export const GOOGLE_OAUTH_CHANNEL = 'dculus_google_oauth';

export const OAuthGoogleSheetsCallback = () => {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    console.log('[GSheets Relay] page loaded, hash length:', hash.length);

    const broadcast = (data: object) => {
      try {
        const ch = new BroadcastChannel(GOOGLE_OAUTH_CHANNEL);
        ch.postMessage(data);
        ch.close();
        console.log('[GSheets Relay] BroadcastChannel message sent:', JSON.stringify(data).slice(0, 80));
      } catch (e) {
        console.error('[GSheets Relay] BroadcastChannel failed:', e);
      }
    };

    if (hash.startsWith('error=')) {
      const errorCode = hash.slice('error='.length);
      console.log('[GSheets Relay] error received:', errorCode);
      broadcast({ error: errorCode });
    } else if (hash) {
      try {
        // base64url → base64: replace - and _, then add missing = padding
        const b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        console.log('[GSheets Relay] decoding base64, padded length:', padded.length);
        const token = JSON.parse(atob(padded));
        console.log('[GSheets Relay] ✅ token parsed, email:', token.email || '(empty)', '— broadcasting');
        broadcast({ token });
      } catch (e) {
        console.error('[GSheets Relay] parse error:', e);
        broadcast({ error: 'parse_failed' });
      }
    } else {
      console.warn('[GSheets Relay] no hash in URL');
      broadcast({ error: 'no_hash' });
    }

    window.close();
  }, []);

  return null;
};
