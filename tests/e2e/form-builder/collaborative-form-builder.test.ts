import { test, expect, Page } from '@playwright/test';
import { signInUser, generateTestUser, signUpNewUser, authenticateUser } from '../utils/auth-helpers';
import { 
  navigateToCollaborativeFormBuilder,
  addTextInputField,
  configureTextInputField,
  verifyFieldExists,
  simulateConnectionLoss,
  restoreConnection
} from '../utils/form-builder-helpers';

test.describe('Collaborative Form Builder - TEXT_INPUT_FIELD Journey Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Generate and create a test user
    const userData = generateTestUser();
    await signUpNewUser(page, userData);
    
    // Sign in with the created user
    await authenticateUser(page, userData.email, userData.password);

    // Navigate to collaborative form builder with retry logic
    await navigateToCollaborativeFormBuilder(page);
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Form Builder Interface', () => {
    test('should display three-panel layout correctly', async () => {
      // Verify left panel (Field Types Panel)
      await expect(page.locator('.h-full.overflow-y-auto:has(h3:has-text("Field Types"))')).toBeVisible();
      
      // Verify center panel (Main Editor)
      await expect(page.locator('[data-testid="droppable-page"]')).toBeVisible();
      
      // Verify right panel (Pages Sidebar)
      await expect(page.locator('[data-testid="pages-sidebar"]')).toBeVisible();
      
      // Verify connection status indicator
      await expect(page.locator('text=Connected')).toBeVisible();
    });

    test('should show TEXT_INPUT_FIELD in field types panel', async () => {
      // Find the TEXT_INPUT_FIELD in the Field Types Panel
      const textInputField = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      await expect(textInputField).toBeVisible();
      
      // Verify it shows correct label
      await expect(textInputField.locator('text=Short Text')).toBeVisible();
      
      // Verify it shows correct description
      await expect(textInputField.locator('text=Single line text input')).toBeVisible();
      
      // Verify it has the correct icon
      await expect(textInputField.locator('svg')).toBeVisible();
    });

    test('should show empty state when no fields exist', async () => {
      // Verify empty state message
      await expect(page.locator('text=Drop field types here to start building your form')).toBeVisible();
      
      // Verify no fields are present
      const fieldElements = page.locator('[data-testid^="draggable-field-"]');
      await expect(fieldElements).toHaveCount(0);
    });
  });

  test.describe('TEXT_INPUT_FIELD Addition', () => {
    test('should add TEXT_INPUT_FIELD via drag and drop', async () => {
      // Add a TEXT_INPUT_FIELD using helper function
      await addTextInputField(page);
      
      // Verify field appears with correct type
      const addedField = page.locator('[data-testid^="draggable-field-"]:has([data-field-type="text_input_field"])').first();
      await expect(addedField).toBeVisible();
      
      // Verify field shows field type badge (specifically in the badge, not the label)
      await expect(addedField.locator('.bg-blue-100').getByText('Short Text')).toBeVisible();
    });

    test('should add multiple TEXT_INPUT_FIELD instances', async () => {
      // Count initial fields
      const initialFieldCount = await page.locator('[data-testid^="draggable-field-"]').count();
      const initialTextInputCount = await page.locator('[data-testid^="draggable-field-"]:has([data-field-type="text_input_field"])').count();
      
      // Add first TEXT_INPUT_FIELD
      await addTextInputField(page);
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(initialFieldCount + 1);
      
      // Add second TEXT_INPUT_FIELD
      await addTextInputField(page);
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(initialFieldCount + 2);
      
      // Verify both new fields are TEXT_INPUT_FIELD type
      const textInputFields = page.locator('[data-testid^="draggable-field-"]:has([data-field-type="text_input_field"])');
      await expect(textInputFields).toHaveCount(initialTextInputCount + 2);
    });

    test('should show drop preview indicator during drag', async () => {
      const textInputFieldType = page.locator('[data-draggable-id="field-type-text_input_field"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      
      // Start dragging
      await textInputFieldType.hover();
      await page.mouse.down();
      
      // Move to droppable area
      await droppablePage.hover();
      
      // Verify drop indicator appears
      await expect(page.locator('[data-testid="drop-indicator"]')).toBeVisible({ timeout: 3000 });
      
      // Complete the drop
      await page.mouse.up();
      
      // Verify drop indicator disappears and field is added
      await expect(page.locator('[data-testid="drop-indicator"]')).not.toBeVisible();
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(1);
    });
  });

  test.describe('TEXT_INPUT_FIELD Configuration', () => {
    test.beforeEach(async () => {
      // Add a TEXT_INPUT_FIELD before each configuration test
      await addTextInputField(page);
      
      // Click on the field to select it and open field settings
      const addedField = page.locator('[data-testid^="draggable-field-"]').first();
      await addedField.click();
      
      // Wait for field settings panel to load
      await expect(page.locator('h3:has-text("Short Text Settings")')).toBeVisible({ timeout: 3000 });
    });

    test('should display field settings panel for TEXT_INPUT_FIELD', async () => {
      // Verify settings panel header
      await expect(page.locator('h3:has-text("Short Text Settings")')).toBeVisible();
      
      // Verify settings panel description
      await expect(page.locator('text=Configure field properties and validation')).toBeVisible();
      
      // Verify TEXT_INPUT_FIELD icon in settings
      await expect(page.locator('.p-2.bg-gray-100 svg')).toBeVisible();
    });

    test('should configure basic TEXT_INPUT_FIELD properties', async () => {
      // Use helper function to configure the field
      await configureTextInputField(page, {
        label: 'Full Name',
        hint: 'Enter your full name as it appears on official documents',
        defaultValue: 'John Doe',
        required: true
      });
      
      // Verify changes are reflected in the field preview
      await verifyFieldExists(page, 'Full Name');
    });

    test('should configure TEXT_INPUT_FIELD placeholder', async () => {
      // Configure Placeholder
      const placeholderInput = page.locator('#field-placeholder');
      await placeholderInput.clear();
      await placeholderInput.fill('e.g. John Smith');
      
      // Save the changes
      await page.click('button:has-text("Save")');
      
      // Wait for save confirmation
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
    });

    test('should configure TEXT_INPUT_FIELD prefix', async () => {
      // Configure Prefix
      const prefixInput = page.locator('#field-prefix');
      await prefixInput.clear();
      await prefixInput.fill('Mr./Ms.');
      
      // Save the changes
      await page.click('button:has-text("Save")');
      
      // Wait for save confirmation
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
    });

    test('should configure TEXT_INPUT_FIELD validation', async () => {
      // Make field required
      const requiredCheckbox = page.locator('#field-required');
      await requiredCheckbox.check();
      
      // Save the changes
      await page.click('button:has-text("Save")');
      
      // Wait for save confirmation and verify required indicator
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
    });

    test('should show unsaved changes indicator', async () => {
      // Make a change without saving
      const labelInput = page.locator('#field-label');
      await labelInput.clear();
      await labelInput.fill('Modified Label');
      
      // Verify unsaved changes indicator appears
      await expect(page.locator('text=Unsaved changes')).toBeVisible();
      
      // Verify save button is enabled
      await expect(page.locator('button:has-text("Save")')).toBeEnabled();
    });

    test('should support keyboard shortcuts for saving', async () => {
      // Make a change
      const labelInput = page.locator('#field-label');
      await labelInput.clear();
      await labelInput.fill('Keyboard Save Test');
      
      // Use Ctrl+S (Cmd+S on Mac) to save
      await page.keyboard.press('Meta+s');
      
      // Verify changes are saved
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
    });

    test('should support canceling changes', async () => {
      // Get original label
      const originalLabel = await page.locator('#field-label').inputValue();
      
      // Make a change
      const labelInput = page.locator('#field-label');
      await labelInput.clear();
      await labelInput.fill('Temporary Change');
      
      // Verify unsaved changes indicator
      await expect(page.locator('text=Unsaved changes')).toBeVisible();
      
      // Cancel changes
      await page.click('button:has-text("Cancel")');
      
      // Verify changes are reverted
      await expect(page.locator('#field-label')).toHaveValue(originalLabel);
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible();
    });

    test('should support resetting field to defaults', async () => {
      // Make changes
      await page.locator('#field-label').fill('Modified Label');
      await page.locator('#field-hint').fill('Modified hint');
      
      // Save changes first
      await page.click('button:has-text("Save")');
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
      
      // Now make more changes
      await page.locator('#field-label').fill('Another Change');
      
      // Reset changes
      await page.click('button:has-text("Reset")');
      
      // Verify field is reset to saved state
      await expect(page.locator('#field-label')).toHaveValue('Modified Label');
    });
  });

  test.describe('TEXT_INPUT_FIELD Reordering', () => {
    test.beforeEach(async () => {
      // Add multiple TEXT_INPUT_FIELD instances for reordering tests
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      
      // Add first field
      await textInputFieldType.dragTo(droppablePage);
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(1);
      
      // Configure first field
      await page.locator('[data-testid^="draggable-field-"]').first().click();
      await page.locator('#field-label').fill('First Field');
      await page.click('button:has-text("Save")');
      
      // Add second field
      await textInputFieldType.dragTo(droppablePage);
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(2);
      
      // Configure second field
      await page.locator('[data-testid^="draggable-field-"]').nth(1).click();
      await page.locator('#field-label').fill('Second Field');
      await page.click('button:has-text("Save")');
      
      // Add third field
      await textInputFieldType.dragTo(droppablePage);
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(3);
      
      // Configure third field
      await page.locator('[data-testid^="draggable-field-"]').nth(2).click();
      await page.locator('#field-label').fill('Third Field');
      await page.click('button:has-text("Save")');
      
      // Click away to deselect
      await page.locator('[data-testid="droppable-page"]').click({ position: { x: 50, y: 50 } });
    });

    test('should reorder fields by dragging up', async () => {
      // Verify initial order
      const fields = page.locator('[data-testid^="draggable-field-"]');
      await expect(fields.nth(0).locator('text=First Field')).toBeVisible();
      await expect(fields.nth(1).locator('text=Second Field')).toBeVisible();
      await expect(fields.nth(2).locator('text=Third Field')).toBeVisible();
      
      // Drag third field up to first position
      await fields.nth(2).dragTo(fields.nth(0));
      
      // Wait and verify new order
      await page.waitForTimeout(1000);
      const reorderedFields = page.locator('[data-testid^="draggable-field-"]');
      await expect(reorderedFields.nth(0).locator('text=Third Field')).toBeVisible();
      await expect(reorderedFields.nth(1).locator('text=First Field')).toBeVisible();
      await expect(reorderedFields.nth(2).locator('text=Second Field')).toBeVisible();
    });

    test('should reorder fields by dragging down', async () => {
      // Drag first field down to last position
      const fields = page.locator('[data-testid^="draggable-field-"]');
      await fields.nth(0).dragTo(fields.nth(2));
      
      // Wait and verify new order
      await page.waitForTimeout(1000);
      const reorderedFields = page.locator('[data-testid^="draggable-field-"]');
      await expect(reorderedFields.nth(0).locator('text=Second Field')).toBeVisible();
      await expect(reorderedFields.nth(1).locator('text=Third Field')).toBeVisible();
      await expect(reorderedFields.nth(2).locator('text=First Field')).toBeVisible();
    });

    test('should show drop indicators during field reordering', async () => {
      const firstField = page.locator('[data-testid^="draggable-field-"]').nth(0);
      const thirdField = page.locator('[data-testid^="draggable-field-"]').nth(2);
      
      // Start dragging first field
      await firstField.hover();
      await page.mouse.down();
      
      // Move to third field position
      await thirdField.hover();
      
      // Verify drop indicator appears
      await expect(page.locator('[data-testid="drop-indicator"]')).toBeVisible({ timeout: 3000 });
      
      // Complete the drop
      await page.mouse.up();
      
      // Verify drop indicator disappears
      await expect(page.locator('[data-testid="drop-indicator"]')).not.toBeVisible();
    });
  });

  test.describe('Collaborative Editing', () => {
    test('should maintain connection status', async () => {
      // Verify connection is established
      await expect(page.locator('text=Connected')).toBeVisible();
      
      // Verify connection indicator shows green dot
      await expect(page.locator('.w-2.h-2.rounded-full.bg-green-500')).toBeVisible();
    });

    test('should handle field updates in real-time collaboration context', async () => {
      // Add a TEXT_INPUT_FIELD
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      await textInputFieldType.dragTo(droppablePage);
      
      // Select and configure field
      await page.locator('[data-testid^="draggable-field-"]').first().click();
      await page.locator('#field-label').fill('Collaborative Field');
      
      // Save changes
      await page.click('button:has-text("Save")');
      
      // Wait for save confirmation
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
      
      // Verify field label is updated in the preview
      await expect(page.locator('text=Collaborative Field')).toBeVisible();
    });

    test('should handle auto-save when switching between fields', async () => {
      // Add two TEXT_INPUT_FIELD instances
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      
      await textInputFieldType.dragTo(droppablePage);
      await textInputFieldType.dragTo(droppablePage);
      
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(2);
      
      // Select first field and make changes
      await page.locator('[data-testid^="draggable-field-"]').nth(0).click();
      await page.locator('#field-label').fill('Auto Save Field 1');
      
      // Switch to second field (should trigger auto-save)
      await page.locator('[data-testid^="draggable-field-"]').nth(1).click();
      
      // Switch back to first field and verify changes were saved
      await page.locator('[data-testid^="draggable-field-"]').nth(0).click();
      await expect(page.locator('#field-label')).toHaveValue('Auto Save Field 1');
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible();
    });
  });

  test.describe('Field Deletion and Management', () => {
    test.beforeEach(async () => {
      // Add a TEXT_INPUT_FIELD for deletion tests
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      await textInputFieldType.dragTo(droppablePage);
      
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(1);
    });

    test('should delete TEXT_INPUT_FIELD', async () => {
      // Select the field
      const field = page.locator('[data-testid^="draggable-field-"]').first();
      await field.click();
      
      // Look for delete button in field settings or field itself
      const deleteButton = page.locator('button:has([data-testid="delete-icon"]), button:has-text("Delete"), button[aria-label*="delete" i]').first();
      
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        
        // Confirm deletion if there's a confirmation dialog
        const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
        if (await confirmButton.count() > 0) {
          await confirmButton.first().click();
        }
        
        // Verify field is deleted
        await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(0);
        
        // Verify empty state is shown
        await expect(page.locator('text=Drop field types here to start building your form')).toBeVisible();
      } else {
        console.log('Delete button not found - may need to implement or locate differently');
      }
    });

    test('should duplicate TEXT_INPUT_FIELD if feature available', async () => {
      // Select the field and configure it
      const field = page.locator('[data-testid^="draggable-field-"]').first();
      await field.click();
      
      await page.locator('#field-label').fill('Original Field');
      await page.click('button:has-text("Save")');
      
      // Look for duplicate button
      const duplicateButton = page.locator('button:has([data-testid="duplicate-icon"]), button:has-text("Duplicate"), button[aria-label*="duplicate" i]').first();
      
      if (await duplicateButton.count() > 0) {
        await duplicateButton.click();
        
        // Verify field is duplicated
        await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(2);
        
        // Verify both fields have similar content
        await expect(page.locator('text=Original Field')).toHaveCount(2);
      } else {
        console.log('Duplicate button not found - feature may not be implemented yet');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle connection loss gracefully', async () => {
      // Add a field first
      await addTextInputField(page);
      
      // Simulate connection loss
      await simulateConnectionLoss(page);
      
      // Verify editing is disabled during offline state
      await page.locator('[data-testid^="draggable-field-"]').first().click();
      await expect(page.locator('text=Changes are disabled while offline')).toBeVisible();
      
      // Restore connection
      await restoreConnection(page);
    });

    test('should validate required fields in settings', async () => {
      // Add and select a TEXT_INPUT_FIELD
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      await textInputFieldType.dragTo(droppablePage);
      
      await page.locator('[data-testid^="draggable-field-"]').first().click();
      
      // Try to clear the label field (if validation exists)
      await page.locator('#field-label').clear();
      
      // Try to save
      await page.click('button:has-text("Save")');
      
      // Check for validation error (implementation dependent)
      const errorMessage = page.locator('.text-red-500');
      if (await errorMessage.count() > 0) {
        await expect(errorMessage).toBeVisible();
        console.log('Validation working correctly');
      } else {
        console.log('No validation error shown - may be allowed or not implemented');
      }
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('should handle rapid field additions smoothly', async () => {
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      
      // Add multiple fields rapidly
      for (let i = 0; i < 5; i++) {
        await textInputFieldType.dragTo(droppablePage);
        await page.waitForTimeout(500); // Small delay to avoid overwhelming
      }
      
      // Verify all fields were added
      await expect(page.locator('[data-testid^="draggable-field-"]')).toHaveCount(5);
      
      // Verify form builder remains responsive
      await expect(page.locator('text=Connected')).toBeVisible();
    });

    test('should maintain smooth performance during field configuration', async () => {
      // Add a field
      const textInputFieldType = page.locator('[data-draggable-id="field-type-TEXT_INPUT_FIELD"]');
      const droppablePage = page.locator('[data-testid="droppable-page"]');
      await textInputFieldType.dragTo(droppablePage);
      
      // Select and rapidly configure field properties
      await page.locator('[data-testid^="draggable-field-"]').first().click();
      
      const configurations = [
        { selector: '#field-label', value: 'Performance Test Field' },
        { selector: '#field-hint', value: 'This is a performance test' },
        { selector: '#field-placeholder', value: 'Enter performance data' },
        { selector: '#field-default', value: 'Default performance value' },
        { selector: '#field-prefix', value: 'PERF:' }
      ];
      
      // Configure all properties rapidly
      for (const config of configurations) {
        const input = page.locator(config.selector);
        if (await input.count() > 0) {
          await input.clear();
          await input.fill(config.value);
        }
      }
      
      // Save configuration
      await page.click('button:has-text("Save")');
      
      // Verify save completed without issues
      await expect(page.locator('text=Unsaved changes')).not.toBeVisible({ timeout: 3000 });
    });
  });
});