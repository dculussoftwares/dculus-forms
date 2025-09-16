import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import { AxiosResponse } from 'axios';
import { AuthUtils, AuthUser, AuthSession } from '../utils/auth-utils';
import { FormTestUtils, Form } from '../utils/form-test-utils';

export interface CustomWorld extends World {
  response?: AxiosResponse;
  baseURL: string;
  authUtils: AuthUtils;
  formTestUtils: FormTestUtils;
  authToken?: string;
  currentUser?: AuthUser;
  currentSession?: AuthSession;
  testUsers: Map<string, { user: AuthUser; token: string; organizationId?: string }>;
  uploadedFiles: string[]; // Track uploaded files for cleanup
  createdForms: Form[]; // Track created forms for cleanup
  sharedTestData: Map<string, any>; // Shared data across step files
  setSharedTestData(key: string, value: any): void;
  getSharedTestData(key: string): any;
}

export class CustomWorldConstructor extends World implements CustomWorld {
  public response?: AxiosResponse;
  public baseURL: string;
  public authUtils: AuthUtils;
  public formTestUtils: FormTestUtils;
  public authToken?: string;
  public currentUser?: AuthUser;
  public currentSession?: AuthSession;
  public testUsers: Map<string, { user: AuthUser; token: string; organizationId?: string }>;
  public uploadedFiles: string[];
  public createdForms: Form[];
  public sharedTestData: Map<string, any>;

  constructor(options: IWorldOptions) {
    super(options);
    this.baseURL = process.env.TEST_BASE_URL || 'http://localhost:4000';
    this.authUtils = new AuthUtils(this.baseURL);
    this.formTestUtils = new FormTestUtils(this.baseURL);
    this.testUsers = new Map();
    this.uploadedFiles = [];
    this.createdForms = [];
    this.sharedTestData = new Map();
  }

  /**
   * Set the current authentication context for this test scenario
   */
  setAuthContext(user: AuthUser, session: AuthSession, token: string): void {
    this.currentUser = user;
    this.currentSession = session;
    this.authToken = token;
  }

  /**
   * Clear the current authentication context
   */
  clearAuthContext(): void {
    this.currentUser = undefined;
    this.currentSession = undefined;
    this.authToken = undefined;
  }

  /**
   * Store a test user for later reference in the test scenario
   */
  storeTestUser(key: string, user: AuthUser, token: string, organizationId?: string): void {
    this.testUsers.set(key, { user, token, organizationId });
  }

  /**
   * Retrieve a stored test user
   */
  getTestUser(key: string): { user: AuthUser; token: string; organizationId?: string } | undefined {
    return this.testUsers.get(key);
  }

  /**
   * Make an authenticated GraphQL request using the current auth context
   */
  async authenticatedGraphQLRequest(query: string, variables: any = {}): Promise<AxiosResponse> {
    if (!this.authToken) {
      throw new Error('No auth token available. Please sign in first.');
    }
    return await this.authUtils.graphqlRequest(query, variables, this.authToken);
  }

  /**
   * Make an authenticated GraphQL request with a specific token
   */
  async authenticatedGraphQLRequestWithToken(
    query: string, 
    token: string, 
    variables: any = {}
  ): Promise<AxiosResponse> {
    return await this.authUtils.graphqlRequest(query, variables, token);
  }

  /**
   * Check if the current context is authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.authToken && this.currentUser);
  }

  /**
   * Get the current organization ID from session or stored test user
   */
  getCurrentOrganizationId(): string | undefined {
    // Try to get from session first
    if (this.currentSession?.activeOrganizationId) {
      return this.currentSession.activeOrganizationId;
    }

    // If not in session, try to get from stored test user
    const mainUser = this.testUsers.get('main');
    if (mainUser?.organizationId) {
      return mainUser.organizationId;
    }

    return undefined;
  }

  /**
   * Track uploaded file for cleanup
   */
  trackUploadedFile(fileKey: string): void {
    this.uploadedFiles.push(fileKey);
  }

  /**
   * Track created form for cleanup
   */
  trackCreatedForm(form: Form): void {
    this.createdForms.push(form);
  }

  /**
   * Set shared test data that can be accessed across step files
   */
  setSharedTestData(key: string, value: any): void {
    this.sharedTestData.set(key, value);
  }

  /**
   * Get shared test data that can be accessed across step files
   */
  getSharedTestData(key: string): any {
    return this.sharedTestData.get(key);
  }

  /**
   * Delete file using GraphQL deleteFile mutation
   */
  async deleteUploadedFile(fileKey: string): Promise<boolean> {
    try {
      const deleteFileMutation = `
        mutation DeleteFile($key: String!) {
          deleteFile(key: $key)
        }
      `;
      
      const response = await this.authenticatedGraphQLRequest(deleteFileMutation, { key: fileKey });
      return response?.data?.data?.deleteFile === true;
    } catch (error) {
      console.warn(`Failed to delete uploaded file ${fileKey}:`, error);
      return false;
    }
  }

  /**
   * Clean up all test users created during this scenario
   */
  async cleanup(): Promise<void> {
    // Clean up created forms
    if (this.createdForms.length > 0) {
      console.log(`Cleaning up ${this.createdForms.length} created forms...`);
      for (const form of this.createdForms) {
        try {
          // Find a token that has access to this form
          let tokenToUse = this.authToken;

          // If current token doesn't work, try other stored tokens
          if (!tokenToUse) {
            for (const [, userData] of this.testUsers) {
              tokenToUse = userData.token;
              break;
            }
          }

          if (tokenToUse) {
            await this.formTestUtils.deleteForm(tokenToUse, form.id);
          }
        } catch (error) {
          console.warn(`Failed to delete form ${form.id}:`, error);
        }
      }
      this.createdForms = [];
    }

    // Clean up uploaded files
    if (this.uploadedFiles.length > 0) {
      console.log(`Cleaning up ${this.uploadedFiles.length} uploaded files...`);
      for (const fileKey of this.uploadedFiles) {
        await this.deleteUploadedFile(fileKey);
      }
      this.uploadedFiles = [];
    }

    // Sign out current user if authenticated
    if (this.authToken) {
      try {
        await this.authUtils.signOut(this.authToken);
      } catch (error) {
        console.warn('Failed to sign out current user:', error);
      }
    }

    // Sign out all stored test users
    for (const [key, userData] of this.testUsers) {
      try {
        await this.authUtils.signOut(userData.token);
      } catch (error) {
        console.warn(`Failed to sign out test user ${key}:`, error);
      }
    }

    // Clear all contexts
    this.clearAuthContext();
    this.testUsers.clear();
  }
}

setWorldConstructor(CustomWorldConstructor);