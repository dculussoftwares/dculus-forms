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
  // Use the specific Zod error text, not /required/i which also matches the field label "Required File"
  await expect(
    this.viewerPage.locator('text=/Please upload at least one file/i').first()
  ).toBeVisible({ timeout: 5_000 });
});

When('I attach a file to the file upload field in viewer', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Both locator.setInputFiles() and fileChooser.setFiles() dispatch the change event via CDP
  // from outside the browser. On a display:none input in headless Chromium, the CDP-level
  // change event does NOT reach React 18's root-delegated synthetic event listener, so
  // cf.onChange is never called and RHF state (and Zod errors) stays unchanged.
  //
  // The fix: page.evaluate() runs inside the browser context. We construct a File object
  // there, inject it via DataTransfer, then dispatch a native bubbling change event.
  // React 18's delegated listener at the root container DOES receive native bubbling events,
  // fires the synthetic onChange, and cf.onChange([File]) clears the Zod required error.
  await this.viewerPage.evaluate(() => {
    const input = document.querySelector('[data-testid="file-upload-input-field-required"]') as HTMLInputElement;
    if (!input) throw new Error('file-upload-input-field-required not found in DOM');
    const file = new File(['E2E test file content'], 'test-document.txt', { type: 'text/plain' });
    const dt = new DataTransfer();
    dt.items.add(file);
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
  });
  await this.viewerPage.waitForTimeout(800);
});

Then('the file upload error should be cleared', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // After attaching a file the Zod required error should no longer be visible
  // Use the specific error text — /required/i also matches the field label "Required File"
  await expect(
    this.viewerPage.locator('text=/Please upload at least one file/i').first()
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
 * Create a form with a file-upload field with maxFiles: 2 (renders multiple=true on the input)
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
 * Attach 3 files to a field with maxFiles: 2.
 * The input renders with multiple=true (maxFiles > 1), so Playwright can pass multiple files.
 * The onFiles() filter slices to maxFiles: 2, so only the first 2 files are kept.
 */
When('I attach 3 files to the multi-file upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  await this.viewerPage.evaluate(() => {
    const input = document.querySelector('[data-testid="file-upload-input-field-maxfiles"]') as HTMLInputElement;
    if (!input) throw new Error('file-upload-input-field-maxfiles not found');
    const dt = new DataTransfer();
    dt.items.add(new File(['first'], 'first-file.txt', { type: 'text/plain' }));
    dt.items.add(new File(['second'], 'second-file.txt', { type: 'text/plain' }));
    dt.items.add(new File(['third'], 'third-file.txt', { type: 'text/plain' }));
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
  });
  await this.viewerPage.waitForTimeout(800);
});

/**
 * After attaching 3 files to a maxFiles:2 field, exactly 2 file chips should be visible.
 * FileChip renders a <span class="truncate"> — we count those within the viewer page.
 */
Then('only 2 files should be listed in the upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  const chips = this.viewerPage.locator('span.truncate');
  await expect(chips).toHaveCount(2, { timeout: 5_000 });
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
  // onFiles() MIME filter drops it (allowedMimeTypes = ['application/pdf']) — no chip appears.
  await this.viewerPage.evaluate(() => {
    const input = document.querySelector('[data-testid="file-upload-input-field-pdf"]') as HTMLInputElement;
    if (!input) throw new Error('file-upload-input-field-pdf not found');
    const dt = new DataTransfer();
    dt.items.add(new File(['plain text content'], 'document.txt', { type: 'text/plain' }));
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
  });
  await this.viewerPage.waitForTimeout(800);
});

/**
 * Attach a file that is larger than maxFileSizeMb: 0.001 (~1 KB limit).
 * The onFiles() size filter drops it — no file chip should appear.
 */
When('I attach an oversized file to the size-limited upload field', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // 2 KB content — exceeds the 0.001 MB (~1 KB) limit; onFiles() size filter drops it.
  await this.viewerPage.evaluate(() => {
    const input = document.querySelector('[data-testid="file-upload-input-field-size"]') as HTMLInputElement;
    if (!input) throw new Error('file-upload-input-field-size not found');
    const dt = new DataTransfer();
    dt.items.add(new File(['x'.repeat(2048)], 'big-file.txt', { type: 'text/plain' }));
    Object.defineProperty(input, 'files', { value: dt.files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: false }));
  });
  await this.viewerPage.waitForTimeout(800);
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
 * maxFiles: 2 → input renders with multiple=true → Playwright can setInputFiles with an array.
 * Attach 3 files; the onFiles() slice caps at 2.
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
            label: 'Two Files Max',
            hint: 'You may upload up to 2 files.',
            maxFileSizeMb: 10,
            maxFiles: 2,
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
