import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { Browser, BrowserContext, Page, chromium } from 'playwright';

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
    // Support both deployment and local testing URLs
    this.baseURL = process.env.E2E_BASE_URL || 
                   process.env.E2E_DEPLOYED_BASE_URL || 
                   'http://localhost:3000';
    this.backendURL = process.env.E2E_BACKEND_URL || 
                      process.env.E2E_DEPLOYED_BACKEND_URL || 
                      'http://localhost:4000';
    this.testData = {};
    
    // Log configuration for debugging
    if (process.env.E2E_DEPLOYMENT_MODE) {
      console.log(`🌐 Running E2E tests in deployment mode:`);
      console.log(`  Frontend URL: ${this.baseURL}`);
      console.log(`  Backend URL: ${this.backendURL}`);
    }
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
      
      // Set longer timeouts for e2e tests, even longer for deployment mode
      const timeout = process.env.E2E_DEPLOYMENT_MODE ? 60000 : 30000;
      this.page.setDefaultTimeout(timeout);
      this.page.setDefaultNavigationTimeout(timeout);
      
      if (process.env.E2E_DEPLOYMENT_MODE) {
        console.log(`⏱️  Using extended timeouts for deployment testing: ${timeout}ms`);
      }
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
   * Clean up resources
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

    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }

    // Clear test data
    this.testData = {};
  }
}

setWorldConstructor(E2EWorldConstructor);