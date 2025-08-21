import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for Sign Up page
 */
export class SignUpPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly organizationNameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly createAccountButton: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByLabel('Full Name');
    this.emailInput = page.getByLabel('Email');
    this.organizationNameInput = page.getByLabel('Organization Name');
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm Password');
    this.createAccountButton = page.getByRole('button', { name: 'Create account' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
  }

  async goto() {
    await this.page.goto('http://localhost:3000/signup');
    await expect(this.page).toHaveURL('http://localhost:3000/signup');
  }

  async fillForm(data: {
    name: string;
    email: string;
    organizationName: string;
    password: string;
    confirmPassword?: string;
  }) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.organizationNameInput.fill(data.organizationName);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword || data.password);
  }

  async submit() {
    await this.createAccountButton.click();
    await this.page.waitForTimeout(2000);
  }

  async getErrorMessage(field: string): Promise<string | null> {
    const errorText = await this.page.getByText(field).first();
    return await errorText.textContent();
  }
}

/**
 * Page Object Model for Sign In page
 */
export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly signUpLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.signUpLink = page.getByRole('link', { name: 'Sign up' });
  }

  async goto() {
    await this.page.goto('http://localhost:3000/signin');
    await expect(this.page).toHaveURL('http://localhost:3000/signin');
  }

  async fillForm(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.signInButton.click();
    await this.page.waitForTimeout(2000);
  }

  async getErrorMessage(): Promise<string | null> {
    const errorElement = this.page.locator('.text-red-500').first();
    return await errorElement.textContent();
  }
}

/**
 * Page Object Model for Dashboard page
 */
export class DashboardPage {
  readonly page: Page;
  readonly myFormsTitle: Locator;
  readonly createFormButton: Locator;
  readonly formCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myFormsTitle = page.getByRole('heading', { name: 'Your Forms' });
    this.createFormButton = page.getByRole('button', { name: 'Create Form' });
    this.formCards = page.locator('[data-testid="form-card"]');
  }

  async goto() {
    await this.page.goto('http://localhost:3000/');
    await expect(this.page).toHaveURL('http://localhost:3000/');
    await expect(this.myFormsTitle).toBeVisible();
  }

  async clickCreateForm() {
    await this.createFormButton.click();
  }

  async getFormCount(): Promise<number> {
    return await this.formCards.count();
  }

  async waitForFormsToLoad() {
    await this.page.waitForTimeout(2000);
  }
}

/**
 * Page Object Model for Templates page
 */
export class TemplatesPage {
  readonly page: Page;
  readonly pageTitle: Locator;
  readonly templateCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByText('Form Templates');
    this.templateCards = page.locator('.group.relative.overflow-hidden');
  }

  async goto() {
    await this.page.goto('http://localhost:3000/dashboard/templates');
    await expect(this.page).toHaveURL('http://localhost:3000/dashboard/templates');
    await expect(this.pageTitle).toBeVisible();
  }

  async waitForTemplatesToLoad() {
    await this.page.waitForSelector('.group.relative.overflow-hidden', { timeout: 10000 });
  }

  async selectFirstTemplate() {
    const templateCard = this.templateCards.first();
    await templateCard.hover();
    
    const useTemplateButton = templateCard.getByRole('button', { name: 'Use Template' });
    await useTemplateButton.click();
  }

  async getTemplateCount(): Promise<number> {
    return await this.templateCards.count();
  }
}

/**
 * Page Object Model for Use Template Popover
 */
export class UseTemplatePopover {
  readonly page: Page;
  readonly formTitleInput: Locator;
  readonly descriptionInput: Locator;
  readonly createFormButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.formTitleInput = page.getByLabel('Form Title');
    this.descriptionInput = page.getByLabel('Description');
    this.createFormButton = page.getByRole('button', { name: 'Create Form' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async isVisible(): Promise<boolean> {
    const popoverTitle = this.page.getByText('Create Form from Template');
    return await popoverTitle.isVisible();
  }

  async fillForm(title: string, description?: string) {
    await this.formTitleInput.fill(title);
    
    if (description) {
      await this.descriptionInput.fill(description);
    }
  }

  async submit() {
    await this.createFormButton.click();
    await this.page.waitForTimeout(3000); // Wait for form creation
  }

  async cancel() {
    await this.cancelButton.click();
  }
}

/**
 * Page Object Model for Form Dashboard page (individual form)
 */
export class FormDashboardPage {
  readonly page: Page;
  readonly formTitle: Locator;
  readonly editFormButton: Locator;
  readonly previewFormButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.formTitle = page.locator('h1, h2, h3').first(); // Form title should be a heading
    this.editFormButton = page.getByRole('button', { name: /edit|builder/i });
    this.previewFormButton = page.getByRole('button', { name: /preview|view/i });
  }

  async verifyFormExists(expectedTitle: string) {
    await expect(this.page).toHaveURL(/\/dashboard\/form\/[\w-]+$/);
    await expect(this.page.locator('h1').filter({ hasText: expectedTitle })).toBeVisible();
  }

  async getFormId(): Promise<string> {
    const url = this.page.url();
    const match = url.match(/\/dashboard\/form\/([\w-]+)/);
    
    if (!match || !match[1]) {
      throw new Error('Could not extract form ID from URL: ' + url);
    }
    
    return match[1];
  }
}