import { Given, When, Then } from '@cucumber/cucumber';
import type { CustomWorld } from '../support/world';
import { expectDefined, expectEqual } from '../utils/assertion-utils';
import { expect, expectContains } from '../utils/expect-helper';

// Helper to create a delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== GIVEN Steps ====================

Given('the form has {int} submitted response(s)',
  async function(this: CustomWorld, count: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📝 Creating ${count} response(s) for form`);

    const responses = [];
    for (let i = 0; i < count; i++) {
      const responseData = this.formTestUtils.generateSampleFormData(form.formSchema);

      // Modify data slightly for each response to make them unique
      Object.keys(responseData).forEach(key => {
        if (typeof responseData[key] === 'string') {
          responseData[key] = `${responseData[key]} ${i + 1}`;
        }
      });

      const response = await this.formTestUtils.submitResponse({
        formId: form.id,
        data: responseData,
      });

      responses.push(response);

      // Small delay to ensure different timestamps
      if (i < count - 1) {
        await delay(10);
      }
    }

    this.setSharedTestData('submittedResponses', responses);
    console.log(`✅ Created ${count} response(s)`);
  }
);

Given('the form has {int} responses submitted at different times',
  async function(this: CustomWorld, count: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📝 Creating ${count} responses with time delays`);

    const responses = [];
    for (let i = 0; i < count; i++) {
      const responseData = this.formTestUtils.generateSampleFormData(form.formSchema);

      const response = await this.formTestUtils.submitResponse({
        formId: form.id,
        data: responseData,
      });

      responses.push(response);

      // Longer delay to ensure distinct timestamps for sorting tests
      if (i < count - 1) {
        await delay(500);
      }
    }

    this.setSharedTestData('submittedResponses', responses);
    console.log(`✅ Created ${count} responses at different times`);
  }
);

Given('the form has {int} responses with various field values',
  async function(this: CustomWorld, count: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📝 Creating ${count} responses with various values`);

    const responses = [];
    const testValues = ['test@example.com', 'user@test.com', 'admin@sample.com', 'contact@demo.com', 'info@website.com'];

    for (let i = 0; i < count; i++) {
      const responseData = this.formTestUtils.generateSampleFormData(form.formSchema);

      // Set field-1 to various values, some containing "test"
      responseData['field-1'] = i < 3 ? testValues[i % testValues.length] : `other-${i}@example.com`;

      const response = await this.formTestUtils.submitResponse({
        formId: form.id,
        data: responseData,
      });

      responses.push(response);
      await delay(10);
    }

    this.setSharedTestData('submittedResponses', responses);
    console.log(`✅ Created ${count} responses with various values`);
  }
);

Given('another user {string} exists in a different organization {string}',
  async function(this: CustomWorld, email: string, orgName: string) {
    console.log(`👤 Creating user: ${email} in new organization: ${orgName}`);

    // Create new user account
    const signupResponse = await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
      email,
      password: 'StrongPass123!',
      name: email.split('@')[0],
      callbackURL: '/',
    });

    const newUser = signupResponse.data.user;
    const newToken = signupResponse.data.token;

    console.log(`✅ User created: ${newUser.id}`);

    // Create a new organization
    const generateId = (length: number = 21): string => {
      const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      const crypto = require('crypto');
      let id = '';
      let bytesNeeded = length;
      while (id.length < length) {
        const bytes = crypto.randomBytes(bytesNeeded);
        for (let i = 0; i < bytes.length && id.length < length; i++) {
          // Discard bytes too large to avoid modulo bias
          if (bytes[i] >= 248) continue;
          id += alphabet[bytes[i] % alphabet.length];
        }
      }
      return id;
    };

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

    // Store user credentials
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

// ==================== WHEN Steps ====================

When('I query responses for the form with page={int} and limit={int}',
  async function(this: CustomWorld, page: number, limit: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📋 Querying responses: page=${page}, limit=${limit}`);

    const result = await this.formTestUtils.getResponsesByForm(
      this.authToken!,
      form.id,
      page,
      limit
    );

    this.setSharedTestData('queryResult', result);
    console.log(`✅ Retrieved ${result.data.length} responses`);
  }
);

