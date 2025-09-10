function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export interface S3Config {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  publicBucketName: string;
  privateBucketName: string;
  cdnUrl: string;
}

export interface AuthConfig {
  baseUrl: string;
  secret: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export const s3Config: S3Config = {
  endpoint: requireEnv('S3_ENDPOINT'),
  accessKey: requireEnv('S3_ACCESS_KEY'),
  secretKey: requireEnv('S3_SECRET_KEY'),
  publicBucketName: requireEnv('S3_PUBLIC_BUCKET_NAME'),
  privateBucketName: requireEnv('S3_PRIVATE_BUCKET_NAME'),
  cdnUrl: requireEnv('S3_CDN_URL'),
};

export const authConfig: AuthConfig = {
  baseUrl: optionalEnv('BETTER_AUTH_URL', 'http://localhost:4000')!,
  secret: requireEnv(
    'BETTER_AUTH_SECRET',
    'fallback-secret-for-development-only-do-not-use-in-production'
  ),
};

const nodeEnv = optionalEnv('NODE_ENV', 'development')!;

export const appConfig: AppConfig = {
  port: parseInt(optionalEnv('PORT', '4000')!, 10),
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  isProduction: nodeEnv === 'production',
};

export const emailConfig: EmailConfig = {
  host: optionalEnv('EMAIL_HOST', 'some-host')!,
  port: parseInt(optionalEnv('EMAIL_PORT', '587')!, 10),
  user: optionalEnv('EMAIL_USER', 'some-user')!,
  password: optionalEnv('EMAIL_PASSWORD', 'some-password')!,
  from: optionalEnv('EMAIL_FROM', 'no-reply@dculus.com')!,
};
