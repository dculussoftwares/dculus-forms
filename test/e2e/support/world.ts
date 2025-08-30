import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page, chromium } from 'playwright';
import fs from 'fs';

export interface E2EWorld extends World {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  baseURL: string;
  backendURL: string;
  testData: Record<string, any>;
  pickle?: any; // Cucumber scenario info
  
  // Methods that will be used in hooks and steps
  initializeBrowser(): Promise<void>;
  initializeBrowserWithSharedAuth(sharedBrowser?: Browser, storageStatePath?: string): Promise<void>;
  navigateToPage(path: string): Promise<void>;
  waitForPageReady(): Promise<void>;
  fillFormField(fieldLabel: string, value: string): Promise<void>;
  clickButton(buttonText: string): Promise<void>;
  waitForElement(selector: string, timeout?: number): Promise<void>;
  isElementVisible(selector: string): Promise<boolean>;
  getElementText(selector: string): Promise<string>;
  pageContainsText(text: string): Promise<boolean>;
  waitForNavigation(): Promise<void>;
  takeScreenshot(name?: string): Promise<Buffer>;
  setTestData(key: string, value: any): void;
  getTestData(key: string): any;
  generateTestEmail(): string;
  generateTestOrganization(): string;
  createFreshUserAuthentication(): Promise<void>;
  cleanup(): Promise<void>;
}

export class E2EWorldConstructor extends World implements E2EWorld {
  public browser?: Browser;
  public context?: BrowserContext;
  public page?: Page;
  public baseURL: string;
  public backendURL: string;
  public testData: Record<string, any>;
  public pickle?: any;

  constructor(options: IWorldOptions) {
    super(options);
    this.baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    this.backendURL = process.env.E2E_BACKEND_URL || 'http://localhost:4000';
    this.testData = {};
  }