When('I query responses sorted by {string} in {string} order',
  async function(this: CustomWorld, sortBy: string, sortOrder: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📋 Querying responses: sortBy=${sortBy}, sortOrder=${sortOrder}`);

    const result = await this.formTestUtils.getResponsesByForm(
      this.authToken!,
      form.id,
      1,
      100,
      sortBy,
      sortOrder
    );

    this.setSharedTestData('queryResult', result);
    console.log(`✅ Retrieved ${result.data.length} responses`);
  }
);

When('I filter responses where field {string} contains {string}',
  async function(this: CustomWorld, fieldId: string, value: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    console.log(`📋 Filtering responses: ${fieldId} contains "${value}"`);

    const filters = [{
      fieldId,
      operator: 'CONTAINS',
      value
    }];

    const result = await this.formTestUtils.getResponsesByForm(
      this.authToken!,
      form.id,
      1,
      100,
      'submittedAt',
      'desc',
      filters
    );

    this.setSharedTestData('queryResult', result);
    this.setSharedTestData('filterCriteria', { fieldId, value });
    console.log(`✅ Retrieved ${result.data.length} filtered responses`);
  }
);

When('I update the response data with editReason {string}',
  async function(this: CustomWorld, editReason: string) {
    expectDefined(this.authToken, 'Auth token required');
    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');

    const responseToEdit = responses[0];
    console.log(`✏️  Updating response ${responseToEdit.id} with reason: ${editReason}`);

    // Modify the data
    const newData = { ...responseToEdit.data };
    Object.keys(newData).forEach(key => {
      if (typeof newData[key] === 'string') {
        newData[key] = `${newData[key]} (UPDATED)`;
      }
    });

    const updatedResponse = await this.formTestUtils.updateResponse(
      this.authToken!,
      responseToEdit.id,
      newData,
      editReason
    );

    this.setSharedTestData('updatedResponse', updatedResponse);
    console.log(`✅ Response updated successfully`);
  }
);

When('I update field {string} to {string} with reason {string}',
  async function(this: CustomWorld, fieldId: string, newValue: string, reason: string) {
    expectDefined(this.authToken, 'Auth token required');
    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');

    const responseToEdit = responses[0];
    console.log(`✏️  Updating field ${fieldId} to "${newValue}"`);

    // Get current data and update specific field
    const currentData = this.getSharedTestData('currentResponseData') || responseToEdit.data;
    const newData = { ...currentData };
    newData[fieldId] = newValue;

    const updatedResponse = await this.formTestUtils.updateResponse(
      this.authToken!,
      responseToEdit.id,
      newData,
      reason
    );

    // Store current data for next update
    this.setSharedTestData('currentResponseData', newData);
    this.setSharedTestData('updatedResponse', updatedResponse);
    console.log(`✅ Field updated successfully`);
  }
);

When('user {string} attempts to update the response',
  async function(this: CustomWorld, userEmail: string) {
    const testUsers = this.getSharedTestData('testUsers') || {};
    const user = testUsers[userEmail];
    expectDefined(user, `User ${userEmail} must exist`);

    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');

    const responseToEdit = responses[0];
    console.log(`❌ User ${userEmail} attempting to update response`);

    try {
      const newData = { ...responseToEdit.data };
      Object.keys(newData).forEach(key => {
        if (typeof newData[key] === 'string') {
          newData[key] = `HACKED: ${newData[key]}`;
        }
      });

      await this.formTestUtils.updateResponse(
        user.token,
        responseToEdit.id,
        newData,
        'Unauthorized attempt'
      );

      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`✅ Update blocked: ${error.message}`);
      // Don't throw - let Then step verify the error
    }
  }
);

When('I delete the second response',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');
    expect(responses.length >= 2, 'Must have at least 2 responses');

    const responseToDelete = responses[1];
    console.log(`🗑️  Deleting response ${responseToDelete.id}`);

    const result = await this.formTestUtils.deleteResponse(
      this.authToken!,
      responseToDelete.id
    );

    this.setSharedTestData('deletedResponseId', responseToDelete.id);
    this.setSharedTestData('deleteResult', result);
    console.log(`✅ Response deleted: ${result}`);
  }
);

When('user {string} attempts to delete the response',
  async function(this: CustomWorld, userEmail: string) {
    const testUsers = this.getSharedTestData('testUsers') || {};
    const user = testUsers[userEmail];
    expectDefined(user, `User ${userEmail} must exist`);

    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');

    const responseToDelete = responses[0];
    console.log(`❌ User ${userEmail} attempting to delete response`);

    try {
      await this.formTestUtils.deleteResponse(
        user.token,
        responseToDelete.id
      );

      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      console.log(`✅ Deletion blocked: ${error.message}`);
      // Don't throw - let Then step verify the error
    }
  }
);

When('I query the first response by ID',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const responses = this.getSharedTestData('submittedResponses');
    expectDefined(responses, 'Responses must exist');

    const responseId = responses[0].id;
    console.log(`📋 Querying response by ID: ${responseId}`);

    const response = await this.formTestUtils.getResponse(
      this.authToken!,
      responseId
    );

    this.setSharedTestData('queriedResponse', response);
    console.log(`✅ Retrieved response`);
  }
);

// ==================== THEN Steps ====================

Then('I should receive {int} responses',
  async function(this: CustomWorld, expectedCount: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.data.length, expectedCount, 'Response count should match');
    console.log(`✅ Received ${expectedCount} responses`);
  }
);

Then('the total count should be {int}',
  async function(this: CustomWorld, expectedTotal: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.total, expectedTotal, 'Total count should match');
    console.log(`✅ Total count is ${expectedTotal}`);
  }
);

Then('the total pages should be {int}',
  async function(this: CustomWorld, expectedPages: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.totalPages, expectedPages, 'Total pages should match');
    console.log(`✅ Total pages is ${expectedPages}`);
  }
);

Then('the current page should be {int}',
  async function(this: CustomWorld, expectedPage: number) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    expectEqual(queryResult.page, expectedPage, 'Current page should match');
    console.log(`✅ Current page is ${expectedPage}`);
  }
);

Then('the responses should be ordered from newest to oldest',
  async function(this: CustomWorld) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    const responses = queryResult.data;
    expect(responses.length > 1, 'Must have multiple responses to verify order');

    // Verify descending order
    for (let i = 0; i < responses.length - 1; i++) {
      const current = new Date(responses[i].submittedAt).getTime();
      const next = new Date(responses[i + 1].submittedAt).getTime();
      expect(current >= next, `Response ${i} should be newer than or equal to response ${i + 1}`);
    }

    console.log(`✅ Responses ordered newest to oldest`);
  }
);

Then('the responses should be ordered from oldest to newest',
  async function(this: CustomWorld) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    const responses = queryResult.data;
    expect(responses.length > 1, 'Must have multiple responses to verify order');

    // Verify ascending order
    for (let i = 0; i < responses.length - 1; i++) {
      const current = new Date(responses[i].submittedAt).getTime();
      const next = new Date(responses[i + 1].submittedAt).getTime();
      expect(current <= next, `Response ${i} should be older than or equal to response ${i + 1}`);
    }

    console.log(`✅ Responses ordered oldest to newest`);
  }
);

Then('I should only receive responses matching that criteria',
  async function(this: CustomWorld) {
    const queryResult = this.getSharedTestData('queryResult');
    const filterCriteria = this.getSharedTestData('filterCriteria');
    expectDefined(queryResult, 'Query result must exist');
    expectDefined(filterCriteria, 'Filter criteria must exist');

    const responses = queryResult.data;

    // Verify all returned responses match the filter
    responses.forEach((response: any) => {
      const fieldValue = response.data[filterCriteria.fieldId];
      expect(
        fieldValue && fieldValue.includes(filterCriteria.value),
        `Response should contain "${filterCriteria.value}" in field ${filterCriteria.fieldId}`
      );
    });

    console.log(`✅ All ${responses.length} responses match filter criteria`);
  }
);

Then('the count should reflect the filtered results',
  async function(this: CustomWorld) {
    const queryResult = this.getSharedTestData('queryResult');
    expectDefined(queryResult, 'Query result must exist');

    // Just verify that total matches the number of filtered results
    expect(queryResult.total > 0, 'Should have at least one filtered result');
    expect(queryResult.total <= queryResult.data.length, 'Total should not exceed data length for single page');

    console.log(`✅ Filter count: ${queryResult.total} responses`);
  }
);

Then('the response should be updated successfully',
  async function(this: CustomWorld) {
    const updatedResponse = this.getSharedTestData('updatedResponse');
    expectDefined(updatedResponse, 'Updated response must exist');

    console.log(`✅ Response updated successfully`);
  }
);

Then('the edit history should show {int} edit(s)', editHistoryCountCheck);
Then('the edit history should show {int} separate edit(s)', editHistoryCountCheck);

async function editHistoryCountCheck(this: CustomWorld, expectedEditCount: number) {
  const updatedResponse = this.getSharedTestData('updatedResponse');
  expectDefined(updatedResponse, 'Updated response must exist');
  expectDefined(updatedResponse.editHistory, 'Edit history must exist');

  expectEqual(updatedResponse.editHistory.length, expectedEditCount, 'Edit history count should match');
  console.log(`✅ Edit history has ${expectedEditCount} edit(s)`);
}

Then('hasBeenEdited should be true',
  async function(this: CustomWorld) {
    const updatedResponse = this.getSharedTestData('updatedResponse');
    expectDefined(updatedResponse, 'Updated response must exist');

    expectEqual(updatedResponse.hasBeenEdited, true, 'hasBeenEdited should be true');
    console.log(`✅ hasBeenEdited is true`);
  }
);

Then('lastEditedBy should be the current user',
  async function(this: CustomWorld) {
    const updatedResponse = this.getSharedTestData('updatedResponse');
    expectDefined(updatedResponse, 'Updated response must exist');
    expectDefined(updatedResponse.lastEditedBy, 'lastEditedBy must exist');

    expect(this.currentUser, 'Current user must exist');
    expectEqual(updatedResponse.lastEditedBy.id, this.currentUser!.id, 'lastEditedBy should be current user');
    console.log(`✅ lastEditedBy is current user`);
  }
);

Then('each edit should track which fields changed',
  async function(this: CustomWorld) {
    const updatedResponse = this.getSharedTestData('updatedResponse');
    expectDefined(updatedResponse, 'Updated response must exist');
    expectDefined(updatedResponse.editHistory, 'Edit history must exist');

    updatedResponse.editHistory.forEach((edit: any, index: number) => {
      expect(edit.fieldChanges && edit.fieldChanges.length > 0, `Edit ${index + 1} should have field changes`);
      console.log(`  Edit ${index + 1}: ${edit.fieldChanges.length} field(s) changed`);
    });

    console.log(`✅ All edits track field changes`);
  }
);

// Note: "the update should fail with error" and "the operation should fail with error"
// steps are already defined in form-operations.steps.ts and form-sharing.steps.ts
// They are reused here for response update failures

Then('the deletion should succeed',
  async function(this: CustomWorld) {
    const deleteResult = this.getSharedTestData('deleteResult');
    expectDefined(deleteResult, 'Delete result must exist');
    expectEqual(deleteResult, true, 'Deletion should return true');
    console.log(`✅ Deletion succeeded`);
  }
);

Then('the form should have {int} responses remaining',
  async function(this: CustomWorld, expectedCount: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    // Query to get current response count
    const result = await this.formTestUtils.getResponsesByForm(
      this.authToken!,
      form.id,
      1,
      100
    );

    expectEqual(result.total, expectedCount, 'Remaining response count should match');
    console.log(`✅ Form has ${expectedCount} responses remaining`);
  }
);

Then('the deleted response should not be retrievable',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const deletedResponseId = this.getSharedTestData('deletedResponseId');
    expectDefined(deletedResponseId, 'Deleted response ID must exist');

    console.log(`🔍 Attempting to retrieve deleted response`);

    try {
      await this.formTestUtils.getResponse(this.authToken!, deletedResponseId);
      throw new Error('Should not be able to retrieve deleted response');
    } catch (error: any) {
      expect(error.message.includes('Response not found') || error.message.includes('not found'), 'Should get not found error');
      console.log(`✅ Deleted response is not retrievable`);
    }
  }
);

Then('I should receive the complete response data',
  async function(this: CustomWorld) {
    const queriedResponse = this.getSharedTestData('queriedResponse');
    expectDefined(queriedResponse, 'Queried response must exist');
    expectDefined(queriedResponse.id, 'Response ID must exist');
    expectDefined(queriedResponse.data, 'Response data must exist');
    console.log(`✅ Received complete response data`);
  }
);

Then('it should include the form ID',
  async function(this: CustomWorld) {
    const queriedResponse = this.getSharedTestData('queriedResponse');
    const form = this.getSharedTestData('createdForm');
    expectDefined(queriedResponse, 'Queried response must exist');
    expectDefined(form, 'Form must exist');

    expectEqual(queriedResponse.formId, form.id, 'Form ID should match');
    console.log(`✅ Response includes form ID`);
  }
);

Then('it should include the submission timestamp',
  async function(this: CustomWorld) {
    const queriedResponse = this.getSharedTestData('queriedResponse');
    expectDefined(queriedResponse, 'Queried response must exist');
    expectDefined(queriedResponse.submittedAt, 'submittedAt must exist');

    // Verify it's a valid timestamp
    const timestamp = new Date(queriedResponse.submittedAt);
    expect(!isNaN(timestamp.getTime()), 'submittedAt should be a valid timestamp');
    console.log(`✅ Response includes submission timestamp: ${queriedResponse.submittedAt}`);
  }
);
