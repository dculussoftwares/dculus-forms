import { test, expect } from '@playwright/test';

test.describe('Test Setup Validation', () => {
  test('should be able to reach the application', async ({ page }) => {
    // Basic connectivity test
    await page.goto('http://localhost:3000/');
    
    // Wait for page to load completely
    await page.waitForTimeout(3000);
    
    // Should either see dashboard (if authenticated) or be redirected to signin
    const isDashboard = await page.getByRole('heading', { name: 'Your Forms' }).isVisible().catch(() => false);
    const isSignIn = await page.getByText('Welcome back').isVisible().catch(() => false);
    const hasTitle = await page.getByText('Dculus Forms').isVisible().catch(() => false);
    
    // At least one of these should be true (app loaded successfully)
    expect(isDashboard || isSignIn || hasTitle).toBe(true);
  });

  test('should be able to access signup page', async ({ page }) => {
    await page.goto('http://localhost:3000/signup');
    
    await expect(page).toHaveURL('http://localhost:3000/signup');
    await expect(page.getByText('Create an account')).toBeVisible();
  });

  test('should be able to access signin page', async ({ page }) => {
    await page.goto('http://localhost:3000/signin');
    
    await expect(page).toHaveURL('http://localhost:3000/signin');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should have working GraphQL endpoint', async ({ page }) => {
    // Try to access GraphQL endpoint
    const response = await page.goto('http://localhost:4000/graphql');
    
    // Should get some response (even if it's a GET request to GraphQL)
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load test fixtures', async () => {
    // Validate our test fixtures can be imported
    const testUsers = await import('../fixtures/test-users.json', { with: { type: 'json' } });
    
    expect(testUsers.default.testUsers).toBeDefined();
    expect(testUsers.default.testUsers.length).toBeGreaterThan(0);
    expect(testUsers.default.invalidUsers).toBeDefined();
  });
});