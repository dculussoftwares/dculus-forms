import { Given, When, Then } from '@cucumber/cucumber';
import { randomBytes } from 'crypto';
import { CustomWorld } from '../support/world';
import { expect, expectDefined } from '../utils/expect-helper';
import { Page } from 'playwright';

function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

Given('I create a comprehensive form with all field types titled {string}',
  async function(this: CustomWorld, title: string) {
    expectDefined(this.authToken, 'Auth token must be available for GraphQL requests');
    expectDefined(this.currentOrganization, 'Current organization must be set before creating a form');

    const pageId = `page-${generateId(8)}`;

    // Create a comprehensive form schema with all 9 field types
    const formSchema = {
      pages: [{
        id: pageId,
        title: 'Comprehensive Test Page',
        order: 0,
        fields: [
          {
            id: 'field-text-input',
            type: 'text_input_field',
            label: 'Short Text Field',
            order: 0,
            defaultValue: '',
            prefix: '',
            hint: 'Enter a short text',
            validation: { required: true, type: 'text_input_field' },
          },
          {
            id: 'field-text-area',
            type: 'text_area_field',
            label: 'Long Text Field',
            order: 1,
            defaultValue: '',
            prefix: '',
            hint: 'Enter a long text',
            validation: { required: false, type: 'text_area_field' },
          },
          {
            id: 'field-email',
            type: 'email_field',
            label: 'Email Field',
            order: 2,
            defaultValue: '',
            prefix: '',
            hint: 'Enter your email',
            validation: { required: true, type: 'email_field' },
          },
          {
            id: 'field-number',
            type: 'number_field',
            label: 'Number Field',
            order: 3,
            defaultValue: '',
            prefix: '',
            hint: 'Enter a number',
            validation: { 
              required: false, 
              type: 'number_field',
              min: 0,
              max: 100
            },
          },
          {
            id: 'field-date',
            type: 'date_field',
            label: 'Date Field',
            order: 4,
            defaultValue: '',
            prefix: '',
            hint: 'Select a date',
            validation: { required: false, type: 'date_field' },
          },
          {
            id: 'field-select',
            type: 'select_field',
            label: 'Dropdown Field',
            order: 5,
            defaultValue: '',
            prefix: '',
            hint: 'Select an option',
            options: ['Option 1', 'Option 2', 'Option 3'],
            validation: { required: true, type: 'select_field' },
          },
          {
            id: 'field-radio',
            type: 'radio_field',
            label: 'Radio Field',
            order: 6,
            defaultValue: '',
            prefix: '',
            hint: 'Choose one option',
            options: ['Choice A', 'Choice B', 'Choice C'],
            validation: { required: true, type: 'radio_field' },
          },
          {
            id: 'field-checkbox',
            type: 'checkbox_field',
            label: 'Checkbox Field',
            order: 7,
            defaultValue: [],
            prefix: '',
            hint: 'Select multiple options',
            options: ['Check 1', 'Check 2', 'Check 3'],
            validation: { 
              required: false, 
              type: 'checkbox_field',
              minSelections: 1,
              maxSelections: 3
            },
          },
          {
            id: 'field-rich-text',
            type: 'rich_text_field',
            label: 'Rich Text Field',
            order: 8,
            defaultValue: '',
            prefix: '',
            hint: 'This is a rich text content field',
            validation: { required: false, type: 'rich_text_field' },
          },
        ],
      }],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: 'L1',
        content: '',
        customBackGroundColor: '#ffffff',
        customCTAButtonName: 'Submit',
        backgroundImageKey: '',
        pageMode: 'multipage',
      },
      isShuffleEnabled: false,
    };

    const form = await this.formTestUtils.createForm(this.authToken!, {
      formSchema,
      title,
      description: 'A comprehensive form with all available field types for testing',
      organizationId: this.currentOrganization!.id,
    });

    this.setSharedTestData('createdForm', form);
    this.trackCreatedForm(form);

    console.log(`📝 Created comprehensive form "${form.title}" with shortUrl: ${form.shortUrl}`);
  }
);

Then('the form should be accessible at the form viewer URL',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form should exist');
    expectDefined(form.shortUrl, 'Form should have a shortUrl');
    expect(form.isPublished === true, 'Form should be published');

    const formViewerURL = process.env.FORM_VIEWER_URL || 'http://localhost:5173';
    const fullURL = `${formViewerURL}/f/${form.shortUrl}`;
    
    this.setSharedTestData('formViewerURL', fullURL);
    
    console.log(`🌐 Form viewer URL: ${fullURL}`);
  }
);

