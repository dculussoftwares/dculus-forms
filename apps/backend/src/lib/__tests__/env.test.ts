import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const resetEnv = () => {
  process.env = { ...ORIGINAL_ENV };
};

describe('env config', () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('falls back to safe defaults when NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.PUBLIC_S3_ENDPOINT;
    delete process.env.PUBLIC_S3_ACCESS_KEY;
    delete process.env.PUBLIC_S3_SECRET_KEY;
    delete process.env.S3_PUBLIC_BUCKET_NAME;
    delete process.env.S3_PRIVATE_BUCKET_NAME;
    delete process.env.S3_PUBLIC_CDN_URL;
    delete process.env.PORT;
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASSWORD;
    delete process.env.EMAIL_FROM;

    const envModule = await import('../env.js');

    expect(envModule.s3Config).toMatchObject({
      endpoint: 'http://localhost:9000',
      accessKey: 'test-access-key',
      secretKey: 'test-secret-key',
      publicBucketName: 'test-public-bucket',
      privateBucketName: 'test-private-bucket',
      publicCdnUrl: 'http://localhost:9000',
    });
    expect(envModule.appConfig).toMatchObject({
      port: 4000,
      nodeEnv: 'test',
      isDevelopment: false,
      isProduction: false,
    });
    expect(envModule.emailConfig).toMatchObject({
      host: 'some-host',
      port: 587,
      user: 'some-user',
      password: 'some-password',
      from: 'no-reply@dculus.com',
    });
  });

  it('throws when required S3 variables are missing in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_S3_ENDPOINT = 'https://s3.example.com';
    process.env.PUBLIC_S3_ACCESS_KEY = 'prod-access';
    process.env.PUBLIC_S3_SECRET_KEY = 'prod-secret';
    process.env.S3_PUBLIC_BUCKET_NAME = 'public';
    process.env.S3_PRIVATE_BUCKET_NAME = 'private';
    delete process.env.S3_PUBLIC_CDN_URL;
    process.env.BETTER_AUTH_SECRET = 'prod-auth-secret';

    await expect(import('../env.js')).rejects.toThrow(
      'Missing required environment variable: S3_PUBLIC_CDN_URL'
    );
  });

  it('builds configs from provided production environment variables', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_S3_ENDPOINT = 'https://s3.example.com';
    process.env.PUBLIC_S3_ACCESS_KEY = 'prod-access';
    process.env.PUBLIC_S3_SECRET_KEY = 'prod-secret';
    process.env.S3_PUBLIC_BUCKET_NAME = 'public';
    process.env.S3_PRIVATE_BUCKET_NAME = 'private';
    process.env.S3_PUBLIC_CDN_URL = 'https://cdn.example.com';
    process.env.BETTER_AUTH_SECRET = 'prod-auth-secret';
    process.env.BETTER_AUTH_URL = 'https://auth.example.com';
    process.env.PORT = '8080';
    process.env.EMAIL_HOST = 'smtp.example.com';
    process.env.EMAIL_PORT = '2525';
    process.env.EMAIL_USER = 'mailer';
    process.env.EMAIL_PASSWORD = 'super-secret';
    process.env.EMAIL_FROM = 'no-reply@example.com';

    const envModule = await import('../env.js');

    expect(envModule.s3Config).toMatchObject({
      endpoint: 'https://s3.example.com',
      accessKey: 'prod-access',
      secretKey: 'prod-secret',
      publicBucketName: 'public',
      privateBucketName: 'private',
      publicCdnUrl: 'https://cdn.example.com',
    });
    expect(envModule.authConfig).toEqual({
      baseUrl: 'https://auth.example.com',
      secret: 'prod-auth-secret',
    });
    expect(envModule.appConfig).toMatchObject({
      port: 8080,
      nodeEnv: 'production',
      isDevelopment: false,
      isProduction: true,
    });
    expect(envModule.emailConfig).toEqual({
      host: 'smtp.example.com',
      port: 2525,
      user: 'mailer',
      password: 'super-secret',
      from: 'no-reply@example.com',
    });
  });
});
