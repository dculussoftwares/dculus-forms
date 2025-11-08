import { Given, When, Then } from '@cucumber/cucumber';
import type { CustomWorld } from '../support/world';
import { expectDefined, expectEqual } from '../utils/assertion-utils';
import { expect, expectContains } from '../utils/expect-helper';
import { randomBytes } from 'crypto';

// Generate nanoid-like IDs
function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// Helper to get user ID by email from shared test data
function getUserIdByEmail(world: CustomWorld, email: string): string {
  // Check if this is the owner (current user)
  if (world.currentUser && world.currentUser.email.startsWith(email.split('@')[0])) {
    return world.currentUser.id;
  }

  const users = world.getSharedTestData('testUsers') || {};
  const user = users[email];
  if (!user || !user.userId) {
    throw new Error(`User not found for email: ${email}`);
  }
  return user.userId;
}

// Helper to get auth token by email
function getAuthTokenByEmail(world: CustomWorld, email: string): string {
  const users = world.getSharedTestData('testUsers') || {};
  const user = users[email];
  if (!user || !user.token) {
    throw new Error(`Auth token not found for email: ${email}`);
  }
  return user.token;
}

// ==================== GIVEN Steps ====================

Given('another user {string} exists with password {string} in the same organization',
  async function(this: CustomWorld, email: string, password: string) {
    expectDefined(this.authToken, 'Owner auth token required');
    expectDefined(this.currentOrganization, 'Organization must exist');
    const organization = this.currentOrganization;

    console.log(`👤 Creating user: ${email} in organization: ${organization.name}`);

    // Create new user account
    const signupResponse = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
      email,
      password,
      name: email.split('@')[0],
      callbackURL: '/',
    });

    const newUser = signupResponse.data.user;
    const newToken = signupResponse.data.token;

    console.log(`✅ User created: ${newUser.id}`);

    // Add user to organization using Prisma directly (simpler for test setup)
    await this.prisma.member.create({
      data: {
        id: generateId(),
        organizationId: organization.id,
        userId: newUser.id,
        role: 'member',
        createdAt: new Date(),
      }
    });

    console.log(`✅ User ${email} added to organization`);

    // Store user credentials in test data
    const testUsers = this.getSharedTestData('testUsers') || {};
    testUsers[email] = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      token: newToken,
    };
    this.setSharedTestData('testUsers', testUsers);
  }
);

Given('another user {string} exists with password {string} in a different organization {string}',
  async function(this: CustomWorld, email: string, password: string, orgName: string) {
    console.log(`👤 Creating user: ${email} in new organization: ${orgName}`);

    // Create new user account
    const signupResponse = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
      email,
      password,
      name: email.split('@')[0],
      callbackURL: '/',
    });

    const newUser = signupResponse.data.user;
    const newToken = signupResponse.data.token;

    console.log(`✅ User created: ${newUser.id}`);

    // Create a new organization for this user
    const orgResponse = await this.authUtils.axiosInstance.post(
      `/api/auth/organization/create`,
      {
        name: orgName,
        slug: `${orgName.toLowerCase().replace(/\s+/g, '-')}-${generateId(6)}`.slice(0, 30),
      },
      {
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const newOrg = orgResponse.data;
    console.log(`✅ Organization created: ${newOrg.id}`);

    // Store user credentials in test data
    const testUsers = this.getSharedTestData('testUsers') || {};
    testUsers[email] = {
      userId: newUser.id,
      email: newUser.email,
      name: newUser.name,
      token: newToken,
      organizationId: newOrg.id,
    };
    this.setSharedTestData('testUsers', testUsers);
  }
);

