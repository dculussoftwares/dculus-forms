const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

// Scopes needed: read/write Excel files + read user profile for email
const SCOPES = [
  'Files.ReadWrite',
  'User.Read',
  'offline_access',
].join(' ');

export interface MicrosoftOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  email: string;
  displayName: string;
}

export const buildMicrosoftAuthUrl = (state: string): string => {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI ?? '',
    response_type: 'code',
    scope: SCOPES,
    response_mode: 'query',
    state,
  });
  return `${MS_AUTH_URL}?${params.toString()}`;
};

export const exchangeMicrosoftCode = async (code: string): Promise<MicrosoftOAuthToken> => {
  const response = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.MICROSOFT_CLIENT_ID ?? '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET ?? '',
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI ?? '',
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Microsoft token exchange failed: ${response.status} ${body}`);
  }

  const data = await response.json() as any;

  const { email, displayName } = await fetchMicrosoftProfile(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    email,
    displayName,
  };
};

const fetchMicrosoftProfile = async (
  accessToken: string
): Promise<{ email: string; displayName: string }> => {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { email: '', displayName: '' };
    const data = await res.json() as any;
    return {
      email: data.mail ?? data.userPrincipalName ?? '',
      displayName: data.displayName ?? '',
    };
  } catch {
    return { email: '', displayName: '' };
  }
};
