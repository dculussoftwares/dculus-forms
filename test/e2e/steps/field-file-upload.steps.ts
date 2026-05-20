/**
 * File Upload field step definitions — builder settings and viewer client-side validation.
 *
 * IMPORTANT: The viewer tests do NOT perform actual S3/R2 uploads.
 *
 * How the FormFieldRenderer handles constraint violations:
 *   - Files exceeding maxFileSizeMb are SILENTLY DROPPED by the onFiles() filter
 *     before they enter react-hook-form state.
 *   - Files with unsupported MIME types are SILENTLY DROPPED by the same filter.
 *   - Files beyond maxFiles are SILENTLY TRUNCATED via .slice(0, maxFiles).
 *
 * This means the tests assert UI state (chip count / drop zone visibility) rather
 * than error message text for these three constraints.
 *
 * The validateFiles() error messages in FormViewer.tsx (size / MIME) are only
 * reachable when a File object bypasses the input filter — not through normal UI
 * interaction — so they are not tested here.
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
// GAP 3: INVALID BUILDER SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit with empty label → assert "Field label is required" error.
 */
Then('I test file upload label required validation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', '');
  await this.page.locator('#field-hint').click(); // blur to trigger onChange validation
  await expect(
    this.page.locator('text=/Field label is required/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

/**
 * Submit with label > 200 chars (Zod schema: max 200) → assert "Label is too long" error.
 */
Then('I test file upload label too long validation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', 'A'.repeat(201));
  await this.page.locator('#field-hint').click();
  await expect(
    this.page.locator('text=/Label is too long/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

/**
 * Submit with hint > 500 chars (Zod schema: max 500) → assert "Help text is too long" error.
 */
Then('I test file upload hint too long validation', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-hint', 'H'.repeat(501));
  await this.page.locator('#field-label').click();
  await expect(
    this.page.locator('text=/Help text is too long/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

/**
 * Fix all errors: set a valid label and clear the oversized hint, then blur
 * to re-trigger validation. The save button should become enabled.
 */
Then('I fix all validation errors for file upload', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.fill('#field-label', `Attachment Field ${Date.now()}`);
  await this.page.fill('#field-hint', 'Upload a file here.');
  await this.page.locator('#field-label').click(); // blur hint to clear its error
  await this.page.waitForTimeout(500);
});

// ─────────────────────────────────────────────────────────────────────────────
// GAP 2: VIEWER CONSTRAINT TESTS  (maxFiles / MIME / size — client-side filter)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a form with a single file-upload field restricted to maxFiles: 1
 */
When('I create a form via GraphQL with file upload maxFiles constraint', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, fileUploadMaxFilesSchema(), 'E2E File Upload MaxFiles Test');
});

/**
 * Create a form with a file-upload field restricted to allowedMimeTypes: ['application/pdf']
 */
When('I create a form via GraphQL with file upload PDF only constraint', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, fileUploadPdfOnlySchema(), 'E2E File Upload MIME Test');
});

/**
 * Create a form with a file-upload field restricted to maxFileSizeMb: 0.001 (~1 KB)
 */
When('I create a form via GraphQL with file upload size constraint', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, fileUploadSizeConstraintSchema(), 'E2E File Upload Size Test');
});

/**
 * Attach 2 files to a field whose drop zone id is "file-upload-input-field-maxfiles".
 * The onFiles() filter slices to maxFiles: 1, so only the first file is kept.
 */
When('I attach 2 files to the single-file upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const fileInput = this.viewerPage.locator('[data-testid="file-upload-input-field-maxfiles"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
  await fileInput.setInputFiles([
    { name: 'first-file.txt', mimeType: 'text/plain', buffer: Buffer.from('first') },
    { name: 'second-file.txt', mimeType: 'text/plain', buffer: Buffer.from('second') },
  ]);
  await this.viewerPage.waitForTimeout(500);
});

/**
 * After attaching 2 files to a maxFiles:1 field, exactly 1 file chip should be visible.
 * File chips are rendered as divs containing the file name inside a
 * data-testid="file-upload-drop-zone-*" sibling area — we count text nodes by
 * looking for the chip container (span.truncate) which the FileChip component renders.
 */
