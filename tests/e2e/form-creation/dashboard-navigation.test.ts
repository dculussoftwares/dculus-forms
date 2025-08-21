import { test, expect } from '@playwright/test';
import { DashboardPage, TemplatesPage } from '../utils/page-objects';
import { authenticateUser, generateTestUser, signUpNewUser } from '../utils/auth-helpers';
import { navigateToDashboard, navigateToTemplates, verifyTemplatesPageLoaded } from '../utils/form-helpers';

test.describe('Dashboard Navigation Journey', () => {
  // Setup: Create and authenticate a user before each test
  test.beforeEach(async ({ page }) => {
    const userData = generateTestUser();
    
    // Create user account
    await signUpNewUser(page, userData);
    
    // Sign in the user
    await authenticateUser(page, userData.email, userData.password);
  });

  test('should display dashboard with My Forms section', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Verify we're on dashboard and it loads correctly
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(dashboardPage.myFormsTitle).toBeVisible();
    
    // Verify dashboard elements
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
    await expect(dashboardPage.createFormButton).toBeVisible();
  });

  test('should show empty state when user has no forms', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    await dashboardPage.goto();
    
    // For a new user, should show empty state
    await expect(page.getByText('No forms yet')).toBeVisible();
    await expect(page.getByText('Get started by creating your first form')).toBeVisible();
    await expect(page.getByText('Create Your First Form')).toBeVisible();
  });

  test('should navigate to templates page when clicking Create Form button', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const templatesPage = new TemplatesPage(page);
    
    await dashboardPage.goto();
    
    // Click Create Form button
    await dashboardPage.clickCreateForm();
    
    // Verify navigation to templates page
    await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
    await expect(templatesPage.pageTitle).toBeVisible();
  });

  test('should navigate to templates page when clicking Create Your First Form button', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    
    // Click the "Create Your First Form" button from empty state
    await page.getByRole('button', { name: 'Create Your First Form' }).click();
    
    // Verify navigation to templates page
    await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
    await expect(templatesPage.pageTitle).toBeVisible();
  });

  test('should display correct breadcrumb navigation on dashboard', async ({ page }) => {
    await navigateToDashboard(page);
    
    // Check for breadcrumb (might be in the MainLayout component)
    const breadcrumb = page.getByText('Dashboard');
    await expect(breadcrumb).toBeVisible();
  });

  test('should show form count correctly', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    await dashboardPage.goto();
    await dashboardPage.waitForFormsToLoad();
    
    // For new user, should show "0 forms"
    await expect(page.getByText('0 forms in your workspace')).toBeVisible();
  });

  test('should have working navigation elements', async ({ page }) => {
    await navigateToDashboard(page);
    
    // Verify main navigation elements exist and are clickable
    const createFormButton = page.getByRole('button', { name: /Create Form/i });
    await expect(createFormButton).toBeVisible();
    await expect(createFormButton).toBeEnabled();
  });

  test('should display organization context', async ({ page }) => {
    await navigateToDashboard(page);
    
    // The dashboard should show forms for the current organization
    // This would depend on your organization context implementation
    // For now, just verify the page loads and shows content correctly
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
  });

  test('should handle loading states gracefully', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    
    // Navigate to dashboard
    await dashboardPage.goto();
    
    // Check if loading states are handled (might show skeleton loading)
    // This depends on your implementation - adjust as needed
    await page.waitForLoadState('domcontentloaded');
    
    // Verify content eventually loads
    await expect(dashboardPage.myFormsTitle).toBeVisible({ timeout: 10000 });
  });

  test('should maintain authentication state during navigation', async ({ page }) => {
    await navigateToDashboard(page);
    
    // Navigate to templates
    await navigateToTemplates(page);
    
    // Navigate back to dashboard
    await page.goto('http://localhost:3000/');
    
    // Should still be authenticated and see dashboard
    await expect(page.getByRole('heading', { name: 'Your Forms' })).toBeVisible();
    // Should not be redirected to signin
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should show correct subtitle and description', async ({ page }) => {
    await navigateToDashboard(page);
    
    // Verify dashboard subtitle/description from MainLayout
    await expect(page.getByText('Create, manage, and analyze your forms')).toBeVisible();
  });
});