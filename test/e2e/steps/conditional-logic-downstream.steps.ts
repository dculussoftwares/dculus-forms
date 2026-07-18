/**
 * Downstream surface steps for conditional logic E2E tests (Issue #137)
 *
 * Checks that after 3 real form submissions (1 fully visible, 1 field hidden,
 * 1 page hidden) the downstream surfaces behave correctly:
 *  - Responses table: stripped cells show "No response" fallback
 *  - Individual response detail panel: opens without crashes
 *  - Excel export: stripped columns have empty cells in the file
 *  - Field analytics: response count matches visible-only submissions
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';
import ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';

// ─────────────────────────────────────────────────────────────────────────────
// Viewer navigation — reuse the existing viewerPage context
// ─────────────────────────────────────────────────────────────────────────────

When('I navigate to the form viewer with the short URL again', async function (this: CustomWorld) {
  if (!this.formShortUrl) throw new Error('Form short URL is not set');

  // If viewerPage exists but is closed, create a fresh one in the same context
  if (!this.viewerPage || this.viewerPage.isClosed()) {
    if (!this.browser) throw new Error('Browser is not initialized');
    const { chromium } = await import('playwright');
    void chromium; // satisfy lint
    const viewerContext = await this.browser.newContext({
      baseURL: this.formViewerUrl,
      viewport: { width: 1280, height: 720 },
    });
    this.viewerPage = await viewerContext.newPage();
  }

  // Navigate back to the start of the form viewer
  await this.viewerPage.goto(`/f/${this.formShortUrl}`);
  await this.viewerPage.waitForSelector(
    '[data-testid="form-viewer-loading"], [data-testid="form-viewer-error"], [data-testid="form-viewer-renderer"]',
    { timeout: 30_000 }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Responses page navigation (uses this.currentFormId, not module-level var)
// ─────────────────────────────────────────────────────────────────────────────

When('I navigate to the downstream form responses page', async function (this: CustomWorld) {
  if (!this.page || !this.currentFormId) {
    throw new Error('Page or form ID is not initialized in CustomWorld');
  }
  await this.page.goto(`${this.baseUrl}/dashboard/form/${this.currentFormId}/responses`);
  await this.page.waitForTimeout(2000);
  const responsesTable = this.page.getByTestId('responses-table');
  await expect(responsesTable).toBeVisible({ timeout: 30_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// Responses table
// ─────────────────────────────────────────────────────────────────────────────

Then(
  'I should see the responses table with 3 responses and correct stripped cells',
  async function (this: CustomWorld) {
    if (!this.page) throw new Error('Page is not initialized');

    const responsesTable = this.page.getByTestId('responses-table');
    await expect(responsesTable).toBeVisible({ timeout: 30_000 });

    // Wait for rows to settle
    await this.page.waitForTimeout(2000);

    const tableRows = responsesTable.locator('tbody tr');
    await expect(tableRows).toHaveCount(3, { timeout: 30_000 });

    // Collect header column indices for cond-bonus and cond-details
    const headers = await this.page
      .locator('[data-testid="responses-table"] thead tr th')
      .allTextContents();

    const bonusColIndex = headers.findIndex(h => h.includes('Bonus Field'));
    const detailsColIndex = headers.findIndex(h => h.includes('Details Text'));

    expect(bonusColIndex, 'Bonus Field column not found in responses table').toBeGreaterThanOrEqual(0);
    expect(detailsColIndex, 'Details Text column not found in responses table').toBeGreaterThanOrEqual(0);

    // Gather all row values for these two columns
    const rowValues: Array<{ bonus: string; details: string }> = [];
    for (let i = 0; i < 3; i++) {
      const row = tableRows.nth(i);
      const cells = await row.locator('td').allTextContents();
      rowValues.push({
        bonus: cells[bonusColIndex]?.trim() ?? '',
        details: cells[detailsColIndex]?.trim() ?? '',
      });
    }

    // Response 1 (field hidden): bonus = "No response", details has value
    const hasFieldHiddenRow = rowValues.some(r =>
      r.bonus.toLowerCase().includes('no response') &&
      r.details.includes('details field hidden')
    );
    // Response 3 (page hidden): bonus has value, details = "No response"
    const hasPageHiddenRow = rowValues.some(r =>
      r.bonus.includes('bonus page hidden') &&
      r.details.toLowerCase().includes('no response')
    );
    // Response 1 (all visible): both have values
    const hasFullyVisibleRow = rowValues.some(r =>
      r.bonus.includes('bonus visible') &&
      r.details.includes('details visible')
    );

    expect(hasFieldHiddenRow, `Expected a row with field hidden (No response for bonus). Rows: ${JSON.stringify(rowValues)}`).toBe(true);
    expect(hasPageHiddenRow, `Expected a row with page hidden (No response for details). Rows: ${JSON.stringify(rowValues)}`).toBe(true);
    expect(hasFullyVisibleRow, `Expected a row with all visible. Rows: ${JSON.stringify(rowValues)}`).toBe(true);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Individual response detail panel
// ─────────────────────────────────────────────────────────────────────────────

Then('I open the detail panel for each response and verify no crashes', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  const tableRows = this.page.locator('[data-testid="responses-table"] tbody tr');
  const count = await tableRows.count();

  for (let i = 0; i < count; i++) {
    // Re-query rows each time since clicking might trigger re-renders
    const row = this.page.locator('[data-testid="responses-table"] tbody tr').nth(i);
    await row.click();

    // Detail panel / sheet should open
    const sheet = this.page.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 15_000 });

    // Confirm no error occurred — panel contains some content (e.g. Response ID label)
    await expect(sheet.locator('text=/Response ID|Submission|#/i').first()).toBeVisible({
      timeout: 10_000,
    });

    // Close the panel
    await this.page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0, { timeout: 10_000 });
    await this.page.waitForTimeout(400);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Excel export
// ─────────────────────────────────────────────────────────────────────────────

Then('I export responses as Excel and parse the file', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  // Make sure we're on the responses page
  const responsesTable = this.page.getByTestId('responses-table');
  await expect(responsesTable).toBeVisible({ timeout: 15_000 });

  // Open the Export dropdown
  const exportBtn = this.page
    .getByRole('button', { name: /export/i })
    .filter({ hasNot: this.page.locator('[disabled]') })
    .first();
  await expect(exportBtn).toBeVisible({ timeout: 15_000 });
  await exportBtn.click();

  // Click "Export as Excel" menu item and capture the download
  const downloadPromise = this.page.waitForEvent('download', { timeout: 60_000 });
  await this.page.getByRole('menuitem', { name: /Export as Excel/i }).click();
  const download = await downloadPromise;

  // Save the downloaded file
  const resultsDir = path.join(process.cwd(), 'test-results', 'e2e');
  fs.mkdirSync(resultsDir, { recursive: true });
  const destPath = path.join(resultsDir, `export-cond-logic-${Date.now()}.xlsx`);
  await download.saveAs(destPath);

  // Parse the Excel workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(destPath);
  const worksheet = workbook.getWorksheet(1);
  expect(worksheet, 'Worksheet 1 not found in Excel export').toBeTruthy();

  // Locate Bonus Field and Details Text columns in the header row
  let bonusColIndex = -1;
  let detailsColIndex = -1;
  const headerRow = worksheet!.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value ?? '');
    if (val.includes('Bonus Field')) bonusColIndex = colNumber;
    if (val.includes('Details Text')) detailsColIndex = colNumber;
  });

  expect(bonusColIndex, 'Bonus Field not found in Excel header row').toBeGreaterThan(0);
  expect(detailsColIndex, 'Details Text not found in Excel header row').toBeGreaterThan(0);

  // Collect data rows (row 1 is header)
  const dataRows: Array<{ bonus: string; details: string }> = [];
  worksheet!.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const bonusVal = String(row.getCell(bonusColIndex).value ?? '');
    const detailsVal = String(row.getCell(detailsColIndex).value ?? '');
    dataRows.push({ bonus: bonusVal, details: detailsVal });
  });

  expect(dataRows.length, 'Expected 3 data rows in Excel export').toBe(3);

  // Assert that the stripped responses have empty cells
  const hasFullyVisible = dataRows.some(r =>
    r.bonus === 'bonus visible' && r.details === 'details visible'
  );
  const hasFieldHidden = dataRows.some(r =>
    r.bonus === '' && r.details === 'details field hidden'
  );
  const hasPageHidden = dataRows.some(r =>
    r.bonus === 'bonus page hidden' && r.details === ''
  );

  expect(hasFullyVisible, `Excel: expected a fully-visible row. Rows: ${JSON.stringify(dataRows)}`).toBe(true);
  expect(hasFieldHidden, `Excel: expected an empty Bonus Field cell when hidden. Rows: ${JSON.stringify(dataRows)}`).toBe(true);
  expect(hasPageHidden, `Excel: expected an empty Details Text cell when page hidden. Rows: ${JSON.stringify(dataRows)}`).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Field analytics
// ─────────────────────────────────────────────────────────────────────────────

When('I navigate to the form analytics page', async function (this: CustomWorld) {
  if (!this.page || !this.currentFormId) {
    throw new Error('Page or form ID is not initialized');
  }
  // Navigate to the FormAnalytics page with the Fields tab active
  await this.page.goto(
    `${this.baseUrl}/dashboard/form/${this.currentFormId}/analytics?tab=fields`
  );
  // Wait for the page to load the analytics content
  await this.page.waitForTimeout(3000);
});

Then('I open the fields tab in analytics', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');

  // Click the "Field Insights" tab button to activate it
  const fieldInsightsTab = this.page.getByRole('button', { name: /Field Insights/i });
  await expect(fieldInsightsTab).toBeVisible({ timeout: 15_000 });
  await fieldInsightsTab.click();
  await this.page.waitForTimeout(2000);
});

Then(
  'the analytics for {string} should show {int} responses',
  async function (this: CustomWorld, fieldLabel: string, expectedCount: number) {
    if (!this.page) throw new Error('Page is not initialized');

    // Wait for the field grid cards to render
    await this.page.waitForTimeout(3000);

    const actualCount = await this.page.evaluate((label) => {
      const divs = Array.from(document.querySelectorAll('div'));
      // Find the div that has the exact field label text
      const labelDiv = divs.find(d => {
        // Only match divs that don't have child divs to find the leaf text element
        return d.textContent?.trim() === label && d.querySelector('div') === null;
      }) || divs.find(d => d.textContent?.trim() === label);

      if (!labelDiv) return -1;

      // Find the card container
      const card = labelDiv.closest('[class*="cursor-pointer"]');
      if (!card) return -2;

      // Find the "Responses" text div inside this card
      const cardDivs = Array.from(card.querySelectorAll('div'));
      const respDiv = cardDivs.find(d => d.textContent?.trim() === 'Responses');
      if (!respDiv) return -3;

      // The count is the sibling div immediately following it
      const countDiv = respDiv.nextElementSibling;
      if (!countDiv) return -4;

      return parseInt(countDiv.textContent?.trim() ?? '', 10);
    }, fieldLabel);

    expect(
      actualCount,
      `Analytics for "${fieldLabel}": expected ${expectedCount} responses but got ${actualCount}`
    ).toBe(expectedCount);
  }
);