Then('only 1 file should be listed in the upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // FileChip renders a <span class="truncate"> with the file name.
  // We scope the search to the field's container (nearest ancestor above the drop zone).
  const chips = this.viewerPage.locator('span.truncate');
  await expect(chips).toHaveCount(1, { timeout: 5_000 });
});

/**
 * After maxFiles is reached the drop zone hides (total >= maxFiles).
 * data-testid="file-upload-drop-zone-field-maxfiles" should not be visible.
 */
Then('the upload drop zone should be hidden', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const dropZone = this.viewerPage.getByTestId('file-upload-drop-zone-field-maxfiles');
  await expect(dropZone).not.toBeVisible({ timeout: 5_000 });
});

/**
 * Attach a .txt file to a field that only accepts application/pdf.
 * The onFiles() MIME filter drops it — no file chip should appear.
 */
When('I attach a txt file to the PDF-only upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const fileInput = this.viewerPage.locator('[data-testid="file-upload-input-field-pdf"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
  await fileInput.setInputFiles({
    name: 'document.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('This is a plain text file.'),
  });
  await this.viewerPage.waitForTimeout(500);
});

/**
 * Attach a file that is larger than maxFileSizeMb: 0.001 (~1 KB limit).
 * The onFiles() size filter drops it — no file chip should appear.
 */
When('I attach an oversized file to the size-limited upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const fileInput = this.viewerPage.locator('[data-testid="file-upload-input-field-size"]');
  await expect(fileInput).toBeAttached({ timeout: 10_000 });
  // 2 KB content — exceeds the 0.001 MB (~1 KB) limit
  const oversizedContent = Buffer.alloc(2048, 'x');
  await fileInput.setInputFiles({
    name: 'big-file.txt',
    mimeType: 'text/plain',
    buffer: oversizedContent,
  });
  await this.viewerPage.waitForTimeout(500);
});

/**
 * Assert no file chip is visible (the file was silently dropped by the filter).
 */
Then('no file should be listed in the upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // FileChip renders span.truncate — there should be none
  const chips = this.viewerPage.locator('span.truncate');
  await expect(chips).toHaveCount(0, { timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// FORM SCHEMAS  (inline, mirrors the pattern in field.steps.ts)
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

/**
 * Schema for maxFiles constraint test.
 * field id "field-maxfiles" → data-testid="file-upload-input-field-maxfiles"
 *                           → data-testid="file-upload-drop-zone-field-maxfiles"
 */
function fileUploadMaxFilesSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>Max Files Test</h1>',
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
            id: 'field-maxfiles',
            type: 'file_upload_field',
            label: 'Single File Only',
            hint: 'You may only upload 1 file.',
            maxFileSizeMb: 10,
            maxFiles: 1,
            allowedMimeTypes: [],
            validation: { required: false },
          },
        ],
      },
    ],
  };
}

/**
 * Schema for MIME type constraint test.
 * field id "field-pdf" → data-testid="file-upload-input-field-pdf"
 */
function fileUploadPdfOnlySchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>PDF Only Test</h1>',
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
            id: 'field-pdf',
            type: 'file_upload_field',
            label: 'PDF Files Only',
            hint: 'Only PDF files are accepted.',
            maxFileSizeMb: 10,
            maxFiles: 3,
            allowedMimeTypes: ['application/pdf'],
            validation: { required: false },
          },
        ],
      },
    ],
  };
}

/**
 * Schema for file size constraint test.
 * maxFileSizeMb: 0.001 ≈ 1 KB — any file larger than ~1 KB is rejected.
 * field id "field-size" → data-testid="file-upload-input-field-size"
 */
function fileUploadSizeConstraintSchema() {
  return {
    layout: {
      theme: 'light',
      textColor: '#000000',
      spacing: 'normal',
      code: 'L9',
      content: '<h1>File Size Limit Test</h1>',
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
            id: 'field-size',
            type: 'file_upload_field',
            label: 'Tiny Files Only',
            hint: 'Maximum file size is ~1 KB.',
            maxFileSizeMb: 0.001,
            maxFiles: 3,
            allowedMimeTypes: [],
            validation: { required: false },
          },
        ],
      },
    ],
  };
}
