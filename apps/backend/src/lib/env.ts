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

export interface DatabaseConfig {
  rootUsername: string;
  rootPassword: string;
  database: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

export const s3Config: S3Config = {
  endpoint: requireEnv('CLOUDFLARE_R2_ENDPOINT'),
  accessKey: requireEnv('CLOUDFLARE_R2_ACCESS_KEY'),
  secretKey: requireEnv('CLOUDFLARE_R2_SECRET_KEY'),
  publicBucketName: requireEnv('CLOUDFLARE_R2_PUBLIC_BUCKET_NAME'),
  privateBucketName: requireEnv('CLOUDFLARE_R2_PRIVATE_BUCKET_NAME'),
  cdnUrl: requireEnv('CLOUDFLARE_R2_CDN_URL'),
};

export const authConfig: AuthConfig = {
  baseUrl: optionalEnv(
    'BETTER_AUTH_URL', 
    process.env.NODE_ENV === 'production' 
      ? 'https://api.example.com' 
      : 'http://localhost:3000'
  )!,
  secret: requireEnv(
    'BETTER_AUTH_SECRET',
    'fallback-secret-for-development-only-do-not-use-in-production'
  ),
};

export const databaseConfig: DatabaseConfig = {
  rootUsername: optionalEnv('MONGO_INITDB_ROOT_USERNAME', 'admin')!,
  rootPassword: optionalEnv('MONGO_INITDB_ROOT_PASSWORD', 'password123')!,
  database: optionalEnv('MONGO_INITDB_DATABASE', 'dculus_forms')!,
};

const nodeEnv = optionalEnv('NODE_ENV', 'development')!;

export const appConfig: AppConfig = {
  port: parseInt(optionalEnv('PORT', '4000')!, 10),
  nodeEnv,
  isDevelopment: nodeEnv === 'development',
  isProduction: nodeEnv === 'production',
};