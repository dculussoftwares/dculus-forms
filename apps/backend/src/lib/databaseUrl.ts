export function isLocalDatabase(url: string): boolean {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/** Throws when production would send database traffic in clear text to a remote host. */
export function assertSecureDatabaseUrl(url: string, isProduction: boolean): void {
  if (!isProduction || isLocalDatabase(url)) return;
  let sslmode: string | null = null;
  try {
    sslmode = new URL(url).searchParams.get('sslmode');
  } catch {
    return;
  }
  if (sslmode === 'disable' || sslmode === 'allow' || sslmode === 'prefer') {
    throw new Error(
      `DATABASE_URL uses sslmode=${sslmode} for a non-local host; use sslmode=require (or verify-full) in production`
    );
  }
}
