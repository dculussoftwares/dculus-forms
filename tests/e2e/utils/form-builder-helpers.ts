import { Page, expect } from '@playwright/test';

export interface FormCreationResult {
  formId: string;
  formUrl: string;
}

/**
 * Navigates to the collaborative form builder with retry logic for loading issues
 */
export async function navigateToCollaborativeFormBuilder(page: Page): Promise<FormCreationResult> {
  // We should already be on the dashboard after authentication
  // Verify we're on the dashboard (could be / or /dashboard)
  const currentUrl = page.url();
  if (!currentUrl.includes('localhost:3000') || (!currentUrl.endsWith('/') && !currentUrl.includes('/dashboard'))) {
    await page.goto('http://localhost:3000/');
  }
  
  // Wait for dashboard to load properly
  await page.waitForTimeout(2000);
  
  // Click Create Form button
  await page.click('button:has-text("Create Form")');
  
  // Wait for templates page to load
  await expect(page).toHaveURL('http://localhost:3000/dashboard/templates');
  
  // Wait for templates to load with retry logic
  await waitForTemplatesWithRetry(page);
  
  // Select the first available template
  const firstTemplate = page.locator('[data-testid="template-card"]').first();
  await expect(firstTemplate).toBeVisible({ timeout: 10000 });
  
  // Click "Use Template" button
  const useTemplateButton = firstTemplate.getByRole('button', { name: 'Use Template' });
  await useTemplateButton.click();
  
  // Fill out the form creation modal
  await page.getByLabel('Form Title').fill('Test Collaborative Form');
  await page.getByLabel('Description').fill('A form for testing collaborative features');
  
  // Submit form creation
  await page.getByRole('button', { name: 'Create Form' }).click();
  
  // Wait for navigation to form dashboard, then go to collaborate mode
  await page.waitForURL(/.*\/dashboard\/form\/.*/, { timeout: 10000 });
  
  // Extract form ID from URL
  const formUrl = page.url();
  const formIdMatch = formUrl.match(/\/dashboard\/form\/([^\/]+)/);
  if (!formIdMatch) {
    throw new Error('Could not extract form ID from URL: ' + formUrl);
  }
  const formId = formIdMatch[1];
  
  // Navigate to collaborative form builder
  const collaborateUrl = `http://localhost:3000/dashboard/form/${formId}/collaborate`;
  await page.goto(collaborateUrl);
  
  // Wait for collaborative form builder to load with retry
  await waitForCollaborativeFormBuilderWithRetry(page);
  
  return {
    formId,
    formUrl: collaborateUrl
  };
}

/**
 * Waits for templates to load with retry logic
 */
