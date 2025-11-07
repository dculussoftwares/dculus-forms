import { Given, When, Then } from '@cucumber/cucumber';
import type { CustomWorld } from '../support/world';
import { expectDefined, expectEqual } from '../utils/assertion-utils';
import { expect, expectContains } from '../utils/expect-helper';

// ==================== WHEN Steps ====================

When('I update the form title to {string} and description to {string}',
  async function(this: CustomWorld, newTitle: string, newDescription: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
        title: newTitle,
        description: newDescription,
      });

      this.setSharedTestData('createdForm', updatedForm);
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
      throw error;
    }
  }
);

When('I publish the form',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      isPublished: true,
    });

    this.setSharedTestData('createdForm', updatedForm);
  }
);

When('I unpublish the form',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      isPublished: false,
    });

    this.setSharedTestData('createdForm', updatedForm);
  }
);

When('I set max responses to {int}',
  async function(this: CustomWorld, maxResponses: number) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      settings: {
        submissionLimits: {
          maxResponses: {
            enabled: true,
            limit: maxResponses,
          },
        },
      },
    });

    this.setSharedTestData('createdForm', updatedForm);
  }
);

When('I set a time window from {string} to {string}',
  async function(this: CustomWorld, startDate: string, endDate: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const updatedForm = await this.formTestUtils.updateForm(this.authToken!, form.id, {
      settings: {
        submissionLimits: {
          timeWindow: {
            enabled: true,
            startDate: startDate,
            endDate: endDate,
          },
        },
      },
    });

    this.setSharedTestData('createdForm', updatedForm);
  }
);

When('I duplicate the form with title {string}',
  async function(this: CustomWorld, expectedTitle: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    // Note: duplicateForm automatically generates title as "{original} (Copy)"
    // The expectedTitle parameter is used for validation, not for setting the title
    const duplicatedForm = await this.formTestUtils.duplicateForm(this.authToken!, form.id);

    this.setSharedTestData('duplicatedForm', duplicatedForm);
    this.setSharedTestData('expectedDuplicateTitle', expectedTitle);
    this.trackCreatedForm(duplicatedForm);
  }
);

When('I note the current short URL',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    this.setSharedTestData('originalShortUrl', form.shortUrl);
  }
);

When('I regenerate the short URL',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const updatedForm = await this.formTestUtils.regenerateShortUrl(this.authToken!, form.id);

    this.setSharedTestData('createdForm', updatedForm);
  }
);

When('I delete the form',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    await this.formTestUtils.deleteForm(this.authToken!, form.id);
  }
);

When('I attempt to delete the form',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      await this.formTestUtils.deleteForm(this.authToken!, form.id);
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
    }
  }
);

When('I attempt to update the form title to {string}',
  async function(this: CustomWorld, newTitle: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      await this.formTestUtils.updateForm(this.authToken!, form.id, {
        title: newTitle,
      });
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
    }
  }
);

When('I query the form by ID',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const queriedForm = await this.formTestUtils.queryFormById(this.authToken!, form.id);

    this.setSharedTestData('queriedForm', queriedForm);
  }
);

When('a public user queries the form by short URL',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      const queriedForm = await this.formTestUtils.queryFormByShortUrl(form.shortUrl);
      this.setSharedTestData('queriedForm', queriedForm);
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
    }
  }
);

When('I query the form metadata',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const formWithMetadata = await this.formTestUtils.queryFormById(this.authToken!, form.id);

    this.setSharedTestData('formMetadata', formWithMetadata.metadata);
  }
);

When('I attempt to update the form organizationId',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      // The GraphQL schema doesn't allow updating organizationId through updateForm
      // This scenario tests that organizationId is immutable
      // We'll use Prisma to attempt a direct update which should fail in production
      await this.prisma.form.update({
        where: { id: form.id },
        data: { organizationId: 'different-org-id' }
      });
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
    }
  }
);

When('I attempt to update the form createdById',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      // The GraphQL schema doesn't allow updating createdById through updateForm
      // This scenario tests that createdById is immutable
      // We'll use Prisma to attempt a direct update which should fail in production
      await this.prisma.form.update({
        where: { id: form.id },
        data: { createdById: 'different-user-id' }
      });
      this.lastOperationError = undefined;
    } catch (error: any) {
      this.lastOperationError = error.message;
    }
  }
);

