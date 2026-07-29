/**
 * Journey rail steps: Intro / Pages / Thank You selection driving the canvas + URL,
 * plus page reorder via the rail and the VIEWER read-only rail. See epic #226,
 * ticket #228.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect, type Locator, type Page } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { dragOnto, selectFirstMentionOption } from './helpers/common';

// A prefix-based CSS selector (`[data-testid^="rail-page-"]`) also matches every
// nested testid that happens to share the prefix (rail-page-title-<n>,
// rail-page-header-<n>, rail-page-drag-handle-<n>, ...) — match the group
// container's exact testid shape instead so this can't collide with new ones.
const railPageGroupByTitle = (page: Page, title: string): Locator =>
  page
    .getByTestId(/^rail-page-\d+$/)
    .filter({ has: page.getByText(title, { exact: true }) });

When('I click the rail Intro card', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('rail-intro').click();
});

When('I click the rail Thank You card', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('rail-thankyou').click();
});

When('I click the rail page {string}', async function (this: CustomWorld, pageTitle: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const group = railPageGroupByTitle(this.page, pageTitle);
  await expect(group).toBeVisible({ timeout: 10_000 });
  // Click the header row, not the title text itself — the title has its own
  // click handler (rename, for editors) that stops propagation.
  await group.locator('[data-testid^="rail-page-header-"]').click();
});

When('I click the rail field chip {string}', async function (this: CustomWorld, fieldLabel: string) {
  if (!this.page) throw new Error('Page is not initialized');
  // hasText does a substring match, which would also match "Show bonus field?"
  // when looking for "Bonus Field" — require an exact label match instead.
  const chip = this.page
    .locator('[data-testid^="rail-field-"]')
    .filter({ has: this.page.getByText(fieldLabel, { exact: true }) });
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await chip.click();
});

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

Then(
  'the builder URL should contain {string}',
  async function (this: CustomWorld, substring: string) {
    if (!this.page) throw new Error('Page is not initialized');
    // page.url() returns the raw (percent-encoded) URL, and URLSearchParams
    // encodes ":" as "%3A" in query values (e.g. screen=page:<id>) — accept either.
    const pattern = escapeRegExp(substring).replace(/:/g, '(:|%3A)');
    await expect(this.page).toHaveURL(new RegExp(pattern), { timeout: 10_000 });
  }
);

Then('the rail Intro card should be selected', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-intro')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 10_000,
  });
});

Then('the rail Thank You card should be selected', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-thankyou')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 10_000,
  });
});

Then('I should see the intro screen in the canvas', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('viewer-cta-button')).toBeVisible({ timeout: 10_000 });
});

Then('I should see the thank you screen in the canvas', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('thank-you-display')).toBeVisible({ timeout: 10_000 });
});

Then(
  'I should see the field {string} in the canvas',
  async function (this: CustomWorld, fieldLabel: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const canvas = this.page.getByTestId('droppable-page');
    // The field card shows the label both as its own truncated title and inside its
    // live input preview (e.g. a <label> for the rendered control) — both are valid
    // evidence the field is here, so just check the first match is visible.
    await expect(canvas.getByText(fieldLabel, { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  }
);

Then('the field settings panel should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('field-settings-panel')).toBeVisible({ timeout: 10_000 });
});

Then(
  'the rail pages should be in order {string}',
  async function (this: CustomWorld, expectedCsv: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const expected = expectedCsv.split(',').map((s) => s.trim());
    // Precise testid match: "rail-page-title-" is also a prefix of
    // rail-page-title-input-<n> (the rename input, rendered only while editing).
    const titles = this.page.getByTestId(/^rail-page-title-\d+$/);
    await expect(titles).toHaveCount(expected.length, { timeout: 10_000 });
    await expect(titles).toHaveText(expected, { timeout: 10_000 });
  }
);

When(
  'I drag rail page {string} onto rail page {string}',
  async function (this: CustomWorld, sourceTitle: string, targetTitle: string) {
    if (!this.page) throw new Error('Page is not initialized');
    const source = railPageGroupByTitle(this.page, sourceTitle).locator(
      '[data-testid^="rail-page-drag-handle-"]'
    );
    const target = railPageGroupByTitle(this.page, targetTitle);
    await dragOnto(source, target);
  }
);

Then('I should not see the rail add content button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('rail-add-content-button')).toHaveCount(0);
});

Then('I should not see the rail add page button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('add-page-button')).toHaveCount(0);
});

Then('I should not see any rail page drag handles', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.locator('[data-testid^="rail-page-drag-handle-"]')).toHaveCount(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Contextual right panels (ticket #229) — Intro / Ending / Page settings that
// the journey rail now drives, replacing the old Design tab's LayoutSidebar
// for CTA text and background editing.
// ─────────────────────────────────────────────────────────────────────────────

Then('the intro settings panel should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('intro-settings-panel')).toBeVisible({ timeout: 10_000 });
});

Then(
  'the CTA button in the canvas should show {string}',
  async function (this: CustomWorld, expectedText: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(this.page.getByTestId('viewer-cta-button')).toHaveText(expectedText, {
      timeout: 10_000,
    });
  }
);

When('I set the intro button text to {string}', async function (this: CustomWorld, text: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const input = this.page.getByTestId('intro-cta-button-input');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(text);
  // Give the store update a moment to propagate to the canvas render before
  // the next step reads it back.
  await this.page.waitForTimeout(300);
});

Then('the intro button text input should be disabled', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('intro-cta-button-input')).toBeDisabled({ timeout: 10_000 });
});

Then('the ending settings panel should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('ending-settings-panel')).toBeVisible({ timeout: 10_000 });
});

Then('I should see the ending message save button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('ending-message-save')).toBeVisible({ timeout: 10_000 });
});

Then('I should not see the ending message save button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('ending-message-save')).toHaveCount(0, { timeout: 10_000 });
});

/**
 * The Ending panel's rich-text editor has no dedicated testid of its own (only
 * the panel container does) — scope the contenteditable lookup to
 * `ending-settings-panel`, mirroring how thank-you-settings.steps.ts scopes
 * the canvas's own inline editor under `thank-you-message`.
 */
