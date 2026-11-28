/**
 * Per-form design tokens steps (docs/design-tokens-plan.md, Phase 7).
 *
 * Drives BrandStyleControls inside the builder's Design drawer and asserts the
 * published viewer picks the tokens up (`data-df-branded` wrapper + `--df-primary`
 * CSS var + submit button background). Reuses existing steps for sign-in, builder
 * open, rail Intro card, Design drawer open/close, reload, publish and viewer
 * navigation. Requires the `en` locale (control labels are matched by name).
 */

import { When, Then } from '@cucumber/cucumber';
import { expect, type Locator } from '@playwright/test';
import { CustomWorld } from '../support/world';
import { createFormViaGraphQL } from './helpers';

// Single page + single field, L1 (intro + CTA) so the viewer's only page shows
// the Submit button (not Next) once the CTA is clicked.
const designTokensFormSchema = () => ({
  layout: {
    theme: 'light',
    textColor: '#000000',
    spacing: 'normal',
    code: 'L1',
    content: '<h1>Design Tokens Test</h1>',
    customBackGroundColor: '#ffffff',
    backgroundImageKey: '',
    pageMode: 'multipage',
    isCustomBackgroundColorEnabled: false,
  },
  isShuffleEnabled: false,
  pages: [
    {
      id: 'tokens-page-1',
      title: 'Details',
      order: 0,
      fields: [
        {
          id: 'tokens-name',
          type: 'text_input_field',
          label: 'Your name',
          defaultValue: '',
          prefix: '',
          hint: '',
          placeholder: 'Type your name',
          validation: { required: false, type: 'text_field_validation' },
        },
      ],
    },
  ],
});

const brandControls = (world: CustomWorld): Locator => {
  if (!world.page) throw new Error('Page is not initialized');
  return world.page.getByTestId('design-drawer').getByTestId('brand-style-controls');
};

// Toggle groups are `role="group"` with aria-label = the control label.
const brandToggle = (world: CustomWorld, group: string, option: string): Locator =>
  brandControls(world)
    .getByRole('group', { name: group, exact: true })
    .getByRole('button', { name: option, exact: true });

const brandColorInput = (world: CustomWorld): Locator =>
  // Placeholder "#2563eb" is unique to the brand color field (surface uses "#ffffff").
  brandControls(world).getByPlaceholder('#2563eb', { exact: true });

When('I create a form via GraphQL for design tokens testing', async function (this: CustomWorld) {
  await createFormViaGraphQL(this, designTokensFormSchema(), 'E2E Design Tokens Test');
});

When(
  'I pick the brand color swatch {string} in the design drawer',
  async function (this: CustomWorld, hex: string) {
    await expect(brandControls(this)).toBeVisible({ timeout: 10_000 });
    await brandControls(this).getByRole('button', { name: hex, exact: true }).click();
    // The hex input mirrors the committed token — wait for it rather than sleeping.
    await expect(brandColorInput(this)).toHaveValue(hex, { timeout: 10_000 });
  }
);

When(
  'I set the brand style {string} to {string} in the design drawer',
  async function (this: CustomWorld, group: string, option: string) {
    const toggle = brandToggle(this, group, option);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  }
);

When(
  'I apply the {string} theme from the theme gallery',
  async function (this: CustomWorld, themeName: string) {
    await expect(brandControls(this)).toBeVisible({ timeout: 10_000 });
    const toggle = brandControls(this).getByTestId('theme-gallery-toggle');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const card = brandControls(this).getByRole('button', { name: themeName, exact: true });
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  }
);

When('I reset the brand style in the design drawer', async function (this: CustomWorld) {
  // The button is disabled while no tokens exist, so a successful click also
  // proves branding was actually present beforehand.
  const reset = brandControls(this).getByRole('button', { name: 'Reset brand style', exact: true });
  await expect(reset).toBeEnabled({ timeout: 10_000 });
  await reset.click();
  await expect(reset).toBeDisabled({ timeout: 10_000 });
});

Then(
  'the design drawer brand color should be {string}',
  async function (this: CustomWorld, hex: string) {
    await expect(brandControls(this)).toBeVisible({ timeout: 10_000 });
    await expect(brandColorInput(this)).toHaveValue(hex, { timeout: 10_000 });
  }
);

Then('the design drawer brand color should be empty', async function (this: CustomWorld) {
  await expect(brandColorInput(this)).toHaveValue('', { timeout: 10_000 });
});

Then(
  'the design drawer brand style {string} should be {string}',
  async function (this: CustomWorld, group: string, option: string) {
    await expect(brandToggle(this, group, option)).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10_000,
    });
  }
);

Then(
  'the viewer form should be branded with {string}',
  async function (this: CustomWorld, hex: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const wrapper = this.viewerPage.locator('[data-df-branded]').first();
    await expect(wrapper).toBeAttached({ timeout: 30_000 });
    await expect(wrapper).toHaveAttribute('style', new RegExp(`--df-primary:\\s*${hex}`, 'i'));
  }
);

Then('the viewer form should not be branded', async function (this: CustomWorld) {
  if (!this.viewerPage) throw new Error('Viewer page is not initialized');
  // Make sure the form actually rendered first so a loading state can't pass vacuously.
  await expect(this.viewerPage.getByTestId('viewer-submit-button')).toBeVisible({
    timeout: 30_000,
  });
  await expect(this.viewerPage.locator('[data-df-branded]')).toHaveCount(0);
});

Then(
  'the viewer submit button background color should be {string}',
  async function (this: CustomWorld, expectedRgb: string) {
    if (!this.viewerPage) throw new Error('Viewer page is not initialized');
    const submit = this.viewerPage.getByTestId('viewer-submit-button');
    await expect(submit).toBeVisible({ timeout: 30_000 });
    // toHaveCSS retries, so a colour transition settling is tolerated.
    await expect(submit).toHaveCSS('background-color', expectedRgb, { timeout: 10_000 });
  }
);