Given('I share the form with user {string} with {string} permission using scope {string}',
  async function(this: CustomWorld, userEmail: string, permission: string, scope: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    console.log(`🔓 Sharing form with ${userEmail} (${permission}) using scope ${scope}`);

    const sharingSettings = await this.formTestUtils.shareForm(this.authToken!, {
      formId: form.id,
      sharingScope: scope,
      userPermissions: [{ userId, permission }],
    });

    this.setSharedTestData('formSharingSettings', sharingSettings);
    console.log(`✅ Form shared successfully`);
  }
);

Given('I create another form from template {string} with title {string}',
  async function(this: CustomWorld, templateName: string, title: string) {
    expectDefined(this.authToken, 'Auth token required');
    expectDefined(this.currentOrganization, 'Organization must exist');

    const template = await this.formTestUtils.findTemplateByName(this.authToken!, templateName);
    expectDefined(template, `Template "${templateName}" not found`);

    const newForm = await this.formTestUtils.createForm(this.authToken!, {
      templateId: template.id,
      title,
      description: `Additional form for testing`,
      organizationId: this.currentOrganization.id,
    });

    console.log(`✅ Additional form created: ${newForm.title}`);
  }
);

// ==================== WHEN Steps ====================

When('I share the form with multiple users:',
  async function(this: CustomWorld, dataTable: any) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    // Parse the data table
    const rows = dataTable.hashes(); // Returns array of objects: [{email: '...', permission: '...'}, ...]
    const userPermissions = rows.map((row: any) => ({
      userId: getUserIdByEmail(this, row.email),
      permission: row.permission,
    }));

    console.log(`🔓 Sharing form with ${userPermissions.length} users`);

    const sharingSettings = await this.formTestUtils.shareForm(this.authToken!, {
      formId: form.id,
      sharingScope: 'SPECIFIC_MEMBERS',
      userPermissions,
    });

    this.setSharedTestData('formSharingSettings', sharingSettings);
    console.log(`✅ Form shared successfully with ${userPermissions.length} users`);
  }
);

When('I share the form with scope {string} and default permission {string}',
  async function(this: CustomWorld, scope: string, defaultPermission: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`🔓 Sharing form with scope ${scope} and default permission ${defaultPermission}`);

    const sharingSettings = await this.formTestUtils.shareForm(this.authToken!, {
      formId: form.id,
      sharingScope: scope,
      defaultPermission,
    });

    this.setSharedTestData('formSharingSettings', sharingSettings);

    // Update the form object to reflect sharing changes
    const updatedForm = await this.formTestUtils.getForm(this.authToken!, form.id);
    this.setSharedTestData('createdForm', updatedForm);

    console.log(`✅ Form shared successfully`);
  }
);

When('I update user {string} permission to {string} on the form',
  async function(this: CustomWorld, userEmail: string, permission: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    console.log(`🔄 Updating ${userEmail} permission to ${permission}`);

    const updatedPermission = await this.formTestUtils.updateFormPermission(this.authToken!, {
      formId: form.id,
      userId,
      permission,
    });

    console.log(`✅ Permission updated successfully`);
  }
);

When('I remove user {string} access from the form',
  async function(this: CustomWorld, userEmail: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    console.log(`🔒 Removing ${userEmail} access from form`);

    const result = await this.formTestUtils.removeFormAccess(this.authToken!, form.id, userId);

    console.log(`✅ Access removed: ${result}`);
  }
);

When('I try to remove user {string} access from the form',
  async function(this: CustomWorld, userEmail: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    console.log(`🔒 Attempting to remove ${userEmail} access from form`);

    try {
      await this.formTestUtils.removeFormAccess(this.authToken!, form.id, userId);
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`❌ Failed to remove access: ${error.message}`);
      // Don't throw - let Then step verify the error
    }
  }
);

When('I try to share the form with user {string} with {string} permission using scope {string}',
  async function(this: CustomWorld, userEmail: string, permission: string, scope: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    console.log(`🔓 Attempting to share form with ${userEmail} (${permission})`);

    try {
      await this.formTestUtils.shareForm(this.authToken!, {
        formId: form.id,
        sharingScope: scope,
        userPermissions: [{ userId, permission }],
      });
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`❌ Failed to share form: ${error.message}`);
      // Don't throw - let Then step verify the error
    }
  }
);

