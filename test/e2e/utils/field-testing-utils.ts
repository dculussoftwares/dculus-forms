import { Page, Locator } from '@playwright/test';

/**
 * Utility functions for testing field properties and validation in the collaborative form builder
 */

export interface FieldPropertyValues {
  label?: string;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
  prefix?: string;
  required?: boolean;
  minLength?: number | string;
  maxLength?: number | string;
}

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Field Testing Utilities Class
 * Provides helpers for interacting with form fields and their settings
 */
export class FieldTestingUtils {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Select a Short Text field by index (0-based)
   */
  async selectShortTextField(index: number = 0): Promise<void> {
    const shortTextFields = this.page.locator('[data-testid^="draggable-field-"]:has([data-field-type="TextInputField"])');
    await shortTextFields.nth(index).waitFor({ state: 'visible', timeout: 10000 });
    await shortTextFields.nth(index).click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Wait for field settings panel to be visible
   */
  async waitForSettingsPanel(): Promise<void> {
    const settingsPanel = this.page.locator('[data-testid="field-settings-panel"]');
    await settingsPanel.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Set multiple field properties at once
   */
  async setFieldProperties(properties: FieldPropertyValues): Promise<void> {
    await this.waitForSettingsPanel();

    if (properties.label !== undefined) {
      await this.setFieldLabel(properties.label);
    }

    if (properties.placeholder !== undefined) {
      await this.setFieldPlaceholder(properties.placeholder);
    }

    if (properties.hint !== undefined) {
      await this.setFieldHint(properties.hint);
    }

    if (properties.defaultValue !== undefined) {
      await this.setFieldDefaultValue(properties.defaultValue);
    }

    if (properties.prefix !== undefined) {
      await this.setFieldPrefix(properties.prefix);
    }

    if (properties.required !== undefined) {
      await this.setFieldRequired(properties.required);
    }

    if (properties.minLength !== undefined) {
      await this.setMinLength(properties.minLength);
    }

    if (properties.maxLength !== undefined) {
      await this.setMaxLength(properties.maxLength);
    }
  }

  /**
   * Set field label
   */
  async setFieldLabel(label: string): Promise<void> {
    const labelInput = this.page.locator('[data-testid="field-label-input"]');
    await labelInput.waitFor({ state: 'visible' });
    await labelInput.clear();
    if (label) {
      await labelInput.fill(label);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set field placeholder
   */
  async setFieldPlaceholder(placeholder: string): Promise<void> {
    const placeholderInput = this.page.locator('[data-testid="field-placeholder-input"]');
    await placeholderInput.waitFor({ state: 'visible' });
    await placeholderInput.clear();
    if (placeholder) {
      await placeholderInput.fill(placeholder);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set field hint/help text
   */
  async setFieldHint(hint: string): Promise<void> {
    const hintInput = this.page.locator('[data-testid="field-hint-input"]');
    await hintInput.waitFor({ state: 'visible' });
    await hintInput.clear();
    if (hint) {
      await hintInput.fill(hint);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set field default value
   */
  async setFieldDefaultValue(defaultValue: string): Promise<void> {
    const defaultInput = this.page.locator('[data-testid="field-default-value-input"]');
    await defaultInput.waitFor({ state: 'visible' });
    await defaultInput.clear();
    if (defaultValue) {
      await defaultInput.fill(defaultValue);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set field prefix
   */
  async setFieldPrefix(prefix: string): Promise<void> {
    const prefixInput = this.page.locator('[data-testid="field-prefix-input"]');
    await prefixInput.waitFor({ state: 'visible' });
    await prefixInput.clear();
    if (prefix) {
      await prefixInput.fill(prefix);
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set field required status
   */
  async setFieldRequired(required: boolean): Promise<void> {
    const requiredToggle = this.page.locator('[data-testid="field-required-toggle"]');
    await requiredToggle.waitFor({ state: 'visible' });
    
    const currentState = await requiredToggle.isChecked();
    if (currentState !== required) {
      await requiredToggle.click();
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * Set minimum character length
   */
  async setMinLength(minLength: number | string): Promise<void> {
    const minLengthInput = this.page.locator('[data-testid="field-min-length-input"]');
    await minLengthInput.waitFor({ state: 'visible' });
    await minLengthInput.clear();
    if (minLength !== undefined && minLength !== '') {
      await minLengthInput.fill(String(minLength));
    }
    await this.page.waitForTimeout(500); // Allow validation to process
  }

  /**
   * Set maximum character length
   */
  async setMaxLength(maxLength: number | string): Promise<void> {
    const maxLengthInput = this.page.locator('[data-testid="field-max-length-input"]');
    await maxLengthInput.waitFor({ state: 'visible' });
    await maxLengthInput.clear();
    if (maxLength !== undefined && maxLength !== '') {
      await maxLengthInput.fill(String(maxLength));
    }
    await this.page.waitForTimeout(500); // Allow validation to process
  }

  /**
   * Save field settings
   */
  async saveFieldSettings(): Promise<void> {
    const saveButton = this.page.locator('[data-testid="field-settings-save-button"]');
    await saveButton.waitFor({ state: 'visible' });
    
    const isEnabled = await saveButton.isEnabled();
    if (!isEnabled) {
      throw new Error('Save button is disabled - check for validation errors');
    }
    
    await saveButton.click();
    await this.page.waitForTimeout(2000); // Wait for save operation
  }

  /**
   * Cancel field settings changes
   */
  async cancelFieldSettings(): Promise<void> {
    const cancelButton = this.page.locator('[data-testid="field-settings-cancel-button"]');
    await cancelButton.waitFor({ state: 'visible' });
    await cancelButton.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get current field property values
   */
  async getFieldProperties(): Promise<FieldPropertyValues> {
    await this.waitForSettingsPanel();
    
    const properties: FieldPropertyValues = {};

    try {
      properties.label = await this.page.locator('[data-testid="field-label-input"]').inputValue();
    } catch (e) {
      properties.label = '';
    }

    try {
      properties.placeholder = await this.page.locator('[data-testid="field-placeholder-input"]').inputValue();
    } catch (e) {
      properties.placeholder = '';
    }

    try {
      properties.hint = await this.page.locator('[data-testid="field-hint-input"]').inputValue();
    } catch (e) {
      properties.hint = '';
    }

    try {
      properties.defaultValue = await this.page.locator('[data-testid="field-default-value-input"]').inputValue();
    } catch (e) {
      properties.defaultValue = '';
    }

    try {
      properties.prefix = await this.page.locator('[data-testid="field-prefix-input"]').inputValue();
    } catch (e) {
      properties.prefix = '';
    }

    try {
      properties.required = await this.page.locator('[data-testid="field-required-toggle"]').isChecked();
    } catch (e) {
      properties.required = false;
    }

    try {
      const minLengthValue = await this.page.locator('[data-testid="field-min-length-input"]').inputValue();
      properties.minLength = minLengthValue ? parseInt(minLengthValue) : undefined;
    } catch (e) {
      properties.minLength = undefined;
    }

    try {
      const maxLengthValue = await this.page.locator('[data-testid="field-max-length-input"]').inputValue();
      properties.maxLength = maxLengthValue ? parseInt(maxLengthValue) : undefined;
    } catch (e) {
      properties.maxLength = undefined;
    }

    return properties;
  }

  /**
   * Check if save button is disabled
   */
  async isSaveButtonDisabled(): Promise<boolean> {
    const saveButton = this.page.locator('[data-testid="field-settings-save-button"]');
    await saveButton.waitFor({ state: 'visible' });
    return await saveButton.isDisabled();
  }

  /**
   * Get all validation errors currently displayed
   */
  async getValidationErrors(): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];
    
    // Look for error elements
    const errorElements = this.page.locator('[data-testid*="error"], .error, [class*="error"]');
    const errorCount = await errorElements.count();
    
    for (let i = 0; i < errorCount; i++) {
      const errorElement = errorElements.nth(i);
      const isVisible = await errorElement.isVisible();
      
      if (isVisible) {
        const errorText = await errorElement.textContent();
        if (errorText && errorText.trim() !== '') {
          errors.push({
            field: 'unknown', // Could be enhanced to detect field
            message: errorText.trim()
          });
        }
      }
    }
    
    return errors;
  }

  /**
   * Check if a specific validation error is displayed
   */
  async hasValidationError(expectedError: string): Promise<boolean> {
    const errors = await this.getValidationErrors();
    return errors.some(error => error.message.includes(expectedError));
  }

  /**
   * Navigate to form preview
   */
  async navigateToPreview(): Promise<void> {
    const previewTab = this.page.locator('[data-testid="preview-tab"]');
    await previewTab.waitFor({ state: 'visible' });
    await previewTab.click();
    await this.page.waitForTimeout(3000); // Wait for preview to load
  }

  /**
   * Enter text in the form preview Short Text field
   */
  async enterTextInPreview(text: string, fieldIndex: number = 0): Promise<void> {
    const textInputs = this.page.locator('input[type="text"]');
    const targetInput = textInputs.nth(fieldIndex);
    await targetInput.waitFor({ state: 'visible' });
    
    await targetInput.clear();
    if (text) {
      await targetInput.fill(text);
    }
    
    // Trigger validation by blurring the field
    await targetInput.blur();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if form preview shows validation errors
   */
  async hasPreviewValidationError(): Promise<boolean> {
    const errorElements = this.page.locator('[data-testid*="error"], .error, [class*="error"]');
    const errorCount = await errorElements.count();
    
    for (let i = 0; i < errorCount; i++) {
      const errorElement = errorElements.nth(i);
      const isVisible = await errorElement.isVisible();
      if (isVisible) {
        const errorText = await errorElement.textContent();
        if (errorText && errorText.trim() !== '') {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Wait for field properties to be applied in preview
   */
  async waitForPreviewUpdate(): Promise<void> {
    await this.page.waitForTimeout(2000);
  }

  /**
   * Check if field shows required indicator
   */
  async hasRequiredIndicator(): Promise<boolean> {
    // Look for required indicators (asterisk or other markers)
    const fieldPreview = this.page.locator('[data-testid^="field-content-"]:has([data-field-type="TextInputField"])').first();
    const previewText = await fieldPreview.textContent() || '';
    
    // Check for required indicator (commonly an asterisk)
    const hasAsterisk = previewText.includes('*');
    
    // Also check for required class or data attribute
    const hasRequiredClass = await this.page.locator('[data-testid*="required"], [class*="required"]').count() > 0;
    
    return hasAsterisk || hasRequiredClass;
  }

  /**
   * Take a screenshot for debugging purposes
   */
  async takeDebugScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `test/e2e/screenshots/debug-${name}-${Date.now()}.png`,
      fullPage: true
    });
  }

  /**
   * Click away from field settings to deselect
   */
  async deselectField(): Promise<void> {
    const droppablePage = this.page.locator('[data-testid="droppable-page"]');
    await droppablePage.click({ position: { x: 100, y: 100 } });
    await this.page.waitForTimeout(1000);
  }

  /**
   * Refresh page and wait for collaborative form builder to reload
   */
  async refreshAndWaitForBuilder(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(3000);
    
    // Verify we're still on collaborative builder
    const isOnCollaborativeBuilder = this.page.url().includes('/collaborate');
    if (!isOnCollaborativeBuilder) {
      throw new Error('Page refresh did not maintain collaborative builder URL');
    }
  }
}

/**
 * Create a new FieldTestingUtils instance
 */
export function createFieldTestingUtils(page: Page): FieldTestingUtils {
  return new FieldTestingUtils(page);
}

/**
 * Test data generators for field properties
 */
export const TestDataGenerators = {
  /**
   * Generate valid field property combinations
   */
  validFieldProperties(): FieldPropertyValues[] {
    return [
      {
        label: 'Full Name',
        placeholder: 'Enter your full name',
        hint: 'Please include first and last name',
        defaultValue: 'John Doe',
        prefix: 'Name:',
        required: true,
        minLength: 2,
        maxLength: 50
      },
      {
        label: 'Employee ID',
        placeholder: 'e.g. EMP001',
        hint: 'Your employee identifier',
        prefix: 'ID:',
        required: true,
        minLength: 3,
        maxLength: 15
      },
      {
        label: 'Comments',
        placeholder: 'Optional comments',
        hint: 'Any additional information',
        required: false,
        maxLength: 500
      }
    ];
  },

  /**
   * Generate invalid field property combinations for negative testing
   */
  invalidFieldProperties(): Array<{ properties: FieldPropertyValues; expectedError: string }> {
    return [
      {
        properties: { label: '' },
        expectedError: 'Field label is required'
      },
      {
        properties: { minLength: -1 },
        expectedError: 'Minimum length must be 0 or greater'
      },
      {
        properties: { maxLength: 0 },
        expectedError: 'Maximum length must be 1 or greater'
      },
      {
        properties: { minLength: 50, maxLength: 10 },
        expectedError: 'Minimum length must be less than or equal to maximum length'
      }
    ];
  },

  /**
   * Generate test input data for form validation
   */
  validationTestInputs(minLength?: number, maxLength?: number): Array<{ input: string; expectValid: boolean; expectedError?: string }> {
    const tests = [];
    
    if (minLength) {
      // Test below minimum length
      const shortText = 'a'.repeat(minLength - 1);
      tests.push({
        input: shortText,
        expectValid: false,
        expectedError: `Minimum ${minLength} characters required`
      });
      
      // Test at minimum length
      const minText = 'a'.repeat(minLength);
      tests.push({
        input: minText,
        expectValid: true
      });
    }
    
    if (maxLength) {
      // Test at maximum length
      const maxText = 'a'.repeat(maxLength);
      tests.push({
        input: maxText,
        expectValid: true
      });
      
      // Test above maximum length
      const longText = 'a'.repeat(maxLength + 1);
      tests.push({
        input: longText,
        expectValid: false,
        expectedError: `Maximum ${maxLength} characters allowed`
      });
    }
    
    // Test valid input within range
    if (minLength && maxLength) {
      const validLength = Math.floor((minLength + maxLength) / 2);
      const validText = 'a'.repeat(validLength);
      tests.push({
        input: validText,
        expectValid: true
      });
    }
    
    return tests;
  }
};