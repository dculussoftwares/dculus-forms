/**
 * Common helper functions for E2E tests
 */

import { CustomWorld } from '../../support/world';

export type Credentials = {
  email: string;
  password: string;
};

/**
 * Get credentials from environment variables
 */
export function getCredentials(): Credentials {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set for sign-in tests.');
  }

  return { email, password };
}

/**
 * Sign in via UI
 */
export async function signInViaUi(world: CustomWorld, options?: { skipGoto?: boolean }) {
  if (!world.page) {
    throw new Error('Page is not initialized');
  }

  const { email, password } = getCredentials();

  if (!options?.skipGoto) {
    await world.page.goto('/signin');
  }

  await world.page.fill('input[name="email"]', email);
  await world.page.fill('input[name="password"]', password);
  await world.page.click('button[type="submit"]');
}