When('I switch to user {string}',
  async function(this: CustomWorld, email: string) {
    const token = getAuthTokenByEmail(this, email);
    this.authToken = token;
    console.log(`🔄 Switched to user: ${email}`);
  }
);

When('I query forms with category {string}',
  async function(this: CustomWorld, category: string) {
    expectDefined(this.authToken, 'Auth token required');
    expectDefined(this.currentOrganization, 'Organization must exist');

    console.log(`📋 Querying forms with category: ${category}`);

    const result = await this.formTestUtils.getFormsByCategory(
      this.authToken!,
      this.currentOrganization.id,
      category
    );

    this.setSharedTestData('queryResult', result);
    console.log(`✅ Found ${result.forms.length} forms`);
  }
);

When('I query formPermissions for the form',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📋 Querying form permissions`);

    const permissions = await this.formTestUtils.getFormPermissions(this.authToken!, form.id);

    this.setSharedTestData('formPermissions', permissions);
    console.log(`✅ Found ${permissions.length} permissions`);
  }
);

When('I query organizationMembers',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    expectDefined(this.currentOrganization, 'Organization must exist');

    console.log(`📋 Querying organization members`);

    const members = await this.formTestUtils.getOrganizationMembers(
      this.authToken!,
      this.currentOrganization.id
    );

    this.setSharedTestData('organizationMembers', members);
    console.log(`✅ Found ${members.length} members`);
  }
);

When('I try to update the form title to {string}',
  async function(this: CustomWorld, newTitle: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`✏️  Attempting to update form title to: ${newTitle}`);

    try {
      const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
        title: newTitle,
      });
      this.setSharedTestData('createdForm', updatedForm);
      this.lastOperationError = undefined;
      console.log(`✅ Form updated successfully`);
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`❌ Failed to update form: ${error.message}`);
      // Don't throw - let Then step verify the error
    }
  }
);

// ==================== THEN Steps ====================

Then('the form sharing scope should be {string}',
  async function(this: CustomWorld, expectedScope: string) {
    const sharingSettings = this.getSharedTestData('formSharingSettings');
    expectDefined(sharingSettings, 'Sharing settings must exist');

    expectEqual(sharingSettings.sharingScope, expectedScope, 'Sharing scope should match');
    console.log(`✅ Sharing scope is ${expectedScope}`);
  }
);

Then('the form default permission should be {string}',
  async function(this: CustomWorld, expectedPermission: string) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    expectEqual(form.defaultPermission, expectedPermission, 'Default permission should match');
    console.log(`✅ Default permission is ${expectedPermission}`);
  }
);

Then('user {string} should have {string} permission on the form',
  async function(this: CustomWorld, userEmail: string, expectedPermission: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    // Query current permissions
    const permissions = await this.formTestUtils.getFormPermissions(this.authToken!, form.id);
    const userPermission = permissions.find(p => p.userId === userId);

    expectDefined(userPermission, `Permission for user ${userEmail} should exist`);
    expectEqual(userPermission!.permission, expectedPermission, 'Permission should match');
    console.log(`✅ User ${userEmail} has ${expectedPermission} permission`);
  }
);

Then('user {string} should not have permission on the form',
  async function(this: CustomWorld, userEmail: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const userId = getUserIdByEmail(this, userEmail);

    // Query current permissions
    const permissions = await this.formTestUtils.getFormPermissions(this.authToken!, form.id);
    const userPermission = permissions.find(p => p.userId === userId);

    expect(!userPermission, `User ${userEmail} should not have permission`);
    console.log(`✅ User ${userEmail} does not have permission`);
  }
);

Then('I should see the form {string} in the results',
  async function(this: CustomWorld, formTitle: string) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    const form = queryResult.forms.find((f: any) => f.title === formTitle);
    expectDefined(form, `Form "${formTitle}" should be in results`);
    console.log(`✅ Form "${formTitle}" found in results`);
  }
);

Then('I should not see the form {string} in the results',
  async function(this: CustomWorld, formTitle: string) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    const form = queryResult.forms.find((f: any) => f.title === formTitle);
    expect(!form, `Form "${formTitle}" should not be in results`);
    console.log(`✅ Form "${formTitle}" not found in results`);
  }
);

Then('the form should have userPermission {string}',
  async function(this: CustomWorld, expectedPermission: string) {
    const queriedForm = this.getSharedTestData('queriedForm');
    expectDefined(queriedForm, 'Queried form must exist');

    expectEqual(queriedForm.userPermission, expectedPermission, 'User permission should match');
    console.log(`✅ Form has userPermission ${expectedPermission}`);
  }
);

Then('I should see {int} permissions in the list',
  async function(this: CustomWorld, expectedCount: number) {
    const permissions = this.getSharedTestData('formPermissions');
    expectDefined(permissions, 'Form permissions must exist');

    console.log(`📊 Found ${permissions.length} permissions, expected ${expectedCount}`);
    console.log('Permissions:', JSON.stringify(permissions.map((p: any) => ({ user: p.user?.email, permission: p.permission })), null, 2));

    expectEqual(permissions.length, expectedCount, 'Permission count should match');
    console.log(`✅ Found ${expectedCount} permissions`);
  }
);

Then('user {string} should be in the permissions list with {string} permission',
  async function(this: CustomWorld, userEmail: string, expectedPermission: string) {
    const permissions = this.getSharedTestData('formPermissions');
    expectDefined(permissions, 'Form permissions must exist');

    const userId = getUserIdByEmail(this, userEmail);
    const userPermission = permissions.find((p: any) => p.userId === userId);

    expectDefined(userPermission, `Permission for user ${userEmail} should exist`);
    expectEqual(userPermission.permission, expectedPermission, 'Permission should match');
    console.log(`✅ User ${userEmail} has ${expectedPermission} permission in list`);
  }
);

Then('I should see {int} forms in the results',
  async function(this: CustomWorld, expectedCount: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.forms.length, expectedCount, 'Form count should match');
    console.log(`✅ Found ${expectedCount} forms`);
  }
);

Then('I should see {int} form in the results',
  async function(this: CustomWorld, expectedCount: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.forms.length, expectedCount, 'Form count should match');
    console.log(`✅ Found ${expectedCount} form`);
  }
);

Then('I should see {int} members in the list',
  async function(this: CustomWorld, expectedCount: number) {
    const members = this.getSharedTestData('organizationMembers');
    expectDefined(members, 'Organization members must exist');

    expectEqual(members.length, expectedCount, 'Member count should match');
    console.log(`✅ Found ${expectedCount} members`);
  }
);

Then('user {string} should be in the members list',
  async function(this: CustomWorld, userEmail: string) {
    const members = this.getSharedTestData('organizationMembers');
    expectDefined(members, 'Organization members must exist');

    // Match by email prefix (handles unique emails like owner@test.com becoming owner+1234@test.com)
    const emailPrefix = userEmail.split('@')[0];
    const member = members.find((m: any) => m.email.startsWith(emailPrefix));
    expectDefined(member, `User ${userEmail} should be in members list`);
    console.log(`✅ User ${userEmail} found in members list`);
  }
);

Then('the operation should fail with error {string}',
  async function(this: CustomWorld, expectedErrorSubstring: string) {
    expectDefined(this.lastOperationError, 'An error should have occurred');
    expectContains(this.lastOperationError!, expectedErrorSubstring, 'Error message should contain expected text');
    console.log(`✅ Operation failed with expected error: ${expectedErrorSubstring}`);
  }
);