export async function waitForTemplatesWithRetry(page: Page, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Check if templates are visible
      const templates = page.locator('[data-testid="template-card"]');
      const templateCount = await templates.count();
      
      if (templateCount > 0) {
        return; // Templates loaded successfully
      }
      
      // If no templates and this isn't the last retry, reload the page
      if (i < maxRetries - 1) {
        console.log(`Templates not loaded (attempt ${i + 1}), reloading page...`);
        await page.reload();
        await page.waitForTimeout(3000);
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Templates failed to load after ${maxRetries} attempts: ${error}`);
      }
      
      console.log(`Error loading templates (attempt ${i + 1}), retrying...`);
      await page.reload();
      await page.waitForTimeout(3000);
    }
  }
  
  throw new Error(`Templates failed to load after ${maxRetries} attempts`);
}

/**
 * Waits for collaborative form builder to load with retry logic
 */
export async function waitForCollaborativeFormBuilderWithRetry(page: Page, maxRetries = 3): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Waiting for collaborative form builder (attempt ${i + 1}/${maxRetries})...`);
      
      // Wait for the main collaborative form builder container
      await page.waitForSelector('[data-testid="collaborative-form-builder"]', { timeout: 10000 });
      console.log('✅ Collaborative form builder container found');
      
      // Wait for connection status (shows "Live" when connected)
      await page.waitForSelector('text=Live', { timeout: 10000 });
      console.log('✅ Connection status shows "Live"');
      
      // Wait for field types panel to load
      await page.waitForSelector('[data-draggable-id="field-type-text_input_field"]', { timeout: 10000 });
      console.log('✅ TEXT_INPUT_FIELD found in field types panel');
      
      // Give extra time for GraphQL initialization to complete
      await page.waitForTimeout(3000);
      
      // Check for droppable pages or empty state
      const droppablePageCount = await page.locator('[data-testid="droppable-page"]').count();
      const emptyStateCount = await page.locator('text=Drop field types here to start building your form').count();
      
      console.log(`Droppable page count: ${droppablePageCount}, Empty state count: ${emptyStateCount}`);
      
      if (droppablePageCount > 0 || emptyStateCount > 0) {
        console.log('✅ Form builder is ready (has droppable page or empty state)');
        return; // Successfully loaded
      }
      
      // If neither droppable page nor empty state found, retry
      if (i < maxRetries - 1) {
        console.log(`No droppable area found (attempt ${i + 1}), reloading...`);
        await page.reload();
        await page.waitForTimeout(5000); // Longer wait for GraphQL to init
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Collaborative form builder failed to load after ${maxRetries} attempts: ${error}`);
      }
      
      console.log(`Error loading collaborative form builder (attempt ${i + 1}), retrying...`);
      await page.reload();
      await page.waitForTimeout(5000); // Longer wait between retries
    }
  }
  
  throw new Error(`Collaborative form builder failed to load after ${maxRetries} attempts`);
}

/**
 * Waits for field settings to be available for editing
 */
export async function waitForFieldSettings(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForSelector('h3:has-text("Settings")', { timeout: timeoutMs });
  await page.waitForSelector('#field-label', { timeout: timeoutMs });
}

/**
 * Adds a TEXT_INPUT_FIELD to the form builder
 */
export async function addTextInputField(page: Page): Promise<void> {
  const textInputFieldType = page.locator('[data-draggable-id="field-type-text_input_field"]');
  await expect(textInputFieldType).toBeVisible();
  
  // Check if we have droppable pages or need to create one
  const droppablePageCount = await page.locator('[data-testid="droppable-page"]').count();
  const emptyStateCount = await page.locator('text=Drop field types here to start building your form').count();
  
  let dropTarget;
  
  if (droppablePageCount > 0) {
    // Use existing droppable page
    dropTarget = page.locator('[data-testid="droppable-page"]').first();
    console.log('Using existing droppable page for field drop');
  } else if (emptyStateCount > 0) {
    // Drop on empty state area
    dropTarget = page.locator('text=Drop field types here to start building your form');
    console.log('Using empty state area for field drop');
  } else {
    // Create a new page first
    const addPageButton = page.locator('button:has-text("Add Page")');
    if (await addPageButton.count() > 0) {
      console.log('Creating new page first...');
      await addPageButton.click();
      await page.waitForTimeout(1000);
      dropTarget = page.locator('[data-testid="droppable-page"]').first();
    } else {
      throw new Error('No droppable area found and no "Add Page" button available');
    }
  }
  
  await expect(dropTarget).toBeVisible();
  
  // Count existing fields before adding
  const initialFieldCount = await page.locator('[data-testid^="draggable-field-"]').count();
  console.log(`Initial field count: ${initialFieldCount}`);
  
  console.log('Performing drag and drop of TEXT_INPUT_FIELD...');
  await textInputFieldType.dragTo(dropTarget);
  
  // Wait for field to be added
  console.log('Waiting for field to be added...');
  
  // Wait for field count to increase by 1
  await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(initialFieldCount + 1, { timeout: 10000 });
  console.log(`✅ TEXT_INPUT_FIELD successfully added (${initialFieldCount} -> ${initialFieldCount + 1} fields)`);
}

/**
 * Configures a TEXT_INPUT_FIELD with basic properties
 */
export async function configureTextInputField(
  page: Page, 
  config: {
    label?: string;
    placeholder?: string;
    hint?: string;
    defaultValue?: string;
    prefix?: string;
    required?: boolean;
  }
): Promise<void> {
  // Select the field to open settings
  const field = page.locator('[data-testid^="draggable-field-"]').first();
  await field.click();
  
  // Wait for field settings to load
  await waitForFieldSettings(page);
  
  // Configure properties
  if (config.label !== undefined) {
    await page.locator('#field-label').fill(config.label);
  }
  
  if (config.placeholder !== undefined) {
    await page.locator('#field-placeholder').fill(config.placeholder);
  }
  
  if (config.hint !== undefined) {
    await page.locator('#field-hint').fill(config.hint);
  }
  
  if (config.defaultValue !== undefined) {
    await page.locator('#field-default').fill(config.defaultValue);
  }
  
  if (config.prefix !== undefined) {
    await page.locator('#field-prefix').fill(config.prefix);
  }
  
  if (config.required !== undefined) {
    const requiredCheckbox = page.locator('#field-required');
    if (config.required) {
      await requiredCheckbox.check();
    } else {
      await requiredCheckbox.uncheck();
    }
  }
  
  // Save the configuration
  await page.click('button:has-text("Save")');
  
  // Wait for save to complete
  await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
}

/**
 * Verifies that a field with given properties exists
 */
export async function verifyFieldExists(page: Page, label: string): Promise<void> {
  await expect(page.locator(`text=${label}`)).toBeVisible();
}

/**
 * Simulates connection loss and recovery
 */
export async function simulateConnectionLoss(page: Page): Promise<void> {
  await page.context().setOffline(true);
  await expect(page.locator('text=Offline')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.w-2.h-2.bg-red-400')).toBeVisible();
}

/**
 * Restores connection after connection loss
 */
export async function restoreConnection(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await expect(page.locator('text=Live')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.w-2.h-2.bg-green-400')).toBeVisible();
}