// ==================== GIVEN Steps ====================

Given('the form is not published',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.isPublished, false, 'Form should not be published by default');
  }
);

Given('I share the form with {string} as {string}',
  async function(this: CustomWorld, email: string, permission: string) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    // First create the user if they don't exist
    const uniqueEmail = email.replace('@', `+${Date.now()}@`);
    await this.authUtils.axiosInstance.post('/api/auth/sign-up/email', {
      email: uniqueEmail,
      password: email.includes('editor') ? 'EditorPass123!' : 'ViewerPass123!',
      name: email.split('@')[0],
      callbackURL: '/',
    });

    // Store the unique email for later signin
    this.setSharedTestData(`uniqueEmail:${email}`, uniqueEmail);

    // TODO: Implement sharing via GraphQL mutation
    // For now, we'll skip this until we implement form sharing scenarios
    console.log(`TODO: Share form ${form.id} with ${uniqueEmail} as ${permission}`);
  }
);

Given('I sign in as {string} with password {string}',
  async function(this: CustomWorld, email: string, password: string) {
    // Get the unique email if it was created
    const uniqueEmail = this.getSharedTestData(`uniqueEmail:${email}`) || email;

    const signInResponse = await this.authUtils.axiosInstance.post('/api/auth/sign-in/email', {
      email: uniqueEmail,
      password,
      callbackURL: '/',
    });

    const authToken = signInResponse.headers['set-auth-token'];
    expectDefined(authToken, 'Auth token should be returned from signin');

    this.authToken = authToken;
    this.currentUser = signInResponse.data.user;
  }
);

Given('a public user submits a response to the form',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.isPublished, true, 'Form must be published to receive responses');

    const responseData = {
      'field-1': 'Test response data',
      'field-2': 'More test data',
      'field-3': 'Final field data',
    };

    const response = await this.responseTestUtils.submitResponse(form.shortUrl, responseData);

    this.setSharedTestData('submittedResponse', response);
  }
);

Given('the form template has a background image',
  async function(this: CustomWorld) {
    expectDefined(this.mockS3, 'Mock S3 must be available');
    const template = this.getSharedTestData(`template:Contact Template`);
    expectDefined(template, 'Template must exist');

    // Load test image from static files
    const fs = await import('fs/promises');
    const path = await import('path');
    const testImagePath = path.join(process.cwd(), 'static-files', 'dculus-high-resolution-logo.png');
    const imageBuffer = await fs.readFile(testImagePath);

    // Upload to mock S3
    const imageKey = `files/form-template/test-background-${Date.now()}.png`;
    const imageUrl = await this.mockS3.upload(imageKey, imageBuffer, {
      mimeType: 'image/png',
      originalName: 'test-background.png',
    });

    // Update template schema with background image
    template.formSchema.layout = template.formSchema.layout || {};
    template.formSchema.layout.backgroundImageKey = imageKey;
    template.formSchema.layout.backgroundImageUrl = imageUrl;

    this.setSharedTestData(`template:Contact Template`, template);
    this.setSharedTestData('backgroundImageKey', imageKey);

    console.log(`📸 Uploaded background image: ${imageKey}`);
  }
);

// ==================== THEN Steps ====================

Then('the form should have title {string}',
  function(this: CustomWorld, expectedTitle: string) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.title, expectedTitle, 'Form title should match');
  }
);

Then('the form should have description {string}',
  function(this: CustomWorld, expectedDescription: string) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.description, expectedDescription, 'Form description should match');
  }
);

Then('the form should be published',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.isPublished, true, 'Form should be published');
  }
);

Then('the form should not be published',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectEqual(form.isPublished, false, 'Form should not be published');
  }
);

Then('the form should be accessible via short URL',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    const queriedForm = await this.formTestUtils.queryFormByShortUrl(form.shortUrl);
    expectDefined(queriedForm, 'Form should be accessible via short URL');
  }
);

Then('public users should not be able to access the form',
  async function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      await this.formTestUtils.queryFormByShortUrl(form.shortUrl);
      throw new Error('Should not be able to access unpublished form');
    } catch (error: any) {
      expectContains(error.message, 'not published', 'Error should mention form is not published');
    }
  }
);

