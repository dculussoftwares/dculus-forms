import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';
import { expect, expectDefined, expectEqual } from '../utils/expect-helper';
import { randomBytes } from 'crypto';

/**
 * Generates unbiased random index using rejection sampling.
 */
function unbiasedRandomIndex(max: number, randomByte: number): number | null {
  const limit = 256 - (256 % max);
  if (randomByte >= limit) return null;
  return randomByte % max;
}

// Generate nanoid-like IDs
function generateId(length: number = 21): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let id = '';
  while (id.length < length) {
    const bytes = randomBytes(length - id.length + 10);
    for (let i = 0; i < bytes.length && id.length < length; i++) {
      const index = unbiasedRandomIndex(alphabet.length, bytes[i]);
      if (index !== null) id += alphabet[index];
    }
  }
  return id;
}

// ============================================================================
// BACKGROUND STEPS
// ============================================================================

Given('I am logged in as {string} with password {string}',
  async function (this: CustomWorld, email: string, password: string) {
    console.log(`🔐 Logging in as: ${email}`);

    // Create user if doesn't exist
    const existingUser = await this.prisma.user.findUnique({ where: { email } });

    if (!existingUser) {
      await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
        email,
        password,
        name: email.split('@')[0],
        callbackURL: '/',
      });
    }

    // Sign in
    const response = await this.authUtils.axiosInstance.post('/api/auth/sign-in/email', {
      email,
      password,
      callbackURL: '/',
    });

    const cookies = response.headers['set-cookie'];
    let token = '';

    if (cookies && Array.isArray(cookies)) {
      for (const cookie of cookies) {
        const match = cookie.match(/better-auth\.session_token=([^;]+)/);
        if (match) {
          token = match[1];
          break;
        }
      }
    }

    if (!token) {
      throw new Error('Failed to extract auth token from cookies');
    }

    this.authToken = token;
    this.currentUser = response.data.user;
    console.log(`✅ Logged in as ${email}`);
  }
);