Then('all field types should be visible in the form viewer', { timeout: 90000 },
  async function(this: CustomWorld) {
    const formViewerURL = this.getSharedTestData('formViewerURL');
    expectDefined(formViewerURL, 'Form viewer URL should be set');

    console.log(`🌐 Navigating to form viewer: ${formViewerURL}`);

    // Use Playwright to check the form viewer - we'll store page reference for subsequent checks
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ 
      headless: process.env.E2E_HEADLESS !== 'false' 
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Enable console logging from the page for debugging
    page.on('console', (msg: any) => console.log(`[Browser Console]: ${msg.text()}`));
    page.on('pageerror', (err: any) => console.error(`[Browser Error]: ${err.message}`));

    try {
      // Navigate to the form viewer
      console.log('📡 Navigating to form viewer URL...');
      await page.goto(formViewerURL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      console.log('📄 Page loaded, checking for error states...');
      
      // Check if there's an error message (e.g., "Form is not published")
      const errorHeading = await page.locator('h1:has-text("Form Not Found"), h1:has-text("Form Unavailable"), h1:has-text("Form Not Ready")').count();
      if (errorHeading > 0) {
        const errorText = await page.locator('p.text-gray-600, p.text-sm').first().innerText();
        throw new Error(`Form viewer showed error: ${errorText}`);
      }
      
      console.log('✅ No error states, waiting for form to load...');
      
      // Wait for React to finish loading - check for loading spinner to disappear
      await page.waitForSelector('div:has-text("Loading form...")', { state: 'hidden', timeout: 30000 }).catch(() => {
        console.log('⚠️  Loading spinner not found (may have loaded already)');
      });
      
      console.log('🔄 Checking for CTA button (for layouts like L8)...');
      
      // Some layouts (like L8) show a CTA button that must be clicked before form pages render
      // The button text comes from layout.customCTAButtonName (we set it as 'Submit')
      const ctaButton = page.locator('button:has-text("Submit"), button:has-text("Continue"), button:has-text("Start")');
      const ctaButtonCount = await ctaButton.count();
      
      if (ctaButtonCount > 0) {
        console.log(`🖱️  Found CTA button, clicking it to reveal form pages...`);
        await ctaButton.first().click();
        // Wait a moment for the transition
        await page.waitForTimeout(1000);
      } else {
        console.log('ℹ️  No CTA button found, form may render directly');
      }
      
      console.log('🔄 Waiting for FormRenderer component...');
      
      // Wait for the form content to appear - be more flexible with selectors
      // The FormRenderer should render form elements
      try {
        await page.waitForSelector('input, textarea, select, button[type="submit"]', { timeout: 40000 });
        console.log('✅ Form elements detected!');
      } catch (error) {
        // Take screenshots and log HTML for debugging
        const html = await page.content();
        console.log('📋 Page HTML snapshot (first 2000 chars):', html.substring(0, 2000));
        
        const screenshot = await page.screenshot({ fullPage: true });
        console.log(`📸 Screenshot captured (${screenshot.length} bytes)`);
        
        throw new Error('Timeout waiting for form elements to appear');
      }
      
      // Store page and browser for cleanup and subsequent checks
      this.setSharedTestData('browserPage', page);
      this.setSharedTestData('browserContext', context);
      this.setSharedTestData('browser', browser);
      
      console.log('✅ Form viewer page loaded successfully with form elements');
    } catch (error) {
      console.error('❌ Failed to load form viewer page');
      console.error(`Error: ${error}`);
      
      await browser.close();
      throw new Error(`Failed to load form viewer: ${error}`);
    }
  }
);

Then('the {string} should be rendered correctly',
  async function(this: CustomWorld, fieldType: string) {
    const page: Page = this.getSharedTestData('browserPage');
    expectDefined(page, 'Browser page should be available');

    // Map field types to their expected labels/selectors
    const fieldMappings: Record<string, { label: string; selector: string }> = {
      'text_input_field': { 
        label: 'Short Text Field',
        selector: 'input[type="text"]'
      },
      'text_area_field': { 
        label: 'Long Text Field',
        selector: 'textarea'
      },
      'email_field': { 
        label: 'Email Field',
        selector: 'input[type="email"]'
      },
      'number_field': { 
        label: 'Number Field',
        selector: 'input[type="number"]'
      },
      'date_field': { 
        label: 'Date Field',
        selector: 'input[type="date"], button:has-text("Pick a date")'
      },
      'select_field': { 
        label: 'Dropdown Field',
        selector: 'select, button[role="combobox"]'
      },
      'radio_field': { 
        label: 'Radio Field',
        selector: 'input[type="radio"]'
      },
      'checkbox_field': { 
        label: 'Checkbox Field',
        selector: 'input[type="checkbox"]'
      },
      'rich_text_field': { 
        label: 'Rich Text Field',
        selector: 'div[class*="rich"], div[class*="prose"], p, div[role="textbox"]'
      },
    };

    const fieldConfig = fieldMappings[fieldType];
    expectDefined(fieldConfig, `Field type ${fieldType} should have a mapping`);

    try {
      // Rich text field is a content display field, not an input field
      // So we check for the content itself rather than the label
      if (fieldType === 'rich_text_field') {
        // For rich text, just check that the content div or prose container is present
        const contentVisible = await page.locator(fieldConfig.selector).first().isVisible({ timeout: 5000 });
        expect(contentVisible, `Rich text content should be visible for ${fieldType}`);
        console.log(`✅ ${fieldType} rendered correctly (content field)`);
        return;
      }
      
      // For all other field types, check both label and input
      // First check if the label is visible
      const labelVisible = await page.locator(`text="${fieldConfig.label}"`).isVisible({ timeout: 5000 });
      expect(labelVisible, `Label "${fieldConfig.label}" should be visible for ${fieldType}`);

      // Then check if the field input/control is present
      const fieldVisible = await page.locator(fieldConfig.selector).first().isVisible({ timeout: 5000 });
      expect(fieldVisible, `Field control should be visible for ${fieldType}`);

      console.log(`✅ ${fieldType} (${fieldConfig.label}) rendered correctly`);
    } catch (error) {
      throw new Error(`Failed to verify ${fieldType}: ${error}`);
    }
  }
);

// Cleanup hook - close browser after scenario
import { After } from '@cucumber/cucumber';

After({ tags: '@FormViewer' }, async function(this: CustomWorld) {
  const browser = this.getSharedTestData('browser');
  if (browser) {
    await browser.close();
    console.log('🧹 Closed browser');
  }
});