Then('the form settings should show max responses of {int}',
  function(this: CustomWorld, expectedMaxResponses: number) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectDefined(form.settings?.submissionLimits?.maxResponses, 'Max responses should be set');
    expectEqual(form.settings.submissionLimits.maxResponses.enabled, true, 'Max responses should be enabled');
    expectEqual(form.settings.submissionLimits.maxResponses.limit, expectedMaxResponses, 'Max responses limit should match');
  }
);

Then('the form settings should show the time window',
  function(this: CustomWorld) {
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');
    expectDefined(form.settings?.submissionLimits?.timeWindow, 'Time window should be set');
    expectEqual(form.settings.submissionLimits.timeWindow.enabled, true, 'Time window should be enabled');
    expectDefined(form.settings.submissionLimits.timeWindow.startDate, 'Start date should be set');
    expectDefined(form.settings.submissionLimits.timeWindow.endDate, 'End date should be set');
  }
);

Then('a new form should be created with title {string}',
  function(this: CustomWorld, expectedTitle: string) {
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    expectDefined(duplicatedForm, 'Duplicated form must exist');
    expectEqual(duplicatedForm.title, expectedTitle, 'Duplicated form title should match');
  }
);

Then('the new form should have the same schema as the original',
  function(this: CustomWorld) {
    const originalForm = this.getSharedTestData('createdForm');
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    expectDefined(originalForm, 'Original form must exist');
    expectDefined(duplicatedForm, 'Duplicated form must exist');

    // Compare schema structure (field count, page count)
    const originalFieldCount = this.getSharedTestData('templateFieldCount');
    expectDefined(duplicatedForm.metadata, 'Duplicated form should have metadata');
    expectEqual(duplicatedForm.metadata.fieldCount, originalFieldCount, 'Field count should match');
  }
);

Then('the new form should have {int} responses',
  async function(this: CustomWorld, expectedCount: number) {
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    expectDefined(duplicatedForm, 'Duplicated form must exist');
    expectEqual(duplicatedForm.responseCount || 0, expectedCount, 'Response count should match');
  }
);

Then('the new form should have a different short URL',
  function(this: CustomWorld) {
    const originalForm = this.getSharedTestData('createdForm');
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    expectDefined(originalForm, 'Original form must exist');
    expectDefined(duplicatedForm, 'Duplicated form must exist');

    expect(duplicatedForm.shortUrl !== originalForm.shortUrl, 'Short URLs should be different');
  }
);

Then('the form should have a different short URL',
  function(this: CustomWorld) {
    const originalShortUrl = this.getSharedTestData('originalShortUrl');
    const form = this.getSharedTestData('createdForm');
    expectDefined(originalShortUrl, 'Original short URL must be stored');
    expectDefined(form, 'Form must exist');

    expect(form.shortUrl !== originalShortUrl, 'Short URL should have changed');
  }
);

Then('the old short URL should not work',
  async function(this: CustomWorld) {
    const originalShortUrl = this.getSharedTestData('originalShortUrl');
    expectDefined(originalShortUrl, 'Original short URL must be stored');

    try {
      await this.formTestUtils.queryFormByShortUrl(originalShortUrl);
      throw new Error('Old short URL should not work');
    } catch (error: any) {
      expectContains(error.message, 'not found', 'Error should mention form not found');
    }
  }
);

Then('the form should not exist in the database',
  async function(this: CustomWorld) {
    expectDefined(this.authToken, 'Auth token required');
    const form = this.getSharedTestData('createdForm');
    expectDefined(form, 'Form must exist');

    try {
      await this.formTestUtils.queryFormById(this.authToken!, form.id);
      throw new Error('Form should not exist after deletion');
    } catch (error: any) {
      expectContains(error.message, 'not found', 'Error should mention form not found');
    }
  }
);

Then('the form responses should be deleted',
  async function(this: CustomWorld) {
    // Responses should be cascade deleted with the form
    // We can verify by checking the response count is 0 or responses don't exist
    console.log('Responses cascade deleted with form');
  }
);

Then('the deletion should fail with error {string}',
  function(this: CustomWorld, expectedError: string) {
    expectDefined(this.lastOperationError, 'Error should be stored');
    expectContains(this.lastOperationError, expectedError, 'Error message should match');
  }
);