async function endingContentEditable(world: CustomWorld) {
  if (!world.page) throw new Error('Page is not initialized');
  const panel = world.page.getByTestId('ending-settings-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });
  const editable = panel.locator('[contenteditable="true"]');
  await expect(editable).toBeVisible({ timeout: 10_000 });
  return editable;
}

When('I edit the ending message to {string}', async function (this: CustomWorld, message: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const editable = await endingContentEditable(this);

  await editable.click({ clickCount: 3 });
  await this.page.keyboard.press('Backspace');
  await this.page.waitForTimeout(150);
  await this.page.keyboard.type(message, { delay: 20 });
  await this.page.waitForTimeout(300);
});

When('I save the ending message', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const saveButton = this.page.getByTestId('ending-message-save');
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await saveButton.click();
  await expect(this.page.getByTestId('ending-message-save')).toHaveCount(0, { timeout: 10_000 });
  // Give the Y.js/Hocuspocus flush a moment to land before a caller reloads —
  // same guard thank-you-settings.steps.ts uses after its own save.
  await this.page.waitForTimeout(800);
});

/**
 * Add a field mention to the Ending panel's message (@-mention picker, same
 * RichTextEditor/mentionFields plumbing as the canvas's inline editor used to
 * have) and save. Replaces thank-you-settings.steps.ts's old
 * "I add a field mention to the thank you message" step, which drove the
 * removed Layout tab's inline editor.
 */
When('I add a field mention to the ending message', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const editable = await endingContentEditable(this);

  await editable.click({ clickCount: 3 });
  await this.page.keyboard.press('Backspace');
  await this.page.waitForTimeout(200);

  await this.page.keyboard.type('Thank you ', { delay: 50 });
  await this.page.keyboard.type('@', { delay: 50 });
  await selectFirstMentionOption(this.page);
  await this.page.keyboard.type(' for your submission!', { delay: 30 });
  await this.page.waitForTimeout(500);

  const saveButton = this.page.getByTestId('ending-message-save');
  await expect(saveButton).toBeVisible({ timeout: 5_000 });
  await saveButton.click();
  await expect(this.page.getByTestId('ending-message-save')).toHaveCount(0, { timeout: 10_000 });
  await this.page.waitForTimeout(800);
});

When('I cancel the ending message edit', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  const cancelButton = this.page.getByTestId('ending-message-cancel');
  await expect(cancelButton).toBeVisible({ timeout: 5_000 });
  await cancelButton.click();
  await expect(this.page.getByTestId('ending-message-save')).toHaveCount(0, { timeout: 10_000 });
});

Then('the page settings panel should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('page-settings-panel')).toBeVisible({ timeout: 10_000 });
});

Then(
  'the page settings title input should have value {string}',
  async function (this: CustomWorld, expectedValue: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(this.page.getByTestId('page-settings-title-input')).toHaveValue(expectedValue, {
      timeout: 10_000,
    });
  }
);

When('I set the page settings title to {string}', async function (this: CustomWorld, title: string) {
  if (!this.page) throw new Error('Page is not initialized');
  const input = this.page.getByTestId('page-settings-title-input');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(title);
  await this.page.waitForTimeout(300);
});

Then('the page settings title input should be disabled', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('page-settings-title-input')).toBeDisabled({ timeout: 10_000 });
});

Then('I should not see the page settings duplicate button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('page-settings-duplicate')).toHaveCount(0, { timeout: 10_000 });
});

Then('I should not see the page settings delete button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('page-settings-delete')).toHaveCount(0, { timeout: 10_000 });
});
