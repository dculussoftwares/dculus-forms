/**
 * File Upload field step definitions — builder settings and viewer client-side validation.
 *
 * IMPORTANT: The viewer test does NOT perform an actual S3/R2 upload.
 * It only exercises client-side required-field validation:
 *   1. Submit without a file  → error appears
 *   2. Attach a file via setInputFiles → error clears
 *   3. Submit succeeds (GraphQL mutation fires, no real upload attempted
 *      because CI has no storage backend — the test stops at the UI layer)
 *
 * The form schema used for the viewer test sets `maxFileSizeMb: 1` and
 * `allowedMimeTypes: []` (any type) to keep the constraint simple.
 */

import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { addFieldToPage, openLastFieldSettings, createFormViaGraphQL } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// DRAG / OPEN-SETTINGS STEPS
// ─────────────────────────────────────────────────────────────────────────────

Then('I drag a file upload field onto the page', async function (this: CustomWorld) {
  await addFieldToPage(this, 'field-type-file-upload');
});

When('I open the file upload field settings', async function (this: CustomWorld) {
  await openLastFieldSettings(this);
});

// ─────────────────────────────────────────────────────────────────────────────
// BUILDER SETTINGS STEPS
// ─────────────────────────────────────────────────────────────────────────────

Then('I fill the file upload field settings with valid data', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.waitForSelector('#field-label', { timeout: 10_000 });
  await this.page.fill('#field-label', `Attachment Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Upload your document here.');
  // Set max file size to 5 MB
  await this.page.fill('#field-maxFileSizeMb', '5');
  // Set max files to 1
  await this.page.fill('#field-maxFiles', '1');
  // Toggle the required checkbox using the id used in FieldSettingsV2
  const req = this.page.locator('#file-upload-required');
  if (!await req.isChecked()) await req.click();
  await expect(this.page.locator('#field-label')).toHaveValue(/Attachment/);
});

Then('I save the file upload field settings', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByRole('button', { name: /save/i }).click();
  await this.page.waitForTimeout(1_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// GRAPHQL FORM CREATION STEP
// ─────────────────────────────────────────────────────────────────────────────

When('I create a form via GraphQL with file upload field', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, fileUploadSchema(), 'E2E File Upload Validation Test');
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEWER VALIDATION STEPS  (client-side only — no real S3 upload)
// ─────────────────────────────────────────────────────────────────────────────

When('I test required validation for file upload in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Submit without attaching any file — required error must appear
  await this.viewerPage.getByTestId('viewer-submit-button').click();
  await this.viewerPage.waitForTimeout(500);
  await expect(
    this.viewerPage.locator('text=/required/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

When('I attach a file to the file upload field in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Locate the hidden file input injected by FormFieldRenderer for the required field
  const fileInput = this.viewerPage.locator('[data-testid="file-upload-input-field-required"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
  // Use setInputFiles to attach a small in-memory text file — no S3 call is made here;
  // the file merely enters the react-hook-form state so validation clears.
  await fileInput.setInputFiles({
    name: 'test-document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('E2E test file content'),
  });
  await this.viewerPage.waitForTimeout(500);
});

Then('the file upload error should be cleared', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // After attaching a file the required error should no longer be visible
  await expect(
    this.viewerPage.locator('text=/required/i').first()
  ).not.toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SCHEMA  (inline, mirrors the pattern in field.steps.ts)
// ─────────────────────────────────────────────────────────────────────────────

function fileUploadSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>File Upload Test</h1>',
      customBackGroundColor: '#ffffff',
      backgroundImageKey: '',
      pageMode: 'multipage',
      isCustomBackgroundColorEnabled: false,
    },
    pages: [
      {
        id: 'page-1',
        title: 'Page',
        fields: [
          {
            id: 'field-required',
            type: 'file_upload_field',
            label: 'Required File',
            hint: 'Upload a file to continue.',
            maxFileSizeMb: 1,
            maxFiles: 1,
            allowedMimeTypes: [],
            validation: { required: true },
          },
        ],
      },
    ],
  };
}
