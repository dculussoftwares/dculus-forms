import { describe, expect, it } from 'vitest';
import { assertSecureDatabaseUrl } from '../databaseUrl.js';

const remote = (query: string) => `postgresql://u:p@db.example.com:5432/app${query}`;

describe('assertSecureDatabaseUrl', () => {
  it.each(['disable', 'allow', 'prefer'])('rejects sslmode=%s for a remote host in production', mode => {
    expect(() => assertSecureDatabaseUrl(remote(`?sslmode=${mode}`), true)).toThrow(/sslmode/);
  });

  it.each(['?sslmode=require', '?sslmode=verify-full', ''])('accepts %s', query => {
    expect(() => assertSecureDatabaseUrl(remote(query), true)).not.toThrow();
  });

  it('allows sslmode=disable on localhost and outside production', () => {
    expect(() => assertSecureDatabaseUrl('postgresql://u:p@localhost:5433/app?sslmode=disable', true)).not.toThrow();
    expect(() => assertSecureDatabaseUrl(remote('?sslmode=disable'), false)).not.toThrow();
  });
});