Given('I create an organization with name {string} and slug {string}',
  async function (this: CustomWorld, name: string, slug: string) {
    expectDefined(this.authToken, 'Auth token required');
    console.log(`🏢 Creating organization: ${name}`);

    // Use better-auth organization API to ensure session is properly set
    try {
      const response = await this.authUtils.axiosInstance.post(
        '/api/auth/organization/create',
        {
          name,
          slug: `${slug}-${generateId(6)}`.slice(0, 30),
        },
        {
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.currentOrganization = {
        id: response.data.id,
        name: response.data.name
      };

      console.log(`✅ Created organization: ${this.currentOrganization!.id}`);
    } catch (error: any) {
      throw new Error(`Failed to create organization: ${error.response?.data?.message || error.message}`);
    }
  }
);

Given('I create a comprehensive test form with all field types',
  async function (this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    expectDefined(this.currentOrganization, 'Organization required');
    console.log('📝 Creating comprehensive test form with all field types');

    const orgId = this.currentOrganization.id;
    const userId = this.currentUser!.id;

    // Create form schema with all field types
    const formSchema = {
      pages: [
        {
          id: generateId(),
          title: 'Test Page',
          order: 0,
          fields: [
            {
              id: 'name-field',
              type: 'TEXT_INPUT_FIELD',
              label: 'Full Name',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Enter your name',
              validation: { type: 'TEXT_FIELD_VALIDATION', required: false }
            },
            {
              id: 'age-field',
              type: 'NUMBER_FIELD',
              label: 'Age',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Enter your age',
              validation: { type: 'FILLABLE_FORM_FIELD_VALIDATION', required: false },
              min: 0,
              max: 150
            },
            {
              id: 'email-field',
              type: 'EMAIL_FIELD',
              label: 'Email',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Enter your email',
              validation: { type: 'FILLABLE_FORM_FIELD_VALIDATION', required: false }
            },
            {
              id: 'country-field',
              type: 'SELECT_FIELD',
              label: 'Country',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: '',
              validation: { type: 'FILLABLE_FORM_FIELD_VALIDATION', required: false },
              options: ['USA', 'Canada', 'UK', 'Australia']
            },
            {
              id: 'gender-field',
              type: 'RADIO_FIELD',
              label: 'Gender',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: '',
              validation: { type: 'FILLABLE_FORM_FIELD_VALIDATION', required: false },
              options: ['Male', 'Female', 'Other']
            },
            {
              id: 'interests-field',
              type: 'CHECKBOX_FIELD',
              label: 'Interests',
              defaultValue: '',
              defaultValues: [],
              prefix: '',
              hint: '',
              placeholder: '',
              validation: { type: 'CHECKBOX_FIELD_VALIDATION', required: false },
              options: ['Sports', 'Music', 'Reading', 'Gaming']
            },
            {
              id: 'birthdate-field',
              type: 'DATE_FIELD',
              label: 'Birth Date',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Select date',
              validation: { type: 'FILLABLE_FORM_FIELD_VALIDATION', required: false }
            },
            {
              id: 'comments-field',
              type: 'TEXT_AREA_FIELD',
              label: 'Comments',
              defaultValue: '',
              prefix: '',
              hint: '',
              placeholder: 'Enter your comments',
              validation: { type: 'TEXT_FIELD_VALIDATION', required: false }
            }
          ]
        }
      ],
      layout: {
        theme: 'light',
        textColor: '#000000',
        spacing: 'normal',
        code: 'L1',
        customBackGroundColor: '#ffffff',
        backgroundImageKey: ''
      },
      isShuffleEnabled: false
    };

    // Create form directly in the database (bypassing template requirement)
    const form = await this.prisma.form.create({
      data: {
        id: generateId(),
        title: 'Test Form with All Fields',
        description: 'Form for testing response filters',
        shortUrl: generateId(8),
        formSchema: JSON.stringify(formSchema),
        isPublished: true,
        organizationId: orgId,
        createdById: userId,
        sharingScope: 'PUBLIC',
        defaultPermission: 'VIEW',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ Created test form: ${form.id}`);

    // Store form data for use in subsequent steps
    this.setSharedTestData('testForm', {
      id: form.id,
      title: form.title,
      shortUrl: form.shortUrl,
      formSchema: form.formSchema,
      isPublished: form.isPublished
    });

    const fields = formSchema.pages[0].fields;
    console.log(`📝 Form has ${fields.length} fields: ${fields.map(f => f.label).join(', ')}`);
  }
);

// ============================================================================
// RESPONSE SUBMISSION STEPS
// ============================================================================

Given('I submit a response with text field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with number field {string} value {int}',
  async function (this: CustomWorld, fieldLabel: string, value: number) {
    await submitSingleFieldResponse.call(this, fieldLabel, value.toString());
  }
);

Given('I submit a response with email field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with select field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with radio field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with checkbox field {string} values {string}',
  async function (this: CustomWorld, fieldLabel: string, values: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, values.split(','));
  }
);

Given('I submit a response with date field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with textarea field {string} value {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await submitSingleFieldResponse.call(this, fieldLabel, value);
  }
);

Given('I submit a response with text field {string} value {string} and number field {string} value {int}',
  async function (this: CustomWorld, field1Label: string, field1Value: string, field2Label: string, field2Value: number) {
    await submitMultiFieldResponse.call(this, {
      [field1Label]: field1Value,
      [field2Label]: field2Value.toString()
    });
  }
);

Given('I submit a response with text field {string} value {string} and email field {string} value {string}',
  async function (this: CustomWorld, field1Label: string, field1Value: string, field2Label: string, field2Value: string) {
    await submitMultiFieldResponse.call(this, {
      [field1Label]: field1Value,
      [field2Label]: field2Value
    });
  }
);

Given('I submit {int} responses with incrementing age values',
  async function (this: CustomWorld, count: number) {
    console.log(`📤 Submitting ${count} responses with incrementing ages`);

    for (let i = 1; i <= count; i++) {
      await submitSingleFieldResponse.call(this, 'Age', (15 + i).toString());
    }

    console.log(`✅ Submitted ${count} responses`);
  }
);

Given('I submit a response with text field {string} value {string} at timestamp {int}',
  async function (this: CustomWorld, fieldLabel: string, value: string, timestamp: number) {
    // Just submit normally - we'll rely on natural timing
    await submitSingleFieldResponse.call(this, fieldLabel, value);
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));
  }
);

Given('I submit response {int} with {string}={string}, {string}={int}, {string}={string}, {string}={string}',
  async function (this: CustomWorld, responseNum: number,
    field1: string, val1: string,
    field2: string, val2: number,
    field3: string, val3: string,
    field4: string, val4: string
  ) {
    await submitMultiFieldResponse.call(this, {
      [field1]: val1,
      [field2]: val2.toString(),
      [field3]: val3,
      [field4]: val4.split(',')
    });
  }
);

// ============================================================================
// FILTER EXECUTION STEPS
// ============================================================================

When('I filter responses by text field {string} equals {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'EQUALS', value);
  }
);

When('I filter responses by text field {string} contains {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'CONTAINS', value);
  }
);

When('I filter responses by number field {string} greater than {int}',
  async function (this: CustomWorld, fieldLabel: string, value: number) {
    await executeFilter.call(this, fieldLabel, 'GREATER_THAN', value);
  }
);

When('I filter responses by number field {string} less than {int}',
  async function (this: CustomWorld, fieldLabel: string, value: number) {
    await executeFilter.call(this, fieldLabel, 'LESS_THAN', value);
  }
);

When('I filter responses by number field {string} between {int} and {int}',
  async function (this: CustomWorld, fieldLabel: string, min: number, max: number) {
    await executeFilterWithRange.call(this, fieldLabel, min, max);
  }
);

When('I filter responses by email field {string} equals {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'EQUALS', value);
  }
);

When('I filter responses by email field {string} contains {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'CONTAINS', value);
  }
);

When('I filter responses by select field {string} equals {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'EQUALS', value);
  }
);

When('I filter responses by radio field {string} equals {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'EQUALS', value);
  }
);

When('I filter responses by checkbox field {string} contains {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'CONTAINS', value);
  }
);

When('I filter responses by date field {string} equals {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'DATE_EQUALS', value);
  }
);

When('I filter responses by date field {string} between {string} and {string}',
  async function (this: CustomWorld, fieldLabel: string, startDate: string, endDate: string) {
    await executeFilterWithDateRange.call(this, fieldLabel, startDate, endDate);
  }
);

When('I filter responses by textarea field {string} contains {string}',
  async function (this: CustomWorld, fieldLabel: string, value: string) {
    await executeFilter.call(this, fieldLabel, 'CONTAINS', value);
  }
);

When('I filter responses by text field {string} contains {string} AND number field {string} greater than {int}',
  async function (this: CustomWorld, field1: string, value1: string, field2: string, value2: number) {
    await executeMultipleFilters.call(this, [
      { field: field1, operator: 'CONTAINS', value: value1 },
      { field: field2, operator: 'GREATER_THAN', value: value2 }
    ], 'AND');
  }
);

When('I filter responses by text field {string} contains {string} OR number field {string} equals {int}',
  async function (this: CustomWorld, field1: string, value1: string, field2: string, value2: number) {
    await executeMultipleFilters.call(this, [
      { field: field1, operator: 'CONTAINS', value: value1 },
      { field: field2, operator: 'EQUALS', value: value2 }
    ], 'OR');
  }
);

When('I filter responses by email field {string} is empty',
  async function (this: CustomWorld, fieldLabel: string) {
    await executeFilter.call(this, fieldLabel, 'IS_EMPTY', null);
  }
);

When('I filter responses by email field {string} is not empty',
  async function (this: CustomWorld, fieldLabel: string) {
    await executeFilter.call(this, fieldLabel, 'IS_NOT_EMPTY', null);
  }
);

When('I filter responses by number field {string} greater than {int} with page {int} and limit {int}',
  async function (this: CustomWorld, fieldLabel: string, value: number, page: number, limit: number) {
    await executeFilterWithPagination.call(this, fieldLabel, 'GREATER_THAN', value, page, limit);
  }
);

When('I filter responses by text field {string} contains {string} sorted by {string} descending',
  async function (this: CustomWorld, fieldLabel: string, value: string, sortField: string) {
    await executeFilterWithSort.call(this, fieldLabel, 'CONTAINS', value, sortField, 'desc');
  }
);

When('I filter by {string} equals {string} AND {string} greater than {int} AND {string} contains {string}',
  async function (this: CustomWorld, field1: string, value1: string, field2: string, value2: number, field3: string, value3: string) {
    await executeMultipleFilters.call(this, [
      { field: field1, operator: 'EQUALS', value: value1 },
      { field: field2, operator: 'GREATER_THAN', value: value2 },
      { field: field3, operator: 'CONTAINS', value: value3 }
    ], 'AND');
  }
);

// ============================================================================
// ASSERTION STEPS
// ============================================================================

Then('I should see {int} response(s)',
  function (this: CustomWorld, expectedCount: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const actualCount = filterResult.data.length;
    expectEqual(actualCount, expectedCount, `Expected ${expectedCount} responses but got ${actualCount}`);
    console.log(`✅ Found ${actualCount} response(s) as expected`);
  }
);

Then('the response should have text field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');
    expectEqual(filterResult.data.length, 1, 'Expected exactly 1 response');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);
    const actualValue = filterResult.data[0].data[fieldId];
    expectEqual(actualValue, expectedValue, `Expected field "${fieldLabel}" to have value "${expectedValue}" but got "${actualValue}"`);
    console.log(`✅ Response has correct value for "${fieldLabel}"`);
  }
);

Then('all responses should have text field {string} containing {string}',
  function (this: CustomWorld, fieldLabel: string, expectedSubstring: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      if (!value || !value.toLowerCase().includes(expectedSubstring.toLowerCase())) {
        throw new Error(`Response ${response.id} does not contain "${expectedSubstring}" in field "${fieldLabel}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses contain "${expectedSubstring}" in "${fieldLabel}"`);
  }
);

Then('all responses should have number field {string} greater than {int}',
  function (this: CustomWorld, fieldLabel: string, threshold: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = parseInt(response.data[fieldId]);
      if (value <= threshold) {
        throw new Error(`Response ${response.id} has value ${value} which is not greater than ${threshold}`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" > ${threshold}`);
  }
);

Then('all responses should have number field {string} less than {int}',
  function (this: CustomWorld, fieldLabel: string, threshold: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = parseInt(response.data[fieldId]);
      if (value >= threshold) {
        throw new Error(`Response ${response.id} has value ${value} which is not less than ${threshold}`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" < ${threshold}`);
  }
);

Then('all responses should have number field {string} between {int} and {int}',
  function (this: CustomWorld, fieldLabel: string, min: number, max: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = parseInt(response.data[fieldId]);
      if (value < min || value > max) {
        throw new Error(`Response ${response.id} has value ${value} which is not between ${min} and ${max}`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" between ${min} and ${max}`);
  }
);

Then('the response should have email field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');
    expectEqual(filterResult.data.length, 1, 'Expected exactly 1 response');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);
    const actualValue = filterResult.data[0].data[fieldId];
    expectEqual(actualValue, expectedValue, `Expected email "${expectedValue}" but got "${actualValue}"`);
    console.log(`✅ Response has correct email value`);
  }
);

Then('all responses should have email field {string} containing {string}',
  function (this: CustomWorld, fieldLabel: string, expectedSubstring: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      if (!value || !value.includes(expectedSubstring)) {
        throw new Error(`Response ${response.id} email does not contain "${expectedSubstring}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses contain "${expectedSubstring}" in email`);
  }
);

Then('all responses should have select field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      if (value !== expectedValue) {
        throw new Error(`Response ${response.id} has value "${value}" instead of "${expectedValue}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" = "${expectedValue}"`);
  }
);

Then('all responses should have radio field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      if (value !== expectedValue) {
        throw new Error(`Response ${response.id} has value "${value}" instead of "${expectedValue}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" = "${expectedValue}"`);
  }
);

Then('all responses should have checkbox field {string} containing {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      const values = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);

      if (!values.includes(expectedValue)) {
        throw new Error(`Response ${response.id} checkbox does not contain "${expectedValue}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${expectedValue}" in "${fieldLabel}"`);
  }
);

Then('all responses should have date field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);

    for (const response of filterResult.data) {
      const value = response.data[fieldId];
      if (value !== expectedValue) {
        throw new Error(`Response ${response.id} has date "${value}" instead of "${expectedValue}"`);
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses have "${fieldLabel}" = "${expectedValue}"`);
  }
);

Then('the response should have date field {string} value {string}',
  function (this: CustomWorld, fieldLabel: string, expectedValue: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');
    expectEqual(filterResult.data.length, 1, 'Expected exactly 1 response');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);
    const actualValue = filterResult.data[0].data[fieldId];
    expectEqual(actualValue, expectedValue, `Expected date "${expectedValue}" but got "${actualValue}"`);
    console.log(`✅ Response has correct date value`);
  }
);

Then('I should see {int} responses on the current page',
  function (this: CustomWorld, expectedCount: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const actualCount = filterResult.data.length;
    expectEqual(actualCount, expectedCount, `Expected ${expectedCount} responses on page but got ${actualCount}`);
    console.log(`✅ Found ${actualCount} responses on current page`);
  }
);

Then('the total filtered count should be {int}',
  function (this: CustomWorld, expectedTotal: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const actualTotal = filterResult.total;
    expectEqual(actualTotal, expectedTotal, `Expected total count of ${expectedTotal} but got ${actualTotal}`);
    console.log(`✅ Total filtered count is ${actualTotal} as expected`);
  }
);

Then('I should see {int} responses in reverse chronological order',
  function (this: CustomWorld, expectedCount: number) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');
    expectEqual(filterResult.data.length, expectedCount, `Expected ${expectedCount} responses`);

    // Verify descending order by submittedAt
    for (let i = 0; i < filterResult.data.length - 1; i++) {
      const current = new Date(filterResult.data[i].submittedAt).getTime();
      const next = new Date(filterResult.data[i + 1].submittedAt).getTime();

      if (current < next) {
        throw new Error('Responses are not in reverse chronological order');
      }
    }

    console.log(`✅ ${expectedCount} responses are in reverse chronological order`);
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function submitSingleFieldResponse(this: CustomWorld, fieldLabel: string, value: any) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  const responseData = {
    [fieldId]: value
  };

  const mutation = `
    mutation SubmitResponse($input: SubmitResponseInput!) {
      submitResponse(input: $input) {
        id
        formId
        data
        submittedAt
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    mutation,
    {
      input: {
        formId: form.id,
        data: responseData
      }
    },
    '' // Public submission, no auth token
  );

  if (response.data.errors) {
    throw new Error(`Failed to submit response: ${response.data.errors[0].message}`);
  }

  console.log(`📤 Submitted response with ${fieldLabel}=${JSON.stringify(value)}`);
}

async function submitMultiFieldResponse(this: CustomWorld, fieldValues: Record<string, any>) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');

  const responseData: Record<string, any> = {};

  for (const [label, value] of Object.entries(fieldValues)) {
    const fieldId = getFieldIdByLabel.call(this, label);
    responseData[fieldId] = value;
  }

  const mutation = `
    mutation SubmitResponse($input: SubmitResponseInput!) {
      submitResponse(input: $input) {
        id
        formId
        data
        submittedAt
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    mutation,
    {
      input: {
        formId: form.id,
        data: responseData
      }
    },
    '' // Public submission, no auth token
  );

  if (response.data.errors) {
    throw new Error(`Failed to submit response: ${response.data.errors[0].message}`);
  }

  console.log(`📤 Submitted multi-field response`);
}

function getFieldIdByLabel(this: CustomWorld, label: string): string {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');

  // Parse the form schema to find the field ID
  const formSchema = JSON.parse(form.formSchema);

  for (const page of formSchema.pages) {
    for (const field of page.fields) {
      if (field.label === label) {
        return field.id;
      }
    }
  }

  throw new Error(`Field with label "${label}" not found in form schema`);
}

async function executeFilter(this: CustomWorld, fieldLabel: string, operator: string, value: any) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  // Convert value to string for GraphQL (all filter values are strings)
  const stringValue = value != null ? String(value) : undefined;

  const filters = [{
    fieldId,
    operator,
    value: stringValue
  }];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered by ${fieldLabel} ${operator} ${value}: found ${response.data.data.responsesByForm.data.length} responses`);
}

async function executeFilterWithRange(this: CustomWorld, fieldLabel: string, min: number, max: number) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  // Use BETWEEN operator with numberRange
  const filters = [{
    fieldId,
    operator: 'BETWEEN',
    numberRange: { min, max }
  }];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered by ${fieldLabel} between ${min} and ${max}: found ${response.data.data.responsesByForm.data.length} responses`);
}

async function executeFilterWithDateRange(this: CustomWorld, fieldLabel: string, startDate: string, endDate: string) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  const filters = [
    { fieldId, operator: 'DATE_AFTER', value: startDate },
    { fieldId, operator: 'DATE_BEFORE', value: endDate }
  ];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered by ${fieldLabel} between ${startDate} and ${endDate}: found ${response.data.data.responsesByForm.data.length} responses`);
}

async function executeMultipleFilters(this: CustomWorld, filterSpecs: Array<{ field: string, operator: string, value: any }>, logic: 'AND' | 'OR') {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const filters = filterSpecs.map(spec => ({
    fieldId: getFieldIdByLabel.call(this, spec.field),
    operator: spec.operator,
    value: spec.value != null ? String(spec.value) : undefined
  }));

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!], $filterLogic: FilterLogic) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters, filterLogic: $filterLogic) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters,
      filterLogic: logic
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Applied ${filterSpecs.length} filters with ${logic} logic: found ${response.data.data.responsesByForm.data.length} responses`);
}

async function executeFilterWithPagination(this: CustomWorld, fieldLabel: string, operator: string, value: any, page: number, limit: number) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  // Convert value to string for GraphQL
  const stringValue = value != null ? String(value) : undefined;

  const filters = [{
    fieldId,
    operator,
    value: stringValue
  }];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page,
      limit,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered page ${page} (limit ${limit}): found ${response.data.data.responsesByForm.data.length} responses`);
}

async function executeFilterWithSort(this: CustomWorld, fieldLabel: string, operator: string, value: any, sortBy: string, sortOrder: string) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  const filters = [{
    fieldId,
    operator,
    value
  }];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy,
      sortOrder,
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered and sorted by ${sortBy} ${sortOrder}: found ${response.data.data.responsesByForm.data.length} responses`);
}

// ============================================================================
// CONTAINS_ALL OPERATOR STEPS
// ============================================================================

When('I filter responses by checkbox field {string} operator {string} with values {string}',
  async function (this: CustomWorld, fieldLabel: string, operator: string, values: string) {
    await executeFilterWithMultipleValues.call(this, fieldLabel, operator, values.split(','));
  }
);

Then('all responses should have checkbox field {string} containing all values {string}',
  async function (this: CustomWorld, fieldLabel: string, values: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);
    const expectedValues = values.split(',').map(v => v.trim());

    for (const response of filterResult.data) {
      const fieldValue = response.data[fieldId];
      expect(Array.isArray(fieldValue), `Field ${fieldLabel} should be an array`);

      // Check that all expected values are present
      for (const expectedValue of expectedValues) {
        expect(
          fieldValue.includes(expectedValue),
          `Response should contain ${expectedValue} in ${fieldLabel}`
        );
      }
    }

    console.log(`✅ All ${filterResult.data.length} responses contain all values: ${values}`);
  }
);

Then('the response should have checkbox field {string} with values {string}',
  async function (this: CustomWorld, fieldLabel: string, values: string) {
    const filterResult = this.getSharedTestData('filterResult');
    expectDefined(filterResult, 'Filter result must exist');
    expect(filterResult.data.length === 1, `Expected 1 response but got ${filterResult.data.length}`);

    const fieldId = getFieldIdByLabel.call(this, fieldLabel);
    const expectedValues = values.split(',').map(v => v.trim()).sort();
    const actualValues = filterResult.data[0].data[fieldId]?.sort() || [];

    expect(
      JSON.stringify(actualValues) === JSON.stringify(expectedValues),
      `Expected ${JSON.stringify(expectedValues)} but got ${JSON.stringify(actualValues)}`
    );

    console.log(`✅ Response has exact values: ${values}`);
  }
);

async function executeFilterWithMultipleValues(this: CustomWorld, fieldLabel: string, operator: string, values: string[]) {
  const form = this.getSharedTestData('testForm');
  expectDefined(form, 'Test form must exist');
  expectDefined(this.authToken, 'Auth token required');

  const fieldId = getFieldIdByLabel.call(this, fieldLabel);

  const filters = [{
    fieldId,
    operator,
    values: values.map(v => v.trim())
  }];

  const query = `
    query GetResponsesByForm($formId: ID!, $page: Int!, $limit: Int!, $sortBy: String!, $sortOrder: String!, $filters: [ResponseFilterInput!]) {
      responsesByForm(formId: $formId, page: $page, limit: $limit, sortBy: $sortBy, sortOrder: $sortOrder, filters: $filters) {
        data {
          id
          formId
          data
          submittedAt
        }
        total
        page
        limit
      }
    }
  `;

  const response = await this.authUtils.graphqlRequest(
    query,
    {
      formId: form.id,
      page: 1,
      limit: 100,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
      filters
    },
    this.authToken
  );

  if (response.data.errors) {
    throw new Error(`Failed to filter responses: ${response.data.errors[0].message}`);
  }

  this.setSharedTestData('filterResult', response.data.data.responsesByForm);
  console.log(`🔍 Filtered by ${fieldLabel} ${operator} ${values.join(',')}: found ${response.data.data.responsesByForm.data.length} responses`);
}
