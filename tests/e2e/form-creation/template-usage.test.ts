import { test, expect } from '@playwright/test';
import { DashboardPage, TemplatesPage, UseTemplatePopover, FormDashboardPage } from '../utils/page-objects';
import { authenticateUser, generateTestUser, signUpNewUser } from '../utils/auth-helpers';
import { 
  navigateToTemplates, 
  useTemplate, 
  verifyFormCreated, 
  generateTestFormData,
  waitForFormCreation,
  getFormIdFromUrl
} from '../utils/form-helpers';

test.describe('Template Usage Journey', () => {
  // Setup: Create and authenticate a user before each test
  test.beforeEach(async ({ page }) => {
    const userData = generateTestUser();
    
    // Create user account
    await signUpNewUser(page, userData);
    
    // Sign in the user
    await authenticateUser(page, userData.email, userData.password);
    
    // Navigate to templates page
    await navigateToTemplates(page);
  });

  test('should display templates page with available templates', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    
    // Verify templates page loaded correctly
    await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
    await expect(templatesPage.pageTitle).toBeVisible();
    
    // Verify page content
    await expect(page.getByText('Choose from our professionally designed templates')).toBeVisible();
    
    // Wait for templates to load and verify at least one template exists
    await templatesPage.waitForTemplatesToLoad();
    const templateCount = await templatesPage.getTemplateCount();
    expect(templateCount).toBeGreaterThan(0);
  });

  test('should show Use Template button on hover', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    
    await templatesPage.waitForTemplatesToLoad();
    
    // Hover over first template
    const firstTemplate = templatesPage.templateCards.first();
    await firstTemplate.hover();
    
    // Use Template button should become visible within the hovered template
    const useTemplateButton = firstTemplate.getByRole('button', { name: 'Use Template' });
    await expect(useTemplateButton).toBeVisible();
  });

  test('should open template popover when clicking Use Template button', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    await templatesPage.waitForTemplatesToLoad();
    
    // Select first template
    await templatesPage.selectFirstTemplate();
    
    // Verify popover opens
    expect(await useTemplatePopover.isVisible()).toBe(true);
    await expect(page.getByText('Create Form from Template')).toBeVisible();
    
    // Verify popover has required fields
    await expect(page.getByLabel('Form Title')).toBeVisible();
    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Form' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('should create form successfully from template', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    const formDashboardPage = new FormDashboardPage(page);
    
    const formData = generateTestFormData();
    
    await templatesPage.waitForTemplatesToLoad();
    
    // Select template and open popover
    await templatesPage.selectFirstTemplate();
    
    // Fill form creation form
    await useTemplatePopover.fillForm(formData.formTitle, formData.description);
    
    // Submit form creation
    await useTemplatePopover.submit();
    
    // Verify form was created and we're redirected to form dashboard
    await waitForFormCreation(page, formData.formTitle);
    await formDashboardPage.verifyFormExists(formData.formTitle);
  });

  test('should validate required fields in template popover', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    
    // Clear the pre-filled title and try to create form without a title
    await useTemplatePopover.formTitleInput.clear();
    await useTemplatePopover.createFormButton.click();
    
    // Should show validation error
    await expect(page.locator('.text-red-500', { hasText: 'Form title is required' })).toBeVisible();
  });

  test('should cancel template usage', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    
    // Cancel the popover
    await useTemplatePopover.cancel();
    
    // Wait for popover to close
    await page.waitForTimeout(500);
    
    // Should close popover and remain on templates page
    expect(await useTemplatePopover.isVisible()).toBe(false);
    await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
  });

  test('should show loading state during form creation', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    const formData = generateTestFormData();
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    
    // Fill form
    await useTemplatePopover.fillForm(formData.formTitle, formData.description);
    
    // Click create form and immediately check for loading state
    const createFormPromise = useTemplatePopover.submit();
    
    // Should show loading state
    await expect(page.getByText('Creating...')).toBeVisible();
    
    // Wait for creation to complete
    await createFormPromise;
  });

  test('should handle form creation errors gracefully', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    await templatesPage.waitForTemplatesToLoad();
    
    // Simulate network failure
    await page.route('**/graphql', route => route.abort());
    
    await templatesPage.selectFirstTemplate();
    
    // Try to create form
    await useTemplatePopover.fillForm('Test Form', 'Test Description');
    await useTemplatePopover.createFormButton.click();
    
    // Should show some error message
    await page.waitForTimeout(2000);
    const hasError = await page.getByText(/error|failed|try again/i).first().isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });

  test('should preserve form data when popover is reopened', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    
    // Fill some data
    await useTemplatePopover.formTitleInput.fill('Test Form Title');
    
    // Cancel and reopen
    await useTemplatePopover.cancel();
    await templatesPage.selectFirstTemplate();
    
    // Form data should be preserved when reopened
    const titleValue = await useTemplatePopover.formTitleInput.inputValue();
    expect(titleValue).toBe('Test Form Title');
  });

  test('should navigate to form dashboard after successful creation', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    const formData = generateTestFormData();
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    
    // Create form
    await useTemplatePopover.fillForm(formData.formTitle, formData.description);
    await useTemplatePopover.submit();
    
    // Should navigate to form dashboard page
    await expect(page).toHaveURL(/\/dashboard\/form\/[\w-]+$/);
    
    // Should be able to get form ID from URL
    const formId = await getFormIdFromUrl(page);
    expect(formId).toMatch(/^[\w-]+$/);
    
    // Form title should be visible as main heading on the page
    await expect(page.locator('h1').filter({ hasText: formData.formTitle })).toBeVisible();
  });

  test('should create forms with different titles from same template', async ({ page }) => {
    const templatesPage = new TemplatesPage(page);
    const useTemplatePopover = new UseTemplatePopover(page);
    
    // Create first form
    const formData1 = generateTestFormData('1');
    
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    await useTemplatePopover.fillForm(formData1.formTitle, formData1.description);
    await useTemplatePopover.submit();
    
    // Verify first form created
    await waitForFormCreation(page, formData1.formTitle);
    const formId1 = await getFormIdFromUrl(page);
    
    // Go back to templates and create another form
    await page.goto('http://localhost:3000/dashboard/templates');
    
    const formData2 = generateTestFormData('2');
    await templatesPage.waitForTemplatesToLoad();
    await templatesPage.selectFirstTemplate();
    await useTemplatePopover.fillForm(formData2.formTitle, formData2.description);
    await useTemplatePopover.submit();
    
    // Verify second form created with different ID
    await waitForFormCreation(page, formData2.formTitle);
    const formId2 = await getFormIdFromUrl(page);
    
    expect(formId1).not.toBe(formId2);
  });
});