  /**
   * Initialize browser and page for the test scenario
   */
  async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
        slowMo: process.env.PLAYWRIGHT_SLOW_MO ? parseInt(process.env.PLAYWRIGHT_SLOW_MO) : 0,
      });
    }

    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
      });
    }

    if (!this.page) {
      this.page = await this.context.newPage();
      
      // Set longer timeouts for e2e tests
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);
    }
  }

  /**
   * Initialize browser context with shared browser instance
   */
  async initializeBrowserWithSharedAuth(sharedBrowser?: Browser, storageStatePath?: string): Promise<void> {
    if (!sharedBrowser) {
      // Fallback to regular initialization if shared browser not available
      return this.initializeBrowser();
    }

    this.browser = sharedBrowser;

    // Create new context (fresh for each scenario)
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    if (!this.page) {
      this.page = await this.context.newPage();
      
      // Set longer timeouts for e2e tests
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);
    }
  }

  /**
   * Navigate to a page relative to the base URL
   */
  async navigateToPage(path: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized. Call initializeBrowser() first.');
    }
    
    const url = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Wait for page to be ready (DOM loaded and network idle)
   */
  async waitForPageReady(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }
    
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Fill form field by label - simplified to use direct ID mapping
   */
  async fillFormField(fieldLabel: string, value: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    // Direct mapping based on debug output
    const fieldMapping: Record<string, string> = {
      'Full Name': 'name',
      'Email': 'email', 
      'Organization Name': 'organizationName',
      'Password': 'password',
      'Confirm Password': 'confirmPassword'
    };

    const fieldId = fieldMapping[fieldLabel];
    if (!fieldId) {
      throw new Error(`Unknown field label: "${fieldLabel}". Available fields: ${Object.keys(fieldMapping).join(', ')}`);
    }

    try {
      // Use the direct ID selector
      const field = this.page.locator(`#${fieldId}`);
      
      // Wait for the field to be visible
      await field.waitFor({ state: 'visible', timeout: 10000 });
      
      // Clear the field first, then fill
      await field.clear();
      await field.fill(value);
      
      // Wait a bit for any dynamic validation
      await this.page.waitForTimeout(500);
      
    } catch (error) {
      console.error(`❌ Failed to fill field "${fieldLabel}":`, error);
      
      // Take screenshot for debugging
      await this.takeScreenshot(`field-error-${fieldId}-${Date.now()}`);
      
      throw new Error(`Could not fill field "${fieldLabel}" (ID: ${fieldId}). Error: ${error}`);
    }
  }

  /**
   * Click button by text content
   */
  async clickButton(buttonText: string): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    try {
      // Try multiple button selectors
      const button = this.page.locator(`button:has-text("${buttonText}"), input[type="submit"][value="${buttonText}"], button[type="submit"]:has-text("${buttonText}")`);
      
      await button.waitFor({ state: 'visible', timeout: 10000 });
      
      // Ensure button is enabled
      await button.waitFor({ state: 'attached' });
      
      await button.click();
      
      // Wait for any navigation or form submission
      await this.page.waitForTimeout(1000);
      
    } catch (error) {
      console.error(`❌ Failed to click button "${buttonText}":`, error);
      
      // Take screenshot for debugging
      await this.takeScreenshot(`button-error-${buttonText.replace(/\s+/g, '-')}-${Date.now()}`);
      
      throw new Error(`Could not click button "${buttonText}". Error: ${error}`);
    }
  }

  /**
   * Wait for element to be visible
   */
  async waitForElement(selector: string, timeout?: number): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    await this.page.locator(selector).waitFor({ 
      state: 'visible',
      timeout: timeout || 10000
    });
  }

  /**
   * Check if element exists and is visible
   */
  async isElementVisible(selector: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    try {
      await this.page.locator(selector).waitFor({ 
        state: 'visible',
        timeout: 5000
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get text content of element
   */
  async getElementText(selector: string): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });
    return await element.textContent() || '';
  }

  /**
   * Check if page contains specific text (with partial matching)
   */
  async pageContainsText(text: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    try {
      // Try exact text match first
      await this.page.locator(`text=${text}`).waitFor({ 
        state: 'visible',
        timeout: 2000
      });
      return true;
    } catch {
      // Try partial text match
      try {
        await this.page.locator(`text*=${text}`).waitFor({ 
          state: 'visible',
          timeout: 2000
        });
        return true;
      } catch {
        // Try looking in all text content
        try {
          const bodyText = await this.page.textContent('body');
          if (bodyText && bodyText.toLowerCase().includes(text.toLowerCase())) {
            return true;
          }
        } catch {
          // Continue to check error elements
        }
        
        // Check for error elements specifically
        try {
          const errorElements = await this.page.locator('.text-red-500, [class*="error"], [role="alert"]').all();
          for (const element of errorElements) {
            const elementText = await element.textContent();
            if (elementText && elementText.toLowerCase().includes(text.toLowerCase())) {
              return true;
            }
          }
        } catch {
          // Final fallback
        }
        
        return false;
      }
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name?: string): Promise<Buffer> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    const screenshotName = name || `screenshot-${Date.now()}`;
    return await this.page.screenshot({ 
      path: `test/e2e/reports/${screenshotName}.png`,
      fullPage: true 
    });
  }

  /**
   * Store test data for later use in scenario
   */
  setTestData(key: string, value: any): void {
    this.testData[key] = value;
  }

  /**
   * Retrieve stored test data
   */
  getTestData(key: string): any {
    return this.testData[key];
  }

  /**
   * Generate random test data
   */
  generateTestEmail(): string {
    const timestamp = Date.now();
    return `test-user-${timestamp}@example.com`;
  }

  generateTestOrganization(): string {
    const timestamp = Date.now();
    return `Test Org ${timestamp}`;
  }

  /**
   * Create fresh user authentication when shared state fails
   */
  async createFreshUserAuthentication(): Promise<void> {
    if (!this.page) {
      throw new Error('Page not initialized.');
    }

    console.log('🔄 Creating fresh user authentication...');
    
    // Navigate to sign up page
    await this.navigateToPage('/signup');
    await this.waitForPageReady();
    
    // Fill in the sign up form with generated test data
    const testEmail = this.generateTestEmail();
    const testOrganization = this.generateTestOrganization();
    
    this.setTestData('testEmail', testEmail);
    this.setTestData('testOrganization', testOrganization);
    
    await this.fillFormField('Full Name', 'Test User');
    await this.fillFormField('Email', testEmail);
    await this.fillFormField('Organization Name', testOrganization);
    await this.fillFormField('Password', 'TestPassword123!');
    await this.fillFormField('Confirm Password', 'TestPassword123!');
    
    // Click create account
    await this.clickButton('Create account');
    
    // Wait for successful signup redirect
    await this.page.waitForTimeout(3000);
    
    // Navigate to sign in page
    await this.navigateToPage('/signin');
    await this.waitForPageReady();
    
    // Fill in sign in form with stored credentials
    await this.fillFormField('Email', testEmail);
    await this.fillFormField('Password', 'TestPassword123!');
    
    // Click sign in
    await this.clickButton('Sign in');
    
    // Wait for successful signin
    await this.page.waitForTimeout(2000);
    
    // Verify we're successfully signed in - should not be on signin page anymore
    const currentUrl = this.page.url();
    const isOnSignInPage = currentUrl.includes('/signin');
    if (isOnSignInPage) {
      throw new Error('Fresh authentication failed - still on signin page');
    }
    
    console.log('✅ Fresh user authentication completed');
  }

  /**
   * Clean up resources (but keep shared browser alive)
   */
  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = undefined;
    }

    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }

    // Don't close browser - it's shared across scenarios
    // The shared browser will be closed in AfterAll hook
    this.browser = undefined;

    // Clear test data
    this.testData = {};
  }
}

setWorldConstructor(E2EWorldConstructor);