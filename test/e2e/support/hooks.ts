import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { CustomWorld } from './world';
import { hasStoredAuthState, STORAGE_STATE_PATH } from './authStorage';

setDefaultTimeout(120 * 1000);

Before(async function (this: CustomWorld) {
  this.browser = await chromium.launch({ headless: this.headless });
  this.context = await this.browser.newContext({
    baseURL: this.baseUrl,
    storageState: hasStoredAuthState() ? STORAGE_STATE_PATH : undefined,
    viewport: { width: 1280, height: 720 },
  });
  this.page = await this.context.newPage();
});

After(async function (this: CustomWorld, scenario) {
  if (scenario.result?.status === 'FAILED') {
    const screenshotPath = `test-results/screenshots/${scenario.pickle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    await this.page?.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);
    
    // Also log current URL
    const url = this.page?.url();
    console.log(`Failed at URL: ${url}`);
  }

  await this.page?.close();
  await this.context?.close();
  await this.browser?.close();
});