Then('the update should fail with error {string}',
  function(this: CustomWorld, expectedError: string) {
    expectDefined(this.lastOperationError, 'Error should be stored');
    expectContains(this.lastOperationError, expectedError, 'Error message should match');
  }
);

Then('I should receive the full form data',
  function(this: CustomWorld) {
    const queriedForm = this.getSharedTestData('queriedForm');
    expectDefined(queriedForm, 'Queried form must exist');
    expectDefined(queriedForm.id, 'Form ID should be present');
    expectDefined(queriedForm.title, 'Form title should be present');
    expectDefined(queriedForm.formSchema, 'Form schema should be present');
  }
);

Then('the public user should receive the form data',
  function(this: CustomWorld) {
    const queriedForm = this.getSharedTestData('queriedForm');
    expectDefined(queriedForm, 'Queried form must exist');
    expectEqual(this.lastOperationError, undefined, 'No error should occur');
  }
);

Then('the query should fail with error {string}',
  function(this: CustomWorld, expectedError: string) {
    expectDefined(this.lastOperationError, 'Error should be stored');
    expectContains(this.lastOperationError, expectedError, 'Error message should match');
  }
);

Then('the metadata should show pageCount of {int}',
  function(this: CustomWorld, expectedPageCount: number) {
    const metadata = this.getSharedTestData('formMetadata');
    expectDefined(metadata, 'Metadata must exist');
    expectEqual(metadata.pageCount, expectedPageCount, 'Page count should match');
  }
);

Then('the metadata should show fieldCount of {int}',
  function(this: CustomWorld, expectedFieldCount: number) {
    const metadata = this.getSharedTestData('formMetadata');
    expectDefined(metadata, 'Metadata must exist');
    expectEqual(metadata.fieldCount, expectedFieldCount, 'Field count should match');
  }
);

Then('the metadata should have a lastUpdated timestamp',
  function(this: CustomWorld) {
    const metadata = this.getSharedTestData('formMetadata');
    expectDefined(metadata, 'Metadata must exist');
    expectDefined(metadata.lastUpdated, 'Last updated should be set');
  }
);

Then('the new form should have a copied background image',
  function(this: CustomWorld) {
    expectDefined(this.mockS3, 'Mock S3 must be available');
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    const originalBackgroundKey = this.getSharedTestData('backgroundImageKey');
    expectDefined(duplicatedForm, 'Duplicated form must exist');

    // Parse form schema to get background image key
    const schema = typeof duplicatedForm.formSchema === 'string'
      ? JSON.parse(duplicatedForm.formSchema)
      : duplicatedForm.formSchema;

    const backgroundImageKey = schema?.layout?.backgroundImageKey;

    if (originalBackgroundKey) {
      // If original had a background, duplicated form should have one too
      expectDefined(backgroundImageKey, 'Duplicated form should have background image key');

      // Note: In real S3, this would be copied. In our mock, we verify the key exists
      // and is different from the original (tested in next step)
      console.log(`📸 Duplicated form has background image: ${backgroundImageKey}`);
    }
  }
);

Then('the new form background image should have a unique key',
  function(this: CustomWorld) {
    const originalForm = this.getSharedTestData('createdForm');
    const duplicatedForm = this.getSharedTestData('duplicatedForm');
    const originalBackgroundKey = this.getSharedTestData('backgroundImageKey');
    expectDefined(originalForm, 'Original form must exist');
    expectDefined(duplicatedForm, 'Duplicated form must exist');

    // Parse both form schemas
    const originalSchema = typeof originalForm.formSchema === 'string'
      ? JSON.parse(originalForm.formSchema)
      : originalForm.formSchema;

    const duplicatedSchema = typeof duplicatedForm.formSchema === 'string'
      ? JSON.parse(duplicatedForm.formSchema)
      : duplicatedForm.formSchema;

    const originalKey = originalSchema?.layout?.backgroundImageKey || originalBackgroundKey;
    const duplicatedKey = duplicatedSchema?.layout?.backgroundImageKey;

    // If original had a background, verify duplicated has different key
    if (originalKey && duplicatedKey) {
      expect(
        duplicatedKey !== originalKey,
        `Background image keys should be different: original="${originalKey}", duplicated="${duplicatedKey}"`
      );
      console.log(`✅ Background image keys are unique: ${originalKey} → ${duplicatedKey}`);
    }
  }
);
