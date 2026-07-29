/**
 * Design drawer steps: the 🎨 Design canvas-toolbar button opening the global
 * layout/theme/spacing/background drawer that replaced the old Design tab's
 * LayoutSidebar. See epic #226, ticket #231.
 */

import { When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { CustomWorld } from '../support/world';

const ALL_LAYOUT_CODES = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'];

When('I click the canvas toolbar Design button', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.getByTestId('canvas-toolbar-design-button').click();
});

Then('the design drawer should be visible', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('design-drawer')).toBeVisible({ timeout: 10_000 });
});

Then(
  'the design drawer should show layout thumbnails for all 9 layouts',
  async function (this: CustomWorld) {
    if (!this.page) throw new Error('Page is not initialized');
    const drawer = this.page.getByTestId('design-drawer');
    for (const code of ALL_LAYOUT_CODES) {
      await expect(drawer.getByTestId(`layout-thumbnail-${code}`)).toBeVisible({
        timeout: 10_000,
      });
    }
  }
);

When(
  'I select layout {string} in the design drawer',
  async function (this: CustomWorld, layoutCode: string) {
    if (!this.page) throw new Error('Page is not initialized');
    // LayoutThumbnails is shared with IntroSettingsPanel behind the drawer — both
    // render the same `layout-thumbnail-<code>` testid, so scope to the drawer.
    const thumbnail = this.page
      .getByTestId('design-drawer')
      .getByTestId(`layout-thumbnail-${layoutCode}`);
    await thumbnail.click();
    // Wait for the click's effect (aria-pressed flip) rather than a flat sleep,
    // so the next step doesn't read the canvas before the store update lands.
    await expect(thumbnail).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  }
);

Then(
  'the design drawer layout {string} should be selected',
  async function (this: CustomWorld, layoutCode: string) {
    if (!this.page) throw new Error('Page is not initialized');
    await expect(
      this.page.getByTestId('design-drawer').getByTestId(`layout-thumbnail-${layoutCode}`)
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  }
);

Then('the design drawer layout thumbnails should be disabled', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(
    this.page.getByTestId('design-drawer').getByTestId('layout-thumbnail-L1')
  ).toBeDisabled({ timeout: 10_000 });
});

When('I close the design drawer', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await this.page.keyboard.press('Escape');
  await expect(this.page.getByTestId('design-drawer')).toHaveCount(0, { timeout: 10_000 });
});

Then('I should not see a CTA button in the canvas', async function (this: CustomWorld) {
  if (!this.page) throw new Error('Page is not initialized');
  await expect(this.page.getByTestId('viewer-cta-button')).toHaveCount(0, { timeout: 10_000 });
});
