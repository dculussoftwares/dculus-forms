/**
 * Common helper functions for E2E tests
 */

import type { Locator } from 'playwright';
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
 * Drag a source element onto a target element.
 * Uses slow manual mouse movement with timing delays to work with DND kit's
 * PointerSensor which requires actual pointer movement past an 8px threshold.
 */
export async function dragOnto(source: Locator, target: Locator): Promise<void> {
  const page = source.page();

  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBB = await source.boundingBox();
  const targetBB = await target.boundingBox();

  if (!sourceBB || !targetBB) {
    throw new Error('Could not get bounding boxes for drag operation');
  }

  const startX = sourceBB.x + sourceBB.width / 2;
  const startY = sourceBB.y + sourceBB.height / 2;
  const endX = targetBB.x + targetBB.width / 2;
  const endY = targetBB.y + targetBB.height / 2;

  // Move to source, press down, then move slowly to activate DND kit
  await page.mouse.move(startX, startY);
  await page.waitForTimeout(50);
  await page.mouse.down();
  await page.waitForTimeout(100); // Let React process pointerdown

  // Move gradually past the 8px activation threshold
  for (let i = 1; i <= 15; i++) {
    await page.mouse.move(startX + i, startY);
    await page.waitForTimeout(10);
  }

  // Continue to the target with many steps for smooth DND detection
  await page.mouse.move(endX, endY, { steps: 50 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
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
